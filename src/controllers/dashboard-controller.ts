// src/controllers/dashboard-controller.ts
import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../lib/prisma'
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays } from 'date-fns'

export class DashboardController {
  async getDashboardStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const hoje = new Date()
      const inicioHoje = startOfDay(hoje)
      const fimHoje = endOfDay(hoje)
      const inicioMes = startOfMonth(hoje)
      const fimMes = endOfMonth(hoje)
      const ontem = subDays(hoje, 1)
      const inicioOntem = startOfDay(ontem)
      const fimOntem = endOfDay(ontem)

      // Buscar todas as estatísticas em paralelo
      const [
        totalSenhasHoje,
        senhasOntem,
        senhasPorPrioridade,
        senhasAguardando,
        atendimentosFinalizadosHoje,
        pacientesUnicosHoje,
        tempoMedioEsperaHoje,
        totalSenhasMes
      ] = await Promise.all([
        // Total de senhas emitidas hoje
        prisma.senha.count({
          where: {
            emitidaEm: {
              gte: inicioHoje,
              lt: fimHoje
            }
          }
        }),

        // Total de senhas ontem (para cálculo de crescimento)
        prisma.senha.count({
          where: {
            emitidaEm: {
              gte: inicioOntem,
              lt: fimOntem
            }
          }
        }),

        // Senhas por prioridade (apenas ativas na fila)
        prisma.senha.groupBy({
          by: ['prioridade'],
          where: {
            status: {
              in: ['AGUARDANDO', 'CHAMANDO', 'EM_ATENDIMENTO']
            }
          },
          _count: true
        }),

        // Total aguardando
        prisma.senha.count({
          where: {
            status: {
              in: ['AGUARDANDO', 'CHAMANDO']
            }
          }
        }),

        // Atendimentos finalizados hoje
        prisma.senha.count({
          where: {
            status: 'ATENDIDO',
            finalizadaEm: {
              gte: inicioHoje,
              lt: fimHoje
            }
          }
        }),

        // Pacientes únicos atendidos hoje
        prisma.senha.findMany({
          where: {
            emitidaEm: {
              gte: inicioHoje,
              lt: fimHoje
            }
          },
          select: {
            pacienteId: true
          },
          distinct: ['pacienteId']
        }),

        // Calcular tempo médio de espera HOJE
        this.calcularTempoMedioEspera(inicioHoje, fimHoje),

        // Total de senhas este mês
        prisma.senha.count({
          where: {
            emitidaEm: {
              gte: inicioMes,
              lt: fimMes
            }
          }
        })
      ])

      // Processar dados das prioridades
      const prioridadesCount = {
        MUITO_URGENTE: 0,
        URGENTE: 0,
        POUCO_URGENTE: 0
      }

      senhasPorPrioridade.forEach(item => {
        prioridadesCount[item.prioridade as keyof typeof prioridadesCount] = item._count
      })

      // Buscar próximo paciente a ser chamado
      const proximoPaciente = await prisma.senha.findFirst({
        where: {
          status: 'EM_ATENDIMENTO'
        },
        include: {
          paciente: {
            select: {
              nomeCompleto: true,
              idade: true
            }
          }
        },
        orderBy: {
          iniciadaEm: 'desc'
        }
      })

      // Calcular crescimento em relação a ontem
      const crescimento = senhasOntem > 0 
        ? ((totalSenhasHoje - senhasOntem) / senhasOntem * 100)
        : totalSenhasHoje > 0 ? 100 : 0

      const stats = {
        senhasHoje: {
          total: totalSenhasHoje,
          crescimento: `${crescimento > 0 ? '+' : ''}${crescimento.toFixed(1)}%`
        },
        prioridades: prioridadesCount,
        filaAtual: {
          aguardando: senhasAguardando,
          emAtendimento: prioridadesCount.MUITO_URGENTE + prioridadesCount.URGENTE + prioridadesCount.POUCO_URGENTE - senhasAguardando
        },
        atendimentos: {
          finalizados: atendimentosFinalizadosHoje,
          pacientesUnicos: pacientesUnicosHoje.length
        },
        tempoMedio: {
          espera: tempoMedioEsperaHoje,
          unidade: 'minutos'
        },
        totalSenhasMes: totalSenhasMes,
        proximoPaciente: proximoPaciente ? {
          nome: proximoPaciente.paciente.nomeCompleto,
          codigo: proximoPaciente.codigo,
          idade: proximoPaciente.paciente.idade,
          tempoAtendimento: proximoPaciente.iniciadaEm 
            ? Math.floor((new Date().getTime() - proximoPaciente.iniciadaEm.getTime()) / (1000 * 60))
            : 0
        } : null
      }

      reply.code(200).send({ stats })
    } catch (error) {
      console.error('Erro ao buscar estatísticas do dashboard:', error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  }

  async getFilaResumo(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Buscar fila atual resumida
      const fila = await prisma.senha.findMany({
        where: {
          status: {
            in: ['AGUARDANDO', 'CHAMANDO', 'EM_ATENDIMENTO']
          }
        },
        include: {
          paciente: {
            select: {
              id: true,
              nomeCompleto: true,
              idade: true,
              numeroIdentificacao: true
            }
          }
        },
        orderBy: [
          {
            prioridade: 'asc'
          },
          {
            emitidaEm: 'asc'
          }
        ],
        take: 10
      })

      // Estatísticas rápidas
      const totalNaFila = await prisma.senha.count({
        where: {
          status: {
            in: ['AGUARDANDO', 'CHAMANDO']
          }
        }
      })

      // Calcular tempo de espera dinâmico para cada senha
      const filaComTempo = fila.map(senha => ({
        ...senha,
        tempoEspera: Math.floor((new Date().getTime() - senha.emitidaEm.getTime()) / (1000 * 60))
      }))

      reply.code(200).send({
        fila: filaComTempo,
        totalNaFila
      })
    } catch (error) {
      console.error('Erro ao buscar resumo da fila:', error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  }

  private async calcularTempoMedioEspera(dataInicio: Date, dataFim: Date): Promise<number> {
    const senhasFinalizadas = await prisma.senha.findMany({
      where: {
        status: 'ATENDIDO',
        emitidaEm: {
          gte: dataInicio,
          lt: dataFim
        },
        finalizadaEm: {
          not: null
        }
      },
      select: {
        emitidaEm: true,
        finalizadaEm: true
      }
    })

    if (senhasFinalizadas.length === 0) return 0

    const tempoTotal = senhasFinalizadas.reduce((total, senha) => {
      if (senha.finalizadaEm) {
        const tempo = (senha.finalizadaEm.getTime() - senha.emitidaEm.getTime()) / (1000 * 60)
        return total + tempo
      }
      return total
    }, 0)

    return Math.round(tempoTotal / senhasFinalizadas.length)
  }
}
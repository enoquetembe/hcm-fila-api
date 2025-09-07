// src/controllers/dashboard-controller.ts
import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../lib/prisma'

export class DashboardController {
  async getDashboardStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      const amanha = new Date(hoje)
      amanha.setDate(amanha.getDate() + 1)

      // Buscar estatísticas em paralelo para melhor performance
      const [
        totalSenhasHoje,
        senhasPorPrioridade,
        senhasAguardando,
        atendimentosFinalizados,
        pacientesUnicos,
        tempoMedioEspera
      ] = await Promise.all([
        // Total de senhas emitidas hoje
        prisma.senha.count({
          where: {
            emitidaEm: {
              gte: hoje,
              lt: amanha
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
              gte: hoje,
              lt: amanha
            }
          }
        }),

        // Pacientes únicos atendidos hoje
        prisma.senha.findMany({
          where: {
            emitidaEm: {
              gte: hoje,
              lt: amanha
            }
          },
          select: {
            pacienteId: true
          },
          distinct: ['pacienteId']
        }),

        // Calcular tempo médio de espera
        this.calcularTempoMedioEspera(hoje, amanha)
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

      // Crescimento em relação ao dia anterior
      const ontem = new Date(hoje)
      ontem.setDate(ontem.getDate() - 1)
      const senhasOntem = await prisma.senha.count({
        where: {
          emitidaEm: {
            gte: ontem,
            lt: hoje
          }
        }
      })

      const crescimento = senhasOntem > 0 
        ? ((totalSenhasHoje - senhasOntem) / senhasOntem * 100).toFixed(1)
        : '0'

      const stats = {
        senhasHoje: {
          total: totalSenhasHoje,
          crescimento: `${crescimento}%`
        },
        prioridades: prioridadesCount,
        filaAtual: {
          aguardando: senhasAguardando,
          emAtendimento: prioridadesCount.MUITO_URGENTE + prioridadesCount.URGENTE + prioridadesCount.POUCO_URGENTE - senhasAguardando
        },
        atendimentos: {
          finalizados: atendimentosFinalizados,
          pacientesUnicos: pacientesUnicos.length
        },
        tempoMedio: {
          espera: tempoMedioEspera,
          unidade: 'minutos'
        },
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
        take: 10 // Apenas os próximos 10 da fila
      })

      // Estatísticas rápidas
      const totalNaFila = await prisma.senha.count({
        where: {
          status: {
            in: ['AGUARDANDO', 'CHAMANDO']
          }
        }
      })

      reply.code(200).send({
        fila: fila.map((senha, index) => ({
          id: senha.id,
          codigo: senha.codigo,
          prioridade: senha.prioridade,
          status: senha.status,
          posicao: index + 1,
          paciente: {
            nome: senha.paciente.nomeCompleto,
            idade: senha.paciente.idade,
            identificacao: senha.paciente.numeroIdentificacao
          },
          tempoEspera: senha.emitidaEm 
            ? Math.floor((new Date().getTime() - senha.emitidaEm.getTime()) / (1000 * 60))
            : 0,
          emitidaEm: senha.emitidaEm
        })),
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
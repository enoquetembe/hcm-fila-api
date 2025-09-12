// src/controllers/senha-controller.ts
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'

const createSenhaSchema = z.object({
  pacienteId: z.string().min(1, 'ID do paciente é obrigatório'),
  sintomas: z.string().min(1, 'Descrição dos sintomas é obrigatória'),
  prioridade: z.enum(['MUITO_URGENTE', 'URGENTE', 'POUCO_URGENTE'], {
    errorMap: () => ({ message: 'Prioridade deve ser MUITO_URGENTE, URGENTE ou POUCO_URGENTE' })
  })
})

const updateStatusSchema = z.object({
  status: z.enum(['AGUARDANDO', 'CHAMANDO', 'EM_ATENDIMENTO', 'ATENDIDO', 'CANCELADO', 'NAO_COMPARECEU'])
})

export class SenhaController {
  async createSenha(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { pacienteId, sintomas, prioridade } = createSenhaSchema.parse(request.body)
      const userId = (request as any).userId

      // Verificar se o paciente existe
      const paciente = await prisma.paciente.findUnique({
        where: { id: pacienteId, ativo: true }
      })

      if (!paciente) {
        return reply.code(404).send({ error: 'Paciente não encontrado' })
      }

      // Verificar se o paciente já tem uma senha ativa
      const senhaAtiva = await prisma.senha.findFirst({
        where: {
          pacienteId,
          status: {
            in: ['AGUARDANDO', 'CHAMANDO', 'EM_ATENDIMENTO']
          }
        }
      })

      if (senhaAtiva) {
        return reply.code(409).send({ error: 'Paciente já possui uma senha ativa na fila' })
      }

      // Gerar próximo código de senha
      const codigo = await this.gerarProximoCodigoSenha(prioridade)

      // Calcular posição na fila
      const posicaoFila = await this.calcularPosicaoNaFila(prioridade)

      const senha = await prisma.senha.create({
        data: {
          codigo,
          prioridade,
          sintomas,
          pacienteId,
          usuarioId: 'cmf9obiec0000ry8ova66r922',
          posicaoFila,
          status: 'AGUARDANDO'
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
        }
      })

      // Log da criação
      await prisma.logSistema.create({
        data: {
          acao: 'SENHA_EMITIDA',
          entidade: 'SENHA',
          entidadeId: senha.id,
          detalhes: JSON.stringify({
            codigo: senha.codigo,
            paciente: paciente.nomeCompleto,
            prioridade: senha.prioridade,
            sintomas: senha.sintomas
          }),
          usuarioId: userId,
          ipAddress: request.ip
        }
      })

      // Atualizar posições de outras senhas se necessário
      await this.atualizarPosicoesFila()

      reply.code(201).send({ senha })
    } catch (error) {
      console.error('Erro ao criar senha:', error)
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ 
          error: 'Dados inválidos',
          details: error.errors 
        })
      }
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  }

  async getFilaAtual(request: FastifyRequest, reply: FastifyReply) {
    try {
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
            prioridade: 'asc' // MUITO_URGENTE primeiro
          },
          {
            emitidaEm: 'asc' // Mais antigo primeiro dentro da mesma prioridade
          }
        ]
      })

      // Estatísticas da fila
      const estatisticas = await this.obterEstatisticasFila()

      reply.code(200).send({
        fila,
        estatisticas
      })
    } catch (error) {
      console.error('Erro ao buscar fila atual:', error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  }

  async chamarProximoPaciente(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).userId

      const proximaSenha = await prisma.senha.findFirst({
        where: {
          status: 'AGUARDANDO'
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
        ]
      })

      if (!proximaSenha) {
        return reply.code(404).send({ error: 'Não há pacientes na fila' })
      }

      // Atualizar status para CHAMANDO
      const senhaAtualizada = await prisma.senha.update({
        where: { id: proximaSenha.id },
        data: { 
          status: 'CHAMANDO',
          iniciadaEm: new Date()
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
        }
      })

      // Log da chamada
      await prisma.logSistema.create({
        data: {
          acao: 'PACIENTE_CHAMADO',
          entidade: 'SENHA',
          entidadeId: senhaAtualizada.id,
          detalhes: JSON.stringify({
            codigo: senhaAtualizada.codigo,
            paciente: senhaAtualizada.paciente.nomeCompleto,
            prioridade: senhaAtualizada.prioridade
          }),
          usuarioId: userId,
          ipAddress: request.ip
        }
      })

      // Atualizar posições da fila
      await this.atualizarPosicoesFila()

      reply.code(200).send({ senha: senhaAtualizada })
    } catch (error) {
      console.error('Erro ao chamar próximo paciente:', error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  }

  async updateStatusSenha(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const { status } = updateStatusSchema.parse(request.body)
      const userId = (request as any).userId

      const senha = await prisma.senha.findUnique({
        where: { id },
        include: {
          paciente: {
            select: {
              nomeCompleto: true
            }
          }
        }
      })

      if (!senha) {
        return reply.code(404).send({ error: 'Senha não encontrada' })
      }

      const dadosAtualizacao: any = { status }

      // Adicionar timestamps baseado no status
      if (status === 'EM_ATENDIMENTO' && !senha.iniciadaEm) {
        dadosAtualizacao.iniciadaEm = new Date()
      } else if (['ATENDIDO', 'CANCELADO', 'NAO_COMPARECEU'].includes(status)) {
        dadosAtualizacao.finalizadaEm = new Date()
      }

      const senhaAtualizada = await prisma.senha.update({
        where: { id },
        data: dadosAtualizacao,
        include: {
          paciente: {
            select: {
              id: true,
              nomeCompleto: true,
              idade: true,
              numeroIdentificacao: true
            }
          }
        }
      })

      // Log da atualização
      await prisma.logSistema.create({
        data: {
          acao: 'STATUS_SENHA_ATUALIZADO',
          entidade: 'SENHA',
          entidadeId: id,
          detalhes: JSON.stringify({
            codigo: senha.codigo,
            paciente: senha.paciente.nomeCompleto,
            statusAnterior: senha.status,
            novoStatus: status
          }),
          usuarioId: userId,
          ipAddress: request.ip
        }
      })

      // Atualizar posições da fila
      await this.atualizarPosicoesFila()

      reply.code(200).send({ senha: senhaAtualizada })
    } catch (error) {
      console.error('Erro ao atualizar status da senha:', error)
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ 
          error: 'Dados inválidos',
          details: error.errors 
        })
      }
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  }

  // Métodos auxiliares privados
  private async gerarProximoCodigoSenha(prioridade: string): Promise<string> {
    const prefixos = {
      'MUITO_URGENTE': 'A',
      'URGENTE': 'B', 
      'POUCO_URGENTE': 'C'
    }

    const prefixo = prefixos[prioridade as keyof typeof prefixos]
    
    // Buscar a última senha com este prefixo hoje
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const amanha = new Date(hoje)
    amanha.setDate(amanha.getDate() + 1)

    const ultimaSenha = await prisma.senha.findFirst({
      where: {
        codigo: {
          startsWith: prefixo
        },
        emitidaEm: {
          gte: hoje,
          lt: amanha
        }
      },
      orderBy: {
        codigo: 'desc'
      }
    })

    let proximoNumero = 1
    if (ultimaSenha) {
      const numeroAtual = parseInt(ultimaSenha.codigo.substring(1))
      proximoNumero = numeroAtual + 1
    }

    return `${prefixo}${proximoNumero.toString().padStart(3, '0')}`
  }

  private async calcularPosicaoNaFila(prioridade: string): Promise<number> {
    const prioridades = ['MUITO_URGENTE', 'URGENTE', 'POUCO_URGENTE']
    const prioridadeIndex = prioridades.indexOf(prioridade)

    let posicao = 1

    // Contar senhas de prioridades mais altas
    for (let i = 0; i < prioridadeIndex; i++) {
      const count = await prisma.senha.count({
        where: {
          prioridade: prioridades[i] as any,
          status: {
            in: ['AGUARDANDO', 'CHAMANDO']
          }
        }
      })
      posicao += count
    }

    // Contar senhas da mesma prioridade
    const countMesmaPrioridade = await prisma.senha.count({
      where: {
        prioridade: prioridade as any,
        status: {
          in: ['AGUARDANDO', 'CHAMANDO']
        }
      }
    })
    posicao += countMesmaPrioridade

    return posicao
  }

  private async atualizarPosicoesFila(): Promise<void> {
    const senhasAguardando = await prisma.senha.findMany({
      where: {
        status: {
          in: ['AGUARDANDO', 'CHAMANDO']
        }
      },
      orderBy: [
        {
          prioridade: 'asc'
        },
        {
          emitidaEm: 'asc'
        }
      ]
    })

    for (let i = 0; i < senhasAguardando.length; i++) {
      await prisma.senha.update({
        where: {
          id: senhasAguardando[i].id
        },
        data: {
          posicaoFila: i + 1
        }
      })
    }
  }

  private async obterEstatisticasFila() {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const amanha = new Date(hoje)
    amanha.setDate(amanha.getDate() + 1)

    const [totalSenhasHoje, senhasPorPrioridade, senhasAguardando] = await Promise.all([
      prisma.senha.count({
        where: {
          emitidaEm: {
            gte: hoje,
            lt: amanha
          }
        }
      }),
      prisma.senha.groupBy({
        by: ['prioridade'],
        where: {
          status: {
            in: ['AGUARDANDO', 'CHAMANDO', 'EM_ATENDIMENTO']
          }
        },
        _count: true
      }),
      prisma.senha.count({
        where: {
          status: {
            in: ['AGUARDANDO', 'CHAMANDO']
          }
        }
      })
    ])

    return {
      totalSenhasHoje,
      senhasPorPrioridade: senhasPorPrioridade.reduce((acc: any, item) => {
        acc[item.prioridade] = item._count
        return acc
      }, {}),
      senhasAguardando,
      tempoMedioEspera: 18 // TODO: Calcular dinamicamente
    }
  }
}
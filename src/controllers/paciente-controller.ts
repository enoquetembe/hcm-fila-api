import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'

// Schema atualizado - número de identificação não é mais obrigatório
const createPacienteSchema = z.object({
  nomeCompleto: z.string().min(1, 'Nome completo é obrigatório').max(255),
  numeroIdentificacao: z.string().optional(), // Removida obrigatoriedade
  idade: z.number().int().min(0).max(14, 'Idade deve estar entre 0 e 14 anos'), // Alterado para 0-14
  dataNascimento: z.string().optional().transform(val => val ? new Date(val) : undefined),
  telefone: z.string().optional(),
  endereco: z.string().optional(),
  responsavel: z.string().optional(),
  telefoneResponsavel: z.string().optional(),
})

const updatePacienteSchema = createPacienteSchema.partial()

const searchPacienteSchema = z.object({
  nome: z.string().optional(),
  numeroIdentificacao: z.string().optional(),
  idade: z.coerce.number().int().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export class PacienteController {
  async createPaciente(request: FastifyRequest, reply: FastifyReply) {
    try {
      const dadosPaciente = createPacienteSchema.parse(request.body)
      const userId = (request as any).userId

      // Verificar se já existe paciente com este número de identificação (apenas se foi fornecido)
      if (dadosPaciente.numeroIdentificacao) {
        const pacienteExistente = await prisma.paciente.findUnique({
          where: { numeroIdentificacao: dadosPaciente.numeroIdentificacao }
        })

        if (pacienteExistente) {
          return reply.code(409).send({ error: 'Já existe um paciente com este número de identificação' })
        }
      }

      const paciente = await prisma.paciente.create({
        data: dadosPaciente
      })

      // Log da criação
      await prisma.logSistema.create({
        data: {
          acao: 'PACIENTE_CRIADO',
          entidade: 'PACIENTE',
          entidadeId: paciente.id,
          detalhes: JSON.stringify({
            nome: paciente.nomeCompleto,
            numeroIdentificacao: paciente.numeroIdentificacao
          }),
          usuarioId: 'cmfl2x6790000ujtcp567bqma',
          ipAddress: request.ip
        }
      })

      reply.code(201).send({ paciente })
    } catch (error) {
      console.error('Erro ao criar paciente:', error)
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ 
          error: 'Dados inválidos',
          details: error.errors 
        })
      }
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  }

  async getPacientes(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { nome, numeroIdentificacao, idade, page, limit } = searchPacienteSchema.parse(request.query)
      
      const where: any = { ativo: true }
      
      if (nome) {
        where.nomeCompleto = {
          contains: nome,
          mode: 'insensitive'
        }
      }
      
      if (numeroIdentificacao) {
        where.numeroIdentificacao = {
          contains: numeroIdentificacao
        }
      }
      
      if (idade) {
        where.idade = idade
      }

      const [pacientes, total] = await Promise.all([
        prisma.paciente.findMany({
          where,
          select: {
            id: true,
            nomeCompleto: true,
            numeroIdentificacao: true,
            idade: true,
            telefone: true,
            responsavel: true,
            createdAt: true
          },
          orderBy: { nomeCompleto: 'asc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.paciente.count({ where })
      ])

      reply.code(200).send({
        pacientes,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      })
    } catch (error) {
      console.error('Erro ao buscar pacientes:', error)
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ 
          error: 'Parâmetros inválidos',
          details: error.errors 
        })
      }
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  }

  async getPacienteById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }

      const paciente = await prisma.paciente.findUnique({
        where: { id },
        include: {
          historicoMedico: {
            orderBy: { data: 'desc' },
            take: 10
          },
          senhas: {
            orderBy: { emitidaEm: 'desc' },
            take: 5,
            select: {
              id: true,
              codigo: true,
              prioridade: true,
              status: true,
              emitidaEm: true
            }
          }
        }
      })

      if (!paciente) {
        return reply.code(404).send({ error: 'Paciente não encontrado' })
      }

      reply.code(200).send({ paciente })
    } catch (error) {
      console.error('Erro ao buscar paciente:', error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  }

  async updatePaciente(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const dadosAtualizacao = updatePacienteSchema.parse(request.body)
      const userId = (request as any).userId

      const pacienteExistente = await prisma.paciente.findUnique({
        where: { id }
      })

      if (!pacienteExistente) {
        return reply.code(404).send({ error: 'Paciente não encontrado' })
      }

      // Se está atualizando o número de identificação, verificar duplicatas (apenas se foi fornecido)
      if (dadosAtualizacao.numeroIdentificacao && 
          dadosAtualizacao.numeroIdentificacao !== pacienteExistente.numeroIdentificacao) {
        const duplicata = await prisma.paciente.findUnique({
          where: { numeroIdentificacao: dadosAtualizacao.numeroIdentificacao }
        })
        
        if (duplicata) {
          return reply.code(409).send({ error: 'Já existe um paciente com este número de identificação' })
        }
      }

      const pacienteAtualizado = await prisma.paciente.update({
        where: { id },
        data: dadosAtualizacao
      })

      // Log da atualização
      await prisma.logSistema.create({
        data: {
          acao: 'PACIENTE_ATUALIZADO',
          entidade: 'PACIENTE',
          entidadeId: id,
          detalhes: JSON.stringify({
            nome: pacienteAtualizado.nomeCompleto,
            alteracoes: dadosAtualizacao
          }),
          usuarioId: 'cmfl2x6790000ujtcp567bqma',
          ipAddress: request.ip
        }
      })

      reply.code(200).send({ paciente: pacienteAtualizado })
    } catch (error) {
      console.error('Erro ao atualizar paciente:', error)
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ 
          error: 'Dados inválidos',
          details: error.errors 
        })
      }
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  }

  async deletePaciente(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const userId = (request as any).userId

      const paciente = await prisma.paciente.findUnique({
        where: { id }
      })

      if (!paciente) {
        return reply.code(404).send({ error: 'Paciente não encontrado' })
      }

      // Soft delete - marcar como inativo
      await prisma.paciente.update({
        where: { id },
        data: { ativo: false }
      })

      // Log da exclusão
      await prisma.logSistema.create({
        data: {
          acao: 'PACIENTE_EXCLUIDO',
          entidade: 'PACIENTE',
          entidadeId: id,
          detalhes: JSON.stringify({
            nome: paciente.nomeCompleto,
            numeroIdentificacao: paciente.numeroIdentificacao
          }),
          usuarioId: 'cmfl2x6790000ujtcp567bqma',
          ipAddress: request.ip
        }
      })

      reply.code(200).send({ message: 'Paciente excluído com sucesso' })
    } catch (error) {
      console.error('Erro ao excluir paciente:', error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  }
}
// src/controllers/auth-controller.ts
import { FastifyRequest, FastifyReply } from 'fastify'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../lib/prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'hcm-sistema-monitoria-secret-key'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
})

export class AuthController {
  async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { email, password } = loginSchema.parse(request.body)

      const usuario = await prisma.usuario.findUnique({ 
        where: { email },
        select: {
          id: true,
          nome: true,
          email: true,
          senha: true,
          role: true,
          ativo: true
        }
      })

      if (!usuario || !usuario.ativo) {
        return reply.code(401).send({ error: 'Email ou senha inválidos' })
      }

      const isPasswordValid = await bcrypt.compare(password, usuario.senha)
      if (!isPasswordValid) {
        return reply.code(401).send({ error: 'Email ou senha inválidos' })
      }

      const token = jwt.sign(
        { 
          userId: usuario.id,
          email: usuario.email,
          role: usuario.role 
        },
        JWT_SECRET,
        { expiresIn: '8h' }
      )

      // Log do login
      await prisma.logSistema.create({
        data: {
          acao: 'LOGIN',
          entidade: 'USUARIO',
          entidadeId: usuario.id,
          detalhes: JSON.stringify({ email: usuario.email }),
          usuarioId: usuario.id,
          ipAddress: request.ip
        }
      })

      reply.code(200).send({
        token,
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          role: usuario.role
        }
      })
    } catch (error) {
      console.error('Erro no login:', error)
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ 
          error: 'Dados inválidos',
          details: error.errors 
        })
      }
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Registrar logout no log
      const userId = (request as any).userId
      if (userId) {
        await prisma.logSistema.create({
          data: {
            acao: 'LOGOUT',
            entidade: 'USUARIO',
            entidadeId: userId,
            usuarioId: userId,
            ipAddress: request.ip
          }
        })
      }

      reply.code(200).send({ message: 'Logout realizado com sucesso' })
    } catch (error) {
      console.error('Erro no logout:', error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).userId
      
      const usuario = await prisma.usuario.findUnique({
        where: { id: userId },
        select: {
          id: true,
          nome: true,
          email: true,
          role: true,
          createdAt: true
        }
      })

      if (!usuario) {
        return reply.code(404).send({ error: 'Usuário não encontrado' })
      }

      reply.code(200).send({ usuario })
    } catch (error) {
      console.error('Erro ao buscar usuário:', error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  }
}
// src/middlewares/auth-middleware.ts
import { FastifyRequest, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'hcm-sistema-monitoria-secret-key'

interface JWTPayload {
  userId: string
  email: string
  role: string
  iat?: number
  exp?: number
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Token de acesso requerido' })
    }

    const token = authHeader.substring(7) // Remove 'Bearer '

    let decoded: JWTPayload
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
    } catch (jwtError) {
      return reply.code(401).send({ error: 'Token inválido ou expirado' })
    }

    // Verificar se o usuário ainda existe e está ativo
    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        ativo: true
      }
    })

    if (!usuario || !usuario.ativo) {
      return reply.code(401).send({ error: 'Usuário não encontrado ou inativo' })
    }

    // Adicionar informações do usuário ao request
    ;(request as any).userId = decoded.userId
    ;(request as any).userEmail = decoded.email
    ;(request as any).userRole = decoded.role

  } catch (error) {
    console.error('Erro no middleware de autenticação:', error)
    return reply.code(500).send({ error: 'Erro interno do servidor' })
  }
}

// Middleware para verificar roles específicas
export function roleMiddleware(allowedRoles: string[]) {
  return async function(request: FastifyRequest, reply: FastifyReply) {
    const userRole = (request as any).userRole

    if (!allowedRoles.includes(userRole)) {
      return reply.code(403).send({ error: 'Acesso negado. Permissão insuficiente.' })
    }
  }
}
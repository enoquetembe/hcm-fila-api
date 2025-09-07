// src/routes/auth-routes.ts
import { FastifyInstance } from 'fastify'
import { AuthController } from '../controllers/auth-controller'
import { authMiddleware } from '../middlewares/auth-middleware'

const authController = new AuthController()

export default async function authRoutes(app: FastifyInstance) {
  // Rotas públicas
  app.post('/auth/login', async (request, reply) => {
    await authController.login(request, reply)
  })

  // Rotas protegidas
  app.register(async function protectedRoutes(app) {
    app.addHook('preHandler', authMiddleware)

    app.post('/auth/logout', async (request, reply) => {
      await authController.logout(request, reply)
    })

    app.get('/auth/me', async (request, reply) => {
      await authController.me(request, reply)
    })
  })
}
// src/routes/dashboard-routes.ts
import { FastifyInstance } from 'fastify'
import { DashboardController } from '../controllers/dashboard-controller'

const dashboardController = new DashboardController()

export default async function dashboardRoutes(app: FastifyInstance) {
  app.get('/dashboard/stats', async (request, reply) => {
    await dashboardController.getDashboardStats(request, reply)
  })

  app.get('/dashboard/fila-resumo', async (request, reply) => {
    await dashboardController.getFilaResumo(request, reply)
  })
}
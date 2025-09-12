// src/routes/relatorio-routes.ts
import { FastifyInstance } from 'fastify'
import { RelatorioController } from '../controllers/relatorio-controller'
import { authMiddleware } from '../middlewares/auth-middleware'

const relatorioController = new RelatorioController()

export default async function relatorioRoutes(app: FastifyInstance) {
  // Rotas protegidas
  app.register(async function protectedRoutes(app) {
    app.addHook('preHandler', authMiddleware)

    // Gerar novo relatório
    app.post('/relatorios/gerar', async (request, reply) => {
      await relatorioController.gerarRelatorio(request, reply)
    })

    // Listar relatórios do usuário
    app.get('/relatorios', async (request, reply) => {
      await relatorioController.listarRelatorios(request, reply)
    })

    // Buscar relatório por ID
    app.get('/relatorios/:id', async (request, reply) => {
      await relatorioController.getRelatorioById(request, reply)
    })

    // Download de relatório em diferentes formatos
    app.get('/relatorios/:id/download', async (request, reply) => {
      await relatorioController.downloadRelatorio(request, reply)
    })
  })
}
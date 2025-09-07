// src/routes/senha-routes.ts
import { FastifyInstance } from 'fastify'
import { SenhaController } from '../controllers/senha-controller'

const senhaController = new SenhaController()

export default async function senhaRoutes(app: FastifyInstance) {
  // Buscar fila atual - acesso público
  app.get('/senhas/fila', async (request, reply) => {
    await senhaController.getFilaAtual(request, reply)
  })

  // Criar senha - acesso público
  app.post('/senhas', async (request, reply) => {
    await senhaController.createSenha(request, reply)
  })

  // Chamar próximo paciente - acesso público
  app.post('/senhas/chamar-proximo', async (request, reply) => {
    await senhaController.chamarProximoPaciente(request, reply)
  })

  // Atualizar status da senha - acesso público
  app.put('/senhas/:id/status', async (request, reply) => {
    await senhaController.updateStatusSenha(request, reply)
  })
}
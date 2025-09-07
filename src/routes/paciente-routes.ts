// src/routes/paciente-routes.ts
import { FastifyInstance } from 'fastify'
import { PacienteController } from '../controllers/paciente-controller'

const pacienteController = new PacienteController()

export default async function pacienteRoutes(app: FastifyInstance) {
  // Buscar pacientes - acesso público
  app.get('/pacientes', async (request, reply) => {
    await pacienteController.getPacientes(request, reply)
  })

  // Buscar paciente por ID - acesso público
  app.get('/pacientes/:id', async (request, reply) => {
    await pacienteController.getPacienteById(request, reply)
  })

  // Criar paciente - acesso público
  app.post('/pacientes', async (request, reply) => {
    await pacienteController.createPaciente(request, reply)
  })

  // Atualizar paciente - acesso público
  app.put('/pacientes/:id', async (request, reply) => {
    await pacienteController.updatePaciente(request, reply)
  })

  // Deletar paciente - acesso público
  app.delete('/pacientes/:id', async (request, reply) => {
    await pacienteController.deletePaciente(request, reply)
  })
}
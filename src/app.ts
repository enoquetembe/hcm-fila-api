import fastify from 'fastify'
import fastifyCors from '@fastify/cors'
import pacinteRotas from './routes/paciente-routes'
import senhaRoutes from './routes/senha-routes'
import dashboardRoutes from './routes/dashboard-routes'
import authRoutes from './routes/auth-routes'

export const app = fastify()

// Configurar CORS
app.register(fastifyCors, {
  origin: 'http://localhost:3000', // Ou use '*' para permitir todos os origens
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // Se estiver usando cookies/tokens
})

app.register(pacinteRotas)
app.register(senhaRoutes)
app.register(dashboardRoutes)
app.register(authRoutes)
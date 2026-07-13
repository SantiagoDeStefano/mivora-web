import { defaultErrorHandler } from './middlewares/errors.middlewares'
import { envConfig } from './constants/config'
import { initFolder } from './utils/file'
import { createServer } from 'http'

import databaseService from './services/database.services'
import express from 'express'
import usersRouter from './routes/users.routes'
import eventsRouter from './routes/events.routes'
import fs from 'fs'
import YAML from 'yaml'
import swaggerUi from 'swagger-ui-express'
import cors from 'cors'
import mediasRouter from './routes/medias.routes'
import ticketsRouter from './routes/tickets.routes'
import initSocket from './utils/socket'
import ordersRouter from './routes/orders.routes'
import { startEventStatusJob } from './jobs/eventStatus.job'

const file = fs.readFileSync('MivoraSwagger.yaml', 'utf8')
const swaggerDocument = YAML.parse(file)
const PORT = Number(envConfig.port)
const app = express()
const httpServer = createServer(app)
app.use(
  cors({
    origin: [
      'http://localhost:4000',
      'http://localhost:5173',
      'http://26.35.82.76:4000',
      'http://26.73.34.56:5173',
      'http://khoinguyenpham.name.vn',
      'https://khoinguyenpham.name.vn',
      'https://mivora.vercel.app'
    ],
    credentials: true
  })
)
// Create upload folder
initFolder()

app.use(express.json())
app.use('/mivora/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))
app.use('/api/v1/users', usersRouter)
app.use('/api/v1/events', eventsRouter)
app.use('/api/v1/tickets', ticketsRouter)
app.use('/api/v1/medias', mediasRouter)
app.use('/api/v1/orders', ordersRouter)

databaseService.verifyConnection()
startEventStatusJob()

app.use(defaultErrorHandler)
initSocket(httpServer)

// Start the server
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`)
})

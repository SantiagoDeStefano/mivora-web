import { Router } from 'express'
import { uploadImageController } from '~/controllers/medias.controllers'

import { accessTokenValidator } from '~/middlewares/users.middlewares'
import { wrapRequestHandler } from '~/utils/handlers'
const mediasRouter = Router()

mediasRouter.post('/image', accessTokenValidator, wrapRequestHandler(uploadImageController))

export default mediasRouter

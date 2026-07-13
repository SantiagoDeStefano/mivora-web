import { Router } from 'express'
import { cancelOrderController, getOrdersDetailsController } from '~/controllers/orders.controllers'
import { cancelOrderStatusValidator, orderIdValidator, orderOwnerValidator } from '~/middlewares/orders.middlewares'

import { accessTokenValidator } from '~/middlewares/users.middlewares'
import { wrapRequestHandler } from '~/utils/handlers'
const ordersRouter = Router()

ordersRouter.get('/:order_id', accessTokenValidator, wrapRequestHandler(getOrdersDetailsController))

/**
 * Change ticket status to canceled
 * - Method: PATCH
 * - Path: /:ticket_id/cancel
 * - Protected: requires `Authorization: Bearer <access_token>`
 * - Params: `ticket_id` (validated by `ticketIdValidator`)
 * - Body: `{ status: 'canceled' }`
 * - Action: returns detailed ticket information if the requester is authorized
 * - Success: 200 with ticket details
 */
ordersRouter.patch(
  '/:order_id',
  accessTokenValidator,
  orderIdValidator,
  orderOwnerValidator,
  cancelOrderStatusValidator,
  wrapRequestHandler(cancelOrderController)
)

export default ordersRouter

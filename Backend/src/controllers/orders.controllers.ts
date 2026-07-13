import { Request, Response } from 'express'
import { ParamsDictionary } from 'express-serve-static-core'
import { ORDERS_MESSAGE } from '~/constants/messages'
import { Pagination } from '~/models/requests/events.requests'
import { GetOrdersDetailsParams } from '~/models/requests/orders.requests'

import orderService from '~/services/orders.services'
import { UUIDv4 } from '~/types/common'
import { OrderStatus } from '~/types/domain'

export const getOrdersController = async (
  req: Request<ParamsDictionary, unknown, Pagination>,
  res: Response
): Promise<void> => {
  const limit = Number(req.query.limit)
  const page = Number(req.query.page)
  const search = req.query.q as string | undefined
  const order_status = req.query.status as OrderStatus
  const user_id = req.decoded_authorization?.user_id as UUIDv4
  const result = await orderService.getOrders(user_id, limit, page, search, order_status)
  res.json({
    message: ORDERS_MESSAGE.GET_ORDERS_HISTORY_SUCCESS,
    result: {
      orders: result.orders,
      limit,
      page,
      total_page: Math.ceil(result.totalOrders / limit)
    }
  })
}

export const getOrdersDetailsController = async (
  req: Request<ParamsDictionary, unknown, GetOrdersDetailsParams>,
  res: Response
): Promise<void> => {
  const order_id = req.params.order_id as UUIDv4
  const user_id = req.decoded_authorization?.user_id as UUIDv4
  const result = await orderService.getOrderDetails(user_id, order_id)
  res.json({
    message: ORDERS_MESSAGE.GET_ORDER_DETAILS_SUCCESS,
    result
  })
}

export const cancelOrderController = async (
  req: Request<ParamsDictionary, GetOrdersDetailsParams, unknown>,
  res: Response
): Promise<void> => {
  const order_id = req.params.order_id as UUIDv4
  const order_status = 'canceled'
  const result = await orderService.cancelOrder(order_id, order_status)
  res.json({
    message: ORDERS_MESSAGE.ORDER_CANCELED_SUCCESSFULLY,
    result
  })
}

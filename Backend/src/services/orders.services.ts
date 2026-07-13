import { CreateEventRequestBody, UpdateEventDetailsBody } from '~/models/requests/events.requests'
import databaseService from './database.services'
import Event from '~/models/schemas/Event.schema'
import { UUIDv4 } from '~/types/common'
import { EventStatus, OrderStatus } from '~/types/domain'
import Message from '~/models/schemas/Message.schema'
import qrCode from './qrcode.services'

class OrderService {
  async getOrders(user_id: UUIDv4, limit: number, page: number, search?: string, order_status?: OrderStatus) {
    const orderStatusParam = order_status ?? null
    const searchParam = search ?? null

    const ordersResult = await databaseService.orders(
      `
        SELECT
          orders.id,
          events.id   AS event_id,
          events.title AS event_title,
          events.start_at,
          orders.amount_cents,
          orders.status AS order_status,
          orders.paid_at,
          orders.canceled_at,
          COUNT(*) OVER() AS total_count
        FROM orders
        JOIN events ON events.id = orders.event_id
        WHERE orders.user_id = $1
          AND orders.status = COALESCE($2::order_status, orders.status)
          AND events.title ILIKE COALESCE('%' || $3::text || '%', events.title)
        ORDER BY orders.paid_at DESC
        LIMIT $4 OFFSET $5;
      `,
      [user_id, orderStatusParam, searchParam, limit, limit * (page - 1)]
    )
    const totalOrders = ordersResult.rows.length > 0 ? parseInt(ordersResult.rows[0].total_count, 10) : 0
    return { orders: ordersResult.rows, totalOrders }
  }

  async getOrderDetails(user_id: UUIDv4, order_id: UUIDv4) {
    const orderResult = await databaseService.orders(
      `
        SELECT
          orders.id,
          tickets.id AS ticket_id,
          events.title AS event_title,
          tickets.status AS ticket_status,
          orders.amount_cents,
          orders.status,
          orders.paid_at,
          orders.canceled_at,
          tickets.qr_code_token
        FROM orders
        JOIN tickets ON tickets.order_id = orders.id
        JOIN events ON events.id = orders.event_id
        WHERE orders.id = $1 AND orders.user_id = $2;
      `,
      [order_id, user_id]
    )
    const qr_code = await qrCode.generateQrTicketCode(orderResult.rows[0].qr_code_token)
    const { qr_code_token, ...orderWithoutToken } = orderResult.rows[0]

    return {
      ...orderWithoutToken,
      qr_code
    }
  }

  async cancelOrder(order_id: UUIDv4, order_status: string) {
    await databaseService.orders(
      `
        UPDATE orders
        SET status = $2,
            canceled_at = NOW()
        WHERE id = $1
      `,
      [order_id, order_status]
    )
    await databaseService.tickets(
      `
        UPDATE tickets
        SET status = 'canceled'
        FROM orders
        WHERE tickets.order_id = orders.id
         AND orders.id = $1
      `,
      [order_id]
    )
    const canceledOrderResult = await databaseService.orders(
      `
        SELECT
          orders.id,
          tickets.id AS ticket_id,
          events.title AS event_title,
          tickets.status AS ticket_status,
          orders.amount_cents,
          orders.status,
          orders.paid_at,
          orders.canceled_at,
          tickets.qr_code_token
        FROM orders
        JOIN tickets ON tickets.order_id = orders.id
        JOIN events ON events.id = orders.event_id
        WHERE orders.id = $1;
      `,
      [order_id]
    )
    const qr_code = await qrCode.generateQrTicketCode(canceledOrderResult.rows[0].qr_code_token)
    const { qr_code_token, ...orderWithoutToken } = canceledOrderResult.rows[0]
    return {
      ...orderWithoutToken,
      qr_code
    }
  }
}

const orderService = new OrderService()
export default orderService

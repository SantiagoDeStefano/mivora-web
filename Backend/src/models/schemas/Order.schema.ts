import { UUIDv4 } from '~/types/common'
import { EventStatus, OrderStatus } from '~/types/domain'
import { newUUIDv4 } from '~/utils/uuid'
import pg from 'pg'

export interface OrderType extends pg.QueryResultRow {
  id?: UUIDv4
  amount_cents: number
  status: OrderStatus
  paid_at?: Date
  canceled_at?: Date
}

export default class Order {
  id: UUIDv4
  amount_cents: number
  status: OrderStatus
  paid_at?: Date
  canceled_at?: Date

  constructor(order: OrderType) {
    this.id = order.id || newUUIDv4()
    this.amount_cents = order.amount_cents
    this.status = order.status
    this.paid_at = order.paid_at
    this.canceled_at = order.canceled_at
  }
}

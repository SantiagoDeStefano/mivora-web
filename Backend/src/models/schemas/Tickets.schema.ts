import { UUIDv4 } from '~/types/common'
import { TicketStatus } from '~/types/domain'
import { newUUIDv4 } from '~/utils/uuid'
import pg from 'pg'

export interface TicketType extends pg.QueryResultRow {
  id?: UUIDv4
  event_id: UUIDv4
  user_id: UUIDv4
  qr_code_token?: string
  status?: TicketStatus
  booked_at?: Date
  // null when havent check in
  checked_in_at?: Date | null
  price_cents: number
}

export default class Ticket {
  id: UUIDv4
  event_id: UUIDv4
  user_id: UUIDv4
  qr_code_token: string
  status: TicketStatus
  booked_at: Date
  checked_in_at: Date | null
  price_cents: number

  constructor(ticket: TicketType) {
    this.id = ticket.id || newUUIDv4()
    this.event_id = ticket.event_id
    this.user_id = ticket.user_id
    this.qr_code_token = ticket.qr_code_token || 'random_qr_text'
    this.status = ticket.status || 'booked'
    this.booked_at = ticket.booked_at || new Date()
    this.checked_in_at = ticket.checked_in_at || null
    this.price_cents = ticket.price_cents
  }
}

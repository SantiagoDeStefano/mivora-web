import { UUIDv4 } from '~/types/common'
import { TicketStatus } from '~/types/domain'

import databaseService from './database.services'
import qrCode from './qrcode.services'
import Ticket from '~/models/schemas/Tickets.schema'
import Order from '~/models/schemas/Order.schema'

class TicketsService {
  /**
   * Create a new ticket reservation for a user.
   * - Signs a QR token for the ticket, saves the ticket record and returns the
   *   created ticket with a generated QR image (the raw token is omitted).
   * - Params:
   *   - `event_id`: UUID of the event being booked
   *   - `user_id`: UUID of the user booking the ticket
   *   - `price_cents`: numeric price stored with the ticket
   * - Returns: `{ ticket }` where `ticket` includes `qr_code` (image/data) instead
   *   of the raw `qr_code_token`.
   */
  async bookTicket(event_id: UUIDv4, user_id: UUIDv4, price_cents: number) {
    // Create order record
    const new_order = new Order({
      amount_cents: price_cents,
      status: 'paid',
      paid_at: new Date()
    })

    // Sign QR code token
    const new_ticket = new Ticket({
      event_id,
      user_id,
      price_cents
    })
    const qr_code_token = await qrCode.createQrTicketToken(new_ticket.id, event_id, user_id)
    const newTicket = await databaseService.tickets(
      `
        WITH event_row AS (
        SELECT id, title, status
        FROM events
        WHERE id = $2
        FOR UPDATE
        ),
        inserted_order AS (
        INSERT INTO orders (
            id,
            event_id,
            user_id,
            amount_cents,
            status,
            paid_at
        )
        VALUES (
            $7,     -- order_id
            $2,     -- event_id
            $3,     -- user_id
            $8,     -- amount_cents (FROM new_order)
            $9,     -- status (FROM new_order)
            $10     -- paid_at (FROM new_order)
        )
        RETURNING id, amount_cents
        ),
        inserted_ticket AS (
        INSERT INTO tickets(
            id,
            event_id,
            user_id,
            order_id,
            qr_code_token,
            status,
            checked_in_at,
            price_cents
        )
        VALUES (
            $1,
            $2,
            $3,
            (SELECT id FROM inserted_order),
            $4,
            $5,
            $6,
            (SELECT amount_cents FROM inserted_order)
        )
        RETURNING
            id,
            event_id,
            user_id,
            status,
            checked_in_at,
            price_cents,
            qr_code_token
        )
        SELECT
        inserted_ticket.id,
        (SELECT title FROM event_row) AS event_title,
        (SELECT status FROM event_row) AS event_status,
        inserted_ticket.status AS ticket_status,
        inserted_ticket.checked_in_at,
        inserted_ticket.price_cents,
        inserted_ticket.qr_code_token,
        (SELECT id FROM inserted_order) AS order_id
        FROM inserted_ticket;
      `,
      [
        new_ticket.id,
        new_ticket.event_id,
        new_ticket.user_id,
        qr_code_token,
        new_ticket.status,
        new_ticket.checked_in_at,
        new_order.id,
        new_order.amount_cents,
        new_order.status,
        new_order.paid_at
      ]
    )
    const qr_code = await qrCode.generateQrTicketCode(qr_code_token)
    const { qr_code_token: token, ...ticketWithoutToken } = newTicket.rows[0]
    return {
      ticket: {
        ...ticketWithoutToken,
        qr_code
      }
    }
  }

  /**
   * Mark a ticket as checked-in (scan).
   * - Updates ticket status and `checked_in_at`, increments event's `checked_in` counter,
   *   then returns the updated ticket.
   * - Params: `ticket_id` (UUID) to identify the ticket to scan.
   * - Returns: `{ ticket }` with the updated ticket fields.
   */
  async scanTicket(ticket_id: UUIDv4) {
    const ticketResult = await databaseService.tickets(
      `
        UPDATE tickets
        SET status = $1,
            checked_in_at = $2
        FROM events
        WHERE tickets.id = $3
        AND tickets.event_id = events.id
        RETURNING
          events.id AS event_id
      `,
      ['checked_in', new Date(), ticket_id]
    )
    const ticket = ticketResult.rows[0]
    await databaseService.events(
      `
        UPDATE events
        SET checked_in = checked_in + 1
        WHERE id = $1
      `,
      [ticket.event_id]
    )
  }

  /**
   * List or search tickets with optional status filtering.
   * - Supports pagination via `limit` and `page`.
   * - Supports search by event title (case-insensitive ILIKE).
   * - For each row, replaces the stored `qr_code_token` with a generated `qr_code`.
   * - Returns `{ tickets, totalTickets }` where `totalTickets` is the full result count.
   */
  async getOrSearchTicketWithStatus(
    limit: number,
    page: number,
    user_id: UUIDv4,
    search?: string,
    status?: TicketStatus
  ) {
    const statusParam = status ?? null // null = "all statuses"
    const searchParam = search ?? null // null = "no search"
    const ticketsResult = await databaseService.tickets(
      `
        SELECT 
          tickets.id, 
          tickets.event_id,
          tickets.user_id,
          events.poster_url,
          events.title as event_title, 
          events.status as event_status,
          tickets.status as ticket_status, 
          tickets.checked_in_at, 
          tickets.price_cents, 
          tickets.qr_code_token,
          COUNT(*) OVER() AS total_count
        FROM tickets  
        JOIN events ON tickets.event_id = events.id
        WHERE
          tickets.status = COALESCE($1::ticket_status, tickets.status)
          AND
          events.title ILIKE COALESCE('%' || $2::text || '%', events.title)
          AND
          tickets.user_id = $3
        ORDER BY tickets.created_at DESC, tickets.id DESC
        LIMIT $4 OFFSET $5
      `,
      [statusParam, searchParam, user_id, limit, limit * (page - 1)]
    )
    const totalTickets = ticketsResult.rows.length > 0 ? Number(ticketsResult.rows[0].total_count) : 0
    const tickets = await Promise.all(
      ticketsResult.rows.map(async (ticket) => {
        const qr_code = await qrCode.generateQrTicketCode(ticket.qr_code_token)

        // remove token and attach generated QR
        const { qr_code_token, ...ticketWithoutToken } = ticket

        return {
          ...ticketWithoutToken,
          qr_code
        }
      })
    )

    return { tickets, totalTickets }
  }

  async getTicketDetails(ticket_id: UUIDv4) {
    const ticketResult = await databaseService.tickets(
      `
        SELECT
          tickets.id,
          tickets.event_id,
          tickets.user_id,
          events.poster_url,
          events.title AS event_title,
          events.status AS event_status,
          tickets.status AS ticket_status,
          tickets.checked_in_at,
          tickets.price_cents,
          tickets.qr_code_token
        FROM tickets
        JOIN events ON tickets.event_id = events.id
        WHERE tickets.id = $1
      `,
      [ticket_id]
    )
    const qr_code = await qrCode.generateQrTicketCode(ticketResult.rows[0].qr_code_token)
    const { qr_code_token, ...ticketWithoutToken } = ticketResult.rows[0]
    return {
      ...ticketWithoutToken,
      qr_code
    }
  }

  async cancelTicket(ticket_id: UUIDv4, ticketStatus: string) {
    await databaseService.orders(
      `
        UPDATE orders
        SET status = 'canceled',
            canceled_at = NOW()
        FROM tickets
        WHERE orders.id = tickets.order_id
        AND tickets.id = $1
      `,
      [ticket_id]
    )
    const ticketResult = await databaseService.tickets(
      `
        UPDATE tickets
        SET status = $1
        FROM events
        WHERE tickets.id = $2
        AND tickets.event_id = events.id
        RETURNING
          tickets.id, 
          events.title as event_title, 
          events.status as event_status,
          tickets.status as ticket_status, 
          tickets.checked_in_at, 
          tickets.price_cents, 
          tickets.qr_code_token
      `,
      [ticketStatus, ticket_id]
    )
    const ticket = ticketResult.rows[0]
    const qr_code = await qrCode.generateQrTicketCode(ticket.qr_code_token)
    const { qr_code_token, ...ticketWithoutToken } = ticket
    return {
      ...ticketWithoutToken,
      qr_code
    }
  }
}

const ticketsService = new TicketsService()
export default ticketsService

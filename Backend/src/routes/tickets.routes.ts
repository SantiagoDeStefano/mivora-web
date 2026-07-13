import { Router } from 'express'
import {
  bookTicketController,
  cancelTicketController,
  getOrSearchTicketWithStatusController,
  getTicketDetailsController,
  scanTicketController
} from '~/controllers/tickets.controllers'
import { eventIdValidator, paginationValidator, searchValidator } from '~/middlewares/events.middlewares'
import {
  bookTicketValidator,
  ticketEventCreatorValidator,
  getTicketStatusValidator,
  scanTicketValidator,
  ticketIdValidator,
  ticketOwnerValidator,
  cancelTicketStatusValidator,
} from '~/middlewares/tickets.middlewares'
import { accessTokenValidator, checkIfUserIsBannedFromEvent, organizerValidator } from '~/middlewares/users.middlewares'
import { wrapRequestHandler } from '~/utils/handlers'

const ticketsRouter = Router()

/**
 * Book a ticket for an event
 * - Method: POST
 * - Path: /
 * - Protected: requires `Authorization: Bearer <access_token>`
 * - Body: `{ event_id: string }`
 * - Validations: `eventIdValidator` ensures the event exists; `bookTicketValidator` validates booking constraints
 * - Action: creates a ticket reservation for the authenticated user
 * - Success: 200 with created ticket details
 */
ticketsRouter.post(
  '/',
  accessTokenValidator,
  eventIdValidator,
  checkIfUserIsBannedFromEvent,
  bookTicketValidator,
  wrapRequestHandler(bookTicketController)
)

/**
 * Scan an attendee's ticket QR code
 * - Method: POST
 * - Path: /check-in
 * - Protected: requires `Authorization: Bearer <access_token>` and organizer role
 * - Body: `{ qr_code_token: string }`
 * - Validations: `scanTicketValidator` checks QR payload; `eventCreatorValidator` ensures the scanner is the event creator
 * - Action: marks ticket as checked-in when valid
 * - Success: 200 with scanned ticket info
 */
ticketsRouter.post(
  '/check-ins',
  accessTokenValidator,
  organizerValidator,
  scanTicketValidator,
  ticketEventCreatorValidator,
  wrapRequestHandler(scanTicketController)
)

/**
 * Get ticket details
 * - Method: GET
 * - Path: /:ticket_id
 * - Protected: requires `Authorization: Bearer <access_token>`
 * - Params: `ticket_id` (validated by `ticketIdValidator`)
 * - Action: returns detailed ticket information if the requester is authorized
 * - Success: 200 with ticket details
 */
ticketsRouter.get(
  '/:ticket_id',
  accessTokenValidator,
  ticketIdValidator,
  ticketOwnerValidator,
  wrapRequestHandler(getTicketDetailsController)
)

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
ticketsRouter.patch(
  '/:ticket_id/status',
  accessTokenValidator,
  ticketIdValidator,
  ticketOwnerValidator,
  cancelTicketStatusValidator,
  wrapRequestHandler(cancelTicketController)
)


export default ticketsRouter

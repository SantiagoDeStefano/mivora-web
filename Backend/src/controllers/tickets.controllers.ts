import { Request, Response } from 'express'
import { ParamsDictionary } from 'express-serve-static-core'
import { TokenPayload } from '~/models/requests/users.requests'
import { UUIDv4 } from '~/types/common'
import { getIO } from '~/utils/socket'
import { TICKETS_MESSAGES } from '~/constants/messages'
import {
  BookTicketRequestBody,
  CancelTicketParams,
  CancelTicketRequestBody,
  ScanTicketRequestBody,
  SearchTicketWithStatus
} from '~/models/requests/tickets.requests'
import Event from '~/models/schemas/Event.schema'
import Ticket from '~/models/schemas/Tickets.schema'
import ticketsService from '~/services/tickets.services'

export const bookTicketController = async (
  req: Request<ParamsDictionary, unknown, BookTicketRequestBody>,
  res: Response
): Promise<void> => {
  const eventData = (req.event as Event[])[0]
  const event_id = eventData.id
  const user_id = (req.decoded_authorization as TokenPayload).user_id
  const price_cents = eventData.price_cents
  const result = await ticketsService.bookTicket(event_id, user_id, price_cents)
  res.json({
    message: TICKETS_MESSAGES.BOOK_TICKET_SUCCESS,
    result
  })
}

export const scanTicketController = async (
  req: Request<ParamsDictionary, unknown, ScanTicketRequestBody>,
  res: Response
): Promise<void> => {
  const ticketData = (req.ticket as Ticket[])[0]
  const ticket_id = ticketData.id
  const ticket_owner_id = ticketData.user_id

  await ticketsService.scanTicket(ticket_id)

  const io = getIO()
  io.to(ticket_owner_id).emit('reload_after_scan', {
    redirect: true
  })

  res.json({
    message: TICKETS_MESSAGES.TICKET_SCANNED_SUCCESS
  })
}

export const getOrSearchTicketWithStatusController = async (
  req: Request<ParamsDictionary, unknown, unknown, SearchTicketWithStatus>,
  res: Response
): Promise<void> => {
  const limit = Number(req.query.limit)
  const page = Number(req.query.page)
  const user_id = (req.decoded_authorization as TokenPayload).user_id
  const status = req.query.status
  const search = req.query.q
  const result = await ticketsService.getOrSearchTicketWithStatus(limit, page, user_id, search, status)
  res.json({
    message: TICKETS_MESSAGES.GET_TICKETS_SUCCESSFULLY,
    result: {
      tickets: result.tickets,
      limit,
      page,
      total_page: Math.ceil(result.totalTickets / limit)
    }
  })
}

export const getTicketDetailsController = async (req: Request, res: Response): Promise<void> => {
  const { id: ticket_id } = (req.ticket as Ticket[])[0]

  const ticket = await ticketsService.getTicketDetails(ticket_id)
  res.json({
    message: TICKETS_MESSAGES.GET_TICKETS_DETAILS_SUCCESSFULLY,
    result: ticket
  })
}

export const cancelTicketController = async (
  req: Request<CancelTicketParams, unknown, CancelTicketRequestBody>,
  res: Response
): Promise<void> => {
  const ticket_id = req.params.ticket_id as UUIDv4
  const ticketStatus = req.body.status
  const result = await ticketsService.cancelTicket(ticket_id, ticketStatus)
  res.json({
    message: TICKETS_MESSAGES.TICKET_CANCELED_SUCCESSFULLY,
    result
  })
}

import { UUIDv4 } from '~/types/common'
import { Pagination } from './events.requests'
import { TicketStatus } from '~/types/domain'
import { ParamsDictionary } from 'express-serve-static-core'
import Ticket from '../schemas/Tickets.schema'

// Body
export interface BookTicketRequestBody {
  event_id: UUIDv4
}

export interface ScanTicketRequestBody {
  ticket: Ticket[]
}

export interface SearchTicketWithStatus extends Pagination {
  status?: TicketStatus
  q?: string
}

export interface CancelTicketRequestBody {
  status: string
}

// Params
export interface CancelTicketParams extends ParamsDictionary {
  ticket_id: UUIDv4
}
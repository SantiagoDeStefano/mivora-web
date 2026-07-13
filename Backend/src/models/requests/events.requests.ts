import { EventStatus, TicketStatus } from '~/types/domain'
import { Query } from 'express-serve-static-core'

// Body
export interface CreateEventRequestBody {
  title: string
  description?: string
  location_text: string
  start_at: Date
  end_at: Date
  price_cents: number
  capacity: number
}

export interface UpdateEventDetailsBody {
  title?: string
  description?: string
  location_text?: string
  start_at?: Date
  end_at?: Date
  price_cents?: number
  capacity?: number
}

export interface EventMessagesBody {
  content: string
}

// Query
export interface Pagination extends Query {
  limit: string
  page: string
}

export interface SearchEventWithStatus extends Pagination {
  status?: EventStatus
  q?: string
}

export interface GetCreatedEventDetailsParams {
  event_id?: string
}

export interface GetCreatedEventDetailsAttendeesParams extends Pagination {
  event_id?: string
  status?: TicketStatus
  q?: string
}

export interface GetBannedEventDetailsAttendeesParams extends Pagination {
  event_id?: string
  search?: string
}

export interface BanCreatedEventDetailsAttendeesParams {
  event_id?: string
  user_id?: string
}

export interface GetAllBannedEventParams extends Pagination {
  q?: string
}

export interface BanCreatedEventDetailsAttendeesBody {
  reason?: string
}

export interface GetCreatedEventDetailsAttendeesDetailsParams {
  event_id?: string
  user_id?: string
}

export interface SearchEvents extends Pagination {
  q: string
}

export interface GetAnalyticsParams {
  from: string
  to: string
  top?: number
  page?: number
  limit?: number
  group_by?: 'month' | 'weekday_weekend'
}
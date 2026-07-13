import { Request, Response } from 'express'
import { Params, ParamsDictionary } from 'express-serve-static-core'
import { EVENTS_MESSAGES, USERS_MESSAGES } from '~/constants/messages'
import {
  BanCreatedEventDetailsAttendeesBody,
  BanCreatedEventDetailsAttendeesParams,
  CreateEventRequestBody,
  EventMessagesBody,
  GetAllBannedEventParams,
  GetAnalyticsParams,
  GetBannedEventDetailsAttendeesParams,
  GetCreatedEventDetailsAttendeesParams,
  GetCreatedEventDetailsParams,
  SearchEvents,
  SearchEventWithStatus,
  UpdateEventDetailsBody
} from '~/models/requests/events.requests'
import { TokenPayload } from '~/models/requests/users.requests'
import Event from '~/models/schemas/Event.schema'

import eventService from '~/services/events.services'
import mediasService from '~/services/medias.services'
import orderService from '~/services/orders.services'
import { UUIDv4 } from '~/types/common'
import { EventStatus } from '~/types/domain'
import { getIO } from '~/utils/socket'

/**
 * Create event controller
 * - Route: POST /organizer/
 * - Protected: requires organizer Authorization header
 * - Body: `CreateEventRequestBody` (title, description?, poster_url?, location_text, start_at, end_at, price_cents, capacity, status)
 * - Action: creates an event owned by the authenticated organizer
 * - Response: JSON { message, result } with created event
 */
export const createEventController = async (
  req: Request<ParamsDictionary, unknown, CreateEventRequestBody>,
  res: Response
): Promise<void> => {
  const organizer_id = (req.decoded_authorization as TokenPayload).user_id
  const result = await eventService.createEvent(organizer_id, req.body)
  res.json({
    message: EVENTS_MESSAGES.EVENT_CREATED_SUCCESSFULLY,
    result
  })
}

/**
 * List or search published events (public)
 * - Route: GET /
 * - Query: `{ limit, page, q? }`
 * - Action: returns paginated list of published events
 * - Response: JSON { message, result: { events, limit, page, total_page } }
 */
export const getOrSearchEventsController = async (
  req: Request<ParamsDictionary, unknown, unknown, SearchEvents>,
  res: Response
): Promise<void> => {
  const limit = Number(req.query.limit)
  const page = Number(req.query.page)
  const search = req.query.q
  const result = await eventService.getOrSearchPublishedEvents(search, limit, page)
  res.json({
    message: EVENTS_MESSAGES.GET_EVENTS_SUCCESSFULLY,
    result: {
      events: result.events,
      limit,
      page,
      total_page: Math.ceil(result.totalEvents / limit)
    }
  })
}

/**
 * List or search events for authenticated organizer
 * - Route: GET /organizer/
 * - Protected: requires organizer Authorization header
 * - Query: `{ limit, page, status?, q? }`
 * - Action: returns paginated list filtered by status/search for the organizer
 */
export const getOrSearchEventsWithStatusController = async (
  req: Request<ParamsDictionary, unknown, unknown, SearchEventWithStatus>,
  res: Response
): Promise<void> => {
  const limit = Number(req.query.limit)
  const page = Number(req.query.page)
  const status = req.query.status
  const search = req.query.q
  const organizer_id = req.decoded_authorization?.user_id as UUIDv4
  const result = await eventService.getOrSearchEventsWithStatus(organizer_id, limit, page, search, status)
  res.json({
    message: EVENTS_MESSAGES.GET_EVENTS_SUCCESSFULLY,
    result: {
      events: result.events,
      limit,
      page,
      total_page: Math.ceil(result.totalEvents / limit)
    }
  })
}

/**
 * Get event details for organizer-created event
 * - Route: GET /organizer/:event_id
 * - Protected: requires organizer Authorization header
 * - Params: `event_id` (UUID)
 * - Action: returns full event details for the organizer's event
 */
export const getCreatedEventDetailsController = async (
  req: Request<ParamsDictionary, unknown, unknown, GetCreatedEventDetailsParams>,
  res: Response
): Promise<void> => {
  const event_id = req.params.event_id as UUIDv4
  const organizer_id = req.decoded_authorization?.user_id as UUIDv4
  const result = await eventService.getCreatedEventDetails(organizer_id, event_id)
  res.json({
    message: EVENTS_MESSAGES.GET_CREATED_EVENTS_DETAILS_SUCCESSFULLY,
    result
  })
}

export const getCreatedEventAttendeesController = async (
  req: Request<ParamsDictionary, unknown, unknown, GetCreatedEventDetailsAttendeesParams>,
  res: Response
): Promise<void> => {
  const event_id = req.params.event_id as UUIDv4
  const limit = Number(req.query.limit)
  const page = Number(req.query.page)
  const search = req.query.q
  const status = req.query.status
  const result = await eventService.getCreatedEventAttendees(event_id, limit, page, search, status)
  res.json({
    message: EVENTS_MESSAGES.GET_CREATED_EVENT_ATTENDEES_SUCCESSFULLY,
    result: {
      attendees: result.attendees,
      limit,
      page,
      total_page: Math.ceil(result.totalAttendees / limit)
    }
  })
}

export const getCreatedEventAttendeesDetailsController = async (
  req: Request<ParamsDictionary, unknown, unknown, GetCreatedEventDetailsAttendeesParams>,
  res: Response
): Promise<void> => {
  const event_id = req.params.event_id as UUIDv4
  const user_id = req.params.user_id as UUIDv4
  const result = await eventService.getCreatedEventAttendeesDetails(event_id, user_id)
  res.json({
    message: EVENTS_MESSAGES.GET_CREATED_EVENT_ATTENDEES_SUCCESSFULLY,
    result
  })
}

export const banCreatedEventAttendeesController = async (
  req: Request<ParamsDictionary, unknown, BanCreatedEventDetailsAttendeesBody, BanCreatedEventDetailsAttendeesParams>,
  res: Response
): Promise<void> => {
  const event_id = req.params.event_id as UUIDv4
  const user_id = req.params.user_id as UUIDv4
  const reason = req.body.reason
  const result = await eventService.banUserFromEventAttending(event_id, user_id, reason)
  res.json({
    message: USERS_MESSAGES.BAN_USER_FROM_EVENT_SUCCESS,
    result
  })
}

export const getBannedEventAttendeesController = async (
  req: Request<ParamsDictionary, unknown, unknown, GetBannedEventDetailsAttendeesParams>,
  res: Response
): Promise<void> => {
  const event_id = req.params.event_id as UUIDv4
  const limit = Number(req.query.limit)
  const page = Number(req.query.page)
  const search = req.query.search
  const result = await eventService.getBannedEventAttendees(event_id, limit, page, search)
  res.json({
    message: EVENTS_MESSAGES.GET_BANNED_EVENT_ATTENDEES_SUCCESS,
    result
  })
}

export const getBannedEventAttendeesDetailsController = async (
  req: Request<ParamsDictionary, unknown, unknown, GetBannedEventDetailsAttendeesParams>,
  res: Response
): Promise<void> => {
  const event_id = req.params.event_id as UUIDv4
  const user_id = req.params.user_id as UUIDv4
  const result = await eventService.getBannedEventAttendeesDetails(event_id, user_id)
  res.json({
    message: EVENTS_MESSAGES.GET_BANNED_EVENT_ATTENDEES_DETAILS_SUCCESS,
    result
  })
}

export const unbanCreatedEventAttendeesController = async (
  req: Request<ParamsDictionary, unknown, unknown, BanCreatedEventDetailsAttendeesParams>,
  res: Response
): Promise<void> => {
  const event_id = req.params.event_id as UUIDv4
  const user_id = req.params.user_id as UUIDv4
  await eventService.unbanUserFromEventAttending(event_id, user_id)
  res.json({
    message: USERS_MESSAGES.UNBAN_USER_FROM_EVENT_SUCCESS
  })
}

export const getAllBannedEventController = async (
  req: Request<ParamsDictionary, unknown, unknown, GetAllBannedEventParams>,
  res: Response
): Promise<void> => {
  const limit = Number(req.query.limit)
  const page = Number(req.query.page)
  const search = req.query.q
  const result = await eventService.getAllBannedEvents(limit, page, search)
  res.json({
    message: EVENTS_MESSAGES.GET_ALL_BANNED_EVENTS_SUCCESS,
    result: {
      banned_events: result.banned_events,
      limit,
      page,
      total_page: Math.ceil(result.totalBannedEvents / limit)
    }
  })
}

export const getAnalyticsController = async (
  req: Request<ParamsDictionary, unknown, GetAnalyticsParams>,
  res: Response
): Promise<void> => {
  const organizer_id = req.decoded_authorization?.user_id as UUIDv4
  const result = await eventService.getAnalytics(organizer_id)
  res.json({
    message: EVENTS_MESSAGES.GET_ANALYTICS_SUCCESS,
    result
  })
}

/**
 * Get public event details
 * - Route: GET /:event_id
 * - Params: `event_id` (UUID)
 * - Action: returns public event information (only for published events)
 */
export const getEventDetailsController = async (req: Request, res: Response): Promise<void> => {
  const eventData = req.event?.[0]
  const event = {
    ...eventData
  }
  res.json({
    message: EVENTS_MESSAGES.GET_EVENTS_SUCCESSFULLY,
    result: event
  })
}

/**
 * Update event details controller
 * - Route: PATCH /organizer/:event_id
 * - Protected: requires organizer Authorization header
 * - Params: `event_id` (UUID)
 * - Body: partial event fields to update
 * - Action: updates event and returns updated resource
 */
export const updateEventDetailsController = async (
  req: Request<ParamsDictionary, unknown, UpdateEventDetailsBody>,
  res: Response
): Promise<void> => {
  const event_id = (req.event as Event[])[0].id
  const result = await eventService.updateEvent(event_id, req.body)
  res.json({
    message: EVENTS_MESSAGES.UPDATE_EVENT_SUCCESS,
    result
  })
}

/**
 * Upload event poster controller
 * - Route: POST /organizer/:event_id/poster
 * - Protected: requires organizer Authorization header
 * - Params: `event_id` (UUID)
 * - Payload: multipart/form-data with a single `image` file field
 * - Action: uploads event poster and returns uploaded poster event
 */
export const uploadEventPosterController = async (req: Request, res: Response): Promise<void> => {
  const event_id = (req.event as Event[])[0].id
  const poster_url = await mediasService.uploadImage(req)
  const result = await eventService.uploadEventPoster(event_id, poster_url[0].url)
  res.json({
    message: EVENTS_MESSAGES.UPLOAD_EVENT_POSTER_SUCCESS,
    result
  })
}

/**
 * Publish event controller
 * - Route: PATCH /organizer/:event_id/publish
 * - Protected: requires organizer Authorization header
 * - Action: marks event as published and returns updated event
 */
export const changeEventStatusController = async (req: Request, res: Response): Promise<void> => {
  const event_id = (req.event as Event[])[0].id
  const status = req.body.status as EventStatus
  const result = await eventService.changeEventStatus(event_id, status)
  res.json({
    message: EVENTS_MESSAGES.CHANGE_EVENT_STATUS_SUCCESS,
    result
  })
}

export const getEventMessagesController = async (req: Request, res: Response): Promise<void> => {
  const event_id = (req.event as Event[])[0].id
  const limit = Number(req.query.limit)
  const page = Number(req.query.page)
  const result = await eventService.getEventMessages(event_id, limit, page)
  res.json({
    message: EVENTS_MESSAGES.GET_EVENT_MESSAGES_SUCCESS,
    result: {
      messages: result.messages,
      limit,
      page,
      total_page: Math.ceil(result.totalMessages / limit)
    }
  })
}

export const createEventMessagesController = async (
  req: Request<ParamsDictionary, unknown, EventMessagesBody>,
  res: Response
): Promise<void> => {
  const event_id = (req.event as Event[])[0].id
  const user_id = req.decoded_authorization?.user_id as UUIDv4
  const content = req.body.content
  const result = await eventService.createEventMessages(event_id, user_id, content)
  const io = getIO()

  io.to(event_id).emit('new_message', {
    id: result.id,
    event_id: result.event_id,
    user_id: result.user_id,
    content: result.content,
    created_at: result.created_at,
    user_name: result.user_name, // make sure service returns these
    user_avatar_url: result.user_avatar_url
  })
  res.json({
    message: EVENTS_MESSAGES.CREATE_EVENT_MESSAGES_SUCCESS,
    result
  })
}

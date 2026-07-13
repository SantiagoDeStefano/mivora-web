import { Router } from 'express'
import {
  changeEventStatusController,
  createEventController,
  createEventMessagesController,
  getEventDetailsController,
  getEventMessagesController,
  getOrSearchEventsController,
  updateEventDetailsController,
  uploadEventPosterController
} from '~/controllers/events.controllers'
import {
  accessTokenValidator,
  checkIfUserIsBannedFromEvent,
  eventEventCreatorValidator,
  eventJoinValidator,
  organizerValidator
} from '~/middlewares/users.middlewares'
import { wrapRequestHandler } from '~/utils/handlers'
import {
  createEventValidator,
  eventIdValidator,
  getPublishedEventStatusValidator,
  messagesContentValidator,
  paginationValidator,
  searchValidator,
  updateEventStatusValidator,
  updateEventValidator,
  uploadEventPosterStatusValidator,
  validateEventStatus
} from '~/middlewares/events.middlewares'

const eventsRouter = Router()

/**
 * Create a new event (organizer only)
 * - Method: POST
 * - Path: /organizer/
 * - Protected: requires `Authorization: Bearer <access_token>` and organizer role
 * - Body: { title, description?, poster_url?, location_text, start_at, end_at, price_cents, capacity, status }
 * - Validations: `createEventValidator` enforces required fields and constraints
 * - Success: 201/200 with created event data
 */
eventsRouter.post(
  '/',
  accessTokenValidator,
  organizerValidator,
  createEventValidator,
  wrapRequestHandler(createEventController)
)

/**
 * Update poster image (organizer only)
 * - Method: PUT
 * - Path: /organizer/:event_id/poster
 * - Protected: requires `Authorization: Bearer <access_token>` and organizer role
 * - Params: `event_id` in URL (validated by `eventIdValidator`)
 * - Payload: multipart/form-data with a single `image` file field
 * - Validations: `updateEventStatusValidator`, `updateEventValidator`
 * - Success: 200 with updated event data
 */
eventsRouter.put(
  '/:event_id/poster',
  accessTokenValidator,
  organizerValidator,
  eventIdValidator,
  eventEventCreatorValidator,
  uploadEventPosterStatusValidator,
  wrapRequestHandler(uploadEventPosterController)
)

/**
 * Update an existing event's details (organizer only)
 * - Method: PATCH
 * - Path: /organizer/:event_id
 * - Protected: requires `Authorization: Bearer <access_token>` and organizer role
 * - Params: `event_id` in URL (validated by `eventIdValidator`)
 * - Body: any updatable fields (title, description, poster_url, location_text, start_at, end_at, price_cents, capacity, status)
 * - Validations: `updateEventStatusValidator`, `updateEventValidator`
 * - Success: 200 with updated event data
 */
eventsRouter.patch(
  '/:event_id',
  accessTokenValidator,
  organizerValidator,
  eventIdValidator,
  eventEventCreatorValidator,
  updateEventStatusValidator,
  updateEventValidator,
  wrapRequestHandler(updateEventDetailsController)
)

/**
 * List or search published events
 * - Method: GET
 * - Path: /
 * - Query: { limit, page, q? }
 * - Validations: `paginationValidator`, `searchValidator`
 * - Success: 200 with paginated list of published events
 */
eventsRouter.get('/', paginationValidator, searchValidator, wrapRequestHandler(getOrSearchEventsController))

/**
 * Get details for a published event
 * - Method: GET
 * - Path: /:event_id
 * - Params: `event_id` in URL (validated by `eventIdValidator`)
 * - Validations: `getPublishedEventStatusValidator`
 * - Success: 200 with public event details
 */
eventsRouter.get(
  '/:event_id',
  accessTokenValidator,
  eventIdValidator,
  checkIfUserIsBannedFromEvent,
  getPublishedEventStatusValidator,
  wrapRequestHandler(getEventDetailsController)
)

/**
 * Publish or cancel or draft an event (mark status as 'published' or 'canceled' or 'draft') (organizer only)
 * - Method: PATCH
 * - Path: /:event_id
 * - Protected: requires `Authorization: Bearer <access_token>` and organizer role
 * - Params: `event_id` in URL (validated by `eventIdValidator`)
 * - Body: { status: 'published' } or { status: 'canceled' } or { status: 'draft' }
 * - Validations: `validateEventStatus`
 * - Success: 200 with updated event status
 */
eventsRouter.patch(
  '/:event_id/status',
  accessTokenValidator,
  organizerValidator,
  eventIdValidator,
  eventEventCreatorValidator,
  validateEventStatus,
  wrapRequestHandler(changeEventStatusController)
)

eventsRouter.get(
  '/:event_id/messages',
  accessTokenValidator,
  eventIdValidator,
  checkIfUserIsBannedFromEvent,
  eventJoinValidator,
  paginationValidator,
  wrapRequestHandler(getEventMessagesController)
)

eventsRouter.post(
  '/:event_id/messages',
  accessTokenValidator,
  eventIdValidator,
  checkIfUserIsBannedFromEvent,
  eventJoinValidator,
  messagesContentValidator,
  wrapRequestHandler(createEventMessagesController)
)

export default eventsRouter

import { NextFunction } from 'express-serve-static-core'
import { TokenPayload } from '~/models/requests/users.requests'
import { Request, Response } from 'express'
import { EVENTS_MESSAGES, TICKETS_MESSAGES } from '~/constants/messages'
import { validate } from '~/utils/validation'
import { checkSchema } from 'express-validator'
import { verifyToken } from '~/utils/jwt'
import { envConfig } from '~/constants/config'
import { capitalize } from 'lodash'
import { JsonWebTokenError } from 'jsonwebtoken'
import { TicketStatus } from '~/types/domain'

import Ticket from '~/models/schemas/Tickets.schema'
import databaseService from '~/services/database.services'
import Event from '~/models/schemas/Event.schema'
import ErrorWithStatus from '~/models/Errors'
import HTTP_STATUS from '~/constants/httpStatus'
import { isValidUUIDv4 } from '~/utils/uuid'

const ticket_status: TicketStatus[] = ['booked', 'checked_in', 'canceled']

/**
 * Ensure the authenticated user hasn't already booked the specified event.
 * - Reads `req.decoded_authorization.user_id` (set by `accessTokenValidator`) and
 *   `req.event` (set by `eventIdValidator`).
 * - Queries the tickets table to count existing bookings for the user/event.
 * - If a booking already exists, responds with 403 and `USERS_MESSAGES.ONE_USER_PER_EVENT_ONLY`.
 * - Calls `next()` when the user can book.
 */
export const bookTicketValidator = async (req: Request, res: Response, next: NextFunction) => {
  const { user_id } = req.decoded_authorization as TokenPayload
  const event_id = (req.event as Event[])[0].id
  const userEventCount = await databaseService.tickets(
    `
      SELECT
        events.status,
        events.organizer_id,
        events.capacity,
        (
          SELECT COUNT(*)
          FROM tickets
          WHERE tickets.user_id = $1
            AND tickets.event_id = $2
        ) AS ticket_count,
        (
          SELECT COUNT(*)
          FROM tickets
          WHERE tickets.event_id = $2
            -- optionally filter by status if you have cancelled/etc
            -- AND tickets.status IN ('booked', 'checked_in')
        ) AS event_ticket_count
      FROM events
      WHERE events.id = $2
    `,
    [user_id, event_id]
  )
  if (user_id === userEventCount.rows[0].organizer_id) {
    return next(
      new ErrorWithStatus({
        message: TICKETS_MESSAGES.EVENT_CREATOR_CANNOT_BOOK_TICKET,
        status: HTTP_STATUS.FORBIDDEN
      })
    )
  }
  if (userEventCount.rows[0].status != 'published') {
    return next(
      new ErrorWithStatus({
        message: TICKETS_MESSAGES.EVENT_STATUS_NOT_PUBLISHED,
        status: HTTP_STATUS.FORBIDDEN
      })
    )
  }
  const ticketCount = Number(userEventCount.rows[0].ticket_count)
  if (ticketCount >= 1) {
    return next(
      new ErrorWithStatus({
        message: TICKETS_MESSAGES.ONE_USER_PER_EVENT_ONLY,
        status: HTTP_STATUS.CONFLICT
      })
    )
  }
  const eventTicketCount = Number(userEventCount.rows[0].event_ticket_count)
  if (eventTicketCount >= userEventCount.rows[0].capacity) {
    return next(
      new ErrorWithStatus({
        message: TICKETS_MESSAGES.EVENT_CAPACITY_REACHED,
        status: HTTP_STATUS.CONFLICT
      })
    )
  }
  next()
}

/**
 * Validate and decode a ticket QR token provided in the request body (`qr_code_token`).
 * - Verifies the token using the QR secret and extracts `user_id` and `event_id`.
 * - Confirms a ticket exists for that user/event and that the associated event is published.
 * - Ensures the ticket is not already checked-in.
 * - On success attaches the found ticket(s) to `req.ticket` for downstream handlers.
 * - On failure throws an `ErrorWithStatus` so the global error handler can set the proper HTTP response.
 */
export const scanTicketValidator = validate(
  checkSchema(
    {
      qr_code_token: {
        custom: {
          options: async (value: string, { req }) => {
            if (!value) {
              throw new ErrorWithStatus({
                message: TICKETS_MESSAGES.QR_CODE_TOKEN_REQUIRED,
                status: HTTP_STATUS.BAD_REQUEST
              })
            }
            try {
              const decoded_qr_code_token = await verifyToken({
                token: value,
                secretOrPublicKey: envConfig.jwtSecretQRCodeToken as string
              })
              const { ticket_id, user_id, event_id } = decoded_qr_code_token
              const ticket = await databaseService.users(
                `
                  SELECT 
                    tickets.id, 
                    tickets.user_id,
                    tickets.status as ticket_status, 
                    events.status as event_status 
                  FROM tickets
                  JOIN events ON events.id = tickets.event_id 
                  WHERE tickets.id=$1 AND tickets.user_id=$2 AND tickets.event_id=$3`,
                [ticket_id, user_id, event_id]
              )
              const ban = await databaseService.event_bans(
                `
                  SELECT
                    user_id
                  FROM event_bans
                  WHERE event_id=$1 AND user_id=$2
                `,
                [event_id, user_id]
              )
              if (ticket.rows.length <= 0) {
                throw new ErrorWithStatus({
                  message: TICKETS_MESSAGES.TICKET_NOT_FOUND,
                  status: HTTP_STATUS.NOT_FOUND
                })
              }
              if (ticket.rows[0].event_status != 'published') {
                throw new ErrorWithStatus({
                  message: TICKETS_MESSAGES.EVENT_STATUS_NOT_PUBLISHED,
                  status: HTTP_STATUS.FORBIDDEN
                })
              }
              if (ticket.rows[0].ticket_status == 'checked_in') {
                throw new ErrorWithStatus({
                  message: TICKETS_MESSAGES.TICKET_ALREADY_CHECKED_IN,
                  status: HTTP_STATUS.CONFLICT
                })
              }
              if (ticket.rows[0].ticket_status == 'canceled') {
                throw new ErrorWithStatus({
                  message: TICKETS_MESSAGES.TICKET_IS_CANCELED,
                  status: HTTP_STATUS.CONFLICT
                })
              }
              if(ban.rows.length > 0) {
                throw new ErrorWithStatus({
                  message: TICKETS_MESSAGES.TICKET_USER_BANNED_FROM_EVENT,
                  status: HTTP_STATUS.FORBIDDEN
                })
              }
              req.ticket = ticket.rows
            } catch (error) {
              throw new ErrorWithStatus({
                message: capitalize((error as JsonWebTokenError).message),
                status: HTTP_STATUS.UNAUTHORIZED
              })
            }
            return true
          }
        }
      }
    },
    ['body']
  )
)

/**
 * Ensure the requester is the organizer (event creator) for the ticket's event.
 * - Expects `req.ticket` to be present (provided by `scanTicketValidator` or `ticketIdValidator`).
 * - Loads the organizer_id from the events table for the ticket's event and compares it
 *   with the authenticated `user_id` (from `req.decoded_authorization`).
 * - If the user is not the organizer, responds with 403 and `TICKETS_MESSAGES.USER_IS_NOT_EVENT_ORGANIZER`.
 * - Calls `next()` when authorized.
 */
export const ticketEventCreatorValidator = async (req: Request, res: Response, next: NextFunction) => {
  const { id: event_id } = (req.ticket as Ticket[])[0]
  const { user_id } = req.decoded_authorization as TokenPayload
  const events = await databaseService.events(
    `
      SELECT events.organizer_id 
      FROM events 
      JOIN tickets ON tickets.event_id = events.id
      WHERE tickets.id = $1
    `,
    [event_id]
  )
  if (events.rows.length <= 0) {
    return next(
      new ErrorWithStatus({
        message: EVENTS_MESSAGES.EVENT_NOT_FOUND,
        status: HTTP_STATUS.NOT_FOUND
      })
    )
  }
  if (user_id != events.rows[0].organizer_id) {
    return next(
      new ErrorWithStatus({
        message: TICKETS_MESSAGES.USER_IS_NOT_EVENT_ORGANIZER,
        status: HTTP_STATUS.FORBIDDEN
      })
    )
  }
  next()
}

/**
 * Validate optional `status` query parameter for ticket listing endpoints.
 * - Accepts only the statuses defined in `ticket_status` (['booked','checked_in']).
 * - Used by the ticket listing/search route to filter results by ticket state.
 */
export const getTicketStatusValidator = validate(
  checkSchema(
    {
      status: {
        optional: { options: { nullable: true } },
        isIn: {
          options: [ticket_status],
          errorMessage: TICKETS_MESSAGES.TICKET_STATUS_MUST_BE_BOOKED_CHECKED_IN_OR_CANCELED
        }
      }
    },
    ['query']
  )
)

/**
 * Validate `ticket_id` URL parameter and load full ticket details.
 * - Ensures `ticket_id` is a valid UUIDv4.
 * - Loads ticket and related event information from the database.
 * - Generates a QR image using `qrCode.generateQrTicketCode` and attaches a
 *   `ticket` object to `req.ticket` (without exposing the raw qr_code_token).
 * - Throws `ErrorWithStatus` for invalid ids or when the ticket is not found.
 */
export const ticketIdValidator = validate(
  checkSchema(
    {
      ticket_id: {
        custom: {
          options: async (values, { req }) => {
            if (!isValidUUIDv4(values)) {
              throw new ErrorWithStatus({
                status: HTTP_STATUS.BAD_REQUEST,
                message: EVENTS_MESSAGES.INVALID_EVENT_ID
              })
            }
            const ticketResult = await databaseService.events(
              `
                SELECT 
                  id
                FROM tickets 
                WHERE id=$1
              `,
              [values]
            )
            if (ticketResult.rows.length <= 0) {
              throw new ErrorWithStatus({
                status: HTTP_STATUS.NOT_FOUND,
                message: TICKETS_MESSAGES.TICKET_NOT_FOUND
              })
            }

            req.ticket = ticketResult.rows
            return true
          }
        }
      }
    },
    ['params']
  )
)

export const ticketOwnerValidator = async (req: Request, res: Response, next: NextFunction) => {
  const { user_id } = req.decoded_authorization as TokenPayload
  const ticketOwnerResult = await databaseService.tickets(`SELECT user_id FROM tickets WHERE user_id=$1`, [user_id])
  if (ticketOwnerResult.rows.length <= 0) {
    return next(
      new ErrorWithStatus({
        message: TICKETS_MESSAGES.CURRENT_USER_IS_NOT_TICKET_OWNER,
        status: HTTP_STATUS.FORBIDDEN
      })
    )
  }
  next()
}

export const cancelTicketStatusValidator = async (req: Request, res: Response, next: NextFunction) => {
  const { id: ticket_id } = (req.ticket as Ticket[])[0]
  const ticket = await databaseService.tickets(`SELECT status FROM tickets WHERE id=$1`, [ticket_id])
  if (ticket.rows[0].status != 'booked') {
    return next(
      new ErrorWithStatus({
        message: TICKETS_MESSAGES.ONLY_BOOKED_TICKETS_CAN_BE_CANCELED,
        status: HTTP_STATUS.FORBIDDEN
      })
    )
  }
  next()
}

import { check, checkSchema } from 'express-validator'
import { validate } from '~/utils/validation'
import { EVENTS_MESSAGES } from '~/constants/messages'
import { EventStatus } from '~/types/domain'
import { isValidUUIDv4 } from '~/utils/uuid'
import { Request, Response } from 'express'
import { NextFunction } from 'express-serve-static-core'

import ErrorWithStatus from '~/models/Errors'
import HTTP_STATUS from '~/constants/httpStatus'
import databaseService from '~/services/database.services'
import LIMIT_MIN_MAX from '~/constants/limits'
import Event from '~/models/schemas/Event.schema'

const event_statuts: EventStatus[] = ['draft', 'published', 'canceled']

/**
 * Validator: createEventValidator
 * - Purpose: validate the request body when creating an event
 * - Body fields validated: `title`, `description?`, `poster_url?`, `location_text`, `start_at`, `end_at`, `price_cents`, `capacity`, `status?`
 * - Rules: type checks, length limits, ISO8601 dates, end_at > start_at, positive numeric checks
 * - Side-effects: none (pure validation)
 */
export const createEventValidator = validate(
  checkSchema(
    {
      title: {
        trim: true,
        isString: {
          errorMessage: EVENTS_MESSAGES.EVENT_TITLE_MUST_BE_STRING
        },
        notEmpty: {
          errorMessage: EVENTS_MESSAGES.EVENT_TITLE_IS_REQUIRED
        },
        isLength: {
          options: {
            min: LIMIT_MIN_MAX.EVENT_TITLE_MIN,
            max: LIMIT_MIN_MAX.EVENT_TITLE_MAX
          },
          errorMessage: EVENTS_MESSAGES.EVENT_TITLE_MUST_BE_BETWEEN_6_AND_50
        }
      },
      description: {
        optional: { options: { nullable: true } },
        isString: {
          errorMessage: EVENTS_MESSAGES.EVENT_DESCRIPTION_MUST_BE_STRING
        },
        isLength: {
          options: {
            min: LIMIT_MIN_MAX.EVENT_DESCRIPTION_MIN,
            max: LIMIT_MIN_MAX.EVENT_DESCRIPTION_MAX
          },
          errorMessage: EVENTS_MESSAGES.EVENT_DESCRIPTION_MUST_BE_BETWEEN_10_AND_100
        },
        trim: true
      },
      location_text: {
        notEmpty: {
          errorMessage: EVENTS_MESSAGES.EVENT_LOCATION_IS_REQUIRED
        },
        isString: {
          errorMessage: EVENTS_MESSAGES.EVENT_LOCATION_TEXT_MUST_BE_STRING
        },
        isLength: {
          options: {
            min: LIMIT_MIN_MAX.EVENT_LOCATION_MIN,
            max: LIMIT_MIN_MAX.EVENT_LOCATION_MAX
          },
          errorMessage: EVENTS_MESSAGES
        },
        trim: true
      },
      start_at: {
        notEmpty: {
          errorMessage: EVENTS_MESSAGES.EVENT_START_AT_IS_REQUIRED
        },
        isISO8601: {
          options: { strict: true, strictSeparator: true },
          errorMessage: EVENTS_MESSAGES.EVENT_START_AT_MUST_BE_ISO8601
        },
        toDate: true
      },
      end_at: {
        notEmpty: {
          errorMessage: EVENTS_MESSAGES.EVENT_END_AT_IS_REQUIRED
        },
        isISO8601: {
          options: { strict: true, strictSeparator: true },
          errorMessage: EVENTS_MESSAGES.EVENT_END_AT_MUST_BE_ISO8601
        },
        toDate: true,
        custom: {
          options: (value, { req }) => {
            const start = Date.parse(req.body.start_at)
            const end = Date.parse(value)
            const current = Date.now()
            // If start is invalid, let the start_at validator report it.
            if (isNaN(start) || isNaN(end)) return true

            const maxStart = current + 30 * 24 * 60 * 60 * 1000 // 30 days

            if (start <= current) {
              throw new Error(EVENTS_MESSAGES.EVENT_START_AT_MUST_BE_IN_FUTURE)
            }
            if (start > maxStart) {
              throw new Error(EVENTS_MESSAGES.EVENT_START_AT_MUST_BE_WITHIN_30_DAYS)
            }
            if (end <= current) {
              throw new Error(EVENTS_MESSAGES.EVENT_END_AT_MUST_BE_IN_FUTURE)
            }
            if (end <= start) {
              throw new Error(EVENTS_MESSAGES.EVENT_END_AT_MUST_BE_AFTER_START_AT)
            }
            return true
          }
        }
      },
      price_cents: {
        notEmpty: {
          errorMessage: EVENTS_MESSAGES.EVENT_PRICE_IS_REQUIRED
        },
        isNumeric: {
          errorMessage: EVENTS_MESSAGES.EVENT_PRICE_MUST_BE_NUMERIC
        },
        toInt: true,
        custom: {
          options: (value, { req }) => {
            return value > 0
          },
          errorMessage: EVENTS_MESSAGES.EVENT_PRICE_MUST_BE_POSITIVE
        }
      },
      capacity: {
        notEmpty: {
          errorMessage: EVENTS_MESSAGES.EVENT_CAPACITY_IS_REQUIRED
        },
        isNumeric: {
          errorMessage: EVENTS_MESSAGES.EVENT_CAPACITY_MUST_BE_NUMBER
        },
        toInt: true,
        custom: {
          options: (value, { req }) => {
            return value > 0
          },
          errorMessage: EVENTS_MESSAGES.EVENT_CAPACITY_MUST_BE_POSITIVE
        }
      }
    },
    ['body']
  )
)

/**
 * Validator: updateEventValidator
 * - Purpose: validate event update payloads (same constraints as create but used for PATCH)
 * - Body: updatable fields with the same semantic checks as creation
 */
export const updateEventValidator = validate(
  checkSchema(
    {
      title: {
        trim: true,
        isString: {
          errorMessage: EVENTS_MESSAGES.EVENT_TITLE_MUST_BE_STRING
        },
        notEmpty: {
          errorMessage: EVENTS_MESSAGES.EVENT_TITLE_IS_REQUIRED
        },
        isLength: {
          options: {
            min: LIMIT_MIN_MAX.EVENT_TITLE_MIN,
            max: LIMIT_MIN_MAX.EVENT_TITLE_MAX
          },
          errorMessage: EVENTS_MESSAGES.EVENT_TITLE_MUST_BE_BETWEEN_6_AND_50
        }
      },
      description: {
        optional: { options: { nullable: true } },
        isString: {
          errorMessage: EVENTS_MESSAGES.EVENT_DESCRIPTION_MUST_BE_STRING
        },
        isLength: {
          options: {
            min: LIMIT_MIN_MAX.EVENT_DESCRIPTION_MIN,
            max: LIMIT_MIN_MAX.EVENT_DESCRIPTION_MAX
          },
          errorMessage: EVENTS_MESSAGES.EVENT_DESCRIPTION_MUST_BE_BETWEEN_10_AND_100
        },
        trim: true
      },
      location_text: {
        isString: {
          errorMessage: EVENTS_MESSAGES
        },
        isLength: {
          options: {
            min: LIMIT_MIN_MAX.EVENT_LOCATION_MIN,
            max: LIMIT_MIN_MAX.EVENT_LOCATION_MAX
          },
          errorMessage: EVENTS_MESSAGES
        },
        trim: true
      },
      start_at: {
        notEmpty: {
          errorMessage: EVENTS_MESSAGES.EVENT_START_AT_IS_REQUIRED
        },
        isISO8601: {
          options: { strict: true, strictSeparator: true },
          errorMessage: EVENTS_MESSAGES.EVENT_START_AT_MUST_BE_ISO8601
        },
        toDate: true
      },
      end_at: {
        notEmpty: {
          errorMessage: EVENTS_MESSAGES.EVENT_END_AT_IS_REQUIRED
        },
        isISO8601: {
          options: { strict: true, strictSeparator: true },
          errorMessage: EVENTS_MESSAGES.EVENT_END_AT_MUST_BE_ISO8601
        },
        custom: {
          options: (value, { req }) => {
            const start = Date.parse(req.body.start_at)
            const end = Date.parse(value)
            // If start is invalid, let the start_at validator report it.
            if (isNaN(start) || isNaN(end)) return true
            return end > start
          },
          errorMessage: EVENTS_MESSAGES.EVENT_END_AT_MUST_BE_AFTER_START_AT
        },
        toDate: true
      },
      price_cents: {
        isNumeric: {
          errorMessage: EVENTS_MESSAGES.EVENT_PRICE_MUST_BE_NUMERIC
        },
        toInt: true,
        custom: {
          options: (value, { req }) => {
            return value > 0
          },
          errorMessage: EVENTS_MESSAGES.EVENT_PRICE_MUST_BE_POSITIVE
        }
      },
      capacity: {
        isNumeric: {
          errorMessage: EVENTS_MESSAGES.EVENT_CAPACITY_MUST_BE_NUMBER
        },
        toInt: true,
        custom: {
          options: (value, { req }) => {
            return value > 0
          },
          errorMessage: EVENTS_MESSAGES.EVENT_CAPACITY_MUST_BE_POSITIVE
        }
      }
    },
    ['body']
  )
)

/**
 * Validator: paginationValidator
 * - Purpose: validate `limit` and `page` query parameters for paginated listing endpoints
 * - Rules: `limit` must be within allowed range, `page` must be >= 1
 */
export const paginationValidator = validate(
  checkSchema(
    {
      limit: {
        isNumeric: true,
        custom: {
          options: async (value, { req }) => {
            const num = Number(value)
            if (num > LIMIT_MIN_MAX.EVENT_PER_PAGE_MAX || num < LIMIT_MIN_MAX.EVENT_PER_PAGE_MIN) {
              throw new Error(EVENTS_MESSAGES.EVENTS_LENGTH_PER_PAGE_IS_BETWEEN_1_AND_50)
            }
          }
        }
      },
      page: {
        isNumeric: true,
        custom: {
          options: async (values, { req }) => {
            const num = Number(values)
            if (num < 1) {
              throw new Error(EVENTS_MESSAGES.NUMBER_OF_PAGE_MUST_BE_GREATER_THAN_0)
            }
          }
        }
      }
    },
    ['query']
  )
)

/**
 * Validator: searchValidator
 * - Purpose: validate search query parameter `q` (optional)
 * - Rules: if present, `q` must be a trimmed string with allowed length
 */
export const searchValidator = validate(
  checkSchema(
    {
      q: {
        optional: { options: { nullable: true } },
        isString: {
          errorMessage: EVENTS_MESSAGES.SEARCH_MUST_BE_STRING
        },
        trim: true,
        isLength: {
          options: {
            min: LIMIT_MIN_MAX.SEARCH_MIN,
            max: LIMIT_MIN_MAX.SEARCH_MAX
          },
          errorMessage: EVENTS_MESSAGES.MAXIMUM_SEARCH_LENGTH_MUST_BE_BETWEEN_3_AND_20
        }
      }
    },
    ['query']
  )
)

/**
 * Validator: eventIdValidator
 * - Purpose: validate `event_id` param and load event data
 * - Params: `event_id` (must be a valid UUIDv4)
 * - Side-effects: queries the DB for the event; if found attaches `req.event` = event.rows
 * - Errors: throws 400 for invalid id, 404 if event not found
 */
export const eventIdValidator = validate(
  checkSchema(
    {
      event_id: {
        custom: {
          options: async (values, { req }) => {
            if (!isValidUUIDv4(values)) {
              throw new ErrorWithStatus({
                status: HTTP_STATUS.BAD_REQUEST,
                message: EVENTS_MESSAGES.INVALID_EVENT_ID
              })
            }
            const event = await databaseService.events(
              `
                SELECT 
                  events.id, 
                  users.name as organizer_name, 
                  events.title, 
                  events.description, 
                  events.poster_url, 
                  events.location_text, 
                  events.start_at, 
                  events.end_at, 
                  events.price_cents, 
                  events.checked_in, 
                  events.capacity, 
                  events.status 
                FROM events 
                JOIN users ON events.organizer_id = users.id
                WHERE events.id=$1
              `,
              [values]
            )
            if (event.rows.length <= 0) {
              throw new ErrorWithStatus({
                status: HTTP_STATUS.NOT_FOUND,
                message: EVENTS_MESSAGES.EVENT_NOT_FOUND
              })
            }
            req.event = event.rows
            return true
          }
        }
      }
    },
    ['params', 'body']
  )
)

/**
 * Guard factory: changeEventStatusValidator
 * - Purpose: create middleware that ensures the current event is in an expected status
 * - Usage: pass the allowed status, an error message and an http status code
 * - Side-effects: expects `req.event` to exist (populated by `eventIdValidator`) and forwards a
 *   `ErrorWithStatus` when the event's status does not match `allowedStatus`.
 */
export const changeEventStatusValidator =
  (allowedStatus: string, errorMessage: string, httpStatus: number) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const events = req.event as Event[]
    const event = events[0]
    if (event.status != allowedStatus) {
      return next(
        new ErrorWithStatus({
          message: errorMessage,
          status: httpStatus
        })
      )
    }
    next()
  }

/**
 * Validator: getEventStatusValidator
 * - Purpose: validate optional `status` query parameter when filtering organizer events
 */
export const getEventStatusValidator = validate(
  checkSchema(
    {
      status: {
        optional: { options: { nullable: true } },
        isIn: {
          options: [event_statuts],
          errorMessage: EVENTS_MESSAGES.EVENT_STATUS_MUST_BE_DRAFT_PUBLISHED_CANCELED
        }
      }
    },
    ['query']
  )
)

/**
 * Guard: updateEventStatusValidator
 * - Ensures event is in `draft` before allowing status updates specific to editing
 */
export const updateEventStatusValidator = changeEventStatusValidator(
  'draft',
  EVENTS_MESSAGES.CHANGE_EVENT_ONLY_ALLOWED_ON_DRAFT,
  HTTP_STATUS.CONFLICT
)

/**
 * Guard: uploadEventPosterStatusValidator
 * - Ensures event is in `draft` before uploading poster
 */
export const uploadEventPosterStatusValidator = changeEventStatusValidator(
  'draft',
  EVENTS_MESSAGES.EVENT_POSTER_ONLY_ALLOWED_ON_DRAFT,
  HTTP_STATUS.CONFLICT
)

/**
 * Guard: getPublishedEventStatusValidator
 * - Ensures event is in `published` when returning public event details
 */
export const getPublishedEventStatusValidator = changeEventStatusValidator(
  'published',
  EVENTS_MESSAGES.GET_EVENT_DETAILS_IS_ONLY_ON_PUBLISHED,
  HTTP_STATUS.CONFLICT
)

/**
 * Guard: changeEventStatusValidator
 * - Ensures event have suitable status before allowing changes
 */
export const validateEventStatus = validate(
  checkSchema(
    {
      status: {
        notEmpty: {
          errorMessage: EVENTS_MESSAGES.EVENT_STATUS_IS_REQUIRED
        },
        isString: {
          errorMessage: EVENTS_MESSAGES.EVENT_STATUS_MUST_BE_STRING
        },
        isIn: {
          options: [event_statuts],
          errorMessage: EVENTS_MESSAGES.EVENT_STATUS_MUST_BE_DRAFT_PUBLISHED_CANCELED
        },
        custom: {
          options: async (value, { req }) => {
            const eventStatus = (req.event as Event[])[0].status
            const nextStatus = value

            const allowedTransitions: Record<string, string[]> = {
              draft: ['published'],
              published: ['canceled'],
              canceled: ['draft']
            }

            if (!allowedTransitions[eventStatus].includes(nextStatus)) {
              throw new ErrorWithStatus({
                message: EVENTS_MESSAGES.EVENT_INVALID_STATUS_TRANSITION,
                status: HTTP_STATUS.CONFLICT
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

export const messagesContentValidator = validate(
  checkSchema({
    content: {
      notEmpty: {
        errorMessage: EVENTS_MESSAGES.MESSAGE_CONTENT_MUST_NOT_BE_EMPTY
      },
      isString: {
        errorMessage: EVENTS_MESSAGES.MESSAGE_CONTENT_MUST_BE_STRING
      },
      isLength: {
        options: {
          min: LIMIT_MIN_MAX.MESSAGE_CONTENT_MIN,
          max: LIMIT_MIN_MAX.MESSAGE_CONTENT_MAX
        },
        errorMessage: EVENTS_MESSAGES.MESSAGE_CONTENT_MUST_BETWEEN_1_AND_200
      },
      trim: true
    }
  })
)

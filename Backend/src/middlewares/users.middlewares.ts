import { checkSchema, ParamSchema } from 'express-validator'
import { EVENTS_MESSAGES, TICKETS_MESSAGES, USERS_MESSAGES } from '~/constants/messages'
import { validate } from '~/utils/validation'
import { UserRole } from '~/types/domain'
import { hashPassword } from '~/utils/crypto'
import { verifyAccessToken } from '~/utils/common'
import { Request, Response } from 'express'
import { verifyToken } from '~/utils/jwt'
import { envConfig } from '~/constants/config'
import { JsonWebTokenError } from 'jsonwebtoken'
import { capitalize } from 'lodash'
import { NextFunction } from 'express-serve-static-core'
import { TokenPayload } from '~/models/requests/users.requests'

import userService from '~/services/users.services'
import databaseService from '~/services/database.services'
import ErrorWithStatus from '~/models/Errors'
import HTTP_STATUS from '~/constants/httpStatus'
import LIMIT_MIN_MAX from '~/constants/limits'
import Event from '~/models/schemas/Event.schema'

// Allowed user roles
const user_roles: UserRole[] = ['attendee', 'organizer']

/**
 * Shared password validation rules
 * - Used by registration and password-reset validators
 * - Enforces non-empty string, length constraints and a strong-password policy
 */
const passwordSchema: ParamSchema = {
  notEmpty: {
    errorMessage: USERS_MESSAGES.PASSWORD_IS_REQUIRED
  },
  isString: {
    errorMessage: USERS_MESSAGES.PASSWORD_MUST_BE_A_STRING
  },
  isLength: {
    options: { min: LIMIT_MIN_MAX.PASSWORD_LENGTH_MIN, max: LIMIT_MIN_MAX.PASSWORD_LENGTH_MAX },
    errorMessage: USERS_MESSAGES.PASSWORD_MUST_BE_FROM_8_TO_24
  },
  isStrongPassword: {
    options: {
      minLength: LIMIT_MIN_MAX.STRONG_PASSWORD_MIN_LENGTH,
      minLowercase: LIMIT_MIN_MAX.STRONG_PASSWORD_MIN_LOWERCASE,
      minUppercase: LIMIT_MIN_MAX.STRONG_PASSWORD_MIN_UPPERCASE,
      minNumbers: LIMIT_MIN_MAX.STRONG_PASSWORD_MIN_NUMBER,
      minSymbols: LIMIT_MIN_MAX.STRONG_PASSWORD_MIN_SYMBOL
    },
    errorMessage: USERS_MESSAGES.STRONG_PASSWORD
  }
}

/**
 * Shared name validation rules
 * - Trims whitespace and enforces min/max length
 */
const nameSchema: ParamSchema = {
  trim: true,
  notEmpty: {
    errorMessage: USERS_MESSAGES.NAME_IS_REQUIRED
  },
  isString: {
    errorMessage: USERS_MESSAGES.NAME_MUST_BE_A_STRING
  },
  isLength: {
    options: {
      min: LIMIT_MIN_MAX.NAME_LENGTH_MIN,
      max: LIMIT_MIN_MAX.NAME_LENGTH_MAX
    },
    errorMessage: USERS_MESSAGES.NAME_LENGTH_MUST_BE_FROM_3_TO_100
  }
}

/**
 * Optional avatar URL rules
 * - Validates that provided `avatar_url` (if present) is a string and within length limits
 */
const imageSchema: ParamSchema = {
  trim: true,
  optional: true,
  isString: {
    errorMessage: USERS_MESSAGES.IMAGE_URL_MUST_BE_A_STRING
  },
  isLength: {
    options: {
      min: LIMIT_MIN_MAX.IMAGE_LENGTH_MIN,
      max: LIMIT_MIN_MAX.IMAGE_LENGTH_MAX
    },
    errorMessage: USERS_MESSAGES.IMAGE_URL_MUST_BE_BETWEEN_1_AND_400
  }
}

/**
 * Validate and decode a `forgot_password_token` value
 * - Body: { forgot_password_token }
 * - Ensures the token is present, verifies the JWT, checks the token is still stored on the user
 * - On success: attaches `req.decoded_forgot_password_token` for downstream handlers
 * - On failure: throws `ErrorWithStatus` (401/404) with explanatory message
 */
const forgotPasswordTokenSchema: ParamSchema = {
  custom: {
    options: async (value: string, { req }) => {
      if (!value) {
        throw new ErrorWithStatus({
          message: USERS_MESSAGES.FORGOT_PASSWORD_TOKEN_REQUIRED,
          status: HTTP_STATUS.UNAUTHORIZED
        })
      }
      try {
        const decoded_forgot_password_token = await verifyToken({
          token: value,
          secretOrPublicKey: envConfig.jwtSecretForgotPasswordToken as string
        })
        const { user_id } = decoded_forgot_password_token
        const user = await databaseService.users(`SELECT id, forgot_password_token FROM users WHERE id=$1`, [user_id])
        if (user.rows.length <= 0) {
          throw new ErrorWithStatus({
            message: USERS_MESSAGES.USER_NOT_FOUND,
            status: HTTP_STATUS.NOT_FOUND
          })
        }

        // Prevent multiple forgot_password_token verification
        if (user.rows[0].forgot_password_token != value) {
          throw new ErrorWithStatus({
            message: USERS_MESSAGES.INVALID_FORGOT_PASSWORD_TOKEN,
            status: HTTP_STATUS.UNAUTHORIZED
          })
        }
        req.decoded_forgot_password_token = decoded_forgot_password_token
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

/**
 * Confirm-password validator factory
 * - Ensures the `confirm_password` value matches the given `customField` in the request body
 */
const confirmPasswordSchema = (customField: string): ParamSchema => ({
  notEmpty: {
    errorMessage: USERS_MESSAGES.CONFIRM_PASSWORD_IS_REQUIRED
  },
  isString: {
    errorMessage: USERS_MESSAGES.CONFIRM_PASSWORD_MUST_BE_A_STRING
  },
  isLength: {
    options: { min: LIMIT_MIN_MAX.PASSWORD_LENGTH_MIN, max: LIMIT_MIN_MAX.PASSWORD_LENGTH_MAX },
    errorMessage: USERS_MESSAGES.CONFIRM_PASSWORD_MUST_BE_FROM_8_TO_24
  },
  custom: {
    options: (value, { req }) => {
      if (value !== req.body[customField]) {
        throw new Error(USERS_MESSAGES.CONFIRM_PASSWORD_DOES_NOT_MATCH_PASSWORD)
      }
      return true
    }
  }
})

/**
 * Register validator
 * - Body: { name, email, password, confirm_password }
 * - Ensures required fields, password strength, and that the email is not already registered
 * - On success: request proceeds to the controller to create the user
 * - On failure: throws a validation error with a descriptive message
 */
export const registerValidator = validate(
  checkSchema(
    {
      name: nameSchema,
      email: {
        isEmail: {
          errorMessage: USERS_MESSAGES.EMAIL_IS_INVALID
        },
        notEmpty: {
          errorMessage: USERS_MESSAGES.EMAIL_IS_REQUIRED
        },
        trim: true,
        custom: {
          options: async (value) => {
            const isExistEmail = await userService.checkEmailExist(value)
            if (isExistEmail) {
              throw new Error(USERS_MESSAGES.EMAIL_ALREADY_EXISTS)
            }
            return true
          }
        }
      },
      password: passwordSchema,
      confirm_password: confirmPasswordSchema('password')
    },
    ['body']
  )
)

/**
 * Login validator
 * - Body: { email, password }
 * - Verifies credentials against the database and attaches `req.user = { id, verified }` on success
 * - On failure: throws an error indicating incorrect email/password
 */
export const loginValidator = validate(
  checkSchema(
    {
      email: {
        isEmail: {
          errorMessage: USERS_MESSAGES.EMAIL_IS_INVALID
        },
        trim: true,
        custom: {
          options: async (value, { req }) => {
            const userRow = await databaseService.users(
              `SELECT id, verified FROM users WHERE email=$1 AND password_hash=$2`,
              [value, hashPassword(req.body.password)]
            )
            if (userRow.rows.length <= 0) {
              throw new Error(USERS_MESSAGES.EMAIL_OR_PASSWORD_IS_INCORRECT)
            }
            req.user = userRow.rows[0]
            return true
          }
        }
      },
      password: {
        notEmpty: {
          errorMessage: USERS_MESSAGES.PASSWORD_IS_REQUIRED
        },
        isString: {
          errorMessage: USERS_MESSAGES.PASSWORD_MUST_BE_A_STRING
        }
      }
    },
    ['body']
  )
)

/**
 * Access token validator
 * - Header: Authorization: Bearer <access_token>
 * - Delegates to `verifyAccessToken` which validates the token and attaches decoded payload on `req`
 * - Must be run before handlers that depend on `req.decoded_authorization`
 */
export const accessTokenValidator = validate(
  checkSchema(
    {
      Authorization: {
        custom: {
          options: async (value: string, { req }) => {
            const access_token = (value || '').split(' ')[1]
            return await verifyAccessToken(access_token, req as Request)
          }
        }
      }
    },
    ['headers']
  )
)

/**
 * Refresh token validator
 * - Body: { refresh_token }
 * - Verifies the refresh JWT and ensures the token exists in persistence (prevents reuse)
 * - On success attaches `req.decoded_refresh_token` for the refresh controller to use
 * - On failure: throws 401/404 as appropriate
 */
export const refreshTokenValidator = validate(
  checkSchema(
    {
      refresh_token: {
        trim: true,
        custom: {
          options: async (value: string, { req }) => {
            if (!value) {
              throw new ErrorWithStatus({
                message: USERS_MESSAGES.ACCESS_TOKEN_REQUIRED,
                status: HTTP_STATUS.UNAUTHORIZED
              })
            }
            try {
              // Verify token and check presence in persistence
              const [decoded_refresh_token, refresh_token_row] = await Promise.all([
                verifyToken({
                  token: value,
                  secretOrPublicKey: envConfig.jwtSecretRefreshToken as string
                }),
                databaseService.refresh_tokens(`SELECT token_hash FROM refresh_tokens WHERE token_hash=$1`, [value])
              ])
              if (refresh_token_row.rows.length <= 0) {
                throw new ErrorWithStatus({
                  message: USERS_MESSAGES.USED_REFRESH_TOKEN_OR_NOT_EXIST,
                  status: HTTP_STATUS.UNAUTHORIZED
                })
              }
              // Attach decoded payload for downstream handlers
              req.decoded_refresh_token = decoded_refresh_token
            } catch (error) {
              // Normalize JWT errors to 401 with capitalized message
              if (error instanceof JsonWebTokenError) {
                throw new ErrorWithStatus({
                  message: capitalize((error as JsonWebTokenError).message),
                  status: HTTP_STATUS.UNAUTHORIZED
                })
              }
              // Re-throw non-JWT errors
              throw error
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
 * Organizer role guard
 * - Ensures the authenticated user (from `req.decoded_authorization`) has the 'organizer' role
 * - Intended to be used after `accessTokenValidator`
 * - On failure: forwards a 403 Forbidden error
 */
export const organizerValidator = async (req: Request, res: Response, next: NextFunction) => {
  const { user_id } = req.decoded_authorization as TokenPayload
  const role = await databaseService.user_roles(`SELECT role FROM user_roles WHERE user_id=$1 AND role=$2`, [
    user_id,
    'organizer'
  ])
  if (role.rows.length <= 0) {
    return next(
      new ErrorWithStatus({
        message: USERS_MESSAGES.MUST_BE_ORGANIZER,
        status: HTTP_STATUS.FORBIDDEN
      })
    )
  }
  next()
}

/**
 * Update-me validator
 * - Body: { name?, role? }
 * - Validates `name` using shared rules; `role` may be changed only to 'organizer' and only
 *   when the user is verified and does not already have the role
 */
export const updateMeValidator = validate(
  checkSchema(
    {
      name: nameSchema,
      role: {
        optional: { options: { nullable: true } },
        isString: {
          errorMessage: USERS_MESSAGES.ROLE_MUST_BE_A_STRING
        },
        isIn: {
          options: [user_roles[1]],
          errorMessage: USERS_MESSAGES.UPDATE_ROLE_MUST_BE_ORGANIZER
        },
        custom: {
          options: async (value, { req }) => {
            // Only allow changing to 'organizer'
            if (value != 'organizer') {
              throw new Error(USERS_MESSAGES.UPDATE_ROLE_MUST_BE_ORGANIZER)
            }
            // Prevent updating to the same role
            const user = req.decoded_authorization as TokenPayload
            const user_id = user.user_id
            const verify = user.verify

            const isVerified = verify === 'verified'
            const isExistRole = await userService.checkRoleExist(user_id, value)

            if (!isVerified) {
              throw new Error(USERS_MESSAGES.USER_MUST_BE_VERIFIED_TO_BE_ORGANIZER)
            }
            if (isExistRole) {
              throw new Error(USERS_MESSAGES.USER_ALREADY_HAVE_THIS_ROLE)
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
 * Send-email validator
 * - Ensures the user's email is not already verified before sending a verification email
 * - Reads user row from DB; if already verified, short-circuits with a 200 (OK) response message
 * - On success attaches `req.user` for the controller to use
 */
export const sendEmailValidator = async (req: Request, res: Response, next: NextFunction) => {
  const { user_id } = req.decoded_authorization as TokenPayload
  const userRow = await databaseService.users(`SELECT id, verified, email FROM users WHERE id=$1`, [user_id])
  if (userRow.rows[0].verified == 'verified') {
    return next(
      new ErrorWithStatus({
        message: USERS_MESSAGES.EMAIL_ALREADY_VERIFIED,
        status: HTTP_STATUS.CONFLICT
      })
    )
  }
  req.user = userRow.rows[0]
  next()
}

/**
 * Email verification token validator
 * - Body: { email_verify_token }
 * - Verifies the email verification JWT, checks DB for matching token and attaches
 *   `req.decoded_email_verify_token` on success
 * - On failure: throws 401/404 with descriptive message
 */
export const emailVerifyTokenValidator = validate(
  checkSchema(
    {
      email_verify_token: {
        custom: {
          options: async (value: string, { req }) => {
            if (!value) {
              throw new ErrorWithStatus({
                message: USERS_MESSAGES.EMAIL_VERIFY_TOKEN_IS_REQUIRED,
                status: HTTP_STATUS.UNAUTHORIZED
              })
            }
            try {
              const decoded_email_verify_token = await verifyToken({
                token: value,
                secretOrPublicKey: envConfig.jwtSecretEmailVerifyToken as string
              })
              const { user_id } = decoded_email_verify_token
              const user = await databaseService.users(
                `SELECT email_verify_token FROM users WHERE id=$1 AND email_verify_token=$2`,
                [user_id, value]
              )
              if (user.rows.length <= 0) {
                throw new ErrorWithStatus({
                  message: USERS_MESSAGES.USER_NOT_FOUND,
                  status: HTTP_STATUS.NOT_FOUND
                })
              }
              if (user.rows[0].email_verify_token != value) {
                throw new ErrorWithStatus({
                  message: USERS_MESSAGES.INVALID_EMAIL_VERIFY_TOKEN,
                  status: HTTP_STATUS.UNAUTHORIZED
                })
              }
              req.decoded_email_verify_token = decoded_email_verify_token
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
 * Forgot-password request validator
 * - Body: { email }
 * - Ensures the provided email belongs to a user and attaches `req.user` for downstream use
 */
export const forgotPasswordValidator = validate(
  checkSchema(
    {
      email: {
        isEmail: {
          errorMessage: USERS_MESSAGES.EMAIL_IS_INVALID
        },
        trim: true,
        custom: {
          options: async (value, { req }) => {
            const user = await databaseService.users(`SELECT id, email, verified FROM users WHERE email=$1`, [value])
            if (user.rows.length <= 0) {
              throw new Error(USERS_MESSAGES.USER_NOT_FOUND)
            }
            req.user = user.rows[0]
            return true
          }
        }
      }
    },
    ['body']
  )
)

/**
 * Verify-forgot-password token validator
 * - Body: { forgot_password_token }
 * - Uses `forgotPasswordTokenSchema` to validate and decode the token; on success attaches
 *   `req.decoded_forgot_password_token`
 */
export const verifyForgotPasswordTokenValidator = validate(
  checkSchema(
    {
      forgot_password_token: forgotPasswordTokenSchema
    },
    ['body']
  )
)

/**
 * Reset-password validator
 * - Body: { password, confirm_password, forgot_password_token }
 * - Validates password rules and the forgot-password token before allowing a password change
 */
export const resetPasswordValidator = validate(
  checkSchema(
    {
      password: passwordSchema,
      confirm_password: confirmPasswordSchema('password'),
      forgot_password_token: forgotPasswordTokenSchema
    },
    ['body']
  )
)

/**
 * Ensure the requester is the organizer (event creator) for the event's details.
 * - Expects `req.params.event_id` to be present (provided by `eventIdValidator`).
 * - Loads the organizer_id from the events table for the event and compares it
 *   with the authenticated `user_id` (from `req.decoded_authorization`).
 * - If the user is not the organizer, responds with 403 and `EVENTS.MUST_BE_ORGANIZER`.
 * - Calls `next()` when authorized.
 */
export const eventEventCreatorValidator = async (req: Request, res: Response, next: NextFunction) => {
  const event_id = req.params.event_id
  const { user_id } = req.decoded_authorization as TokenPayload
  const events = await databaseService.events(
    `
      SELECT organizer_id 
      FROM events 
      WHERE id = $1
    `,
    [event_id]
  )
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

export const alreadyBannedValidator = async (req: Request, res: Response, next: NextFunction) => {
  const event_id = (req.event as Event[])[0].id
  const user_id = req.params.user_id
  const bannedAttendee = await databaseService.event_bans(
    `
      SELECT user_id
      FROM event_bans
      WHERE event_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [event_id, user_id]
  )
  if (bannedAttendee.rows.length > 0) {
    return next(
      new ErrorWithStatus({
        message: USERS_MESSAGES.USER_IS_ALREADY_BANNED_FROM_THIS_EVENT,
        status: HTTP_STATUS.FORBIDDEN
      })
    )
  }
  next()
}

export const checkIfUserIsBannedFromEvent = async (req: Request, res: Response, next: NextFunction) => {
  const event_id = (req.event as Event[])[0].id
  const { user_id } = req.decoded_authorization as TokenPayload
  const bannedAttendee = await databaseService.event_bans(
    `
      SELECT user_id
      FROM event_bans
      WHERE event_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [event_id, user_id]
  )
  if (bannedAttendee.rows.length > 0) {
    return next(
      new ErrorWithStatus({
        message: USERS_MESSAGES.USER_IS_BANNED_FROM_THIS_EVENT,
        status: HTTP_STATUS.FORBIDDEN
      })
    )
  }
  next()
}

export const banReasonValidator = validate(
  checkSchema({
    reason: {
      optional: { options: { nullable: true } },
      isString: {
        errorMessage: EVENTS_MESSAGES.BANNING_REASON_MUST_BE_A_STRING
      },
      trim: true,
      isLength: {
        options: { max: LIMIT_MIN_MAX.BAN_REASON_LENGTH_MAX, min: LIMIT_MIN_MAX.BAN_REASON_LENGTH_MIN },
        errorMessage: EVENTS_MESSAGES.BANNING_REASON_MUST_BETWEEN_3_AND_255
      }
    }
  })
)
export const eventJoinValidator = async (req: Request, res: Response, next: NextFunction) => {
  const event_id = (req.event as Event[])[0].id
  const { user_id } = req.decoded_authorization as TokenPayload
  const attendee = await databaseService.tickets(
    `
      SELECT
        1
      FROM tickets
      WHERE event_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [event_id, user_id]
  )
  const organizer = await databaseService.tickets(
    `
      SELECT
        1
      FROM events
      WHERE id = $1 AND organizer_id = $2
      LIMIT 1
    `,
    [event_id, user_id]
  )
  if (attendee.rows.length <= 0 && organizer.rows.length <= 0) {
    return next(
      new ErrorWithStatus({
        message: TICKETS_MESSAGES.USER_IS_NOT_EVENT_ATTENDEE_OR_ORGANIZER,
        status: HTTP_STATUS.FORBIDDEN
      })
    )
  }
  next()
}

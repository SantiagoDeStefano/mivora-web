import { Request, Response } from 'express'
import { NextFunction, ParamsDictionary } from 'express-serve-static-core'
import { USERS_MESSAGES } from '~/constants/messages'
import {
  ForgotPasswordRequestBody,
  LoginRequestBody,
  LogoutRequestBody,
  RefreshTokenRequestBody,
  RegisterRequestBody,
  ResetPasswordRequestBody,
  TokenPayload,
  UpdateMeRequestBody,
  VerifyEmailRequestBody,
  VerifyForgotPasswordRequestBody
} from '~/models/requests/users.requests'
import { UUIDv4 } from '~/types/common'
import { UserVerificationStatus } from '~/types/domain'
import User from '~/models/schemas/User.schema'
import userService from '~/services/users.services'
import mediasService from '~/services/medias.services'

/**
 * Register controller
 * - Route: POST /register
 * - Public endpoint
 * - Body: { name, email, password, confirm_password }
 * - Action: creates a new user, stores hashed password and role, and returns auth tokens
 * - Response: JSON { message, result } where result contains `{ access_token, refresh_token }`
 */
export const registerController = async (
  req: Request<ParamsDictionary, unknown, RegisterRequestBody>,
  res: Response
): Promise<void> => {
  const result = await userService.register(req.body)
  res.json({
    message: USERS_MESSAGES.REGISTER_SUCCESS,
    result
  })
  return
}

/**
 * Login controller
 * - Route: POST /login
 * - Public endpoint
 * - Body: { email, password }
 * - Action: verifies credentials and returns a new access/refresh token pair
 * - Side-effect: `loginValidator` attaches `req.user` before this runs
 * - Response: JSON { message, result } where result contains `{ access_token, refresh_token }`
 */
export const loginController = async (
  req: Request<ParamsDictionary, unknown, LoginRequestBody>,
  res: Response
): Promise<void> => {
  const user = req.user
  const user_id = user?.id as UUIDv4
  const verified = user?.verified as UserVerificationStatus
  const result = await userService.login(user_id, verified)
  res.json({
    message: USERS_MESSAGES.LOGIN_SUCCESS,
    result
  })
  return
}

/**
 * Logout controller
 * - Route: POST /logout
 * - Protected: requires a refresh token in the request body
 * - Body: { refresh_token }
 * - Action: revokes the refresh token from persistence
 * - Response: JSON { message }
 */
export const logoutController = async (
  req: Request<ParamsDictionary, unknown, LogoutRequestBody>,
  res: Response
): Promise<void> => {
  const { refresh_token } = req.body
  await userService.logout(refresh_token)
  res.json({
    message: USERS_MESSAGES.LOGOUT_SUCCESS
  })
  return
}

/**
 * Refresh-token controller
 * - Route: POST /refresh-token
 * - Public endpoint but requires a valid `refresh_token` in the body
 * - Body: { refresh_token }
 * - Action: validates the provided refresh token and issues a new token pair
 * - Side-effect: `refreshTokenValidator` attaches `req.decoded_refresh_token`
 * - Response: JSON { message, result } where result contains `{ access_token, refresh_token }`
 */
export const refreshTokenController = async (
  req: Request<ParamsDictionary, unknown, RefreshTokenRequestBody>,
  res: Response
): Promise<void> => {
  const { refresh_token } = req.body
  const { user_id, verify, exp } = req.decoded_refresh_token as TokenPayload
  const result = await userService.refreshToken({ user_id, refresh_token, verify, exp })
  res.json({
    message: USERS_MESSAGES.REFRESH_TOKEN_SUCCESS,
    result
  })
  return
}

/**
 * Get current user's profile
 * - Route: GET /me
 * - Protected: requires `Authorization: Bearer <access_token>`
 * - Action: returns user profile including name, email, avatar_url and roles
 * - Note: when the user has the 'organizer' role, `userService.getMe` includes organizer revenue
 * - Response: JSON { message, result }
 */
export const getMeController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { user_id } = req.decoded_authorization as TokenPayload
  const result = await userService.getMe(user_id)
  res.json({
    message: USERS_MESSAGES.GET_PROFILE_SUCCESS,
    result
  })
  return
}

/**
 * Update current user's profile
 * - Route: PATCH /me
 * - Protected: requires `Authorization: Bearer <access_token>`
 * - Body: partial profile fields (e.g. { name, avatar_url, role })
 * - Action: updates allowed fields and may add 'organizer' role if validated
 * - Response: JSON { message, result }
 */
export const updateMeController = async (
  req: Request<ParamsDictionary, unknown, UpdateMeRequestBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { user_id } = req.decoded_authorization as TokenPayload
  const result = await userService.updateMe(user_id, req.body)
  res.json({
    message: USERS_MESSAGES.UPDATE_ME_SUCCESS,
    result
  })
  return
}

/**
 * Update avatar controller
 * - Route: PUT /me/avatar
 * - Protected: requires `Authorization: Bearer <access_token>`
 * - Payload: multipart/form-data with single `image` file
 * - Action: uploads file via `mediasService.uploadImage` and updates user's `avatar_url`
 * - Response: JSON { message, result } where result contains the updated user
 */
export const updateAvatarController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { user_id } = req.decoded_authorization as TokenPayload
  const url = await mediasService.uploadImage(req)
  const result = await userService.updateAvatar(user_id, url[0].url)
  res.json({
    message: USERS_MESSAGES.UPDATE_AVATAR_SUCCESS,
    result
  })
  return
}

/**
 * Send email verification controller
 * - Route: POST /me/email-verification
 * - Protected: requires `Authorization: Bearer <access_token>`
 * - Action: generates a verification token and sends an email to the user's registered address
 * - Response: JSON { message }
 */

export const sendEmailController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const user = req.user as User
  const user_id = user.id
  const user_email = user.email
  await userService.sendEmailVerifyToken(user_id, user_email)
  res.json({
    message: USERS_MESSAGES.CHECK_YOUR_EMAIL_FOR_VERIFICATION_LINK
  })
  return
}

/**
 * Verify email controller
 * - Route: POST /verify-email
 * - Public: accepts `{ email_verify_token }` in the body
 * - Action: validates token, marks user as verified and issues new auth tokens
 * - Response: JSON { message, result }
 */
export const verifyEmailController = async (
  req: Request<ParamsDictionary, unknown, VerifyEmailRequestBody>,
  res: Response
): Promise<void> => {
  const { user_id } = req.decoded_email_verify_token as TokenPayload
  const result = await userService.verifyEmail(user_id)
  res.json({
    message: USERS_MESSAGES.EMAIL_VERIFY_SUCCESS,
    result
  })
}

/**
 * Forgot-password controller
 * - Route: POST /forgot-password
 * - Public: accepts `{ email }` in the body
 * - Action: sends a password reset email containing a token if the email exists
 * - Response: JSON { message }
 */
export const forgotPasswordController = async (
  req: Request<ParamsDictionary, unknown, ForgotPasswordRequestBody>,
  res: Response
): Promise<void> => {
  const { id, verified, email } = req.user as User
  await userService.forgotPassword({ user_id: id, verify: verified, email })
  res.json({
    message: USERS_MESSAGES.CHECK_YOUR_EMAIL_FOR_RESET_PASSWORD_LINK
  })
  return
}

/**
 * Verify forgot-password token controller
 * - Route: POST /verify-forgot-password
 * - Public: accepts `{ forgot_password_token }` in the body
 * - Action: validates token; response indicates the token is valid and the client can proceed
 * - Response: JSON { message }
 */
export const verifyForgotPasswordController = async (
  req: Request<ParamsDictionary, unknown, VerifyForgotPasswordRequestBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  res.json({
    message: USERS_MESSAGES.VERIFY_FORGOT_PASSWORD_TOKEN_SUCCESS
  })
}

/**
 * Reset password controller
 * - Route: POST /reset-password
 * - Public: accepts `{ password, confirm_password, forgot_password_token }` in the body
 * - Action: validates token and password rules, updates stored password hash and clears token
 * - Response: JSON { message }
 */
export const resetPasswordController = async (
  req: Request<ParamsDictionary, unknown, ResetPasswordRequestBody>,
  res: Response
): Promise<void> => {
  const { user_id } = req.decoded_forgot_password_token as TokenPayload
  const password = req.body.confirm_password
  await userService.resetPassword(user_id, password)
  res.json({
    message: USERS_MESSAGES.RESET_PASSWORD_SUCCESS
  })
}
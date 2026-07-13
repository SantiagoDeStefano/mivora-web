import { USERS_MESSAGES } from '~/constants/messages'
import { verifyToken } from './jwt'
import { envConfig } from '~/constants/config'
import { capitalize } from 'lodash'
import { JsonWebTokenError } from 'jsonwebtoken'
import { Request } from 'express'

import ErrorWithStatus from '~/models/Errors'
import HTTP_STATUS from '~/constants/httpStatus'

export const verifyAccessToken = async (access_token: string, req?: Request) => {
  if (!access_token) {
    throw new ErrorWithStatus({
      message: USERS_MESSAGES.ACCESS_TOKEN_REQUIRED,
      status: HTTP_STATUS.UNAUTHORIZED
    })
  }
  try {
    const decoded_authorization = await verifyToken({
      token: access_token,
      secretOrPublicKey: envConfig.jwtSecretAccessToken as string
    })
    if (req) {
      ;(req as Request).decoded_authorization = decoded_authorization
      return true
    }
    return decoded_authorization
  } catch (error) {
    throw new ErrorWithStatus({
      message: capitalize((error as JsonWebTokenError).message),
      status: HTTP_STATUS.UNAUTHORIZED
    })
  }
}

export function parsePgArray(pgArray: unknown): string[] {
  if (!pgArray) return []
  if (Array.isArray(pgArray)) return pgArray // already an array
  if (typeof pgArray === 'string') {
    return pgArray.replace(/[{}]/g, '').split(',').filter(Boolean)
  }
  return []
}

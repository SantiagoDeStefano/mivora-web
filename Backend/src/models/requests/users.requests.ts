import { JwtPayload } from 'jsonwebtoken'
import { TokenType } from '~/constants/enums'
import { UUIDv4 } from '~/types/common'
import { UserRole, UserVerificationStatus } from '~/types/domain'

// Body
export interface RegisterRequestBody {
  name: string
  email: string
  password: string
  confirm_password: string
}

export interface LoginRequestBody {
  email: string
  password: string
}

export interface LogoutRequestBody {
  refresh_token: string
}

export interface RefreshTokenRequestBody {
  refresh_token: string
}

export interface TokenPayload extends JwtPayload {
  user_id: UUIDv4
  token_type: TokenType
  verify: UserVerificationStatus
  iat: number
  exp: number
}

export interface UpdateMeRequestBody {
  name?: string
  avatar_url?: string
  role?: UserRole
}

export interface VerifyEmailRequestBody {
  email_verify_token: string
}

export interface ForgotPasswordRequestBody {
  email: string
}

export interface VerifyForgotPasswordRequestBody {
  forgot_password_token: string
}

export interface ResetPasswordRequestBody {
  forgot_password_token: string
  password: string
  confirm_password: string
}
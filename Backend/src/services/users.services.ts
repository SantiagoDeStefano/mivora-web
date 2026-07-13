import { envConfig } from '~/constants/config'
import { TokenType } from '~/constants/enums'
import { RegisterRequestBody, UpdateMeRequestBody } from '~/models/requests/users.requests'
import { UUIDv4 } from '~/types/common'
import { hashPassword } from '~/utils/crypto'
import { signToken, verifyToken } from '~/utils/jwt'

import RefreshToken from '~/models/schemas/RefreshToken.schema'
import User from '~/models/schemas/User.schema'
import databaseService from '~/services/database.services'
import { parsePgArray } from '~/utils/common'
import { UserVerificationStatus } from '~/types/domain'
import { sendForgotPasswordEmail, sendVerifyStatusEmail } from '~/utils/email'

class UserService {
  /**
   * Sign a short-lived Access Token for the given user
   * - Purpose: create a JWT used for API authorization (sent as `Authorization: Bearer <token>`)
   * - Inputs: `user_id` and `verify` status
   * - Returns: a signed JWT string (access token)
   * - Notes: lifetime is configured through `envConfig.accessTokenExpiresIn`
   */
  private signAccessToken({ user_id, verify }: { user_id: UUIDv4; verify: UserVerificationStatus }): Promise<string> {
    return signToken({
      payload: {
        user_id,
        verify,
        token_type: TokenType.AccessToken
      },
      privateKey: envConfig.jwtSecretAccessToken as string,
      options: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expiresIn: envConfig.accessTokenExpiresIn as any
      }
    }) as Promise<string>
  }

  /**
   * Sign a Refresh Token for the given user
   * - Purpose: issue a longer-lived token used to obtain new access tokens
   * - Inputs: `user_id`, `verify`, optional `exp` to preserve an explicit expiry when rotating tokens
   * - Returns: a signed JWT string (refresh token)
   * - Notes: when `exp` is provided the value is embedded in the token payload (rotation preserving expiry)
   */
  private signRefreshToken({
    user_id,
    verify,
    exp
  }: {
    user_id: UUIDv4
    verify: UserVerificationStatus
    exp?: number
  }): Promise<string> {
    if (exp) {
      return signToken({
        payload: {
          user_id,
          verify,
          token_type: TokenType.RefreshToken,
          exp
        },
        privateKey: envConfig.jwtSecretRefreshToken as string
      }) as Promise<string>
    }
    return signToken({
      payload: {
        user_id,
        verify,
        token_type: TokenType.RefreshToken
      },
      privateKey: envConfig.jwtSecretRefreshToken as string,
      options: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expiresIn: envConfig.refreshTokenExpiresIn as any
      }
    }) as Promise<string>
  }

  /**
   * Convenience: sign both access and refresh tokens for a user
   * - Inputs: `user_id`, `verify`
   * - Returns: `[access_token, refresh_token]`
   */
  private async signAccessAndRefreshToken({
    user_id,
    verify
  }: {
    user_id: UUIDv4
    verify: UserVerificationStatus
  }): Promise<[string, string]> {
    const access_token = await this.signAccessToken({ user_id, verify })
    const refresh_token = await this.signRefreshToken({ user_id, verify })
    return [access_token, refresh_token]
  }

  /**
   * Sign an email verification token
   * - Purpose: create a short-lived token used in email verification links
   * - Inputs: `user_id`, `verify`
   * - Returns: a signed JWT string (email verify token)
   */
  private signEmailVerifyToken({
    user_id,
    verify
  }: {
    user_id: string
    verify: UserVerificationStatus
  }): Promise<string> {
    return signToken({
      payload: {
        user_id,
        verify,
        token_type: TokenType.EmailVerifyToken
      },
      privateKey: envConfig.jwtSecretEmailVerifyToken as string,
      options: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expiresIn: envConfig.emailVerifyTokenExpiresIn as any
      }
    }) as Promise<string>
  }

  /**
   * Sign a forgot-password token
   * - Purpose: create a token for password reset flows
   * - Inputs: `user_id`, `verify`
   * - Returns: a signed JWT string (forgot-password token)
   */
  async signForgotPasswordToken({
    user_id,
    verify
  }: {
    user_id: UUIDv4
    verify: UserVerificationStatus
  }): Promise<string> {
    return signToken({
      payload: {
        user_id,
        token_type: TokenType.ForgotPasswordToken,
        verify
      },
      privateKey: envConfig.jwtSecretForgotPasswordToken as string,
      options: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expiresIn: envConfig.forgotPasswordTokenExpiresIn as any
      }
    }) as Promise<string>
  }

  /**
   * Decode / validate a refresh token
   * - Inputs: `refresh_token` string
   * - Returns: decoded payload (including `iat`/`exp`) or throws on invalid token
   */
  private decodeRefreshToken(refresh_token: string) {
    return verifyToken({
      token: refresh_token,
      secretOrPublicKey: envConfig.jwtSecretRefreshToken as string
    })
  }

  /**
   * Register a new user
   * - Body: `{ name, email, password }`
   * - Actions:
   *   1. Hashes password and creates a `users` row
   *   2. Creates the initial `user_roles` entry (attendee)
   *   3. Issues access + refresh tokens and persists the refresh token record
   * - Returns: `{ access_token, refresh_token }`
   */
  async register(payload: RegisterRequestBody) {
    const { name, email, password } = payload
    const password_hash = hashPassword(password) // Hashing password before storing (uses sha256 in hashPassword).

    const new_user = new User({
      name,
      email,
      password_hash
    })

    await databaseService.users(
      `INSERT INTO 
          users(id, name, email, password_hash, email_verify_token, forgot_password_token, avatar_url, verified) 
          VALUES($1, $2, $3, $4, $5, $6, $7, $8)
        `,
      [
        new_user.id,
        new_user.name,
        new_user.email,
        new_user.password_hash,
        new_user.email_verify_token,
        new_user.forgot_password_token,
        new_user.avatar_url,
        new_user.verified
      ]
    )
    await databaseService.user_roles(`INSERT INTO user_roles (user_id, role) VALUES ($1, $2)`, [
      new_user.id,
      'attendee'
    ])

    const [access_token, refresh_token] = await this.signAccessAndRefreshToken({
      user_id: new_user.id,
      verify: 'unverified'
    })
    const { iat, exp } = await this.decodeRefreshToken(refresh_token) // iat/exp are unix seconds from JWT.

    await databaseService.refresh_tokens(
      `INSERT INTO refresh_tokens (user_id, token_hash, iat, exp) VALUES ($1, $2, to_timestamp($3), to_timestamp($4))`,
      [new_user.id, refresh_token, iat, exp] // token_hash column expects hashed value; ensure refresh_token is already hashed upstream.
    )

    return {
      access_token,
      refresh_token
    }
  }

  /**
   * Issue a fresh access + refresh token pair for an existing user
   * - Inputs: `user_id`, `verify`
   * - Actions: signs tokens, persists the refresh token record
   * - Returns: `{ access_token, refresh_token }`
   */
  async login(user_id: UUIDv4, verify: UserVerificationStatus) {
    const [access_token, refresh_token] = await this.signAccessAndRefreshToken({ user_id, verify })
    const { iat, exp } = await this.decodeRefreshToken(refresh_token)

    const refreshToken = new RefreshToken({
      user_id: user_id,
      token_hash: refresh_token,
      iat,
      exp
    })

    await databaseService.refresh_tokens(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, iat, exp) VALUES ($1, $2, $3, to_timestamp($4), to_timestamp($5))`,
      [refreshToken.id, refreshToken.user_id, refreshToken.token_hash, refreshToken.iat, refreshToken.exp]
    )

    return {
      access_token,
      refresh_token
    }
  }

  /**
   * Logout: revoke a refresh token
   * - Inputs: `refresh_token` string
   * - Action: deletes the refresh token row from persistence
   */
  async logout(refresh_token: string) {
    await databaseService.refresh_tokens(`DELETE FROM refresh_tokens WHERE token_hash=$1`, [refresh_token])
  }

  /**
   * Check whether an email address is already registered
   * - Input: `email` string
   * - Returns: boolean (true if email exists)
   */
  async checkEmailExist(email: string) {
    const userRow = await databaseService.users(`SELECT id FROM users WHERE email=$1 LIMIT 1`, [email])
    return userRow.rows.length > 0
  }

  /**
   * Check whether a user already has a specific role
   * - Inputs: `user_id`, `role`
   * - Returns: boolean (true if role row exists)
   */
  async checkRoleExist(user_id: UUIDv4, role: string) {
    const userRow = await databaseService.user_roles(`SELECT role FROM user_roles WHERE user_id=$1 AND role=$2`, [
      user_id,
      'organizer'
    ])
    return userRow.rows.length > 0
  }

  /**
   * Rotate a refresh token and issue new tokens
   * - Inputs: `{ user_id, refresh_token, verify, exp }` where `exp` is preserved when rotating
   * - Actions: deletes the old refresh token row, signs new tokens, and persists the new refresh token
   * - Returns: `{ access_token, refresh_token }`
   */
  async refreshToken({
    user_id,
    refresh_token,
    verify,
    exp
  }: {
    user_id: UUIDv4
    refresh_token: string
    verify: UserVerificationStatus
    exp: number
  }) {
    const [new_access_token, new_refresh_token] = await Promise.all([
      this.signAccessToken({ user_id, verify }),
      this.signRefreshToken({ user_id, verify, exp }),
      databaseService.refresh_tokens(`DELETE FROM refresh_tokens WHERE token_hash=$1`, [refresh_token])
    ])

    const decoded_refresh_token = await this.decodeRefreshToken(new_refresh_token)

    const refreshToken = new RefreshToken({
      user_id: user_id,
      token_hash: new_refresh_token,
      iat: decoded_refresh_token.iat,
      exp: decoded_refresh_token.exp
    })

    await databaseService.refresh_tokens(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, iat, exp) VALUES ($1, $2, $3, to_timestamp($4), to_timestamp($5))`,
      [refreshToken.id, refreshToken.user_id, new_refresh_token, refreshToken.iat, refreshToken.exp]
    )

    return {
      access_token: new_access_token,
      refresh_token: new_refresh_token
    }
  }

  /**
   * Return the current user's profile
   * - Input: `user_id`
   * - Returns: user object with `{ name, email, avatar_url, verified, role }`
   * - Notes: when the user has 'organizer' role, the service also computes `revenue_cents`
   */
  async getMe(user_id: UUIDv4) {
    const user = await databaseService.users(
      `SELECT 
        users.id,
        users.name, 
        users.email, 
        users.avatar_url, 
        users.verified, 
        ARRAY_AGG(user_roles.role) AS role 
        FROM users 
      JOIN user_roles ON users.id = user_roles.user_id 
      WHERE id=$1 GROUP BY users.id, users.name, users.email, users.avatar_url;`,
      [user_id]
    )
    user.rows[0].role = parsePgArray(user.rows[0].role)

    // if (user.rows[0].role.includes('organizer')) {
    //   const revenueRes = await databaseService.users(
    //     `
    //       SELECT
    //         SUM(tickets.price_cents) AS total_revenue_cents
    //       FROM tickets
    //       JOIN events ON tickets.event_id = events.id
    //       WHERE events.organizer_id = $1
    //     `,
    //     [user_id]
    //   )
    //   const totalRevenueCents = Number(revenueRes.rows[0]?.total_revenue_cents ?? 0)
    //   const userRow = user.rows[0]
    //   userRow.revenue_cents = totalRevenueCents
    // }

    return user.rows[0]
  }

  /**
   * Update a user's profile fields
   * - Inputs: `user_id`, `body` (may include `name` and optional `role`)
   * - Actions: updates user row and optionally inserts a new `user_roles` row when role is provided
   * - Returns: updated user object
   */
  async updateMe(user_id: UUIDv4, body: UpdateMeRequestBody) {
    const { name, role } = body

    await databaseService.users(
      `
      UPDATE users
      SET name = $1
      WHERE id = $2
      `,
      [name, user_id]
    )
    if (role) {
      await databaseService.user_roles(`INSERT INTO user_roles(user_id, role) VALUES($1, $2)`, [user_id, role])
    }
    const updatedUser = await databaseService.users(
      `SELECT users.id,users.name, users.email, users.avatar_url, users.verified, ARRAY_AGG(user_roles.role) AS role FROM users JOIN user_roles ON users.id = user_roles.user_id WHERE id=$1 GROUP BY users.id, users.name, users.email, users.avatar_url;`,
      [user_id]
    )
    updatedUser.rows[0].role = parsePgArray(updatedUser.rows[0].role)
    return updatedUser.rows[0]
  }

  /**
   * Update user's avatar URL
   * - Inputs: `user_id`, `avatar_url`
   * - Action: updates `avatar_url` on the users table and returns the updated user
   */
  async updateAvatar(user_id: UUIDv4, avatar_url: string) {
    await databaseService.users(`UPDATE users SET avatar_url=$1 WHERE id=$2`, [avatar_url, user_id])
    const updatedUser = await databaseService.users(
      `SELECT users.id, users.name, users.email, users.avatar_url, users.verified, ARRAY_AGG(user_roles.role) AS role FROM users JOIN user_roles ON users.id = user_roles.user_id WHERE id=$1 GROUP BY users.id, users.name, users.email, users.avatar_url;`,
      [user_id]
    )
    updatedUser.rows[0].role = parsePgArray(updatedUser.rows[0].role)
    return updatedUser.rows[0]
  }

  /**
   * Generate and send an email verification token
   * - Inputs: `user_id`, `email`
   * - Actions: signs an email verification token, sends it by email, and stores the token on the user row
   */
  async sendEmailVerifyToken(user_id: UUIDv4, email: string) {
    const email_verify_token = await this.signEmailVerifyToken({ user_id, verify: 'unverified' })
    console.log('email_verify_token:', email_verify_token)

    await sendVerifyStatusEmail(email, email_verify_token)
    await databaseService.users(`UPDATE users SET email_verify_token=$1 WHERE id=$2`, [email_verify_token, user_id])
  }

  /**
   * Verify a user's email and issue fresh auth tokens
   * - Input: `user_id` (from validated email token)
   * - Actions: marks user as verified, clears stored email token, issues new access+refresh tokens and persists the refresh token
   * - Returns: `{ access_token, refresh_token }`
   */
  async verifyEmail(user_id: UUIDv4) {
    const [tokens] = await Promise.all([
      this.signAccessAndRefreshToken({ user_id, verify: 'verified' }),

      databaseService.users(`UPDATE users SET verified=$1, email_verify_token=$2 WHERE id=$3`, [
        'verified',
        '',
        user_id
      ])
    ])

    const [access_token, refresh_token] = tokens

    const { iat, exp } = await this.decodeRefreshToken(refresh_token)

    const refreshToken = new RefreshToken({
      user_id: user_id,
      token_hash: refresh_token,
      iat,
      exp
    })

    await databaseService.refresh_tokens(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, iat, exp) VALUES ($1, $2, $3, to_timestamp($4), to_timestamp($5))`,
      [refreshToken.id, refreshToken.user_id, refreshToken.token_hash, refreshToken.iat, refreshToken.exp]
    )

    return {
      access_token,
      refresh_token
    }
  }

  /**
   * Initiate forgot-password flow for a user
   * - Inputs: `user_id`, `verify`, `email`
   * - Actions: signs a forgot-password token, stores it on the user row and emails the reset link
   * - Returns: `{ forgot_password_token }` (for testing; production may not return this)
   */
  async forgotPassword({ user_id, verify, email }: { user_id: UUIDv4; verify: UserVerificationStatus; email: string }) {
    const forgot_password_token = await this.signForgotPasswordToken({ user_id, verify })
    console.log('forgot_password_token:', forgot_password_token)
    await databaseService.users(`UPDATE users SET forgot_password_token=$1 WHERE id=$2`, [
      forgot_password_token,
      user_id
    ])

    await sendForgotPasswordEmail(email, forgot_password_token)

    // For testing only, remove return this statement in production
    return {
      forgot_password_token
    }
  }
  /**
   * Reset a user's password
   * - Inputs: `user_id` (from validated forgot-password token), `new_password`
   * - Actions: hashes and updates the stored password and clears the forgot-password token
   */
  async resetPassword(user_id: string, new_password: string) {
    const password = hashPassword(new_password)
    await databaseService.users(`UPDATE users SET password_hash=$1, forgot_password_token=$2 WHERE id=$3`, [
      password,
      '',
      user_id
    ])
  }
}

const userService = new UserService()
export default userService

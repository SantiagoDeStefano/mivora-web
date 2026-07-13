import { UUIDv4 } from '~/types/common'
import { newUUIDv4 } from '~/utils/uuid'
import pg from 'pg'

interface RefreshTokenType extends pg.QueryResultRow {
  id?: UUIDv4
  user_id: UUIDv4
  token_hash: string
  iat: number
  exp: number
}

export default class RefreshToken {
  id: UUIDv4
  user_id: UUIDv4
  token_hash: string
  iat: number
  exp: number

  constructor(refreshToken: RefreshTokenType) {
    this.id = refreshToken.id || newUUIDv4()
    this.user_id = refreshToken.user_id
    this.token_hash = refreshToken.token_hash
    this.iat = refreshToken.iat
    this.exp = refreshToken.exp
  }
}
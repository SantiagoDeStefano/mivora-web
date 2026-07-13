import { UUIDv4 } from '~/types/common'
import { newUUIDv4 } from '~/utils/uuid'
import pg from 'pg'
import { UserVerificationStatus } from '~/types/domain'

interface UserType extends pg.QueryResultRow {
  id?: UUIDv4
  name: string
  email: string
  password_hash: string
  email_verify_token?: string
  forgot_password_token?: string
  avatar_url?: string
  verified?: UserVerificationStatus
}

export default class User {
  id: UUIDv4
  name: string
  email: string
  password_hash: string
  email_verify_token: string
  forgot_password_token: string
  avatar_url: string
  verified: UserVerificationStatus

  constructor(user: UserType) {
    this.id = user.id || newUUIDv4()
    this.name = user.name
    this.email = user.email
    this.password_hash = user.password_hash
    this.email_verify_token = user.email_verify_token || 'have_never_request_verification_email'
    this.forgot_password_token = user.forgot_password_token || 'have_never_request_forgot_password_token'
    this.avatar_url =
      user.avatar_url ||
      'https://mivora-ap-southeast-1.s3.ap-southeast-1.amazonaws.com/avatar-images/tiu7tvddseqens3u2h5pvfnn2.jpg'
    this.verified = user.verified || 'unverified'
  }
}

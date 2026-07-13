import {} from 'express'
import { TokenPayload } from './models/requests/users.requests'
import { UUIDv4 } from './types/common'

import Event from './models/schemas/Event.schema'
import User from './models/schemas/User.schema'
import Ticket from './models/schemas/Tickets.schema'
import Order from './models/schemas/Order.schema'

declare module 'express' {
  interface Request {
    user?: User // User.id
    decoded_authorization?: TokenPayload
    decoded_refresh_token?: TokenPayload
    decoded_forgot_password_token?: TokenPayload
    decoded_email_verify_token?: TokenPayload
    event?: Event[]
    ticket?: Ticket[]
    order?: Order[]
  }
}

import { UUIDv4 } from '~/types/common'
import { newUUIDv4 } from '~/utils/uuid'
import pg from 'pg'

export interface MessageType extends pg.QueryResultRow {
  id?: UUIDv4
  event_id: UUIDv4
  user_id: UUIDv4
  content: string
}

export default class Message {
  id?: UUIDv4
  event_id: UUIDv4
  user_id: UUIDv4
  content: string

  constructor(message: MessageType) {
    this.id = message.id || newUUIDv4()
    this.event_id = message.event_id
    this.user_id = message.user_id
    this.content = message.content
  }
}

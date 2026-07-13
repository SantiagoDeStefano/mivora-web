import { UUIDv4 } from '~/types/common'
import pg from 'pg'

export interface EventBanType extends pg.QueryResultRow {
  event_id: UUIDv4
  user_id: UUIDv4
  reason?: string
}

export default class EventBan {
  event_id: UUIDv4
  user_id: UUIDv4
  reason?: string

  constructor(ban: EventBanType) {
    this.event_id = ban.event_id
    this.user_id = ban.user_id
    this.reason = ban.reason || 'You have been banned from attending this event.'
  }
}

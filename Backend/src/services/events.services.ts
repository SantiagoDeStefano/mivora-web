import { CreateEventRequestBody, UpdateEventDetailsBody } from '~/models/requests/events.requests'
import databaseService from './database.services'
import Event from '~/models/schemas/Event.schema'
import { UUIDv4 } from '~/types/common'
import { EventStatus } from '~/types/domain'
import Message from '~/models/schemas/Message.schema'
import EventBan from '~/models/schemas/Ban.schema'

class EventService {
  /**
   * Create a new event owned by the organizer
   * - Inputs: `organizer_id`, `body: CreateEventRequestBody`
   * - Action: inserts a new `events` row and returns the created event record
   * - Returns: created event object (id, title, description, poster_url, location_text, start_at, end_at, price_cents, checked_in, capacity, status)
   */
  async createEvent(organizer_id: UUIDv4, body: CreateEventRequestBody) {
    const { title, description, location_text, start_at, end_at, price_cents, capacity } = body
    const new_event = new Event({
      organizer_id,
      title,
      description,
      location_text,
      start_at,
      end_at,
      price_cents,
      capacity
    })
    const newEvent = await databaseService.events(
      `
        INSERT INTO events(
          id, 
          organizer_id, 
          title, 
          description, 
          poster_url, 
          location_text, 
          start_at, 
          end_at, 
          price_cents, 
          checked_in,
          capacity, 
          status
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
        RETURNING
          id,
          title, 
          description, 
          poster_url, 
          location_text, 
          start_at, 
          end_at, 
          price_cents,
          checked_in, 
          capacity, 
          status
      `,
      [
        new_event.id,
        new_event.organizer_id,
        new_event.title,
        new_event.description,
        new_event.poster_url,
        new_event.location_text,
        new_event.start_at,
        new_event.end_at,
        new_event.price_cents,
        new_event.checked_in,
        new_event.capacity,
        new_event.status
      ]
    )
    return newEvent.rows[0]
  }

  /**
   * List or search published events (public)
   * - Inputs: `search` (optional), `limit`, `page`, `status` (usually 'published')
   * - Action: queries `events` joined with organizer name, applies pagination and optional search
   * - Returns: { events: Event[], totalEvents: number }
   */
  async getOrSearchPublishedEvents(search: string, limit: number, page: number) {
    const eventsResult = !search
      ? await databaseService.events(
          `
          SELECT 
            events.id,
            users.name as organizer_name,
            events.title,
            events.description,
            events.poster_url,
            events.location_text,
            events.start_at,
            events.end_at,
            events.price_cents,
            events.checked_in,
            events.capacity,
            events.status,
            COUNT(*) OVER() AS total_count
          FROM events 
          JOIN users ON events.organizer_id = users.id
          WHERE status='published' OR status='in_progress'
          ORDER BY events.created_at DESC, events.id DESC 
          LIMIT $1 OFFSET $2
        `,
          [limit, limit * (page - 1)]
        )
      : await databaseService.events(
          `
          SELECT
            events.id,
            users.name as organizer_name,
            events.title,
            events.description,
            events.poster_url,
            events.location_text,
            events.start_at,
            events.end_at,
            events.price_cents,
            events.checked_in,
            events.capacity,
            events.status,
            COUNT(*) OVER() AS total_count
          FROM events 
          JOIN users ON events.organizer_id = users.id
          WHERE events.title ILIKE '%' || $1 || '%' AND (events.status='published' OR events.status='in_progress')
          ORDER BY similarity(events.title, $1) DESC, events.title
          LIMIT $2 OFFSET $3
        `,
          [search, limit, limit * (page - 1)]
        )

    const events = eventsResult.rows
    const totalEvents = events.length > 0 ? Number(events[0].total_count) : 0
    return {
      events,
      totalEvents
    }
  }
  /**
   * List or search events for a specific organizer, optionally filtered by status
   * - Inputs: `organizer_id`, `limit`, `page`, optional `search`, optional `status`
   * - Action: returns organizer's events with pagination and optional filters
   * - Returns: { events: Event[], totalEvents: number }
   */
  async getOrSearchEventsWithStatus(
    organizer_id: UUIDv4,
    limit: number,
    page: number,
    search?: string,
    status?: EventStatus
  ) {
    const statusParam = status ?? null // null = "all statuses"
    const searchParam = search ?? null // null = "no search"
    const eventsResult = await databaseService.events(
      `
        SELECT
          events.id,
          events.title,
          events.description,
          events.poster_url,
          events.location_text,
          events.start_at,
          events.end_at,
          events.price_cents,
          events.checked_in,
          events.capacity,
          events.status,
          COUNT(*) OVER() AS total_count,
          COALESCE(revenue.revenue_cents, 0) AS revenue_cents
        FROM events
        LEFT JOIN (
          SELECT
            event_id,
            SUM(price_cents) AS revenue_cents
          FROM tickets
          WHERE status = 'checked_in'
          GROUP BY event_id
        ) revenue ON revenue.event_id = events.id
        WHERE organizer_id = $1
          AND status = COALESCE($2::event_status, status)
          AND title ILIKE COALESCE('%' || $3::text || '%', title)
        ORDER BY created_at DESC, id DESC
        LIMIT $4 OFFSET $5;
      `,
      [organizer_id, statusParam, searchParam, limit, limit * (page - 1)]
    )

    const events = eventsResult.rows
    const totalEvents = events.length > 0 ? Number(events[0].total_count) : 0
    return {
      events,
      totalEvents
    }
  }
  /**
   * Return details for a specific event created by the organizer
   * - Inputs: `organizer_id`, `event_id`
   * - Action: verifies ownership and returns the event details (or undefined if not found)
   * - Returns: event object or undefined
   */
  async getCreatedEventDetails(organizer_id: UUIDv4, event_id: UUIDv4) {
    const eventsResult = await databaseService.events(
      `
        SELECT
          events.id,
          events.title,
          events.description,
          events.poster_url,
          events.location_text,
          events.start_at,
          events.end_at,
          events.price_cents,
          events.checked_in,
          events.capacity,
          events.status,
          COALESCE(revenue.revenue_cents, 0) AS revenue_cents
        FROM events
        LEFT JOIN (
          SELECT
            event_id,
            SUM(price_cents) AS revenue_cents
          FROM tickets
          WHERE status = 'checked_in'
          GROUP BY event_id
        ) revenue ON revenue.event_id = events.id
        WHERE organizer_id = $1
          AND events.id = $2
        LIMIT 1;
      `,
      [organizer_id, event_id]
    )

    return eventsResult.rows[0]
  }
  /**
   * Update an event's mutable fields
   * - Inputs: `event_id`, `body: UpdateEventDetailsBody`
   * - Action: updates the events row and returns the updated record
   * - Returns: updated event object
   */
  async updateEvent(event_id: UUIDv4, body: UpdateEventDetailsBody) {
    const { title, description, location_text, start_at, end_at, price_cents, capacity } = body
    const event = await databaseService.events(
      `
        UPDATE events
        SET
          title = $1,
          description = $2,
          location_text = $3,
          start_at = $4,
          end_at = $5,
          price_cents = $6,
          capacity = $7
        WHERE id = $8
        RETURNING
          id,
          title,
          description,
          poster_url,
          location_text,
          start_at,
          end_at,
          price_cents,
          checked_in,
          capacity,
          status
      `,
      [title, description, location_text, start_at, end_at, price_cents, capacity, event_id]
    )
    return event.rows[0]
  }

  /**
   * Change an event's status
   * - Inputs: `event_id`, `status`
   * - Action: updates the event's status and returns the updated record
   * - Returns: updated event object
   */
  async changeEventStatus(event_id: UUIDv4, status: EventStatus) {
    if (status == 'canceled') {
      await databaseService.orders(
        `
          UPDATE orders
          SET status = 'canceled',
              canceled_at = NOW()
          WHERE event_id = $1
        `,
        [event_id]
      )
      await databaseService.tickets(
        `
          UPDATE tickets
          SET status = 'canceled'
          WHERE event_id = $1
        `,
        [event_id]
      )
    }
    const event = await databaseService.events(
      `
        UPDATE events
        SET status = $1
        WHERE id = $2
        RETURNING
          id,
          title,
          description,
          poster_url,
          location_text,
          start_at,
          end_at,
          price_cents,
          checked_in,
          capacity,
          status
      `,
      [status, event_id]
    )
    return event.rows[0]
  }

  /**
   * Mark an event as published
   * - Input: `event_id`
   * - Action: sets `status = 'published'` and returns the updated event
   * - Returns: updated event object
   */
  async publishEvent(event_id: UUIDv4) {
    const event = await databaseService.events(
      `
        UPDATE events
        SET status = 'published'
        WHERE id = $1
        RETURNING
          id,
          title,
          description,
          poster_url,
          location_text,
          start_at,
          end_at,
          price_cents,
          checked_in,
          capacity,
          status
      `,
      [event_id]
    )
    return event.rows[0]
  }

  /**
   * Mark an event as canceled
   * - Input: `event_id`
   * - Action: sets `status = 'canceled'` and returns the updated event
   * - Returns: updated event object
   */
  async cancelEvent(event_id: UUIDv4) {
    const event = await databaseService.events(
      `
        UPDATE events
        SET status = 'canceled'
        WHERE id = $1
        RETURNING
          id,
          title,
          description,
          poster_url,
          location_text,
          start_at,
          end_at,
          price_cents,
          checked_in,
          capacity,
          status
      `,
      [event_id]
    )
    return event.rows[0]
  }

  /**
   * Lightweight title search used for quick lookups
   * - Inputs: `search`, `limit`, `page`
   * - Action: finds event IDs and titles matching the search term
   * - Returns: { events: Array<{id, title}>, totalEvents: number }
   */
  async searchEvents(search: string, limit: number, page: number) {
    const eventsResult = await databaseService.events(
      `
        SELECT id, title
        FROM events
        WHERE title ILIKE '%' || $1 || '%'
        ORDER BY similarity(name, $1) DESC, name
        LIMIT $2 OFFSET $3
      `,
      [search, limit, page]
    )
    const events = eventsResult.rows
    const totalEvents = eventsResult.rows.length
    return {
      events,
      totalEvents
    }
  }

  async uploadEventPoster(event_id: UUIDv4, poster_url: string) {
    const event = await databaseService.events(
      `
        UPDATE events
        SET poster_url = $1
        WHERE id = $2
        RETURNING
          id,
          title,
          description,
          poster_url,
          location_text,
          start_at,
          end_at,
          price_cents,
          checked_in,
          capacity,
          status
      `,
      [poster_url, event_id]
    )
    return event.rows[0]
  }

  async getEventMessages(event_id: UUIDv4, limit: number, page: number) {
    const messagesResult = await databaseService.messages(
      `
        SELECT 
          messages.id,
          messages.event_id,
          messages.user_id,
          messages.content,
          messages.created_at,
          users.name as user_name,
          users.avatar_url as user_avatar_url,
          COUNT(*) OVER() AS total_count
        FROM messages
        JOIN users as users ON messages.user_id = users.id
        WHERE event_id = $1
        ORDER BY created_at ASC
        LIMIT $2 OFFSET $3
      `,
      [event_id, limit, limit * (page - 1)]
    )
    const messages = messagesResult.rows
    const totalMessages = messages.length > 0 ? Number(messages[0].total_count) : 0
    return {
      messages,
      totalMessages
    }
  }

  async createEventMessages(event_id: UUIDv4, user_id: UUIDv4, content: string) {
    const newMessage = new Message({
      event_id,
      user_id,
      content
    })
    const messageResult = await databaseService.messages(
      `
        WITH inserted AS (
          INSERT INTO messages (
            id,
            event_id,
            user_id,
            content
          )
          VALUES ($1, $2, $3, $4)
          RETURNING id, event_id, user_id, content, created_at
        )
        SELECT
          inserted.*,
          users.name AS user_name,
          users.avatar_url AS user_avatar_url
        FROM inserted
        JOIN users ON users.id = inserted.user_id;
      `,
      [newMessage.id, newMessage.event_id, newMessage.user_id, newMessage.content]
    )
    return messageResult.rows[0]
  }

  async getCreatedEventAttendees(event_id: UUIDv4, limit: number, page: number, search?: string, status?: string) {
    const statusParam = status ?? null
    const searchParam = search ?? null

    const attendeesResult = await databaseService.events(
      `
        SELECT
          users.id as user_id,
          users.name,
          users.email,
          users.avatar_url,
          tickets.status AS ticket_status,
          tickets.checked_in_at,
          COUNT(*) OVER() AS total_count
        FROM tickets
        JOIN users ON tickets.user_id = users.id
        JOIN events ON tickets.event_id = events.id
        WHERE events.id = $1
          AND tickets.status = COALESCE($2::ticket_status, tickets.status)
          AND users.name ILIKE COALESCE('%' || $3::text || '%', users.name)
        ORDER BY tickets.booked_at ASC
        LIMIT $4 OFFSET $5
      `,
      [event_id, statusParam, searchParam, limit, limit * (page - 1)]
    )
    const totalAttendees = attendeesResult.rows.length > 0 ? Number(attendeesResult.rows[0].total_count) : 0
    return {
      attendees: attendeesResult.rows,
      totalAttendees
    }
  }

  async getCreatedEventAttendeesDetails(event_id: UUIDv4, user_id: UUIDv4) {
    const attendeeResult = await databaseService.events(
      `
        SELECT
          users.id as user_id,
          users.name,
          users.email,
          users.avatar_url
        FROM users
        WHERE users.id = $1
        LIMIT 1
      `,
      [user_id]
    )
    return attendeeResult.rows[0]
  }

  async getAnalytics(organizer_id: UUIDv4) {
    const sales_vs_attendance_per_event = await databaseService.events(
      `
        SELECT
          e.id,
          e.title,
          e.start_at,
          COALESCE(o.paid_orders, 0)    AS paid_orders,
          COALESCE(t.checked_in, 0)     AS checked_in,
          COALESCE(o.sales_cents, 0)    AS sales_cents
        FROM events e
        LEFT JOIN (
          SELECT
            event_id,
            COUNT(*) FILTER (WHERE status = 'paid') AS paid_orders,
            SUM(amount_cents) FILTER (WHERE status = 'paid') AS sales_cents
          FROM orders
          GROUP BY event_id
        ) o ON o.event_id = e.id
        LEFT JOIN (
          SELECT
            event_id,
            COUNT(*) FILTER (WHERE status = 'checked_in') AS checked_in
          FROM tickets
          GROUP BY event_id
        ) t ON t.event_id = e.id
        WHERE e.organizer_id = $1
        ORDER BY sales_cents DESC;
      `,
      [organizer_id]
    )
    const cancellation_stats = await databaseService.events(
      `
        SELECT
          e.id AS event_id,
          e.title,

          COUNT(o.id) FILTER (WHERE o.status = 'paid')     AS paid_orders,
          COUNT(o.id) FILTER (WHERE o.status = 'canceled') AS canceled_orders,

          COALESCE(SUM(o.amount_cents) FILTER (WHERE o.status = 'paid'), 0)     AS gross_revenue_cents,
          COALESCE(SUM(o.amount_cents) FILTER (WHERE o.status = 'canceled'), 0) AS canceled_amount_cents

        FROM events e
        LEFT JOIN orders o ON o.event_id = e.id
        WHERE e.organizer_id = $1
        GROUP BY e.id, e.title
        ORDER BY canceled_amount_cents DESC;
      `,
      [organizer_id]
    )
    const revenue_efficiency_vs_capacity = await databaseService.events(
      `
        SELECT
          e.id,
          e.title,
          e.start_at,
          e.capacity,

          COALESCE(o.paid_orders, 0)   AS paid_orders,
          COALESCE(t.checked_in, 0)    AS checked_in,
          COALESCE(o.sales_cents, 0)   AS sales_cents,

          CASE
            WHEN e.capacity = 0 THEN 0
            ELSE ROUND(o.paid_orders::numeric / e.capacity, 4)
          END AS capacity_sold_ratio,

          CASE
            WHEN e.capacity = 0 THEN 0
            ELSE ROUND(o.sales_cents::numeric / e.capacity, 2)
          END AS revenue_per_capacity_seat_cents

        FROM events e
        LEFT JOIN (
          SELECT
            event_id,
            COUNT(*) FILTER (WHERE status = 'paid') AS paid_orders,
            SUM(amount_cents) FILTER (WHERE status = 'paid') AS sales_cents
          FROM orders
          GROUP BY event_id
        ) o ON o.event_id = e.id
        LEFT JOIN (
          SELECT
            event_id,
            COUNT(*) FILTER (WHERE status = 'checked_in') AS checked_in
          FROM tickets
          GROUP BY event_id
        ) t ON t.event_id = e.id
        WHERE e.organizer_id = $1
        ORDER BY revenue_per_capacity_seat_cents DESC;
      `,
      [organizer_id]
    )

    return {
      sales_vs_attendance_per_event: sales_vs_attendance_per_event.rows,
      cancellation_stats: cancellation_stats.rows,
      revenue_efficiency_vs_capacity: revenue_efficiency_vs_capacity.rows
    }
  }

  async banUserFromEventAttending(event_id: UUIDv4, user_id: UUIDv4, reason?: string) {
    const new_ban = new EventBan({
      event_id,
      user_id,
      reason
    })
    await databaseService.orders(
      `
        UPDATE orders
        SET status = $2,
            canceled_at = NOW()
        FROM events
        WHERE orders.event_id = events.id
          AND orders.user_id = $1
          AND events.id = $3
      `,
      [user_id, 'canceled', event_id]
    )
    await databaseService.tickets(
      `
        UPDATE tickets
          SET status = 'canceled',
              checked_in_at = NULL
        WHERE tickets.event_id = $1
          AND tickets.user_id = $2
      `,
      [event_id, user_id]
    )
    await databaseService.events(
      `
        UPDATE events
        SET checked_in = GREATEST(checked_in - 1, 0)
        WHERE id = $1
      `,
      [event_id]
    )
    const banResult = await databaseService.event_bans(
      `
        INSERT INTO event_bans (
          event_id,
          user_id,
          reason
        )
        VALUES ($1, $2, $3)
        RETURNING
          event_id,
          user_id,
          reason
      `,
      [new_ban.event_id, new_ban.user_id, new_ban.reason]
    )
    return banResult.rows[0]
  }

  async getBannedEventAttendees(event_id: UUIDv4, limit: number, page: number, search?: string) {
    const searchParam = search ?? null
    const bannedResult = await databaseService.event_bans(
      `
        SELECT
          users.id as user_id,
          users.name,
          users.email,
          users.avatar_url,
          event_bans.reason,
          COUNT(*) OVER() AS total_count
        FROM event_bans
        JOIN users ON event_bans.user_id = users.id
        WHERE event_bans.event_id = $1
          AND users.name ILIKE COALESCE('%' || $2::text || '%', users.name)
        ORDER BY event_bans.created_at DESC
        LIMIT $3 OFFSET $4
      `,
      [event_id, searchParam, limit, limit * (page - 1)]
    )
    const totalBanned = bannedResult.rows.length > 0 ? Number(bannedResult.rows[0].total_count) : 0
    return {
      banned_attendees: bannedResult.rows,
      total: totalBanned
    }
  }

  async getBannedEventAttendeesDetails(event_id: UUIDv4, user_id: UUIDv4) {
    const banResult = await databaseService.event_bans(
      `
        SELECT 
          users.id as user_id,
          users.name,
          users.email,
          users.avatar_url,
          event_bans.reason
        FROM event_bans
        JOIN users ON event_bans.user_id = users.id
        WHERE event_bans.event_id = $1
          AND users.id = $2
        LIMIT 1
      `,
      [event_id, user_id]
    )
    return banResult.rows[0]
  }

  async unbanUserFromEventAttending(event_id: UUIDv4, user_id: UUIDv4) {
    await databaseService.event_bans(
      `
        DELETE FROM event_bans
        WHERE event_id = $1
          AND user_id = $2
      `,
      [event_id, user_id]
    )
  }

  async getAllBannedEvents(limit: number, page: number, search?: string) {
    const searchParam = search ?? null
    const bannedResult = await databaseService.event_bans(
      `
        SELECT
          events.id as event_id,
          events.title,
          event_bans.reason,
          COUNT(event_bans.user_id) AS total_banned,
          COUNT(*) OVER() AS total_count
        FROM event_bans
        JOIN events ON event_bans.event_id = events.id
        WHERE events.title ILIKE COALESCE('%' || $1::text || '%', events.title)
        GROUP BY events.id, events.title, event_bans.reason
        ORDER BY total_banned DESC
        LIMIT $2 OFFSET $3
      `,
      [searchParam, limit, limit * (page - 1)]
    )
    const totalBannedEvents = bannedResult.rows.length > 0 ? Number(bannedResult.rows[0].total_count) : 0
    return {
      banned_events: bannedResult.rows,
      totalBannedEvents
    }
  }
}

const eventService = new EventService()
export default eventService

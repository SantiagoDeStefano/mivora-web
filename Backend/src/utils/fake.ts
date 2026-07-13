import { faker } from '@faker-js/faker'
import { v4 as uuidv4 } from 'uuid'
import type { UUIDv4 } from '~/types/common'
import databaseService from '~/services/database.services' // adjust if path differs

// ------------------
// Types
// ------------------
export interface FakeEvent {
  id: UUIDv4
  organizer_id: UUIDv4
  title: string
  description: string
  poster_url: string
  location_text: string
  start_at: Date
  end_at: Date
  price_cents: number
  checked_in: number
  capacity: number
  status: 'draft' | 'published' | 'canceled'
}

// ------------------
// Fake data generator
// ------------------
function generateFakeEvent(): FakeEvent {
  const start_at = faker.date.soon({ days: 30 })
  const end_at = new Date(start_at.getTime() + faker.number.int({ min: 1, max: 6 }) * 60 * 60 * 1000)

  return {
    id: uuidv4() as UUIDv4,
    organizer_id: faker.helpers.arrayElement([
      '108ccbe5-a294-4024-92c9-88998de21203'
    ]) as UUIDv4,
    title: faker.company.catchPhrase(),
    description: faker.lorem.paragraphs({ min: 1, max: 3 }),
    poster_url: faker.image.urlPicsumPhotos({ width: 800, height: 600 }),
    location_text: `${faker.location.city()}, ${faker.location.country()}`,
    start_at,
    end_at,
    price_cents: faker.number.int({ min: 0, max: 50000 }),
    checked_in: 0,
    capacity: faker.number.int({ min: 3, max: 20 }),
    status: faker.helpers.arrayElement(['draft', 'published', 'canceled'])
    // status: faker.helpers.arrayElement(['published'])
  }
}

function generateFakeEvents(count: number): FakeEvent[] {
  return Array.from({ length: count }, generateFakeEvent)
}

// ------------------
// Seeder
// ------------------
const NUMBR_OF_FAKES_EVENTS = 10
async function seedFakeEvents(count = NUMBR_OF_FAKES_EVENTS) {
  const fakeEvents = generateFakeEvents(count)

  console.log(`🌱 Inserting ${count} fake events...`)

  for (const ev of fakeEvents) {
    await databaseService.events(
      `
      INSERT INTO events (
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
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `,
      [
        ev.id,
        ev.organizer_id,
        ev.title,
        ev.description,
        ev.poster_url,
        ev.location_text,
        ev.start_at,
        ev.end_at,
        ev.price_cents,
        ev.checked_in,
        ev.capacity,
        ev.status
      ]
    )
  }

  console.log(`✅ Seeded ${count} fake events successfully.`)
}

// ------------------
// Auto-run on import
// ------------------
seedFakeEvents(NUMBR_OF_FAKES_EVENTS).catch((err) => {
  console.error('❌ Failed to seed fake events:', err)
  process.exit(1)
})

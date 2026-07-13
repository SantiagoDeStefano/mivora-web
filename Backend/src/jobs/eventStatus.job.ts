import databaseService from '~/services/database.services'

const LOCK_KEY = 424242
const INTERVAL_MS = 30 * 1000 // debug

async function runOnce() {
  const client = await databaseService.getClient()
  try {
    console.log('[eventStatusJob] tick', new Date().toISOString())

    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [LOCK_KEY])
    if (!rows[0].locked) return

    await client.query('BEGIN')

    const r1 = await client.query(`
      UPDATE events
      SET status='in_progress', updated_at=now()
      WHERE status='published' AND now() >= start_at AND now() < end_at
    `)

    const r2 = await client.query(`
      UPDATE events
      SET status='finished', updated_at=now()
      WHERE status IN ('published','in_progress') AND now() >= end_at
    `)

    await client.query('COMMIT')
    console.log(`[eventStatusJob] updated in_progress=${r1.rowCount} finished=${r2.rowCount}`)
  } catch (e) {
    try {
      await client.query('ROLLBACK')
    } catch {
      console.error('[eventStatusJob] error:', e)
    }
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY])
    } catch {
      console.error('[eventStatusJob] failed to release lock')
    }
    client.release()
  }
}

export function startEventStatusJob() {
  console.log('[eventStatusJob] started')
  runOnce().catch(console.error)
  setInterval(() => runOnce().catch(console.error), INTERVAL_MS)
}

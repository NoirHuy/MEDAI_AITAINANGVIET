// ---------------------------------------------------------------------
// Minimal JSON-file "database". Good enough for local development and
// demoing the API without standing up Postgres/MongoDB, but it is NOT a
// real database: no indexes, no transactions across collections, and it
// re-reads/re-writes the whole file on every access. For production,
// swap this module for a real DB client and keep the repo functions'
// signatures (findByEmail, create, update, ...) the same so routes don't
// need to change.
// ---------------------------------------------------------------------

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '../../data')

const writeQueues = new Map()

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`)
}

export async function readCollection(name) {
  await ensureDataDir()
  try {
    const raw = await fs.readFile(filePath(name), 'utf-8')
    return JSON.parse(raw)
  } catch (err) {
    if (err.code === 'ENOENT') return []
    throw err
  }
}

// Serializes writes per-collection so two concurrent requests can't
// interleave and corrupt the file.
export function writeCollection(name, data) {
  const previous = writeQueues.get(name) ?? Promise.resolve()
  const next = previous
    .catch(() => {})
    .then(async () => {
      await ensureDataDir()
      await fs.writeFile(filePath(name), JSON.stringify(data, null, 2), 'utf-8')
    })
  writeQueues.set(name, next)
  return next
}

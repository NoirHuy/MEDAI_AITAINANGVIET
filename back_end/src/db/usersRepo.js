import { randomUUID } from 'node:crypto'
import { readCollection, writeCollection } from './jsonDb.js'

const COLLECTION = 'users'

function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

export async function findUserByEmail(email) {
  const users = await readCollection(COLLECTION)
  return users.find((u) => u.email === normalizeEmail(email)) ?? null
}

export async function findUserById(id) {
  const users = await readCollection(COLLECTION)
  return users.find((u) => u.id === id) ?? null
}

export async function createUser({ name, email, passwordHash, provider, planId }) {
  const users = await readCollection(COLLECTION)
  const user = {
    id: randomUUID(),
    name,
    email: normalizeEmail(email),
    passwordHash: passwordHash ?? null,
    provider,
    planId,
    tokensUsed: 0,
    createdAt: new Date().toISOString(),
  }
  users.push(user)
  await writeCollection(COLLECTION, users)
  return user
}

export async function updateUser(id, patch) {
  const users = await readCollection(COLLECTION)
  const idx = users.findIndex((u) => u.id === id)
  if (idx === -1) return null
  users[idx] = { ...users[idx], ...patch }
  await writeCollection(COLLECTION, users)
  return users[idx]
}

export async function incrementUsage(id, tokens) {
  const users = await readCollection(COLLECTION)
  const idx = users.findIndex((u) => u.id === id)
  if (idx === -1) return null
  users[idx] = { ...users[idx], tokensUsed: (users[idx].tokensUsed ?? 0) + tokens }
  await writeCollection(COLLECTION, users)
  return users[idx]
}

export function toPublicUser(user) {
  if (!user) return null
  const { passwordHash: _passwordHash, ...publicFields } = user
  return publicFields
}

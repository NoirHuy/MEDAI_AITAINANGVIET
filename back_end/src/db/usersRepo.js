import { randomUUID } from 'node:crypto'
import { UserModel } from './user.model.js'

function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

export async function findUserByEmail(email) {
  return await UserModel.findOne({ email: normalizeEmail(email) }).lean()
}

export async function findUserById(id) {
  return await UserModel.findOne({ id }).lean()
}

export async function createUser({ name, email, passwordHash, provider, planId }) {
  const user = new UserModel({
    id: randomUUID(),
    name,
    email: normalizeEmail(email),
    passwordHash: passwordHash ?? null,
    provider,
    planId,
    tokensUsed: 0,
  })
  await user.save()
  return user.toObject()
}

export async function updateUser(id, patch) {
  return await UserModel.findOneAndUpdate(
    { id },
    { $set: patch },
    { new: true }
  ).lean()
}

export async function incrementUsage(id, tokens) {
  return await UserModel.findOneAndUpdate(
    { id },
    { $inc: { tokensUsed: tokens } },
    { new: true }
  ).lean()
}

export function toPublicUser(user) {
  if (!user) return null
  const { passwordHash: _passwordHash, _id, ...publicFields } = user
  return publicFields
}

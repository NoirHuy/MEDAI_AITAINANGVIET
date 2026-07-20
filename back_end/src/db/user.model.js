import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, default: null },
  provider: { type: String, required: true },
  planId: { type: String, required: true },
  tokensUsed: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
}, {
  versionKey: false,
})

// Mongoose model mapping to the 'users' collection
export const UserModel = mongoose.model('User', userSchema, 'users')

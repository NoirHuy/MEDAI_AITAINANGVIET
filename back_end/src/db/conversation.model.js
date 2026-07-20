import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  id: { type: String, required: true },
  role: { type: String, required: true, enum: ['user', 'assistant'] },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false })

const conversationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  title: { type: String, required: true },
  specialtyId: { type: String, required: true },
  messages: [messageSchema],
  createdAt: { type: Date, default: Date.now }
}, {
  versionKey: false,
})

// Index on userId for fast query of a user's conversations
conversationSchema.index({ userId: 1 })

export const ConversationModel = mongoose.model('Conversation', conversationSchema, 'conversations')

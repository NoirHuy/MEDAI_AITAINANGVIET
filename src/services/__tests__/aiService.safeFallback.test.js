import { describe, expect, it, vi } from 'vitest'
import { streamAssistantReply } from '../aiService.js'

describe('streamAssistantReply', () => {
  it('returns a safe fallback message when the backend is unreachable', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    })

    let captured = ''
    const result = await streamAssistantReply({
      messages: [{ role: 'user', content: 'Tôi bị đau ngực' }],
      specialtyId: 'health_consultation',
      lang: 'vi',
      onToken: (chunk) => { captured += chunk },
    })

    expect(captured.length).toBeGreaterThan(0)
    expect(captured).toMatch(/cấp cứu|cơ sở y tế/)
    expect(result).toBe(captured)
  })

  it('still propagates AbortError to the caller', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new DOMException('Aborted', 'AbortError')
    })

    await expect(
      streamAssistantReply({
        messages: [{ role: 'user', content: 'hi' }],
        specialtyId: 'general',
        lang: 'en',
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('emits an English safe fallback for English sessions', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('down')
    })

    let captured = ''
    await streamAssistantReply({
      messages: [{ role: 'user', content: 'Hello' }],
      specialtyId: 'general',
      lang: 'en',
      onToken: (chunk) => { captured += chunk },
    })

    expect(captured.toLowerCase()).toContain('emergency')
  })

  it('parses and emits __STATUS__ markers while stripping them from text', async () => {
    const encoder = new TextEncoder()
    const chunks = [
      encoder.encode('__STATUS__:intake\n'),
      encoder.encode('__STATUS__:extracting\n'),
      encoder.encode('__STATUS__:composing\nXin '),
      encoder.encode('chào bạn!'),
    ]

    let readIndex = 0
    const mockStream = {
      getReader: () => ({
        read: async () => {
          if (readIndex < chunks.length) {
            return { value: chunks[readIndex++], done: false }
          }
          return { value: undefined, done: true }
        },
        releaseLock: () => {},
      }),
    }

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: mockStream,
    }))

    const capturedStatuses = []
    let capturedText = ''

    const result = await streamAssistantReply({
      messages: [{ role: 'user', content: 'Chào' }],
      specialtyId: 'health_consultation',
      lang: 'vi',
      onToken: (c) => { capturedText += c },
      onStatus: (s) => capturedStatuses.push(s),
    })

    expect(capturedStatuses).toEqual(['intake', 'extracting', 'composing'])
    expect(capturedText).toBe('Xin chào bạn!')
    expect(capturedText).not.toContain('__STATUS__')
    expect(result).toBe('Xin chào bạn!')
  })
})

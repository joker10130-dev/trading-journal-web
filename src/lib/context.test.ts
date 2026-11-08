import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTag, getTradeContext, listTags } from './context'

const tag = { id: 8, name: 'Calm', category: 'EMOTION', sentiment: 'POSITIVE' } as const

describe('trade context requests', () => {
  afterEach(() => vi.restoreAllMocks())

  it('loads tags and trade context with bearer authentication', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json([tag]))
      .mockResolvedValueOnce(Response.json({ tags: [tag], note: 'Patient entry', images: [] }))

    await expect(listTags('access-token')).resolves.toEqual([tag])
    await expect(getTradeContext('31', 'access-token')).resolves.toEqual({
      tags: [tag],
      note: 'Patient entry',
      images: [],
    })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/tags')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      credentials: 'include',
      headers: { Authorization: 'Bearer access-token' },
    })
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/trades/31/context')
  })

  it('sends tag values as JSON and surfaces API errors', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json(tag, { status: 201 }))
      .mockResolvedValueOnce(Response.json(
        { detail: 'A tag with this name already exists.' },
        { status: 409 },
      ))

    await expect(createTag('access-token', {
      name: 'Calm',
      category: 'EMOTION',
      sentiment: 'POSITIVE',
    })).resolves.toEqual(tag)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Calm', category: 'EMOTION', sentiment: 'POSITIVE' }),
    })
    await expect(createTag('access-token', {
      name: 'Calm',
      category: 'EMOTION',
      sentiment: 'POSITIVE',
    })).rejects.toMatchObject({
      name: 'ContextRequestError',
      status: 409,
      message: 'A tag with this name already exists.',
    })
  })
})

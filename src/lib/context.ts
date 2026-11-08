export type TagCategory = 'SETUP' | 'MISTAKE' | 'EMOTION' | 'OTHER'
export type TagSentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'

export type TagRecord = {
  id: number
  name: string
  category: TagCategory
  sentiment: TagSentiment | null
}

export type TradeImageRecord = {
  id: number
  contentType: 'image/png' | 'image/jpeg' | 'image/webp'
  createdAt: string
}

export type TradeContext = {
  tags: TagRecord[]
  note: string
  images: TradeImageRecord[]
}

export class ContextRequestError extends Error {
  readonly status: number

  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ContextRequestError'
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTag(value: unknown): value is TagRecord {
  return isRecord(value)
    && typeof value.id === 'number'
    && typeof value.name === 'string'
    && (value.category === 'SETUP' || value.category === 'MISTAKE' || value.category === 'EMOTION' || value.category === 'OTHER')
    && (value.sentiment === null || value.sentiment === 'POSITIVE' || value.sentiment === 'NEGATIVE' || value.sentiment === 'NEUTRAL')
}

function isImage(value: unknown): value is TradeImageRecord {
  return isRecord(value)
    && typeof value.id === 'number'
    && (value.contentType === 'image/png' || value.contentType === 'image/jpeg' || value.contentType === 'image/webp')
    && typeof value.createdAt === 'string'
}

function isTagList(value: unknown): value is TagRecord[] {
  return Array.isArray(value) && value.every(isTag)
}

function isTradeContext(value: unknown): value is TradeContext {
  return isRecord(value)
    && isTagList(value.tags)
    && typeof value.note === 'string'
    && Array.isArray(value.images)
    && value.images.every(isImage)
}

async function request<T>(
  path: string,
  accessToken: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  validate: (value: unknown) => value is T,
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body === undefined || body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  })
  if (!response.ok) {
    const payload: unknown = await response.json()
    const detail = isRecord(payload) && typeof payload.detail === 'string'
      ? payload.detail
      : `Trade context request failed with status ${response.status}.`
    throw new ContextRequestError(response.status, detail)
  }
  if (response.status === 204) return undefined as T
  const payload: unknown = await response.json()
  if (!validate(payload)) throw new Error('The trade context response was invalid.')
  return payload
}

function isEmpty(value: unknown): value is undefined {
  return value === undefined
}

function isImageRecord(value: unknown): value is TradeImageRecord {
  return isImage(value)
}

export function listTags(accessToken: string): Promise<TagRecord[]> {
  return request('/api/v1/tags', accessToken, 'GET', isTagList)
}

export function createTag(
  accessToken: string,
  tag: Omit<TagRecord, 'id'>,
): Promise<TagRecord> {
  return request('/api/v1/tags', accessToken, 'POST', isTag, tag)
}

export function updateTag(
  accessToken: string,
  id: number,
  tag: Omit<TagRecord, 'id'>,
): Promise<TagRecord> {
  return request(`/api/v1/tags/${id}`, accessToken, 'PUT', isTag, tag)
}

export function deleteTag(accessToken: string, id: number): Promise<void> {
  return request(`/api/v1/tags/${id}`, accessToken, 'DELETE', isEmpty)
}

export function getTradeContext(tradeId: string, accessToken: string): Promise<TradeContext> {
  return request(`/api/v1/trades/${tradeId}/context`, accessToken, 'GET', isTradeContext)
}

export function assignTradeTags(tradeId: string, tagIds: number[], accessToken: string): Promise<void> {
  return request(`/api/v1/trades/${tradeId}/tags`, accessToken, 'PUT', isEmpty, { tagIds })
}

export function saveTradeNote(tradeId: string, text: string, accessToken: string): Promise<void> {
  return request(`/api/v1/trades/${tradeId}/note`, accessToken, 'PUT', isEmpty, { text })
}

export function deleteTradeNote(tradeId: string, accessToken: string): Promise<void> {
  return request(`/api/v1/trades/${tradeId}/note`, accessToken, 'DELETE', isEmpty)
}

export async function uploadTradeImage(
  tradeId: string,
  file: File,
  accessToken: string,
): Promise<TradeImageRecord> {
  const form = new FormData()
  form.append('file', file)
  return request(`/api/v1/trades/${tradeId}/images`, accessToken, 'POST', isImageRecord, form)
}

export async function getTradeImageUrl(
  tradeId: string,
  imageId: number,
  accessToken: string,
): Promise<string> {
  const response = await fetch(`/api/v1/trades/${tradeId}/images/${imageId}`, {
    method: 'GET',
    credentials: 'include',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    const payload: unknown = await response.json()
    const detail = isRecord(payload) && typeof payload.detail === 'string'
      ? payload.detail
      : `Trade image request failed with status ${response.status}.`
    throw new ContextRequestError(response.status, detail)
  }
  return URL.createObjectURL(await response.blob())
}

export function deleteTradeImage(tradeId: string, imageId: number, accessToken: string): Promise<void> {
  return request(`/api/v1/trades/${tradeId}/images/${imageId}`, accessToken, 'DELETE', isEmpty)
}

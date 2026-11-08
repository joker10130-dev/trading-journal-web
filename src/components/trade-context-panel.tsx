import { useCallback, useEffect, useRef, useState } from 'react'
import {
  assignTradeTags,
  ContextRequestError,
  deleteTradeImage,
  deleteTradeNote,
  getTradeContext,
  getTradeImageUrl,
  listTags,
  saveTradeNote,
  uploadTradeImage,
  type TagRecord,
  type TradeContext,
} from '../lib/context'

type Props = {
  tradeId: string
  accessToken: string
  onAuthenticationRequired: () => void
}

function TradeContextPanel({ tradeId, accessToken, onAuthenticationRequired }: Props) {
  const [context, setContext] = useState<TradeContext | null>(null)
  const [availableTags, setAvailableTags] = useState<TagRecord[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [note, setNote] = useState('')
  const [imageUrls, setImageUrls] = useState<Record<number, string>>({})
  const imageUrlsRef = useRef<Record<number, string>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    setError('')
    const [nextContext, tags] = await Promise.all([
      getTradeContext(tradeId, accessToken),
      listTags(accessToken),
    ])
    setContext(nextContext)
    setSelectedTagIds(nextContext.tags.map((tag) => tag.id))
    setNote(nextContext.note)
    const pairs = await Promise.all(nextContext.images.map(async (image) => [
      image.id,
      await getTradeImageUrl(tradeId, image.id, accessToken),
    ] as const))
    setImageUrls((current) => {
      Object.values(current).forEach(URL.revokeObjectURL)
      const next = Object.fromEntries(pairs)
      imageUrlsRef.current = next
      return next
    })
    setAvailableTags(tags)
  }, [accessToken, tradeId])

  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => {
        if (!active) return
        setLoading(true)
        return reload()
      })
      .catch((requestError: unknown) => {
        if (!active) return
        if (requestError instanceof ContextRequestError && requestError.status === 401) {
          onAuthenticationRequired()
          return
        }
        setError(requestError instanceof Error ? requestError.message : 'Unable to load trade context.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => {
      active = false
      Object.values(imageUrlsRef.current).forEach(URL.revokeObjectURL)
    }
  }, [reload, onAuthenticationRequired])

  function handleError(requestError: unknown) {
    if (requestError instanceof ContextRequestError && requestError.status === 401) {
      onAuthenticationRequired()
      return
    }
    setError(requestError instanceof Error ? requestError.message : 'Unable to update trade context.')
  }

  async function saveTags() {
    setSaving(true)
    setError('')
    try {
      await assignTradeTags(tradeId, selectedTagIds, accessToken)
      await reload()
    } catch (requestError) {
      handleError(requestError)
    } finally {
      setSaving(false)
    }
  }

  async function saveNoteValue() {
    setSaving(true)
    setError('')
    try {
      await saveTradeNote(tradeId, note, accessToken)
      await reload()
    } catch (requestError) {
      handleError(requestError)
    } finally {
      setSaving(false)
    }
  }

  async function removeNote() {
    setSaving(true)
    setError('')
    try {
      await deleteTradeNote(tradeId, accessToken)
      await reload()
    } catch (requestError) {
      handleError(requestError)
    } finally {
      setSaving(false)
    }
  }

  async function addImage(file: File | undefined) {
    if (!file) return
    setSaving(true)
    setError('')
    try {
      await uploadTradeImage(tradeId, file, accessToken)
      await reload()
    } catch (requestError) {
      handleError(requestError)
    } finally {
      setSaving(false)
    }
  }

  async function removeImage(imageId: number) {
    setSaving(true)
    setError('')
    try {
      await deleteTradeImage(tradeId, imageId, accessToken)
      await reload()
    } catch (requestError) {
      handleError(requestError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="trade-context-panel" aria-label="Trade context">
      <h3>Trade context</h3>
      {error && <div className="trade-management-error" role="alert">{error}</div>}
      {loading || !context
        ? <p role="status">Loading trade context…</p>
        : <>
            <div className="context-section">
              <h4>Tags</h4>
              {availableTags.length === 0
                ? <p className="tag-category">Create tags from Manage tags first.</p>
                : <div className="context-tag-options">
                    {availableTags.map((tag) => (
                      <label key={tag.id}>
                        <input
                          type="checkbox"
                          checked={selectedTagIds.includes(tag.id)}
                          onChange={() => setSelectedTagIds((current) => current.includes(tag.id)
                            ? current.filter((id) => id !== tag.id)
                            : [...current, tag.id])}
                        />
                        {tag.name}
                      </label>
                    ))}
                  </div>}
              <button className="secondary-button" disabled={saving} onClick={() => { void saveTags() }} type="button">Save tags</button>
            </div>
            <div className="context-section">
              <label className="context-note-label" htmlFor="trade-note">Notes</label>
              <textarea id="trade-note" rows={4} value={note} onChange={(event) => setNote(event.target.value)} />
              <div className="context-actions">
                <button className="secondary-button" disabled={saving} onClick={() => { void saveNoteValue() }} type="button">Save note</button>
                {context.note && <button className="trade-link-button" disabled={saving} onClick={() => { void removeNote() }} type="button">Remove note</button>}
              </div>
            </div>
            <div className="context-section">
              <h4>Chart screenshots</h4>
              <label className="image-upload-label">
                <span>Upload PNG, JPEG, or WebP (max 5 MB)</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={saving}
                  onChange={(event) => {
                    void addImage(event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
              </label>
              <div className="context-image-list">
                {context.images.map((image) => (
                  <figure key={image.id}>
                    {imageUrls[image.id]
                      ? <img src={imageUrls[image.id]} alt="Trade chart screenshot" />
                      : <span role="status">Loading image…</span>}
                    <button className="trade-link-button" disabled={saving} onClick={() => { void removeImage(image.id) }} type="button">Remove image</button>
                  </figure>
                ))}
                {context.images.length === 0 && <p className="tag-category">No chart screenshots.</p>}
              </div>
            </div>
          </>}
    </section>
  )
}

export default TradeContextPanel

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  ContextRequestError,
  createTag,
  deleteTag,
  listTags,
  updateTag,
  type TagCategory,
  type TagRecord,
  type TagSentiment,
} from '../lib/context'

type Props = {
  accessToken: string
  onAuthenticationRequired: () => void
}

const categories: TagCategory[] = ['SETUP', 'MISTAKE', 'EMOTION', 'OTHER']
const sentiments: TagSentiment[] = ['POSITIVE', 'NEGATIVE', 'NEUTRAL']
const label = (value: string) => value[0] + value.slice(1).toLowerCase()

function TagManagementScreen({ accessToken, onAuthenticationRequired }: Props) {
  const [tags, setTags] = useState<TagRecord[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<TagCategory>('SETUP')
  const [sentiment, setSentiment] = useState<TagSentiment | ''>('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      setTags(await listTags(accessToken))
      setError('')
    } catch (requestError) {
      if (requestError instanceof ContextRequestError && requestError.status === 401) {
        onAuthenticationRequired()
        return
      }
      setError(requestError instanceof Error ? requestError.message : 'Unable to load tags.')
    } finally {
      setLoading(false)
    }
  }, [accessToken, onAuthenticationRequired])

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => { if (active) return reload() })
    return () => { active = false }
  }, [reload])

  function startEdit(tag: TagRecord) {
    setEditingId(tag.id)
    setName(tag.name)
    setCategory(tag.category)
    setSentiment(tag.sentiment ?? '')
    setError('')
  }

  function resetForm() {
    setEditingId(null)
    setName('')
    setCategory('SETUP')
    setSentiment('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const value = { name, category, sentiment: sentiment || null }
    try {
      if (editingId === null) await createTag(accessToken, value)
      else await updateTag(accessToken, editingId, value)
      resetForm()
      await reload()
    } catch (requestError) {
      if (requestError instanceof ContextRequestError && requestError.status === 401) {
        onAuthenticationRequired()
        return
      }
      setError(requestError instanceof Error ? requestError.message : 'Unable to save tag.')
    }
  }

  async function remove(tag: TagRecord) {
    try {
      await deleteTag(accessToken, tag.id)
      if (editingId === tag.id) resetForm()
      await reload()
    } catch (requestError) {
      if (requestError instanceof ContextRequestError && requestError.status === 401) {
        onAuthenticationRequired()
        return
      }
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete tag.')
    }
  }

  return (
    <main className="dashboard tag-management">
      <section className="panel tag-management-panel">
        <div className="panel-heading"><h2>Manage tags</h2></div>
        <form className="tag-editor-form" onSubmit={(event) => { void submit(event) }}>
          <label><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={64} required /></label>
          <label>
            <span>Category</span>
            <select value={category} onChange={(event) => {
              const next = event.target.value as TagCategory
              setCategory(next)
              if (next !== 'EMOTION') setSentiment('')
            }}>
              {categories.map((item) => <option key={item} value={item}>{label(item)}</option>)}
            </select>
          </label>
          <label>
            <span>Sentiment{category === 'EMOTION' ? ' (required)' : ''}</span>
            <select value={sentiment} required={category === 'EMOTION'} onChange={(event) => setSentiment(event.target.value as TagSentiment | '')}>
              <option value="">Not set</option>
              {sentiments.map((item) => <option key={item} value={item}>{label(item)}</option>)}
            </select>
          </label>
          <div className="tag-editor-actions">
            <button className="trade-add-button" type="submit">{editingId === null ? 'Create tag' : 'Save tag'}</button>
            {editingId !== null && <button className="trade-link-button" type="button" onClick={resetForm}>Cancel</button>}
          </div>
        </form>
        {error && <div className="trade-management-error" role="alert">{error}</div>}
        {loading
          ? <p role="status">Loading tags…</p>
          : tags.length === 0
            ? <p className="chart-empty">No tags yet.</p>
            : <ul className="managed-tag-list">
                {tags.map((tag) => (
                  <li key={tag.id}>
                    <span className="tag-chip">{tag.name}</span>
                    <span className="tag-category">{label(tag.category)}{tag.sentiment ? ` · ${label(tag.sentiment)}` : ''}</span>
                    <div>
                      <button className="trade-link-button" type="button" onClick={() => startEdit(tag)}>Rename / edit</button>
                      <button className="trade-link-button delete-tag-button" type="button" onClick={() => { void remove(tag) }}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>}
      </section>
    </main>
  )
}

export default TagManagementScreen

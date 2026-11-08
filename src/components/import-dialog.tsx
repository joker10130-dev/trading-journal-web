import { useState } from 'react'
import { FileSpreadsheet, Upload, X } from 'lucide-react'
import {
  confirmImport,
  detectImportSource,
  ImportRequestError,
  previewImport,
  type ImportPreview,
  type ImportResult,
  type ImportSource,
  type MultiFilePreview,
} from '../lib/imports'
import type { TradingAccount } from '../lib/accounts'

type Props = {
  accounts: TradingAccount[]
  accessToken: string
  onClose: () => void
  onAuthenticationRequired: () => void
  onImported: (result: ImportResult) => void
}

function previewCounts(preview: ImportPreview) {
  const counts: [string, number][] = [
    ['All rows', preview.totalRows],
    ['Duplicate rows', preview.duplicateRows],
    ['New trades', preview.newTrades ?? preview.newOrders ?? 0],
    ['Existing trades', preview.existingTrades ?? 0],
    ['Cash rows', preview.cashRows],
    ['Error rows', preview.errorRows],
  ]
  if (preview.newTradeCloses !== undefined) counts.push(['New trade closes', preview.newTradeCloses])
  if (preview.alreadyImportedTradeCloses !== undefined) {
    counts.push(['Already imported closes', preview.alreadyImportedTradeCloses])
  }
  if (preview.newCashTransactions !== undefined) {
    counts.push(['New cash transactions', preview.newCashTransactions])
  }
  if (preview.alreadyImportedOrders !== undefined) {
    counts.push(['Already imported orders', preview.alreadyImportedOrders])
  }
  return counts
}

function importSummary(result: ImportResult) {
  const counts: string[] = []
  if (result.importedTradeCloses !== undefined) {
    counts.push(`${result.importedTradeCloses} trade closes`)
  }
  if (result.importedCashTransactions !== undefined && result.importedCashTransactions > 0) {
    counts.push(`${result.importedCashTransactions} cash transactions`)
  }
  if (result.importedOrders !== undefined) counts.push(`${result.importedOrders} orders`)
  if (result.importedTradeCloses === undefined
    && result.importedOrders === undefined
    && result.newTrades !== undefined) {
    counts.push(`${result.newTrades} trades`)
  }
  return `Imported ${counts.length ? counts.join(' and ') : 'no new records'} from ${result.totalRows} rows.`
}

function ImportDialog({
  accounts,
  accessToken,
  onClose,
  onAuthenticationRequired,
  onImported,
}: Props) {
  const [accountId, setAccountId] = useState(String(accounts[0]?.id ?? ''))
  const [source, setSource] = useState<ImportSource | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [previewResult, setPreviewResult] = useState<MultiFilePreview | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [acknowledgeLoginMismatch, setAcknowledgeLoginMismatch] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [errorRows, setErrorRows] = useState(0)
  const [rowErrors, setRowErrors] = useState<string[]>([])
  const [successMessage, setSuccessMessage] = useState('')

  const isBusy = isDetecting || isPreviewing || isImporting

  function clearPreview() {
    setPreviewResult(null)
    setAcknowledgeLoginMismatch(false)
    setErrorMessage('')
    setErrorRows(0)
    setRowErrors([])
    setSuccessMessage('')
  }

  async function setSelectedFiles(nextFiles: File[]) {
    if (nextFiles.length > 5) {
      setErrorMessage('Select no more than 5 files per import.')
      return
    }
    setFiles(nextFiles)
    clearPreview()
    if (nextFiles.length === 0) {
      setSource(null)
      return
    }

    setIsDetecting(true)
    try {
      const detectedSources = await Promise.all(nextFiles.map(detectImportSource))
      if (new Set(detectedSources).size !== 1) {
        setSource(null)
        setErrorMessage('Select files from one report type at a time.')
        return
      }
      setSource(detectedSources[0])
    } catch (error) {
      setSource(null)
      setErrorMessage(error instanceof Error ? error.message : 'Unable to detect this report type.')
    } finally {
      setIsDetecting(false)
    }
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return
    const incoming = Array.from(fileList)
      .filter((file) => !files.some((item) => item.name === file.name && item.size === file.size))
    void setSelectedFiles([...files, ...incoming])
  }

  function removeFile(file: File) {
    void setSelectedFiles(files.filter((item) => item !== file))
  }

  async function handlePreview() {
    const selectedAccountId = Number(accountId)
    if (!Number.isInteger(selectedAccountId) || files.length === 0 || !source) return
    clearPreview()
    setIsPreviewing(true)
    try {
      setPreviewResult(await previewImport(selectedAccountId, source, files, accessToken))
    } catch (error) {
      if (error instanceof ImportRequestError) {
        setErrorMessage(error.message)
        setErrorRows(error.errorRows)
        setRowErrors(error.errors)
        if (error.status === 401) onAuthenticationRequired()
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to preview these files.')
      }
    } finally {
      setIsPreviewing(false)
    }
  }

  async function handleImport() {
    if (!previewResult || !source) return
    setErrorMessage('')
    setErrorRows(0)
    setRowErrors([])
    setIsImporting(true)
    try {
      const imported = await confirmImport(
        Number(accountId),
        source,
        files,
        previewResult.files,
        accessToken,
        acknowledgeLoginMismatch,
      )
      const message = importSummary(imported.result)
      setPreviewResult(null)
      setSuccessMessage(message)
      onImported(imported.result)
    } catch (error) {
      if (error instanceof ImportRequestError) {
        setErrorMessage(error.message)
        setErrorRows(error.errorRows)
        setRowErrors(error.errors)
        if (error.status === 401) onAuthenticationRequired()
        if (error.status === 409) setPreviewResult(null)
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to import these files.')
      }
    } finally {
      setIsImporting(false)
    }
  }

  const preview = previewResult?.preview
  const needsLoginAcknowledgment = source === 'EIGHTCAP' && preview?.loginMismatch === true

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (!isBusy && event.target === event.currentTarget) onClose()
    }}>
      <section className="import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <div className="modal-heading">
          <div><div className="metric-label">ADD TRADE HISTORY</div><h2 id="import-title">Import files</h2></div>
          <button className="close-button" onClick={onClose} aria-label="Close import dialog" type="button" disabled={isBusy}><X size={18} /></button>
        </div>
        <p className="modal-description">Preview up to five reports together. Files upload only when you request a preview.</p>
        <label className="upload-zone">
          <input
            type="file"
            accept=".csv,.xlsx"
            multiple
            disabled={isBusy}
            onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = '' }}
          />
          <Upload size={21} /><strong>Choose report files</strong><span>Up to 5 CSV or XLSX files of one report type</span>
        </label>
        {source && (
          <>
            <p className="import-detected">Detected: {source === 'EIGHTCAP' ? 'Eightcap Trades Report' : 'TradingView Order History'}</p>
            <div className="import-options">
              <label>
                <span>Trading account</span>
                <select value={accountId} disabled={isBusy} onChange={(event) => {
                  setAccountId(event.target.value)
                  clearPreview()
                }}>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name} · {account.broker} ({account.currency})</option>
                  ))}
                </select>
              </label>
            </div>
          </>
        )}
        {source === 'EIGHTCAP' && (
          <div className="import-tip"><FileSpreadsheet size={17} /><p><strong>Eightcap tip</strong><span>Monthly exports help avoid repeated rows in longer reports.</span></p></div>
        )}
        {files.length > 0 && (
          <div className="selected-files" aria-label="Selected files">
            {files.map((file) => (
              <div key={`${file.name}-${file.size}-${file.lastModified}`}>
                <FileSpreadsheet size={15} />
                <span>{file.name}<small>{(file.size / 1024).toFixed(0)} KB</small></span>
                <button onClick={() => removeFile(file)} aria-label={`Remove ${file.name}`} type="button" disabled={isBusy}><X size={14} /></button>
              </div>
            ))}
          </div>
        )}

        {errorMessage && (
          <div className="import-error" role="alert">
            <strong>{errorMessage}</strong>
            {errorRows > 0 && <span>{errorRows} error {errorRows === 1 ? 'row' : 'rows'} found.</span>}
            {rowErrors.length > 0 && <ul>{rowErrors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul>}
          </div>
        )}
        {successMessage && <p className="import-success" role="status">{successMessage}</p>}

        {preview && (
          <section className="import-preview" aria-labelledby="import-preview-title">
            <h3 id="import-preview-title">Preview · {preview.filename}</h3>
            <div className="import-count-grid">
              {previewCounts(preview).map(([label, count]) => (
                <div key={label}><span>{label}</span><strong>{count.toLocaleString()}</strong></div>
              ))}
            </div>
            {previewResult.files.length > 1 && (
              <ul className="import-file-counts">
                {previewResult.files.map((file) => (
                  <li key={`${file.filename}-${file.fileSha256}`}>{file.filename}: {file.totalRows.toLocaleString()} rows</li>
                ))}
              </ul>
            )}
            {(preview.warnings ?? []).map((warning) => (
              <p className="import-warning" key={warning.code}><strong>{warning.code.replaceAll('_', ' ')}</strong> {warning.message}</p>
            ))}
            {needsLoginAcknowledgment && (
              <label className="login-acknowledgment">
                <input
                  type="checkbox"
                  checked={acknowledgeLoginMismatch}
                  onChange={(event) => setAcknowledgeLoginMismatch(event.target.checked)}
                />
                I confirm this report belongs to the selected account.
              </label>
            )}
          </section>
        )}

        <div className="modal-footer">
          <button className="secondary-button" onClick={onClose} type="button" disabled={isBusy}>Close</button>
          {successMessage
            ? <button className="confirm-button import-confirm-button" onClick={onClose} type="button">Done</button>
            : preview
            ? <button
                className="confirm-button import-confirm-button"
                onClick={handleImport}
                disabled={isBusy || (needsLoginAcknowledgment && !acknowledgeLoginMismatch)}
                type="button"
              >{isImporting ? 'Importing…' : 'Confirm import'}</button>
            : <button
                className="confirm-button import-confirm-button"
                onClick={handlePreview}
                disabled={isBusy || files.length === 0 || !accountId}
                type="button"
              >{isDetecting ? 'Detecting report…' : isPreviewing ? 'Preparing preview…' : 'Preview import'}</button>}
        </div>
        {isBusy && <p className="import-progress" role="status">
          {isDetecting ? 'Checking file headers…' : isPreviewing ? 'Uploading and checking files…' : 'Saving import batch…'}
        </p>}
      </section>
    </div>
  )
}

export default ImportDialog

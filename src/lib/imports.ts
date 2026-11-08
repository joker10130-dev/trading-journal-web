export type ImportSource = 'EIGHTCAP' | 'TRADINGVIEW'

export type ImportWarning = {
  code: string
  message: string
}

export type ImportPreview = {
  tradingAccountId: number
  filename: string
  fileSha256: string
  totalRows: number
  duplicateRows: number
  uniqueRows: number
  newTrades?: number
  existingTrades?: number
  newTradeCloses?: number
  alreadyImportedTradeCloses?: number
  newCashTransactions?: number
  alreadyImportedCashTransactions?: number
  newOrders?: number
  alreadyImportedOrders?: number
  nonTradeRows: number
  cashRows: number
  errorRows: number
  loginMismatch?: boolean
  possibleManualTradeDuplicates?: number
  deletedTradeMatches?: number
  warnings?: ImportWarning[]
}

export type ImportFilePreview = {
  filename: string
  fileSha256: string
  totalRows: number
}

export type MultiFilePreview = {
  files: ImportFilePreview[]
  preview: ImportPreview
}

export type ImportResult = {
  importBatchId: number
  totalRows: number
  duplicateRows: number
  importedTradeCloses?: number
  importedCashTransactions?: number
  importedOrders?: number
  newTrades?: number
}

export class ImportRequestError extends Error {
  readonly status: number
  readonly errorRows: number
  readonly errors: string[]

  constructor(status: number, message: string, errorRows = 0, errors: string[] = []) {
    super(message)
    this.name = 'ImportRequestError'
    this.status = status
    this.errorRows = errorRows
    this.errors = errors
  }
}

const eightcapHeaders = [
  'Ticket', 'Login', 'Type', 'Symbol', 'Volume', 'Swaps', 'Commission',
  'Open Time', 'Open Price', 'Close Time', 'Close Price', 'Profit', 'Currency', 'Comment',
]
const tradingViewHeaders = [
  'Symbol', 'Side', 'Type', 'Qty', 'Filled Qty', 'Limit Price', 'Stop Price',
  'Avg Fill Price', 'Status', 'Update Time', 'Position ID', 'Commission',
  'Closed P&L', 'Net Closed P&L', 'Order ID',
]

export async function detectImportSource(file: File): Promise<ImportSource> {
  const filename = file.name.toLowerCase()
  if (filename.endsWith('.xlsx')) return 'EIGHTCAP'
  if (!filename.endsWith('.csv')) {
    throw new Error('Choose a CSV or XLSX report supported by this importer.')
  }

  const text = (await file.slice(0, 64 * 1024).text()).replace(/^\uFEFF/, '')
  const headerRows = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, 3)
  const matches = (required: string[]) => headerRows.some((line) => {
    const columns = new Set(line.split(',').map((column) => column.trim().replace(/^"|"$/g, '')))
    return required.every((column) => columns.has(column))
  })

  if (matches(eightcapHeaders)) return 'EIGHTCAP'
  if (matches(tradingViewHeaders)) return 'TRADINGVIEW'
  throw new Error('Report type could not be detected from the CSV column headers.')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isImportWarning(value: unknown): value is ImportWarning {
  return isRecord(value) && typeof value.code === 'string' && typeof value.message === 'string'
}

function isImportPreview(value: unknown): value is ImportPreview {
  if (!isRecord(value)) return false
  const requiredNumbers = [
    'tradingAccountId', 'totalRows', 'duplicateRows', 'uniqueRows',
    'nonTradeRows', 'cashRows', 'errorRows',
  ]
  if (requiredNumbers.some((key) => !isNonNegativeInteger(value[key]))) return false
  if (typeof value.filename !== 'string'
    || typeof value.fileSha256 !== 'string'
    || !/^[a-f0-9]{64}$/i.test(value.fileSha256)) return false

  const optionalNumbers = [
    'newTrades', 'existingTrades', 'newTradeCloses', 'alreadyImportedTradeCloses',
    'newCashTransactions', 'alreadyImportedCashTransactions', 'newOrders', 'alreadyImportedOrders',
    'possibleManualTradeDuplicates', 'deletedTradeMatches',
  ]
  if (optionalNumbers.some((key) => value[key] !== undefined && !isNonNegativeInteger(value[key]))) {
    return false
  }
  if (value.loginMismatch !== undefined && typeof value.loginMismatch !== 'boolean') return false
  return value.warnings === undefined
    || (Array.isArray(value.warnings) && value.warnings.every(isImportWarning))
}

function isImportFilePreview(value: unknown): value is ImportFilePreview {
  return isRecord(value)
    && typeof value.filename === 'string'
    && typeof value.fileSha256 === 'string'
    && /^[a-f0-9]{64}$/i.test(value.fileSha256)
    && isNonNegativeInteger(value.totalRows)
}

function isMultiFilePreview(value: unknown): value is MultiFilePreview {
  return isRecord(value)
    && Array.isArray(value.files)
    && value.files.every(isImportFilePreview)
    && isImportPreview(value.preview)
}

function isImportResult(value: unknown): value is ImportResult {
  return isRecord(value)
    && isNonNegativeInteger(value.importBatchId)
    && isNonNegativeInteger(value.totalRows)
    && isNonNegativeInteger(value.duplicateRows)
    && ['importedTradeCloses', 'importedCashTransactions', 'importedOrders', 'newTrades']
      .every((key) => value[key] === undefined || isNonNegativeInteger(value[key]))
}

function problemError(status: number, payload: unknown): ImportRequestError {
  const problem = isRecord(payload) ? payload : {}
  const detail = typeof problem.detail === 'string'
    ? problem.detail
    : `Import request failed with status ${status}.`
  const errorRows = isNonNegativeInteger(problem.errorRows) ? problem.errorRows : 0
  const errors = Array.isArray(problem.errors)
    ? problem.errors.filter((error): error is string => typeof error === 'string')
    : []
  return new ImportRequestError(status, detail, errorRows, errors)
}

async function postImport<T>(
  path: string,
  accessToken: string,
  body: FormData,
  validate: (value: unknown) => value is T,
): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  })
  if (!response.ok) {
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      payload = null
    }
    throw problemError(response.status, payload)
  }

  const payload: unknown = await response.json()
  if (!validate(payload)) throw new Error('The import response was invalid.')
  return payload
}

function importPath(accountId: number, source: ImportSource) {
  const format = source === 'EIGHTCAP' ? 'eightcap' : 'tradingview'
  return `/api/v1/trading-accounts/${accountId}/imports/${format}/batch`
}

export function previewImport(
  accountId: number,
  source: ImportSource,
  files: File[],
  accessToken: string,
): Promise<MultiFilePreview> {
  const body = new FormData()
  files.forEach((file) => body.append('files', file))
  return postImport(`${importPath(accountId, source)}/preview`, accessToken, body, isMultiFilePreview)
}

export function confirmImport(
  accountId: number,
  source: ImportSource,
  files: File[],
  filePreviews: ImportFilePreview[],
  accessToken: string,
  acknowledgeLoginMismatch = false,
): Promise<{ files: ImportFilePreview[]; result: ImportResult }> {
  if (files.length !== filePreviews.length) {
    return Promise.reject(new Error('Preview every selected file before importing.'))
  }

  const body = new FormData()
  files.forEach((file) => body.append('files', file))
  filePreviews.forEach((file) => body.append('sha256s', file.fileSha256))
  if (source === 'EIGHTCAP') {
    body.append('acknowledgeLoginMismatch', String(acknowledgeLoginMismatch))
  }

  return postImport(`${importPath(accountId, source)}`, accessToken, body, (value): value is {
    files: ImportFilePreview[]
    result: ImportResult
  } => isRecord(value)
    && Array.isArray(value.files)
    && value.files.every(isImportFilePreview)
    && isImportResult(value.result))
}

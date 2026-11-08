import { afterEach, describe, expect, it, vi } from 'vitest'
import { confirmImport, detectImportSource, ImportRequestError, previewImport } from './imports'

const filePreview = {
  filename: 'october.csv',
  fileSha256: 'a'.repeat(64),
  totalRows: 10,
}

const preview = {
  tradingAccountId: 12,
  filename: '1-files.csv',
  fileSha256: 'b'.repeat(64),
  totalRows: 10,
  duplicateRows: 2,
  uniqueRows: 8,
  newTrades: 5,
  existingTrades: 1,
  newTradeCloses: 6,
  alreadyImportedTradeCloses: 2,
  nonTradeRows: 0,
  newCashTransactions: 1,
  alreadyImportedCashTransactions: 0,
  loginMismatch: false,
  cashRows: 1,
  errorRows: 0,
  warnings: [{ code: 'HIGH_DUPLICATE_RATE', message: 'Duplicate rows found.' }],
}

describe('import requests', () => {
  afterEach(() => vi.restoreAllMocks())

  it('detects Eightcap and TradingView CSVs from their headers', async () => {
    const eightcap = new File([
      'Trades Report\nTicket,Login,Type,Symbol,Volume,Swaps,Commission,Open Time,Open Price,Close Time,Close Price,Profit,Currency,Comment\n',
    ], 'report.csv')
    const tradingView = new File([
      'Symbol,Side,Type,Qty,Filled Qty,Limit Price,Stop Price,Avg Fill Price,Status,Update Time,Position ID,Commission,Closed P&L,Net Closed P&L,Order ID\n',
    ], 'orders.csv')

    await expect(detectImportSource(eightcap)).resolves.toBe('EIGHTCAP')
    await expect(detectImportSource(tradingView)).resolves.toBe('TRADINGVIEW')
  })

  it('detects Eightcap XLSX files by supported extension', async () => {
    await expect(detectImportSource(new File(['workbook'], 'report.XLSX'))).resolves.toBe('EIGHTCAP')
  })

  it('previews multiple Eightcap files with authenticated multipart upload', async () => {
    const file = new File(['report'], 'october.csv', { type: 'text/csv' })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ files: [filePreview], preview }),
    )

    await expect(previewImport(12, 'EIGHTCAP', [file], 'access-token'))
      .resolves.toEqual({ files: [filePreview], preview })
    const [path, options] = fetchMock.mock.calls[0]
    expect(path).toBe('/api/v1/trading-accounts/12/imports/eightcap/batch/preview')
    expect(options?.headers).toEqual({ Authorization: 'Bearer access-token' })
    expect(options?.credentials).toBe('include')
    expect(options?.body).toBeInstanceOf(FormData)
    expect((options?.body as FormData).getAll('files')).toEqual([file])
  })

  it('confirms with file hashes in order and login mismatch acknowledgment', async () => {
    const first = new File(['first'], 'first.csv', { type: 'text/csv' })
    const second = new File(['second'], 'second.csv', { type: 'text/csv' })
    const imported = {
      files: [filePreview, { ...filePreview, filename: 'second.csv', fileSha256: 'c'.repeat(64) }],
      result: { importBatchId: 31, totalRows: 10, duplicateRows: 0, importedTradeCloses: 4 },
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(imported))

    await expect(confirmImport(
      12,
      'EIGHTCAP',
      [first, second],
      imported.files,
      'access-token',
      true,
    )).resolves.toEqual(imported)
    const formData = fetchMock.mock.calls[0][1]?.body as FormData
    expect(formData.getAll('files')).toEqual([first, second])
    expect(formData.getAll('sha256s')).toEqual(['a'.repeat(64), 'c'.repeat(64)])
    expect(formData.get('acknowledgeLoginMismatch')).toBe('true')
  })

  it('exposes row errors returned by an invalid report preview', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({
      detail: '1 malformed data row(s); no rows were imported.',
      errorRows: 1,
      errors: ['line 3: invalid volume'],
    }, { status: 400 }))

    await expect(previewImport(
      12,
      'TRADINGVIEW',
      [new File(['bad'], 'orders.csv', { type: 'text/csv' })],
      'access-token',
    )).rejects.toMatchObject<Partial<ImportRequestError>>({
      status: 400,
      errorRows: 1,
      errors: ['line 3: invalid volume'],
    })
  })
})

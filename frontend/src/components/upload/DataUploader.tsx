import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Sparkles,
  Table2,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatBytes, formatNumber } from '@/utils/format'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/DataDisplay'
import { useWorkspace } from '@/context/WorkspaceContext'

/* ── CSV helpers ─────────────────────────────────────────────── */

const MAX_BYTES = 25 * 1024 * 1024
const PREVIEW_ROWS = 5

/** Minimal RFC-4180-ish parser — enough for a preview + column detection. */
function parseCsv(text: string, maxRows = PREVIEW_ROWS): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length && rows.length <= maxRows; i += 1) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') inQuotes = true
    else if (char === ',') {
      row.push(field.trim())
      field = ''
    } else if (char === '\n') {
      row.push(field.trim())
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') {
      field += char
    }
  }

  if (field.length || row.length) {
    row.push(field.trim())
    rows.push(row)
  }

  return rows.filter((r) => r.length > 1 || r[0] !== '')
}

const FIELD_ALIASES: Record<string, string[]> = {
  timestamp: ['timestamp', 'time', 'datetime', 'date_time', 'recorded_at', 'ts'],
  actual_kwh: ['actual_kwh', 'actual', 'consumption', 'energy_kwh', 'usage', 'value'],
  expected_kwh: ['expected_kwh', 'expected', 'baseline_kwh', 'baseline'],
  floor: ['floor', 'floor_id', 'level', 'floor_label'],
}

export type CsvColumnKey = keyof typeof FIELD_ALIASES

function detectMapping(header: string[]): Partial<Record<CsvColumnKey, string>> {
  const mapping: Partial<Record<CsvColumnKey, string>> = {}
  const normalized = header.map((h) => h.toLowerCase().replace(/[\s-]+/g, '_'))

  for (const [key, aliases] of Object.entries(FIELD_ALIASES) as [CsvColumnKey, string[]][]) {
    const index = normalized.findIndex((name) => aliases.includes(name))
    if (index >= 0) mapping[key] = header[index]
  }
  return mapping
}

function countLines(text: string): number {
  let count = 0
  for (let i = 0; i < text.length; i += 1) if (text[i] === '\n') count += 1
  return text.length > 0 && !text.endsWith('\n') ? count + 1 : count
}

/* ── Component ───────────────────────────────────────────────── */

export interface DataUploaderProps {
  buildingId: string
  onUpload: (file: File, mapping: Record<string, string>, notes: string) => Promise<void>
  uploading: boolean
  disabled?: boolean
  className?: string
}

/**
 * Meter-data uploader.
 *
 * Parses the CSV in the browser purely to *preview* and pre-map columns; all
 * cleaning, baseline learning and anomaly detection happen server-side and are
 * surfaced by <ProcessingPipeline>.
 */
export function DataUploader({ buildingId, onUpload, uploading, disabled, className }: DataUploaderProps) {
  const { pushNotification } = useWorkspace()
  const inputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string[][]>([])
  const [header, setHeader] = useState<string[]>([])
  const [rowCount, setRowCount] = useState(0)
  const [mapping, setMapping] = useState<Partial<Record<CsvColumnKey, string>>>({})
  const [notes, setNotes] = useState('')
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [readError, setReadError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setFile(null)
    setPreview([])
    setHeader([])
    setRowCount(0)
    setMapping({})
    setNotes('')
    setError(null)
    setReadError(null)
  }, [])

  const acceptFile = useCallback(async (candidate: File | null) => {
    setError(null)
    setReadError(null)
    if (!candidate) return

    if (!/\.(csv|txt)$/i.test(candidate.name)) {
      setError('Only .csv files are accepted.')
      return
    }
    if (candidate.size > MAX_BYTES) {
      setError(`File is ${formatBytes(candidate.size)}. The limit is ${formatBytes(MAX_BYTES)}.`)
      return
    }
    if (candidate.size === 0) {
      setError('That file is empty.')
      return
    }

    try {
      const text = await candidate.text()
      const rows = parseCsv(text)
      const [first, ...rest] = rows

      if (!first || rest.length === 0) {
        setError('The file has a header but no data rows.')
        return
      }

      setFile(candidate)
      setHeader(first)
      setPreview(rest.slice(0, PREVIEW_ROWS))
      setRowCount(Math.max(0, countLines(text) - 1))
      setMapping(detectMapping(first))
    } catch {
      setReadError('The file could not be read. Check the encoding and try again.')
    }
  }, [])

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setDragging(false)
      void acceptFile(event.dataTransfer.files?.[0] ?? null)
    },
    [acceptFile],
  )

  const missingTimestamp = file !== null && !mapping.timestamp
  const canSubmit = file !== null && !uploading && !missingTimestamp && !readError

  const submit = useCallback(async () => {
    if (!file || !canSubmit) return
    try {
      await onUpload(file, mapping as Record<string, string>, notes)
      pushNotification({
        kind: 'system',
        title: 'File uploaded',
        body: `${file.name} is queued for cleaning, baseline learning and anomaly detection.`,
        severity: 'info',
      })
    } catch (uploadError) {
      // Surfaced through the notification centre; the page also renders the
      // message inline, so there is nothing left to rethrow.
      pushNotification({
        kind: 'system',
        title: 'Upload failed',
        body: uploadError instanceof Error ? uploadError.message : 'The ingestion service rejected the file.',
        severity: 'high',
      })
    }
  }, [file, canSubmit, onUpload, mapping, notes, pushNotification])

  const setMappingValue = useCallback((key: CsvColumnKey, value: string) => {
    setMapping((prev) => {
      if (!value) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: value }
    })
  }, [])

  const mappingRows = useMemo(
    () =>
      (Object.keys(FIELD_ALIASES) as CsvColumnKey[]).map((key) => ({
        key,
        label: key === 'actual_kwh' ? 'Actual energy' : key === 'expected_kwh' ? 'Expected energy' : key === 'timestamp' ? 'Timestamp' : 'Floor (optional)',
        value: mapping[key] ?? '',
        required: key !== 'floor',
      })),
    [mapping],
  )

  return (
    <div className={cn('space-y-4', className)}>
      {/* ── Dropzone ───────────────────────────────────────── */}
      {!file ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          aria-label="Upload meter data CSV"
          className={cn(
            'group relative cursor-pointer overflow-hidden rounded-2xl border border-dashed px-6 py-12 text-center transition duration-300',
            dragging
              ? 'border-flux-400/60 bg-flux-500/[0.07]'
              : 'border-white/15 bg-white/[0.02] hover:border-flux-400/45 hover:bg-white/[0.035]',
            disabled && 'pointer-events-none opacity-50',
          )}
        >
          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-flux-500/20 blur-3xl transition-opacity duration-500',
              dragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-60',
            )}
          />

          <span className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-flux-400/25 bg-flux-500/10 text-flux-300 transition-transform duration-300 group-hover:scale-105">
            {dragging ? <FileUp size={22} /> : <UploadCloud size={22} />}
          </span>

          <p className="relative mt-5 text-sm font-semibold text-ink-50">
            {dragging ? 'Release to load your file' : 'Drop your meter data CSV here'}
          </p>
          <p className="relative mt-1.5 text-xs text-ink-400">
            or <span className="text-flux-300 underline underline-offset-2">browse files</span>
          </p>
          <p className="relative mt-4 text-2xs text-ink-500">
            CSV · up to {formatBytes(MAX_BYTES)} · columns detected automatically
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            onChange={(event) => {
              void acceptFile(event.target.files?.[0] ?? null)
              event.target.value = ''
            }}
          />
        </div>
      ) : (
        /* ── Selected file ────────────────────────────────── */
        <div className="glass p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-watt-400/25 bg-watt-400/10 text-watt-300">
                <FileSpreadsheet size={19} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-50">{file.name}</p>
                <p className="tnum mt-0.5 text-2xs text-ink-400">
                  {formatBytes(file.size)} · {formatNumber(rowCount)} data rows
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge tone="watt" icon={<CheckCircle2 size={11} />}>
                Ready
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                disabled={uploading}
                iconLeft={<Trash2 size={13} />}
                aria-label="Remove selected file"
              >
                Remove
              </Button>
            </div>
          </div>

          {/* Column mapping */}
          <div className="divider my-4" />

          <div className="flex items-center gap-2">
            <Table2 size={13} className="text-ink-500" />
            <h4 className="text-xs font-semibold text-ink-100">Column mapping</h4>
            {missingTimestamp ? (
              <Badge tone="alert">Timestamp column required</Badge>
            ) : (
              <Badge tone="watt">Detected automatically</Badge>
            )}
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {mappingRows.map((row) => (
              <div
                key={row.key}
                className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
              >
                <label htmlFor={`map-${row.key}`} className="w-32 shrink-0 text-2xs text-ink-400">
                  {row.label}
                  {row.required ? <span className="ml-1 text-alert-400">*</span> : null}
                </label>
                <div className="relative min-w-0 flex-1">
                  <select
                    id={`map-${row.key}`}
                    value={row.value}
                    onChange={(event) => setMappingValue(row.key, event.target.value)}
                    className="w-full appearance-none truncate rounded-lg border border-white/10 bg-base-900/80 py-1.5 pl-2.5 pr-7 text-2xs text-ink-100 outline-none transition focus:border-flux-400/60"
                  >
                    <option value="">— not mapped —</option>
                    {header.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                  <ArrowRight
                    size={11}
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rotate-90 text-ink-600"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.06]">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-white/[0.03]">
                  {header.map((column) => (
                    <th
                      key={column}
                      className="max-w-[9rem] truncate px-3 py-2 text-2xs font-semibold uppercase tracking-[0.1em] text-ink-500"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-white/[0.05]">
                    {header.map((_, cellIndex) => (
                      <td
                        key={cellIndex}
                        className="tnum max-w-[9rem] truncate px-3 py-1.5 text-2xs text-ink-300"
                      >
                        {row[cellIndex] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-2xs text-ink-500">
            Showing {preview.length} of {formatNumber(rowCount)} rows. Rows are validated and cleaned
            server-side before the baseline is refitted.
          </p>

          {/* Notes */}
          <div className="mt-4">
            <label htmlFor="upload-notes" className="label-muted">
              Notes for the facility team <span className="text-ink-600">(optional)</span>
            </label>
            <textarea
              id="upload-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="e.g. Meter was offline 12–13 Mar; readings were backfilled by the BMS team."
              className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-ink-100 placeholder:text-ink-600 outline-none transition focus:border-flux-400/60"
            />
          </div>

          {/* Submit */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-2xs text-ink-500">
              Uploading will refit the baseline for{' '}
              <span className="text-ink-300">{buildingId}</span>.
            </p>
            <Button
              variant="primary"
              onClick={() => void submit()}
              disabled={!canSubmit}
              loading={uploading}
              iconLeft={uploading ? undefined : <Sparkles size={14} />}
            >
              {uploading ? 'Uploading…' : 'Upload & process'}
            </Button>
          </div>
        </div>
      )}

      {/* ── Errors ──────────────────────────────────────────── */}
      {error || readError ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-crit-500/25 bg-crit-500/[0.07] px-4 py-3">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-crit-400" />
          <p className="text-xs text-crit-200">{error ?? readError}</p>
        </div>
      ) : null}

      {missingTimestamp ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-alert-500/25 bg-alert-500/[0.07] px-4 py-3">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-alert-400" />
          <p className="text-xs text-alert-200">
            Map a timestamp column before uploading — the pipeline needs ordered readings to learn a
            baseline.
          </p>
        </div>
      ) : null}

      {uploading ? (
        <div className="glass px-4 py-3">
          <div className="mb-2 flex items-center gap-2 text-2xs text-ink-400">
            <Loader2 size={12} className="animate-spin text-flux-300" />
            Streaming file to the ingestion service…
          </div>
          <ProgressBar value={undefined} tone="flux" />
        </div>
      ) : null}
    </div>
  )
}
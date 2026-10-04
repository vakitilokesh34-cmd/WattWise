import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileUp, Info, Sparkles, Table2 } from 'lucide-react'
import type { UploadJob } from '@/types'
import { formatBytes, formatNumber } from '@/utils/format'
import { useMutation, useQuery } from '@/hooks/useQuery'
import { useWorkspace } from '@/context/WorkspaceContext'
import { wattwiseApi } from '@/services/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { DataUploader } from '@/components/upload/DataUploader'
import { ProcessingPipeline } from '@/components/upload/ProcessingPipeline'

/**
 * DATA UPLOAD
 *
 * CSV → POST /api/energy/upload → job polling. All cleaning, baseline learning,
 * anomaly detection and costing happen server-side; this page only submits and
 * reflects the reported stage states.
 */
export default function UploadPage() {
  const navigate = useNavigate()
  const { activeBuilding, activeBuildingId, latestJob, setLatestJob, refreshSignal } = useWorkspace()

  const upload = useMutation((file: File, mapping: Record<string, string>, notes: string) =>
    wattwiseApi.uploadEnergy(file, {
      buildingId: activeBuildingId,
      columnMapping: mapping,
      notes,
    }),
  )

  const jobId = latestJob?.jobId ?? null
  const settled =
    latestJob?.state === 'complete' || latestJob?.state === 'failed' ? true : false

  const job = useQuery<UploadJob>(
    jobId ? `uploadJob:${jobId}` : null,
    () => wattwiseApi.getUploadJob(jobId as string),
    // Poll while the pipeline is still moving.
    { refetchIntervalMs: settled ? 0 : 2000 },
  )

  const currentJob = job.data ?? latestJob
  const refreshedRef = useRef(false)

  // Reflect the polled job into the shell, then revalidate the data views once.
  useEffect(() => {
    if (!job.data || !latestJob) return
    if (job.data.state === latestJob.state && job.data.progress === latestJob.progress) return
    setLatestJob(job.data)
    if (job.data.state === 'complete' && !refreshedRef.current) {
      refreshedRef.current = true
      refreshSignal()
    }
    if (job.data.state !== 'complete') refreshedRef.current = false
  }, [job.data, latestJob, setLatestJob, refreshSignal])

  const handleUpload = useCallback(
    async (file: File, mapping: Record<string, string>, notes: string) => {
      const created = await upload.mutate(file, mapping, notes)
      if (!created) {
        // `mutate` already recorded the ApiError; the message is rendered
        // inline below the uploader and mirrored as a notification.
        throw new Error('The upload could not be started. Check the file and try again.')
      }
      setLatestJob(created)
      refreshedRef.current = false
    },
    [upload, setLatestJob],
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Upload meter data"
        subtitle="Add historical readings for the selected building. The pipeline refits the baseline and re-runs detection."
        icon={<FileUp size={19} />}
        meta={
          <>
            <span className="text-2xs text-ink-500">
              Target building: {activeBuilding?.name ?? 'none selected'}
            </span>
          </>
        }
        actions={
          currentJob?.state === 'complete' ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/anomalies')}
              iconRight={<Sparkles size={13} />}
            >
              Review anomalies
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <DataUploader
            buildingId={activeBuildingId}
            onUpload={handleUpload}
            uploading={upload.isPending}
            disabled={!activeBuildingId}
          />

          {upload.error ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-crit-500/25 bg-crit-500/[0.07] px-4 py-3">
              <Info size={14} className="mt-0.5 shrink-0 text-crit-400" />
              <p className="text-xs text-crit-300">{upload.error.message}</p>
            </div>
          ) : null}

          {!activeBuildingId ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-alert-500/25 bg-alert-500/[0.07] px-4 py-3">
              <Info size={14} className="mt-0.5 shrink-0 text-alert-400" />
              <p className="text-xs text-alert-300">Select a building before uploading data.</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <ProcessingPipeline job={currentJob} />

          <Card>
            <CardHeader
              title="Expected columns"
              subtitle="Detected automatically, remappable before upload"
              icon={<Table2 size={15} />}
            />
            <ul className="mt-4 space-y-2 text-2xs leading-relaxed text-ink-400">
              <li>
                <span className="text-ink-100">timestamp</span> — ISO-8601 or{' '}
                <span className="text-ink-200">YYYY-MM-DD HH:MM</span>. Required.
              </li>
              <li>
                <span className="text-ink-100">actual_kwh</span> — metered consumption per interval.
                Required.
              </li>
              <li>
                <span className="text-ink-100">expected_kwh</span> — optional; omit it and the model
                learns the baseline itself.
              </li>
              <li>
                <span className="text-ink-100">floor</span> — optional; used to localise anomalies to a
                floor in the 3D view.
              </li>
            </ul>
            <div className="divider my-4" />
            <p className="text-2xs text-ink-500">
              CSV only · up to 25 MB · the browser previews the first rows, then the file is streamed
              to <span className="text-ink-300">POST /api/energy/upload</span> as multipart form data.
            </p>
            <p className="tnum mt-2 text-2xs text-ink-600">
              {currentJob
                ? `Job ${currentJob.jobId} · ${formatNumber(currentJob.rowsAccepted)} rows accepted · ${formatNumber(currentJob.rowsRejected)} rejected`
                : 'No upload in this session yet.'}
            </p>
            {currentJob?.message ? (
              <p className="mt-2 text-2xs text-ink-400">{currentJob.message}</p>
            ) : null}
            {currentJob?.error ? (
              <p className="mt-2 text-2xs text-crit-300">{currentJob.error}</p>
            ) : null}
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="What happens after upload" icon={<Info size={15} />} />
        <ol className="mt-4 grid gap-3 text-2xs leading-relaxed text-ink-400 sm:grid-cols-2 lg:grid-cols-3">
          <li>1. Rows are validated, deduplicated and gaps imputed server-side.</li>
          <li>2. The seasonal baseline is refitted on the cleaned series.</li>
          <li>3. Residuals are scored; breaches become anomalies with a confidence score.</li>
          <li>4. Excess energy is costed with the building tariff — estimates only.</li>
          <li>5. Dashboard, trends and investigation views are refreshed.</li>
          <li>6. Rejected rows are reported back with the ingestion log.</li>
        </ol>
        <p className="tnum mt-4 text-2xs text-ink-600">
          {formatBytes(25 * 1024 * 1024)} maximum per file.
        </p>
      </Card>
    </div>
  )
}
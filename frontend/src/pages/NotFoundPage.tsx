import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Compass, LayoutDashboard, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useWorkspace } from '@/context/WorkspaceContext'

/** 404 — rendered inside the app shell so navigation stays available. */
export default function NotFoundPage() {
  const navigate = useNavigate()
  const { activeBuilding } = useWorkspace()

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-lg text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-flux-300">
          <SearchX size={22} />
        </span>

        <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink-50">Page not found</h1>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-ink-400">
          That route does not exist. If you followed a link from a notification, the anomaly may have
          been removed by an administrator.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button variant="primary" onClick={() => navigate('/dashboard')} iconLeft={<LayoutDashboard size={13} />}>
            Go to dashboard
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)} iconLeft={<ArrowLeft size={13} />}>
            Go back
          </Button>
        </div>

        <p className="mt-6 inline-flex items-center gap-1.5 text-2xs text-ink-500">
          <Compass size={11} />
          {activeBuilding ? `${activeBuilding.name} · ` : ''}available routes: dashboard, anomalies,
          trends, cost-impact, investigations, upload, settings
        </p>
      </Card>
    </div>
  )
}
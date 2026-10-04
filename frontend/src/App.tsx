import { lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { useWorkspace } from '@/context/WorkspaceContext'

/**
 * Route-level code splitting: the 3D dashboard scene (three.js + R3F) is only
 * fetched when the user actually opens /dashboard.
 */
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const AnomaliesPage = lazy(() => import('@/pages/AnomaliesPage'))
const TrendsPage = lazy(() => import('@/pages/TrendsPage'))
const CostImpactPage = lazy(() => import('@/pages/CostImpactPage'))
const InvestigationsPage = lazy(() => import('@/pages/InvestigationsPage'))
const ReportsPage = lazy(() => import('@/pages/ReportsPage'))
const UploadPage = lazy(() => import('@/pages/UploadPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

export default function App() {
  const { activeBuilding } = useWorkspace()

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="overview" element={<Navigate to="/dashboard" replace />} />
          <Route path="anomalies" element={<AnomaliesPage />} />
          <Route path="trends" element={<TrendsPage />} />
          <Route path="energy-analytics" element={<Navigate to="/trends" replace />} />
          <Route path="cost-impact" element={<CostImpactPage />} />
          <Route path="investigations" element={<InvestigationsPage />} />
          <Route path="investigations/:anomalyId" element={<InvestigationsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>

      {/* Rendered once, outside the outlet, purely as a courtesy for a11y. */}
      <span className="sr-only" aria-live="polite">
        {activeBuilding ? `${activeBuilding.name} selected` : ''}
      </span>
    </>
  )
}
# WattWise — Frontend

Smart energy **anomaly detection** dashboard: a dark, enterprise-grade React UI with an
interactive 3D smart-building visualisation, actual-vs-expected energy charts, cost impact
estimates and an investigation centre for reviewing flagged deviations.

This repository contains the **frontend only**. Detection, baseline learning, cost modelling
and meter ingestion all happen in the WattWise backend. The UI renders what the API reports —
it never invents anomalies, causes or savings.

---

## Highlights

| Area | Detail |
| --- | --- |
| Dashboard | Live KPIs, 3D building, floor states, actual-vs-expected chart, latest anomalies |
| Anomaly explorer | Debounced search, severity/status multi-select, score threshold, CSV export |
| Trends | Window totals, excess-per-interval bars, hourly load profile, interval detail |
| Cost impact | Daily / weekly / projected estimates, costliest periods, mandatory disclaimer |
| Investigation centre | Evidence, unverified factors, recommended checks, timeline, printable brief |
| Data upload | Drag-and-drop CSV, client-side validation and pre-mapping, live pipeline stages |
| Realtime | SSE with polling fallback; new anomalies appear without a refresh |
| Mock mode | Deterministic, isolated synthetic data so the UI runs with no backend |
| 3D | React Three Fiber scene with adaptive quality — no external HDR or postprocessing |

---

## Tech stack

- **React 18** + **TypeScript 5** (strict, `noUnusedLocals`, `noUnusedParameters`)
- **Vite 5** build tooling, route-level code splitting, vendor chunking
- **Tailwind CSS 3.4** design system (dark glassmorphism, custom palette + keyframes)
- **Three.js / React Three Fiber / Drei** for the 3D building
- **Recharts** for charts, **Framer Motion** for transitions, **Lucide React** for icons
- **Axios** for the live HTTP transport

---

## Getting started

### Prerequisites

- Node.js **>= 18.18**
- npm 9+

### Install

```bash
npm install
```

### Configure

```bash
cp .env.example .env        # Windows: copy .env.example .env
```

Edit `.env` if the backend is not reachable through the Vite dev proxy at
`http://localhost:8000`.

### Run

```bash
npm run dev        # dev server on http://localhost:5173
```

### Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server with HMR and the `/api` proxy |
| `npm run build` | Typecheck (`tsc --noEmit`) then produce `dist/` |
| `npm run preview` | Serve the production build on port 4173 |
| `npm run typecheck` | TypeScript only — no emit |
| `npm run clean` | Remove `dist/` and the Vite cache |

---

## Environment variables

Every variable is optional; the defaults in `src/services/config.ts` keep the app usable
out of the box. Only `VITE_*` variables reach the browser bundle — never put secrets here.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api` | Base URL prefixed to every request |
| `VITE_PROXY_TARGET` | `http://localhost:8000` | Dev-server proxy target for `/api` |
| `VITE_API_TIMEOUT` | `20000` | Request timeout in ms |
| `VITE_API_MODE` | `auto` | `live` \| `mock` \| `auto` |
| `VITE_ENABLE_MOCK_FALLBACK` | `true` | Allow `auto` to fall back on connectivity failures |
| `VITE_ENABLE_REALTIME` | `true` | Master realtime switch |
| `VITE_REALTIME_TRANSPORT` | `sse` | `sse` \| `polling` \| `off` |
| `VITE_REALTIME_SSE_PATH` | `/api/realtime/stream` | SSE endpoint |
| `VITE_REALTIME_POLL_MS` | `30000` | Polling fallback interval |
| `VITE_UPLOAD_MAX_MB` | `25` | Client-side CSV size limit |
| `VITE_UPLOAD_ACCEPT` | `.csv,text/csv` | Accepted upload types |
| `VITE_SCENE_QUALITY` | `auto` | `auto` \| `high` \| `medium` \| `low` |
| `VITE_MAX_PARTICLES` | `260` | Hard particle ceiling |
| `VITE_ENABLE_3D` | `true` | Render the 3D canvas at all |
| `VITE_ENABLE_ANIMATIONS` | `true` | Allow decorative animation |

---

## Data sources: live vs mock

Transport selection lives entirely in `src/services/api.ts`. **UI components never import a
transport** — they call `wattwiseApi`.

- `VITE_API_MODE=live` — always call the backend; failures surface as an error state.
- `VITE_API_MODE=mock` — always use `src/services/mock/`, which generates deterministic
  synthetic data (stable for a given building + window, so screenshots and tests are stable).
- `VITE_API_MODE=auto` (default) — probe `/api/health` once at start-up. If the backend is
  unreachable (connection refused, DNS failure, timeout) the app switches to the mock layer and
  the header badge shows **mock / degraded**. Auth, permission and validation errors are *never*
  swallowed by the fallback.

Switching transport mid-session is broadcast through `onModeChange`, so the top bar updates
immediately.

### Endpoint contract

| Method | Path | Used by |
| --- | --- | --- |
| `GET` | `/api/buildings` | Building selector |
| `GET` | `/api/dashboard/summary` | KPI band, service status, polling fallback |
| `GET` | `/api/energy` | Charts, trends, 3D floor loads |
| `GET` | `/api/anomalies` | Explorer, dashboard list, investigations |
| `GET` | `/api/anomalies/{id}` | Anomaly detail |
| `GET` | `/api/anomalies/{id}/investigation` | Investigation centre |
| `GET` | `/api/cost-impact` | Cost impact page |
| `POST` | `/api/energy/upload` | CSV upload (multipart) |
| `GET` | `/api/energy/upload/{jobId}` | Pipeline polling |
| `GET` | `/api/health` (falls back to `/healthz`, `/status`, `/dashboard/summary`) | Connectivity probe |
| `GET` | `/api/realtime/stream` | SSE channel |

Responses pass through tolerant mappers (`src/services/mappers.ts`) so harmless backend
variations — missing optional fields, snake_case aliases, string numerics — do not break the UI.

---

## Realtime behaviour

`WorkspaceProvider` subscribes once per session and normalises events into the `RealtimeEvent`
union:

`hello` · `anomaly.detected` · `reading.updated` · `model.status` · `data.status` ·
`job.progress` · `summary.snapshot` · `ping`

- `anomaly.detected` → pushes a notification, merges the anomaly into open lists, and invalidates
  the affected cache scopes.
- `reading.updated` / `summary.snapshot` → invalidate and re-render.
- If SSE is unavailable the transport degrades to polling; the top bar shows the live status.

---

## Project structure

```
src/
├── components/
│   ├── anomaly/        AnomalyCard, AnomalyFilters, AnomalyTimeline
│   ├── charts/         EnergyChart, SecondaryCharts, chartTheme
│   ├── cost/           CostCard
│   ├── dashboard/      BuildingSelector, DateRangeSelector, DataStatus, ModelStatus
│   ├── investigation/  InvestigationPanel, InvestigationBrief
│   ├── kpi/            EnergyKpiCard
│   ├── layout/         AppShell, Sidebar, Topbar, PageHeader, RouteErrorBoundary
│   ├── realtime/       NotificationCenter
│   ├── three/          Building3D, BuildingScene, BuildingMesh, FloorNode,
│   │                   EnergyMeter, EnergyFlow, EnergyParticles, FloorLegend, CameraRig
│   ├── ui/             Button, Card, Badge, Form, Modal, Tooltip, Skeleton, States, …
│   └── upload/         DataUploader, ProcessingPipeline
├── context/            WorkspaceContext (buildings, range, realtime, notifications)
├── hooks/              useQuery/useMutation, useDeviceProfile, useDebouncedValue, …
├── pages/              Route components (lazy-loaded)
├── services/           api.ts facade, config, http, liveTransport, mappers, mock/
├── types/              Domain types mirroring the backend contract
└── utils/              format, date, download, cn, floorState
```

### Routes

| Path | Page |
| --- | --- |
| `/dashboard` | KPI band, 3D building, chart, latest anomalies |
| `/anomalies` | Filterable anomaly explorer |
| `/trends` | Actual vs expected over time, load profile |
| `/cost-impact` | Estimated excess cost, costliest periods |
| `/investigations` | Investigation queue |
| `/investigations/:anomalyId` | Full investigation brief |
| `/upload` | CSV upload and processing pipeline |
| `/settings` | Configuration, diagnostics, service status |

---

## Performance notes

- Route-level `lazy()` splitting keeps three.js out of the initial bundle; it loads with
  `/dashboard`.
- Manual vendor chunks split `three`, `recharts` and `framer-motion`.
- API responses are cached in memory with per-endpoint TTLs plus in-flight de-duplication, so
  several panels on one screen cost a single request.
- The 3D budget derives from `useDeviceProfile()`: DPR, shadows, window detail and particle
  count scale with the breakpoint and `prefers-reduced-motion`.
- No external HDR environment, no postprocessing passes — lighting is procedural and cheap.
- Animations are transform/opacity-only and disabled under reduced motion.

---

## Data honesty rules

These are enforced throughout the UI, not just in the copy:

1. **No invented detections.** Anomaly counts, scores, severities and baselines come from the API.
2. **No asserted root causes.** Factors are always labelled *unverified*, *corroborated* or
   *ruled out*, exactly as the backend reports them.
3. **Costs are estimates.** Every figure is prefixed “estimated”, derived from the reported
   tariff, and accompanied by the backend disclaimer. Nothing claims guaranteed savings.
4. **Zero is not always good news.** A window with no anomalies reports zero estimated cost, not
   zero waste.
5. **Currency comes from the API** — nothing is hard-coded to a single currency.

---

## Accessibility

- Semantic landmarks, skip-to-content link, labelled controls and visible focus rings.
- Charts pair every visual with a text/number readout.
- `aria-live` regions announce building and upload state changes.
- Severity is never encoded by colour alone — labels and icons accompany every tone.
- Full keyboard support, including floor selection fallbacks for the 3D scene.

---

## Deployment

```bash
npm run build      # emits dist/
```

`dist/` is a static bundle. Serve it from any static host or CDN and configure your reverse
proxy so that `/api/*` (and the SSE route) reach the backend.

Notes for production:

- SPA fallback: rewrite unknown paths to `/index.html` so deep links such as
  `/investigations/an_024` work on refresh.
- SSE requires buffering disabled on the proxy and a longer read timeout.
- Set `VITE_API_BASE_URL` to the absolute API origin if the API is not same-origin.
- For high-traffic deployments, point `VITE_ENABLE_MOCK_FALLBACK=false` and `VITE_API_MODE=live`
  so a backend outage is visible instead of silently showing synthetic data.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Header shows “mock / degraded” | Backend unreachable in `auto` mode. Check `VITE_PROXY_TARGET`, or set `VITE_API_MODE=live` to surface the real error. |
| Empty panels with no error | No readings in the selected window — widen the range or upload a CSV. |
| 3D scene replaced by a notice | `VITE_ENABLE_3D=false`, or the device profile reports low capability. All figures remain in the charts. |
| Realtime stuck “connecting” | `VITE_REALTIME_TRANSPORT=sse` requires the backend SSE route; switch to `polling`. |
| Build fails on types | Run `npm run typecheck`; the build script already runs it first. |

---

## Licence

Provided as-is for the WattWise project. Backend services, detection models and tariff data are
owned by their respective providers.
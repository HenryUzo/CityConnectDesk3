# Requests Page + Backend Contract Notes

- New Prisma-backed endpoints now exist for the resident view:
  * `GET /api/my-estates` → returns estates the current user belongs to.
  * `GET /api/estates/:estateId/requests` → loads service requests for that estate.
  * `POST /api/estates/:estateId/requests` → creates a resident request scoped to an estate.
  * `PATCH /api/requests/:id/status` → updates request lifecycle states (supports `UNDER_REVIEW` and friends).
- `/requests` is the canonical resident view and must derive the estate ID from `/api/my-estates` before fetching `/api/estates/:estateId/requests` (no hard-coded IDs).
- Status lifecycle expected by tests: `PENDING → UNDER_REVIEW → IN_PROGRESS → COMPLETED`, with buttons that hit `PATCH /api/requests/:id/status` and persist across reloads.
- Completed rows should render without action buttons (table shows “Done” only).
- Legacy flows still exist that use the old `/api/service-requests` endpoint (e.g., `client/src/components/resident/MyRequestsList.tsx`, admin/provider dashboards). They are not estate-aware and may diverge from the new contract.
- Any mock or legacy data paths should be migrated to the new estate-aware API when those UIs are refreshed; the new tests focus solely on `/requests`.

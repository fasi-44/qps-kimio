# Committee Management Module — Implementation Plan

> Status: **Approved (core-lifecycle-first)** · Date: 2026-06-17
> Source FRS: Committee Management Module — Functional Requirements Specification v1.0
> Target codebase: `qps-kmio` (NQAS Accreditation Platform — Kidwai Memorial Institute of Oncology)

---

## 1. Key findings from the codebase

- **Stack**: pnpm monorepo — `@nabh/api` (NestJS), `@nabh/web` (Next.js App Router), `@nabh/database` (Prisma 7 / PostgreSQL 16), `@nabh/shared` (enums/types/schemas).
- **The committee folders are empty scaffolding.** Both `apps/api/src/modules/committees/` and the web routes under `apps/web/src/app/(dashboard)/committees/` (including `new`, `[id]`, `[id]/edit`, `[id]/meetings/...`) exist as **empty directories**. The Prisma schema has **zero** committee models. This is net-new work.
- **Enums are mirrored in two places** — every enum lives in both `packages/database/prisma/schema.prisma` *and* `packages/shared/src/enums.ts`. Both must be kept in sync.
- **Only 3 system roles exist**: `ADMIN`, `HOD`, `ASSESSOR`. The FRS lists 8 committee roles (Chairperson, Member Secretary, etc.) — these are **not** auth roles (see §2.1).
- **Reusable infrastructure already exists**: `AuditService.log()` writes to an immutable `AuditLog`; `NotificationsService.create()` + WebSocket gateway + `mail.service`; global `JwtAuthGuard`/`RolesGuard`; `@CurrentUser()`/`@Roles()`/`@Public()` decorators; React Query + `api` client + Zustand `auth.store` with a global `selectedModule`.
- **Nav** is a static `NAV_ITEMS` array in `apps/web/src/app/(dashboard)/layout.tsx`, filtered by role + `pageAccess`. It is **not** currently filtered by module.

---

## 2. Architectural decisions

### 2.1 Committee positions ≠ system roles  ⭐ most important
The FRS "roles" (Chairperson, Member Secretary, Member…) are **per-committee membership data**, not the platform's auth roles. Authorization is two-layered:
- **Coarse (guard):** `@Roles(ADMIN, HOD, ASSESSOR)` on endpoints as today.
- **Fine (service layer):** "Only the Chairperson can approve minutes" is enforced by checking the current user's **CommitteeMember position** for that committee — not their global role.

Mapping: System Admin/Quality Executive → `ADMIN`; Member Secretary/Chairperson approvals gated by committee position; Committee Member → any user who is an active member of that committee.

### 2.2 "Under NQAS in the left menu"
Committee is an NQAS-scoped feature. Implementation:
- Add an optional `modules?: AppModule[]` field to the `NavItem` interface in `layout.tsx`.
- Add a **Committees** entry (icon `Landmark` or `Gavel` from lucide) gated to `modules: ['NQAS']`, visible to all three roles.
- Filter `NAV_ITEMS` by the active `selectedModule` so it only appears under NQAS.
- Register `module: AppModule @default(NQAS)` on the `Committee` model (matching the `Assessment`/`Notification` pattern).
- Add page titles + notification deep-link routing for committee routes.

### 2.3 Audit trail
Reuse the existing immutable `AuditLog` via `AuditService.log({ action, resource, resourceId, oldValue, newValue, userId })`. No new audit model. The FRS membership-history requirement (§3.4) additionally gets a **dedicated** `CommitteeMembershipHistory` table (it is a first-class feature, not just an audit line).

### 2.4 File uploads
Supporting docs / evidence follow the existing `evidenceUrls String[]` convention used by `AssessmentResponse`, reusing the platform's existing upload mechanism (client-docs).

---

## 3. Locked decisions (the three open questions)

1. **Approval authority** — **Position-gated, with ADMIN override.** Minutes approval and action closure require the user to hold the relevant committee position (Chairperson / Member Secretary, via `CommitteePositionType.canApprove`); a system `ADMIN` may always override.
2. **Designation-based membership** — **Add a proper `Designation` lookup table.** Designation-based membership references a stable `Designation` record (not the free-text `User.designation`). The "current incumbent" resolves from the user(s) currently mapped to that designation, so committee membership auto-reflects the latest holder (FRS §3.3A).
3. **Recurring meetings** — **Generate a bounded horizon (next 12 occurrences).** Recurring meetings roll forward by generating up to 12 future occurrences at a time, replenished as meetings are conducted, rather than one-at-a-time or unbounded.

---

## 4. Data model — Prisma (core lifecycle)

**New enums** (in both `schema.prisma` and `shared/enums.ts`):

| Enum | Values |
|---|---|
| `CommitteeStatus` | ACTIVE, INACTIVE, ARCHIVED |
| `MeetingFrequency` | MONTHLY, QUARTERLY, HALF_YEARLY, YEARLY, CUSTOM |
| `MeetingMode` | PHYSICAL, ONLINE, HYBRID |
| `MeetingStatus` | SCHEDULED, RESCHEDULED, CANCELLED, COMPLETED |
| `MembershipType` | DESIGNATION, NOMINATION |
| `MembershipChangeType` | ADDED, REMOVED, REPLACED, ROLE_CHANGED |
| `AttendanceStatus` | PRESENT, ABSENT, LEAVE_OF_ABSENCE, INVITED_GUEST |
| `AgendaStatus` | SUBMITTED, ACCEPTED, REJECTED, CLARIFICATION_REQUESTED, PUBLISHED |
| `MinutesMethod` | DIRECT, UPLOAD |
| `MinutesStatus` | DRAFT, UNDER_REVIEW, APPROVED, PUBLISHED |
| `ActionStatus` | OPEN, IN_PROGRESS, PARTIALLY_COMPLETED, COMPLETED, CLOSED, OVERDUE |
| `ActionPriority` | LOW, MEDIUM, HIGH, CRITICAL |
| `ActionSource` | AGENDA, AUDIT_FINDING, INCIDENT, ASSESSMENT, COMMITTEE_DECISION |
| extend `NotificationType` | + COMMITTEE_MEETING_SCHEDULED, AGENDA_DEADLINE, MINUTES_PENDING_APPROVAL, ACTION_OVERDUE, COMMITTEE_TENURE_EXPIRY |

**New models** (cuid IDs, `@@map` snake_case, `createdAt/updatedAt`, indexes — matching existing style):

1. **`Committee`** — name, category, type, purpose, frequency, effectiveDate, expiryDate, status, `module @default(NQAS)`, createdById → relations: positions, members, meetings, actions, history.
2. **`CommitteePositionType`** — global, admin-configurable catalog (seeded: Chairperson, Vice Chairperson, Member Secretary, Co-ordinator, Executive Secretary, Member, Invited Member); flags `isLeadership`, `canApprove`. Satisfies FRS §3.2 "configurable." `canApprove` drives the position-gated approval rule (§3.1).
3. **`Designation`** — admin-managed lookup (name, code, isActive). Backs designation-based membership; resolves current incumbent(s). (Decision §3.2)
4. **`CommitteeMember`** — committeeId, positionTypeId, `membershipType`, `userId?` (resolved incumbent), `designationId?` (for designation-based), `departmentId?`, `nomineeName?`, startDate, endDate, isActive.
5. **`CommitteeMembershipHistory`** — committeeId, memberId?, `changeType`, previousValue Json, newValue Json, changedById, changeReason, createdAt. **Never deleted** (FRS §3.4).
6. **`CommitteeMeeting`** — committeeId, title, scheduledDate, time, venue, `mode`, `status`, `isRecurring`, `recurrenceRule?`, `parentMeetingId?` (generated series), agendaDeadline, createdById.
7. **`MeetingAttendance`** — meetingId, memberId, `status`, remarks. `@@unique([meetingId, memberId])`.
8. **`AgendaItem`** — meetingId, title, description, submittedById, `status`, supportingDocs String[], reviewComment?, order, version.
9. **`MeetingMinutes`** — meetingId (unique), `method`, `status`, fileUrl? + version (upload mode), approvedById?, publishedAt? → entries.
10. **`MinuteEntry`** — minutesId, agendaItemId, discussionSummary, decisions, recommendations (direct-entry mode, FRS §7.1).
11. **`ActionItem`** — actionCode (auto), description, committeeId, meetingId?, agendaItemId?, `source`, responsibleUserId, department?, `priority`, dueDate, targetCompletionDate?, `status`, remarks?, evidenceUrls String[], closedById?, reopenedCount.
12. **`ActionCarryForward`** — actionId, fromMeetingId, toMeetingId, `decision` (CONTINUE/MODIFY_DUE/ESCALATE/CLOSE), newDueDate?, createdById (FRS §9 history).

One migration (`pnpm db:migrate`), plus seed additions for `CommitteePositionType` and an initial `Designation` set.

---

## 5. API layer

New NestJS module `apps/api/src/modules/committees/` following the assessments pattern (`committees.module.ts` + controller + service + `dto/`), imports `AuditModule` + `NotificationsModule`, registered in `app.module.ts`. Service may be split by concern (committees, meetings, agenda, minutes, actions) within one module.

Endpoint groups (core lifecycle):
- **Committees**: `GET /committees`, `POST`, `GET/PATCH /:id`, `PATCH /:id/status` (archive), `GET /:id/history`.
- **Positions**: `GET/POST/PATCH /committee-positions` (admin catalog).
- **Designations**: `GET/POST/PATCH /designations` (admin lookup).
- **Members**: `GET /committees/:id/members`, `POST`, `PATCH /members/:mid`, `DELETE` (writes membership history + resolves designation incumbents).
- **Meetings**: `GET/POST /committees/:id/meetings`, `GET/PATCH /meetings/:mid`, `POST /meetings/:mid/reschedule|cancel`, recurring generation (12-occurrence horizon).
- **Attendance**: `POST /meetings/:mid/attendance`.
- **Agenda**: `POST /meetings/:mid/agenda` (submit), `PATCH /agenda/:aid` (accept/reject/clarify), `POST /meetings/:mid/agenda/publish`.
- **Minutes**: `POST /meetings/:mid/minutes` (direct or upload), `PATCH /minutes/:id/status` (Member Secretary → Chairperson → Published, position-gated with ADMIN override).
- **Actions**: `GET /committees/:id/actions`, `POST`, `PATCH /actions/:id`, `POST /:id/evidence`, `POST /:id/close|reopen`, carry-forward endpoints.

Every mutating handler calls `AuditService.log(...)`; meeting-scheduled / minutes-pending / agenda-deadline fire `NotificationsService.create(...)`.

---

## 6. Web layer

Fill in the already-scaffolded routes under `apps/web/src/app/(dashboard)/committees/`:
- `page.tsx` (list), `new/page.tsx`, `[id]/page.tsx` (overview + members + history tabs), `[id]/edit`, `[id]/meetings/page.tsx`, `[id]/meetings/new`, `[id]/meetings/[meetingId]/page.tsx` (agenda + attendance + minutes + actions).
- React Query + `api` client, matching existing component/styling conventions (tailwind, lucide, motion).
- **Nav update** in `layout.tsx` per §2.2 + `PageTitle` map + notification deep-linking.

---

## 7. Phasing (core lifecycle first)

| Phase | Scope | Status |
|---|---|---|
| **0** | Enums + Prisma models + migration + position/designation seed | ✅ done |
| **1** | Committee CRUD + positions + designations + members + membership history | ✅ done |
| **2** | Meetings (one-time + recurring) + attendance + nav/module gating | ✅ done |
| **3** | Agenda submit/review/publish | ✅ done |
| **4** | Minutes (direct + upload) + approval workflow | ✅ done |
| **5** | Action items + evidence + closure/reopen + carry-forward | ✅ done |
| **6** | Dashboard widgets, Reports (PDF/Excel), scheduled reminders (cron) | deferred |
| **7** | Cross-module integration (NQAS/Audit/Incident → action repository) | deferred (FRS §15) |

> Core lifecycle (Phases 0–5) completed 2026-06-17. Authorization model: coarse role guard (`ADMIN`/`HOD`) + fine position-gating (`canApprove` member, ADMIN override) for agenda review, minutes approval, action closure/carry-forward.

---

## 8. FRS coverage map (core scope)

| FRS section | Covered by |
|---|---|
| 3.1 Committee Creation | `Committee` model, Phase 1 |
| 3.2 Position Definition | `CommitteePositionType` catalog, Phase 1 |
| 3.3 Membership (Designation/Nomination) | `CommitteeMember` + `Designation`, Phase 1 |
| 3.4 Membership History | `CommitteeMembershipHistory`, Phase 1 |
| 4 Meeting Management | `CommitteeMeeting` + recurrence, Phase 2 |
| 5 Agenda Management | `AgendaItem`, Phase 3 |
| 6 Attendance | `MeetingAttendance`, Phase 2 |
| 7 Minutes (direct/upload + workflow) | `MeetingMinutes` + `MinuteEntry`, Phase 4 |
| 8 Action Plan | `ActionItem`, Phase 5 |
| 9 Carry Forward | `ActionCarryForward`, Phase 5 |
| 10 Dashboard | Phase 6 (deferred) |
| 11 Reports | Phase 6 (deferred) |
| 12 Audit Trail | existing `AuditLog` + `CommitteeMembershipHistory`, all phases |
| 13 Notifications/Reminders | `NotificationsService` (live) all phases; scheduled reminders Phase 6 |
| 14 Security/Access | §2.1 two-layer model, all phases |
| 15 Future integration | Phase 7 (deferred) |

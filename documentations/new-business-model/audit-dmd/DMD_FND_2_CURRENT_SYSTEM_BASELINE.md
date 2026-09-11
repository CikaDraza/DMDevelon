# DMD-FND-2 — Fresh Current-System Baseline

**Status:** IN PROGRESS  
**Captured:** 2026-09-12  
**Branch:** `staging`  
**Application baseline:** `4efeebb64f54271f4d2473a55306cace5b175ea2`  
**Starting documentation state:** `9750a806577e5ce00e0ad63bd3a4a3c3a907e75b`

This document is the reproducible React 18 baseline that DMD-FND-2A must preserve. It records observed behavior and missing evidence; it does not repair, normalize or redesign legacy contracts.

## 1. Runtime and toolchain snapshot

| Boundary | Fresh value |
|---|---|
| Node.js | `24.13.1` |
| npm | `11.14.1` |
| Next.js | `16.2.10` |
| React | `18.3.1` |
| React DOM | `18.3.1` |
| Mongoose | `8.24.1` |
| Vitest | `2.1.9` |
| TypeScript checker | `5.9.3` (JavaScript/module-resolution gate only) |

The package manifest intentionally remains on `react: ^18` and `react-dom: ^18`. React 19.2 belongs only to DMD-FND-2A.

## 2. Fresh command evidence

| Command | Fresh result | Status |
|---|---|---|
| `npm test` | 9 test files passed, 0 failed/skipped | PASS |
| `npm run test:ui -- --reporter=dot` | 8 files, 55 tests passed | PASS |
| `npm run typecheck` | zero errors | PASS |
| `npm run build` | Next.js production build passed; 16 routes generated/registered | PASS |
| `npm run test:api` | local Docker daemon unavailable; the pinned replica set at `127.0.0.1:27077` cannot start | PENDING |
| `npm run lint` | no script or lint configuration exists | NOT A CURRENT GATE |

The earlier 236/236 API result is useful history but is deliberately not reused as fresh FND-2 evidence. Start Docker and `dmd-test-mongo`, then run `npm run test:api` to close this row.

### Fresh staging HTTP baseline

Preview deployment `dpl_5e58g6M1xw5R6n3SZCK74ep7fCaR`, which runs application commit `4efeebb`, passed 14/14 read-only status checks through Vercel's authenticated Preview access:

- `200`: `/`, `/api/health`, `/api/services`, `/api/projects`, `/api/testimonials`, `/api/company-profile`, `/api/cms-pages`;
- `404`: `/api/cms-pages/slug/fnd2-definitely-missing`;
- `401` without a bearer token: `/api/auth/me`, `/api/project-requests`, `/api/client-projects`, `/api/chat/channels`, `/api/notifications`, `/api/users`.

These checks prove reachability and the anonymous boundary only. They do not prove response schemas, publication filtering, authenticated role behavior or complete client journeys.

### Lint-gate decision

FND-2 records the repository as it exists. It does not install or configure a linter merely to manufacture a new green baseline. Until a separately bounded lint decision defines tool, rules, ignored/generated paths and rollout policy, the required gates are the scripts that actually exist: unit, API integration, UI, typecheck and build. No milestone may claim that lint passed while the script is absent.

## 3. Canonical staging smoke suite

Run on `https://staging.dmdevelon.website` with staging-only accounts/providers. Use admin, owner, collaborator, viewer and outsider roles where the row calls for them. Never use production credentials or mutate production data.

| Journey | Minimum client path | Evidence and authorization assertions | Current FND-2 state |
|---|---|---|---|
| Login/auth | login → `/auth/me` → refresh → reload → logout | canonical user shape is stable; expired access can refresh; logout removes access; anonymous protected calls are 401 | Fresh anonymous boundary passes; authenticated journey pending |
| Project request | owner creates request → opens thread → sends message/attachment → admin sees and updates it | owner/admin can read; unrelated account receives 404; admin-only lifecycle actions reject clients | Defined; fresh complete pass pending |
| Proposal access | admin creates/sends → owner views → requests changes or accepts → plan/history reconcile | drafts are not exposed to clients; project outsider receives 404; client cannot perform operator-only mutations | Defined; fresh complete pass pending |
| Client project | owner opens project → milestones/tasks/history render → collaborator/viewer comparison | owner/membership/admin access comes from central policy; viewer is read-only; outsider gets 404; closed/ownerless projects remain protected | Defined; fresh complete pass pending |
| Chat | open channel → send/reply/mention → read/unread → deep link | owner/collaborator write, viewer reads only, outsider gets 404; attachment visibility follows role; removed member loses access | Recent live send/push evidence exists; full matrix pending |
| CMS/public | landing data → published CMS slug → missing/unpublished slug | public output contains only intended published content; reserved/missing paths are real 404; admin mutations require admin | Fresh public reachability and missing-slug 404 pass; publication/admin matrix pending |
| Notifications | incoming message → in-app row/toast → Firefox push → digest while offline → deep link/read | author not self-notified; viewing-conversation/presence/throttle policy holds; preferences disable their channel; endpoint data is account-scoped | Normal push and digest live pass confirmed; full preference/deep-link matrix pending |
| Admin | non-admin opens/calls admin surface → admin opens users/requests/projects/CMS/statistics | non-admin is rejected without leaking data; admin can reach each operational list; destructive actions require explicit confirmation | Fresh anonymous users rejection passes; role/UI matrix pending |
| Dashboard/settings | login → projects/requests render → profile/settings update → reload | cached identity is projection; token actor is authority; canonical ID exists where compatibility routes still require it; preferences persist | Avatar/profile staging smoke exists; fresh complete pass pending |

The suite is complete only when each row has dated staging evidence. Recent FND-1 evidence may identify likely-good paths but does not silently turn every FND-2 row green.

## 4. Contract and authorization baseline

| Area | Preserved current contract | Automated evidence | Known coverage gap |
|---|---|---|---|
| Auth/user shape | register, login, refresh and `/auth/me` share `authUserPayload`; canonical identity is `id ?? _id`; server token remains authority | `auth-user-shape.test.mjs`, `use-auth.test.jsx` | no full browser refresh/logout/session-expiry journey; no request-count regression |
| ProjectRequest | list is actor-scoped; detail is owner/admin-only; unrelated callers receive 404; formal request creation is owner commitment | request behavior partly exercised through `chat-convert.test.mjs` | direct CRUD, status, proposal field and request-thread routes lack a dedicated integration suite |
| ProjectProposal | existing versioned aggregate remains canonical; lifecycle actions notify blocked actors; drafts are intended to stay operator-only | `project-proposal-domain.test.mjs`, lifecycle portion of `notification-delivery.test.mjs` | no complete API suite for draft visibility, version conflicts, accept materialization and every role/action pair |
| ClientProject | owner, active membership and global admin resolve through central project access; 404 hides unrelated resources; known relationship without permission uses 403 where supported | `project-lifecycle.test.mjs`, `chat-channels.test.mjs` | generic CRUD, milestone/task mutations and full page projection lack consolidated contract tests |
| ProjectItem | chat converts to idea/problem/incident/decision; operator decides; client/collaborator limits remain distinct | `chat-convert.test.mjs`, pure domain tests | no full browser handoff journey and no cross-slice regression manifest |
| Chat | group/DM visibility, write/read, moderation, conversion, read watermarks and purge rules are role-scoped | chat integration suites plus message/pinned UI suites | no automated browser E2E for polling, composer, upload and multi-session timing |
| CMS/public | current catch-all exposes services/projects/testimonials/company profile and CMS reads; mutations are intended as operator work | production build and historical public smoke | no dedicated CMS authorization/publish-state integration tests; current `GET /cms-pages` and slug read require explicit publication/privacy characterization before extraction |
| Notifications | records are account-scoped; message push/email policy is independent; push stamps only accepted delivery; digest consumes only successful sends | notification delivery/fan-out/purge integration tests and notification bell/use-push UI tests | no browser automation across OS permission, service worker and provider; missing icon remains presentation debt |
| Admin | user/contact/CMS/statistics lists require an admin actor at the API boundary where implemented | scattered negative route tests | no dedicated admin API contract suite or full admin-page browser smoke |
| Dashboard/settings | client lists are token-scoped; profile compatibility routes still use canonical client ID; settings is actor-scoped | auth/UI identity regressions and project access suites | giant-page orchestration and duplicate auth ownership are not page-level tested |

### Existing status-code behavior to preserve during baseline work

- `401` means no authenticated actor (and some older admin-only branches also use it for a non-admin actor).
- `404` hides a resource when the actor has no relationship to it.
- `403` is used where the relationship exists but a specific permission is absent.
- FND-2 records these differences. Any normalization requires a later bounded contract migration with tests; it must not happen accidentally during React compatibility work.

## 5. React 18 auth ownership observation

One login/page mount in development has been observed producing approximately 17 successful `GET /api/auth/me` requests. These are not server retries. `useAuth()` owns local state and its mount effect independently calls `refreshUser()`, while many pages, hooks and components instantiate `useAuth()` separately. The module-level refresh promise deduplicates token refresh after a 401, but it does not deduplicate successful `/auth/me` reads.

Baseline classification:

- known client-auth ownership/performance gap;
- successful requests, not an availability incident;
- approximate manual observation, not yet a deterministic automated count;
- must be compared under the same development/login/page-mount conditions after React 19.2;
- must not be "fixed" inside DMD-FND-2A unless React compatibility itself requires a bounded correction.

## 6. Preserved foundations

DMD-FND-2 and DMD-FND-2A must preserve rather than replace:

- `ProjectRequest` as the request/commitment entry;
- `ProjectProposal` as the versioned commercial/scope aggregate;
- `ClientProject` milestones, tasks, history and proposal linkage;
- `ProjectItem` as formal idea/problem/incident/decision evidence;
- Project Communication Hub group/DM/message/read/moderation behavior;
- central project access and its 404/403 resource-first policy;
- notification, Web Push, digest and deep-link behavior;
- legacy records that have no new-business references.

## 7. Completion gate

DMD-FND-2 remains open until:

1. Docker and `dmd-test-mongo` are running and the fresh API suite result is recorded;
2. every staging smoke row has dated evidence or an explicitly accepted, narrowly described limitation;
3. the baseline commit is recorded in `documentations/TODO.md`;
4. no implementation behavior changed while capturing the baseline.

Only then may DMD-FND-2A change React and React DOM.

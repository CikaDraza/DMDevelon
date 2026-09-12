# DMD-FND-3 — Central Legacy API Registry

**Status:** AUDIT EVIDENCE
**Authority:** evidence-only
**Owner domain:** FND-3 / Cross-domain API
**Supersedes:** —
**Superseded by:** —

**Audit date:** 2026-09-12
**Method baseline:** `staging` @ `156790ac9e1765ede7b12bcb4ddf0ea93243c55d` (§§1–4, 6)
**Current ingest commit:** `staging` @ `666cbcf` (§5 rows and drift reconciliation)
**Milestone evidence:** 3H IN PROGRESS — method, row schema, global dispatcher facts, route-surface control table, initial cross-cutting risks, **and the first merged domain batch (3A, 28 rows)**. 3B–3F rows are not populated and the **system-wide** exact endpoint count remains unproven.

**Input state:** 3A is complete as `DMD_FND_3A_PUBLIC_CMS_AUDIT.md`; its 28 proposed rows have been **independently re-verified and merged** into §5 at `666cbcf` — see §5.1. 3G is complete as `DMD_FND_3_PAGE_INVENTORY.md`; 3B–3F are `NOT STARTED` and contribute no rows yet. Rows are ingested incrementally, one completed domain at a time, so six large audits never have to be merged in a single pass; this is a population order inside 3H and creates no second milestone or status system. `documentations/TODO.md` holds the canonical FND-3 evidence ledger and remains the only status source.
**Authority:** `documentations/TODO.md` defines the FND-3 contract and completion status.

This file is the one endpoint registry. Domain audit notes are evidence inputs, not competing inventories. No runtime code was changed while producing it.

## 1. Completeness method

The registry count must reconcile all of these source surfaces:

1. `app/api/[[...path]]/route.js` exports `OPTIONS`, `GET`, `POST`, `PUT`, `DELETE` and `PATCH`; exact contracts are counted per method and reachable branch, not per textual `startsWith` family.
2. `app/api/seed/route.js` exports a dedicated `POST /api/seed` route.
3. `app/api/client-projects/[id]/ownership/route.js` exports dedicated `POST /api/client-projects/:id/ownership`.
4. `app/api/client-projects/[id]/restore/route.js` exports dedicated `POST /api/client-projects/:id/restore`.
5. Browser callers in `hooks/`, `components/`, `app/`, service worker/config and tests are reverse-matched to a registry row; an implemented branch with no known caller remains recorded.
6. Branch order is part of the contract. Specific routes such as `projects/slug/:slug` are evaluated before general `projects/:id`; nested `client-projects`, chat and project-request families are expanded to exact patterns.
7. Tracked-source enumeration uses `git ls-files` in addition to ignore-aware search. At this baseline, an ignore-aware `rg --files app` omitted the tracked `app/api/seed/route.js`, demonstrating why one discovery command is not a completeness proof.
8. The dispatcher uses more than one matching style in the same file: `GET`, `POST`, `PUT` and `DELETE` branch on `pathStr === …` and `pathStr.startsWith(…)`, while `PATCH` branches on positional `path[index] === …` (`app/api/[[...path]]/route.js:6027` at `666cbcf`; `:5952` at the method baseline). Nested segment checks add further positional conditions. A single matcher-pattern search therefore cannot establish completeness, and any count derived from one grep strategy is invalid.
9. Reachable-branch counting is per exact method + path contract. Top-level matcher totals are a floor, never the endpoint count.

## 2. Registry schema

Every finalized row records:

```text
exact method + path/pattern
→ source file / source branch and order
→ owning domain
→ authentication
→ authorization / resource ownership
→ input/query validation
→ models / source of truth
→ response contract
→ error contract
→ side effects
→ transaction semantics
→ external providers
→ serializers / normalization
→ CORS/origin behavior where relevant
→ known callers
→ existing tests
→ coverage gap
→ explicit risk
→ target route/module
```

Unknown facts use `UNKNOWN — requires follow-up`.

## 3. Global dispatcher facts

- The catch-all calls `connectDB()` before branch selection for every `GET`, `POST`, `PUT`, `DELETE` and `PATCH`, including branches that do not inherently require Mongo. `OPTIONS` does not connect.
- Catch-all responses use `getCorsHeaders()` from `route.js:183-190`, currently `Access-Control-Allow-Origin: *` with `Content-Type, Authorization` and all exported methods.
- `errorResponse()` maps explicit status/statusCode, validation to 400, version/duplicate-key to 409 and otherwise exposes `error.message` with 500.
- Authentication helpers accept bearer access tokens; refresh and invitation continuity additionally use HttpOnly cookies. Resource authorization is branch/domain specific and must not be collapsed into the fact that a route is “authenticated”.
- `lib/auth.js:5` currently has a `JWT_SECRET || "default-secret"` fallback. This is an FND-4 risk input, not an FND-3 runtime change.
- No catch-all branch may be removed until its exact method/path row has completed the canonical extraction protocol in `documentations/TODO.md`.

## 4. Route-surface control table

| Surface | Exported methods | Static source evidence | Reconciliation state |
|---|---|---|---|
| `/api/[[...path]]` | OPTIONS, GET, POST, PUT, DELETE, PATCH | `app/api/[[...path]]/route.js:893,1017,1846,4725,5514,6027` at `666cbcf` (`:880,1004,1833,4712,5427,5940` at the method baseline) | **PARTIAL** — 28 exact 3A rows merged (§5.3); 3B–3F branches in this surface not yet written |
| `/api/seed` | POST | `app/api/seed/route.js:11` | NOT STARTED — awaiting domain 3D |
| `/api/client-projects/:id/ownership` | POST | `app/api/client-projects/[id]/ownership/route.js:13` | NOT STARTED — awaiting domain 3E |
| `/api/client-projects/:id/restore` | POST | `app/api/client-projects/[id]/restore/route.js:19` | NOT STARTED — awaiting domain 3E |

Method-export line numbers drifted +13 between the method baseline and `666cbcf`; the cause is reconciled in §5.4. No exported method was added or removed.

## 5. Exact endpoint rows

### 5.1 Ingest state and provenance

Domain rows are merged **incrementally**, one completed domain audit at a time, rather than held until 3A–3F are all finished and merged in one pass. Incremental ingest is a population order inside 3H only. It introduces **no second milestone or status system**: `documentations/TODO.md` remains the only status source, and a merged row never advances its source domain's ledger state.

| Domain | Ledger state | Rows proposed | Rows merged here | Ingest state |
|---|---|---|---|---|
| 3A Public / Marketing / CMS | COMPLETE | 28 | **28** | **MERGED** (2026-09-12) |
| 3B Auth / Session / Access | NOT STARTED | — | 0 | awaiting audit |
| 3C Uploads / Assets | NOT STARTED | — | 0 | awaiting audit |
| 3D Notifications / Cron / Operational | NOT STARTED | — | 0 | awaiting audit |
| 3E Project Requests / Proposals / Client Projects | NOT STARTED | — | 0 | awaiting audit |
| 3F Communication / Chat / DM / Project Items | NOT STARTED | — | 0 | awaiting audit |

Every merged row carries ingest metadata. For the 3A batch these are uniform except where a row's note states otherwise:

```text
source_domain:       3A
source_commit:       b8db489          (the 3A audit baseline the row was written against)
verified_at_commit:  666cbcf          (staging HEAD at ingest; independently re-checked here)
verification_status: proposed | verified | disputed
```

- `proposed` — carried from the domain audit, not independently re-checked at `verified_at_commit`.
- `verified` — matcher line, branch order and contract independently re-confirmed at `verified_at_commit`.
- `disputed` — the domain audit and current source disagree; the row records both and names the discrepancy.

**3A batch result: 28 `verified`, 0 `proposed`, 0 `disputed`.** The verification is not a re-reading of 28 branches from scratch. `git diff b8db489..666cbcf -- 'app/api/[[...path]]/route.js'` resolves to hunks in exactly two regions — one 13-line helper insertion at old line 667 and the two security-hotfix bodies — so **27 of the 28 rows lie in source regions that are byte-identical to the 3A baseline**, which is a stronger completeness proof than re-reading them. Row 20 is the single row whose behavior changed, and it was re-read in full. Every matcher line was independently re-located at `666cbcf`, and every recorded browser caller was re-confirmed at its recorded file and line.

**Per-row `target route/module` is deliberately not populated.** 3A recorded architectural seams (its §7) rather than per-endpoint targets, and inventing a target per row would be an extraction decision. It stays `UNKNOWN — requires follow-up` and belongs to 3I.

### 5.2 Common contract for the merged 3A rows

Holds for every row in §5.3 unless the row says otherwise:

- **Source file:** `app/api/[[...path]]/route.js` (the catch-all dispatcher).
- **Source branch and order:** `connectDB()` runs before branch selection; branches are evaluated top-to-bottom within the exported method. `projects/slug/:slug` (row 4) is evaluated **before** the general `projects/:id` (row 5) — correct order, no shadowing. `services/` and `testimonials/` have no slug variant.
- **Response contract:** raw Mongo documents. **No serializer or normalization exists in this domain** — `lib/` provides only `project-serializers.mjs` and `chat-serializers.mjs`.
- **Error contract:** `errorResponse()` — explicit status/statusCode passthrough, validation ⇒ 400, version/duplicate-key ⇒ 409, otherwise `error.message` with 500. Authorization failures in this domain answer **401, not 403** (3A-R9); row 20 is the sole exception after SHC-1.
- **CORS/origin:** `getCorsHeaders()` (`route.js:183-190`), currently `Access-Control-Allow-Origin: *`.
- **Transaction semantics:** none. No row in this domain opens a session or transaction.
- **External providers:** email only (`lib/email.js`), on row 16. No Cloudinary or push dependency in 3A.
- **Models / source of truth:** the six models in `DMD_FND_3A_PUBLIC_CMS_AUDIT.md` §2. None has a draft/published/approved state; `seo.noIndex` is a crawler hint, not an access gate.
- **Existing tests:** none, except row 20 — see §5.4.
- **Target route/module:** `UNKNOWN — requires follow-up` (3I).

### 5.3 Merged rows — `source_domain: 3A` (28)

Line numbers are `app/api/[[...path]]/route.js` at `verified_at_commit` `666cbcf`. The `3A line` column preserves the `source_commit` `b8db489` value so drift is auditable rather than silently overwritten.

#### 5.3.1 GET (12)

| # | Method + path | Line @666cbcf | 3A line @b8db489 | Auth | Authorization | Validation | Response | Known callers | Tests | Risk | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `GET /api/services` | 1047 | 1034 | none | public | none | raw `Service[]` sorted `displayOrder` | `hooks/useServices.js:14` | none | 3A-R11 | verified |
| 2 | `GET /api/services/:id` | 1052 | 1039 | none | public | none | raw `Service`, 404 | **no caller found** | none | 3A-R11, 3A-R12 | verified |
| 3 | `GET /api/projects` | 1065 | 1052 | none | public | `?category` passthrough, `all` ⇒ no filter | raw `Project[]` sorted `-createdAt` | `hooks/useProjects.js:15` | none | 3A-R11 | verified |
| 4 | `GET /api/projects/slug/:slug` | 1072 | 1059 | none | public | none | raw `Project`, 404 | `app/projects/[slug]/page.js:45` | none | 3A-R10, 3A-R11 | verified |
| 5 | `GET /api/projects/:id` | 1084 | 1071 | none | public | none | raw `Project`, 404 | **no caller found** | none | 3A-R11, 3A-R12 | verified |
| 6 | `GET /api/testimonials` | 1575 | 1562 | none | public | none | raw `Testimonial[]` **including `clientEmail`** | `hooks/useTestimonials.js:14` | none | **3A-R3**, 3A-R11 | verified |
| 7 | `GET /api/testimonials/:id` | 1580 | 1567 | none | public | none | raw `Testimonial`, 404 | **no caller found** | none | **3A-R3**, 3A-R11, 3A-R12 | verified |
| 8 | `GET /api/company-profile` | 1593 | 1580 | none | public | none | `CompanyProfile`; **creates one if absent** (write side effect on an unauthenticated read) | `hooks/useCompanyProfile.js:15` | none | **3A-R6**, 3A-R11 | verified |
| 9 | `GET /api/contact-messages` | 1626 | 1613 | bearer | `isAdmin`, else 401 | none | `ContactMessage[]` | `app/admin/page.js:1451` | none | 3A-R9, 3A-R11 | verified |
| 10 | `GET /api/cms-pages` | 1639 | 1626 | **none** | **public** | none | **all** `CMSPage[]`, unfiltered incl. `noIndex` | `app/admin/page.js:2052` | none | **3A-R4**, 3A-R11 | verified |
| 11 | `GET /api/cms-pages/slug/:slug` | 1644 | 1631 | none | public | none | raw `CMSPage`, 404 | `app/[...slug]/CMSPageClient.js:24` | none | 3A-R11 | verified |
| 12 | `GET /api/categories` | 1830 | 1817 | none | public | none | distinct union of `Service.category` + `Project.category` | **no caller found** | none | 3A-R11, 3A-R12 | verified |

#### 5.3.2 POST (5)

| # | Method + path | Line @666cbcf | 3A line @b8db489 | Auth | Authorization | Validation | Side effects | Known callers | Tests | Risk | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 13 | `POST /api/services` | 2246 | 2233 | bearer | `isAdmin`, else 401 | **none** — `Service.create({_id, ...body})` | none | `hooks/useServices.js:21` | none | 3A-R7, 3A-R9, 3A-R11 | verified |
| 14 | `POST /api/projects` | 2263 | 2250 | bearer | `isAdmin`, else 401 | **none** — body spread | none | `hooks/useProjects.js:22` | none | 3A-R7, 3A-R9, 3A-R11 | verified |
| 15 | `POST /api/testimonials` | 4631 | 4618 | **optional** | **none — anonymous allowed** | **none** — `Testimonial.create({_id, ...body, userId: user?._id \|\| null})` | `notifyAdmins(testimonial_created)` | `hooks/useTestimonials.js:21` | none | **3A-R2**, 3A-R7, 3A-R11 | verified |
| 16 | `POST /api/contact-messages` | 4654 | 4641 | **none** | **none — anonymous allowed** | presence of `name`/`email`/`message` only; no format or length check | `ContactMessage.create` + `sendEmail` to hardcoded `milan.drazic@dmdevelon.website` + `notifyAdmins(contact_message)` | `components/pages/HomeClient.js:1705` | none | **3A-R5**, 3A-R11 | verified |
| 17 | `POST /api/cms-pages` | 4701 | 4688 | bearer | `isAdmin`, else 401 | none | none | `app/admin/page.js:2070` | none | 3A-R7, 3A-R9, 3A-R11 | verified |

#### 5.3.3 PUT (6)

| # | Method + path | Line @666cbcf | 3A line @b8db489 | Auth | Authorization | Validation | Side effects | Known callers | Tests | Risk | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 18 | `PUT /api/services/:id` | 5042 | 5029 | bearer | `isAdmin`, else 401 | none — `findByIdAndUpdate(id, body)`, full body | none | `hooks/useServices.js` | none | 3A-R7, 3A-R9, 3A-R11 | verified |
| 19 | `PUT /api/projects/:id` | 5062 | 5049 | bearer | `isAdmin`, else 401 | none — full body | none | `hooks/useProjects.js` | none | 3A-R7, 3A-R9, 3A-R11 | verified |
| 20 | `PUT /api/testimonials/:id` | 5260 | 5247 | **bearer, required** | **author-or-admin against the stored record, else 403**; `adminReply` additionally admin-only | **explicit allowlist** — `clientName`, `clientEmail`, `clientTitle`, `rating`, `comment`, plus `adminReply` for admins; all other keys dropped, `userId` no longer writable | `notifyUser(testimonial_reply)` when `body.adminReply` truthy | `app/admin/page.js`, `app/dashboard/page.js` | **`tests/integration/testimonial-authz.test.mjs` — 9 tests** | historical **3A-R1 / SHC-1 — REMEDIATED**; residual 3A-R11 lifted for this row only | verified |
| 21 | `PUT /api/company-profile` | 5349 | 5285 | bearer | `isAdmin`, else 401 | none — singleton update | none | `hooks/useCompanyProfile.js:23` | none | 3A-R7, 3A-R9, 3A-R11 | verified |
| 22 | `PUT /api/contact-messages…` | 5369 | 5305 | bearer | `isAdmin`, else 401 | none | none | `app/admin/page.js:1466` | none | **3A-R8** (matcher is `startsWith("contact-messages")` with **no trailing slash**, unlike its DELETE sibling at row 27 and every other branch in the domain), 3A-R7, 3A-R9, 3A-R11 | verified |
| 23 | `PUT /api/cms-pages/:id` | 5407 | 5343 | bearer | `isAdmin`, else 401 | none — full body | none | `app/admin/page.js:2065` | none | 3A-R7, 3A-R9, 3A-R11 | verified |

**Row 20 — current behavior vs. historical finding.** This row describes the endpoint **as it is now**. The vulnerable contract recorded at `source_commit` (`3A-R1` / `SHC-1`: authentication demanded only when `body.adminReply !== undefined`, every other field anonymously writable, `findByIdAndUpdate(id, body)` with no ownership check) is **no longer current on either branch** and is preserved only as a historical finding reference — see `DMD_FND_3A_PUBLIC_CMS_AUDIT.md` §5 row 3A-R1 and `documentations/TODO.md` § SHC-1. Remediating revisions: `staging` `5e18d24`, `main` `25fa70a`. Registry rows record current source; they are not an archive of superseded behavior.

#### 5.3.4 DELETE (5)

| # | Method + path | Line @666cbcf | 3A line @b8db489 | Auth | Authorization | Known callers | Tests | Risk | Status |
|---|---|---|---|---|---|---|---|---|---|
| 24 | `DELETE /api/services/:id` | 5559 | 5472 | bearer | `isAdmin`, else 401 | `hooks/useServices.js` | none | 3A-R9, 3A-R11 | verified |
| 25 | `DELETE /api/projects/:id` | 5581 | 5494 | bearer | `isAdmin`, else 401 | `hooks/useProjects.js` | none | 3A-R9, 3A-R11 | verified |
| 26 | `DELETE /api/testimonials/:id` | 5828 | 5741 | bearer | **owner (`String(testimonial.userId) === String(user._id)`) or `isAdmin`**, else 401 — the one resource-ownership check present in this domain at the 3A baseline | `app/dashboard/page.js` | none | 3A-R9 (answers 401 where 403 is meant), 3A-R11 | verified |
| 27 | `DELETE /api/contact-messages/:id` | 5856 | 5769 | bearer | `isAdmin`, else 401 | `app/admin/page.js:1483` | none | 3A-R9, 3A-R11 | verified |
| 28 | `DELETE /api/cms-pages/:id` | 5879 | 5792 | bearer | `isAdmin`, else 401 | `app/admin/page.js:2103` | none | 3A-R9, 3A-R11 | verified |

#### 5.3.5 PATCH (0)

No 3A branch exists in `PATCH`. `PATCH` branches on positional `path[index] === …` (`route.js:6027` onward), a different matching style from the other methods — recorded in §1.8 as a completeness hazard, not as a 3A row.

### 5.4 Baseline drift reconciliation — `b8db489` → `666cbcf`

Reconciled against current `staging` at ingest time, as required before a domain's rows may be merged.

**Source drift.** `app/api/[[...path]]/route.js` changed in exactly two commits since the 3A baseline, both security hotfixes: `5e18d24` (SHC-1) and `f2a6aa0` (SHC-2). The file grew 6,358 → 6,445 lines. Diff hunks resolve to three regions only:

| Region (old lines) | Change | Effect on 3A rows |
|---|---|---|
| 667 | +13 lines — `assertNoUnsafeMongoKeys()` helper added by SHC-2 | none; shifts every later line by +13 |
| 5247–5258 | SHC-1 testimonial PUT rewrite | **row 20 behavior changed** |
| 5374–5409 | SHC-2 `PUT /api/users/:id` boundary | none — that endpoint is **3B**, not 3A |

**Line drift is therefore piecewise and predictable:** +13 for rows 1–20, +64 for rows 21–23, +87 for rows 24–28. Every row's current line was independently re-located rather than computed from the offset.

**Behavioral drift: one row.** Row 20 only. No other 3A row's contract, matcher, branch order or caller changed.

**Consequence for 3A-R11.** The 3A finding *"zero automated test coverage across the 3A domain"* was true at `source_commit` and is **now partially stale**: `tests/integration/testimonial-authz.test.mjs`, added by SHC-1, covers row 20 with 9 tests across two describe blocks (anonymous rejection, non-owner rejection, author update, admin update, 404 non-disclosure, `adminReply` admin-only, admin `adminReply`, `userId` reassignment rejection, no field riding along with a rejected `adminReply`). **27 of 28 rows remain uncovered.** This is recorded as drift, not as a change to 3A's status or to the 3A-R11 severity — 3A stays `COMPLETE` and its risk register is not re-scored here.

**Supplemental 3A findings.** 3A appended two post-baseline metadata findings, `3A-R13` (Medium) and `3A-R14` (Low), in its §5.2. Both concern `app/layout.js` — a non-API surface — so **neither produces a registry row**. They are carried to 3I as FND-4 inputs.

### 5.5 Outstanding before §5 may claim completeness

The merged 3A batch does not make this registry complete. Still required:

- 3B–3F domain audits merged as further incremental batches, each with its own `source_commit` / `verified_at_commit` / `verification_status`;
- every remaining top-level and nested matcher expanded to an exact method/path pattern across all six exported methods, including the positional-matcher `PATCH` family;
- shadowing and branch order checked system-wide, not only within 3A;
- the three dedicated route files (`/api/seed`, `/api/client-projects/:id/ownership`, `/api/client-projects/:id/restore`) included;
- every known browser/test caller resolved to one row or recorded as an explicit stale/missing-route finding;
- uncaught/unsupported methods and the catch-all 404 behavior recorded;
- an independent 3H recount proving the system-wide total.

## 6. Initial cross-cutting risks for 3I

| Risk | Evidence | Current classification |
|---|---|---|
| Default JWT secret fallback | `lib/auth.js:5` | Critical security configuration risk; candidate FND-4 scope |
| Wildcard catch-all CORS | `app/api/[[...path]]/route.js:183-190` | Security/contract risk; exact credential/origin implications require 3B reconciliation |
| Catch-all size and ownership mixing | 6,358 lines; imports public CMS, auth, project, chat, notifications, email, push and Cloudinary domains | Architecture/change-risk driver for sequential extraction, not a big-bang rewrite justification |
| DB connection before routing | Each non-OPTIONS method calls `connectDB()` before path matching | Operational coupling and unnecessary failure surface for health/provider-only branches |
| Discovery-tool blind spot | `rg --files app` omitted tracked `app/api/seed/route.js`; `git ls-files app/api` found it | Completeness process risk; multiple independent enumerations required |

## 7. Current completeness state

- **Merged rows:** **28**, all `source_domain: 3A`, all `verification_status: verified` at `666cbcf`. This is a merged-batch total, not a system-wide count.
- **System-wide exact endpoint count:** `UNKNOWN — requires follow-up`. Requires the remaining 3B–3F domain batches and an independent 3H recount. Do not infer a count from any single matcher grep, and do not read the 28 merged rows as a floor for the system total in any other document.
- **Unmatched callers:** `UNKNOWN — requires follow-up` system-wide. Within the merged 3A batch every recorded browser caller resolves to exactly one row, and rows 2, 5, 7 and 12 are recorded as implemented with **no known caller** (3A-R12) rather than dropped.
- **Shadowed/unreachable branches:** `UNKNOWN — requires follow-up` system-wide. Within 3A, branch order was checked and only one ordering pair is material — `projects/slug/:slug` before `projects/:id`, which is correct.
- **Test coverage across merged rows:** 1 of 28 covered (row 20, 9 tests). See §5.4.
- **3H completion:** Not claimed. 3H remains `IN PROGRESS` in the `documentations/TODO.md` evidence ledger.

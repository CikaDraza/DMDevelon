# DMD-FND-3 — Central Legacy API Registry

**Audit date:** 2026-09-12  
**Source baseline:** `staging` @ `156790ac9e1765ede7b12bcb4ddf0ea93243c55d`  
**Status:** 3H IN PROGRESS — method, row schema, global dispatcher facts, route-surface control table and initial cross-cutting risks only. No exact endpoint row is populated and the exact endpoint count is unproven.

**Input state:** 3A is complete as `DMD_FND_3A_PUBLIC_CMS_AUDIT.md` and proposes 28 exact rows for the public/marketing/CMS domain; 3G is complete as `DMD_FND_3_PAGE_INVENTORY.md`; 3B–3F are `NOT STARTED`. The 3A rows are a domain proposal awaiting merge and independent recount here; no row has been merged into §5 yet. `documentations/TODO.md` holds the canonical FND-3 evidence ledger.  
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
8. The dispatcher uses more than one matching style in the same file: `GET`, `POST`, `PUT` and `DELETE` branch on `pathStr === …` and `pathStr.startsWith(…)`, while `PATCH` branches on positional `path[index] === …` (`app/api/[[...path]]/route.js:5952`). Nested segment checks add further positional conditions. A single matcher-pattern search therefore cannot establish completeness, and any count derived from one grep strategy is invalid.
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
| `/api/[[...path]]` | OPTIONS, GET, POST, PUT, DELETE, PATCH | `app/api/[[...path]]/route.js:880,1004,1833,4712,5427,5940` | NOT STARTED — no exact reachable branch row written |
| `/api/seed` | POST | `app/api/seed/route.js:11` | NOT STARTED — awaiting domain 3D |
| `/api/client-projects/:id/ownership` | POST | `app/api/client-projects/[id]/ownership/route.js:13` | NOT STARTED — awaiting domain 3E |
| `/api/client-projects/:id/restore` | POST | `app/api/client-projects/[id]/restore/route.js:19` | NOT STARTED — awaiting domain 3E |

## 5. Exact endpoint rows

No exact endpoint row has been merged into this registry. 3A has proposed 28 rows in its own artifact and 3B–3F are `NOT STARTED`; this section must not receive a “complete” count until:

- every top-level and nested matcher has been expanded to an exact method/path pattern;
- shadowing/order has been checked;
- the three dedicated route files are included;
- every known browser/test caller resolves to one row or an explicit stale/missing-route finding;
- uncaught/unsupported methods and the catch-all 404 behavior are recorded.

## 6. Initial cross-cutting risks for 3I

| Risk | Evidence | Current classification |
|---|---|---|
| Default JWT secret fallback | `lib/auth.js:5` | Critical security configuration risk; candidate FND-4 scope |
| Wildcard catch-all CORS | `app/api/[[...path]]/route.js:183-190` | Security/contract risk; exact credential/origin implications require 3B reconciliation |
| Catch-all size and ownership mixing | 6,358 lines; imports public CMS, auth, project, chat, notifications, email, push and Cloudinary domains | Architecture/change-risk driver for sequential extraction, not a big-bang rewrite justification |
| DB connection before routing | Each non-OPTIONS method calls `connectDB()` before path matching | Operational coupling and unnecessary failure surface for health/provider-only branches |
| Discovery-tool blind spot | `rg --files app` omitted tracked `app/api/seed/route.js`; `git ls-files app/api` found it | Completeness process risk; multiple independent enumerations required |

## 7. Current completeness state

- **Exact endpoint count:** UNKNOWN — requires follow-up. Requires the 3A–3F domain merge and an independent 3H recount. Do not infer a count from any single matcher grep.
- **Unmatched callers:** UNKNOWN — requires reverse caller reconciliation.
- **Shadowed/unreachable branches:** UNKNOWN — requires ordered matcher analysis.
- **3H completion:** Not yet claimed.

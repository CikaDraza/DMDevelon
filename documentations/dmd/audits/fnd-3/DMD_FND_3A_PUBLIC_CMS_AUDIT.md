# DMD-FND-3 — 3A Public / Marketing / CMS Domain Audit

**Status:** AUDIT EVIDENCE
**Authority:** evidence-only
**Owner domain:** FND-3 / Public, Marketing & CMS
**Supersedes:** —
**Superseded by:** —

**Audit date:** 2026-09-12
**Source baseline:** `staging` @ `b8db489` (FND-3 baseline)
**Milestone evidence:** 3A COMPLETE as a domain evidence input.
**Authority:** `documentations/TODO.md` defines the FND-3 contract and completion status; its evidence ledger is the only status source.
**Feeds:** 3H central API registry (row merge and final count) and 3I (risk/migration map).

This is an evidence record, not a refactor proposal and not a fix list. **No runtime file was changed while producing it.** Every risk below is FND-4 input.

## 1. Scope and method

Scope per the canonical 3A definition: public catalog, services, projects, testimonials, company profile, categories, contact entry point, homepage/`HomeClient`, metadata, public loaders and CMS catch-all behavior.

Enumeration used four independent strategies, because no single one is a completeness proof:

1. Matcher sweep of all six exported methods in `app/api/[[...path]]/route.js` for both matching styles (`pathStr === `, `pathStr.startsWith(`, positional `path[index] ===`).
2. Reverse caller matching from `hooks/`, `components/`, `app/` for every `axios.{get,post,put,delete}` to a 3A path, literal and template form.
3. Model-first sweep: every Mongo model owned by this domain traced to the branches that read/write it.
4. Non-API public surface sweep: server loaders, metadata, sitemap and robots.

**Proposed 3A exact row count: 28** (12 GET, 5 POST, 6 PUT, 5 DELETE, 0 PATCH). This count is a domain proposal. Final registry reconciliation and the system-wide count remain 3H; the system-wide endpoint count stays `UNKNOWN — requires follow-up`.

### Domain boundary decisions

- Admin-actor writes to catalog/CMS resources are recorded **here**, because the owning domain is the public/CMS catalog, not the admin page that calls them. The actor is recorded per row.
- `POST /api/project-requests` is the public "request" entry point but its lifecycle is owned by **3E**. Recorded here only as a cross-domain reference, not as a 3A row, to avoid a duplicate inventory.
- `GET /api/health`, cron and upload branches are **3D/3C**, not 3A.

## 2. Models owned by this domain

| Model | File | Publication/approval field | Notes |
|---|---|---|---|
| `Service` | `models/Service.js` | **none** | `displayOrder`, `gridSpan` 1–7, `category` required |
| `Project` | `models/Project.js` | **none** | `slug` `unique` but **not** `required` |
| `Testimonial` | `models/Testimonial.js` | **none** | stores `clientEmail`, `adminReply`, optional `userId` |
| `CompanyProfile` | `models/CompanyProfile.js` | `seo.noIndex` (SEO only) | singleton by convention, not by constraint |
| `CMSPage` | `models/CMSPage.js` | `seo.noIndex` (SEO only) | `slug` required+unique; no draft/published state |
| `ContactMessage` | `models/ContactMessage.js` | n/a | `replied`, `convertedToRequestId` |

**Finding:** no model in this domain has a draft/published/approved state. Every record is publicly live the moment it is created. `seo.noIndex` is a crawler hint, not an access or publication gate.

## 3. Exact endpoint rows

Common to every row unless stated: dispatcher is `app/api/[[...path]]/route.js`; `connectDB()` runs before branch selection; responses carry `getCorsHeaders()` (`Access-Control-Allow-Origin: *`); errors flow through `errorResponse()`; no transaction is used; no serializer is applied (this domain has none — `lib/` provides only `project-serializers.mjs` and `chat-serializers.mjs`).

### 3.1 GET (12)

| # | Method + path | Line | Auth | Authorization | Validation | Response | Known callers |
|---|---|---|---|---|---|---|---|
| 1 | `GET /api/services` | 1034 | none | public | none | raw `Service[]` sorted `displayOrder` | `hooks/useServices.js:14` |
| 2 | `GET /api/services/:id` | 1039 | none | public | none | raw `Service`, 404 | **no caller found** |
| 3 | `GET /api/projects` | 1052 | none | public | `?category` passthrough, `all` ⇒ no filter | raw `Project[]` sorted `-createdAt` | `hooks/useProjects.js:15` |
| 4 | `GET /api/projects/slug/:slug` | 1059 | none | public | none | raw `Project`, 404 | `app/projects/[slug]/page.js:45` |
| 5 | `GET /api/projects/:id` | 1071 | none | public | none | raw `Project`, 404 | **no caller found** |
| 6 | `GET /api/testimonials` | 1562 | none | public | none | raw `Testimonial[]` **including `clientEmail`** | `hooks/useTestimonials.js:14` |
| 7 | `GET /api/testimonials/:id` | 1567 | none | public | none | raw `Testimonial`, 404 | **no caller found** |
| 8 | `GET /api/company-profile` | 1580 | none | public | none | `CompanyProfile`; **creates one if absent** | `hooks/useCompanyProfile.js:15` |
| 9 | `GET /api/contact-messages` | 1613 | bearer | `isAdmin`, else 401 | none | `ContactMessage[]` | `app/admin/page.js:1451` |
| 10 | `GET /api/cms-pages` | 1626 | **none** | **public** | none | **all** `CMSPage[]`, unfiltered | `app/admin/page.js:2052` |
| 11 | `GET /api/cms-pages/slug/:slug` | 1631 | none | public | none | raw `CMSPage`, 404 | `app/[...slug]/CMSPageClient.js:24` |
| 12 | `GET /api/categories` | 1817 | none | public | none | distinct union of `Service.category` + `Project.category` | **no caller found** |

Branch order: `projects/slug/` (row 4) is correctly evaluated **before** the general `projects/:id` (row 5). `services/` and `testimonials/` have no slug variant, so no shadowing exists there.

### 3.2 POST (5)

| # | Method + path | Line | Auth | Authorization | Validation | Side effects |
|---|---|---|---|---|---|---|
| 13 | `POST /api/services` | 2233 | bearer | `isAdmin`, else 401 | **none** — `Service.create({_id, ...body})` | none |
| 14 | `POST /api/projects` | 2250 | bearer | `isAdmin`, else 401 | **none** — body spread | none |
| 15 | `POST /api/testimonials` | 4618 | **optional** | **none — anonymous allowed** | **none** — `Testimonial.create({_id, ...body, userId: user?._id \|\| null})` | `notifyAdmins(testimonial_created)` |
| 16 | `POST /api/contact-messages` | 4641 | **none** | **none — anonymous allowed** | presence of `name`/`email`/`message` only; no format or length check | `ContactMessage.create` + `sendEmail` to hardcoded `milan.drazic@dmdevelon.website` + `notifyAdmins(contact_message)` |
| 17 | `POST /api/cms-pages` | 4688 | bearer | `isAdmin`, else 401 | none | none |

### 3.3 PUT (6)

| # | Method + path | Line | Auth | Authorization | Notes |
|---|---|---|---|---|---|
| 18 | `PUT /api/services/:id` | 5029 | bearer | `isAdmin`, else 401 | `findByIdAndUpdate(id, body)` — full body |
| 19 | `PUT /api/projects/:id` | 5049 | bearer | `isAdmin`, else 401 | full body |
| 20 | `PUT /api/testimonials/:id` | 5247 | **conditional** | **admin required only when `body.adminReply !== undefined`**; every other field is writable with **no authentication and no ownership check** | `findByIdAndUpdate(id, body)`; `notifyUser(testimonial_reply)` when `body.adminReply` truthy |
| 21 | `PUT /api/company-profile` | 5285 | bearer | `isAdmin`, else 401 | singleton update |
| 22 | `PUT /api/contact-messages…` | 5305 | bearer | `isAdmin`, else 401 | matcher is `startsWith("contact-messages")` — **no trailing slash**, unlike every sibling |
| 23 | `PUT /api/cms-pages/:id` | 5343 | bearer | `isAdmin`, else 401 | full body |

### 3.4 DELETE (5)

| # | Method + path | Line | Auth | Authorization |
|---|---|---|---|---|
| 24 | `DELETE /api/services/:id` | 5472 | bearer | `isAdmin`, else 401 |
| 25 | `DELETE /api/projects/:id` | 5494 | bearer | `isAdmin`, else 401 |
| 26 | `DELETE /api/testimonials/:id` | 5741 | bearer | **owner (`testimonial.userId === user._id`) or `isAdmin`** — the one resource-ownership check in this domain |
| 27 | `DELETE /api/contact-messages/:id` | 5769 | bearer | `isAdmin`, else 401 |
| 28 | `DELETE /api/cms-pages/:id` | 5792 | bearer | `isAdmin`, else 401 |

### 3.5 PATCH

No 3A branch exists in `PATCH`.

## 4. Non-API public surfaces

| Surface | Source | Behavior | Gap |
|---|---|---|---|
| Homepage server loader | `app/page.js:24-32` | direct `Service.find()`, `revalidate = 300`, degrades to `[]` on DB error | duplicate of row 1; client hook refetches the same data after hydration |
| Homepage metadata | `app/page.js:35` → `lib/seo.js` | `CompanyProfile.seo`/`geo`, hardcoded business fallbacks | fallback copy is indexed when a field is cleared; no test |
| CMS metadata | `app/[...slug]/page.js:4` → `lib/seo.js` | `CMSPage.findOne({slug})` | metadata read is a **separate query** from the later browser body load — not pinned to one revision |
| CMS body | `app/[...slug]/CMSPageClient.js:24,113` | `GET /api/cms-pages/slug/:slug`, rendered via `rehypeRaw` **without a sanitizer** | cross-ref 3G |
| `sitemap.xml` | `app/sitemap.js` | `CMSPage` where `seo.noIndex != true`; `Project` where `slug` not null/empty; `revalidate = 3600`; degrades to homepage | `Project` has no publication field to filter on |
| `robots.txt` | `app/robots.js` | disallows `/api`, `/admin`, `/dashboard`, `/invite`, `/verify-email`, `/reset-password` | crawl guidance only, not authorization |
| Contact form | `components/pages/HomeClient.js:1705` | anonymous `POST /api/contact-messages` | no captcha, no rate limit |

## 5. Risks — 3I input

Severity is this domain's assessment; FND-4 owns the final classification and any change.

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| 3A-R1 | **Critical — SECURITY HOTFIX CANDIDATE (SHC-1)** | `PUT /api/testimonials/:id` authenticates **only** when `body.adminReply` is present. An anonymous caller can overwrite `clientName`, `rating`, `comment` and `userId` on **any** testimonial. There is no ownership check on this branch. The identical branch is present on `main` (`route.js:5242`), so this is an active defect on the production branch, not future hardening. Raised for a separate owner decision in `documentations/TODO.md` § Security hotfix candidates; **not** repaired inside FND-3. | `route.js:5247-5257`; `main` `route.js:5242`; `lib/auth.js:35` |
| 3A-R2 | **Critical** | `POST /api/testimonials` accepts anonymous callers, the model has no approval state, and `GET /api/testimonials` is public. Anonymous content reaches the public marketing site with no review, plus an admin notification per submission. | `route.js:4618-4626`, `models/Testimonial.js`, `route.js:1562` |
| 3A-R3 | **High** | `GET /api/testimonials` and `GET /api/testimonials/:id` return raw documents including `clientEmail`. No serializer exists for this domain. Client email addresses are readable by anyone, cross-origin (wildcard CORS). | `route.js:1562,1567`; `lib/` has no public serializer |
| 3A-R4 | **High** | No publication gate exists in the data model for `Service`, `Project`, `Testimonial` or `CMSPage`. `GET /api/cms-pages` returns **every** CMS page unauthenticated, including `noIndex` ones, enumerating unlinked content. | `models/*`, `route.js:1626` |
| 3A-R5 | **High** | `POST /api/contact-messages` is anonymous and triggers a DB write, an outbound email and an admin notification fan-out. No rate limiting, captcha or throttle exists anywhere in the repository for this path. Recipient is hardcoded. | `route.js:4641-4680`; repo-wide search for rate-limit/captcha returns nothing for request paths |
| 3A-R6 | **Medium** | `GET /api/company-profile` **creates** a `CompanyProfile` document when none exists — an unauthenticated read with a write side effect, not idempotent under concurrency, seeded with a personal address (`drazic.milan@gmail.com`) that differs from the hardcoded contact recipient. | `route.js:1580-1611` |
| 3A-R7 | **Medium** | Mass assignment: every create/update in this domain spreads the raw request body into the model (`{...body}` / `findByIdAndUpdate(id, body)`). Combined with 3A-R1 this lets an anonymous caller set fields the UI never exposes. | rows 13, 14, 15, 17, 18, 19, 20, 21, 22, 23 |
| 3A-R8 | **Medium** | `PUT` contact-messages matches `startsWith("contact-messages")` without a trailing slash, unlike its DELETE sibling and every other branch in the domain. Matcher shape is inconsistent within one resource. | `route.js:5305` vs `route.js:5769` |
| 3A-R9 | **Medium** | Authorization failures return **401**, not 403, and every admin check is an inline `getUserFromRequest()` + `user.isAdmin` pair repeated per branch. There is no central admin policy for this domain. | rows 9, 13, 14, 17–19, 21–25, 27, 28 |
| 3A-R10 | **Low–Medium** | `Project.slug` is `unique` but not `required`, so slug-less projects are creatable; the sitemap compensates by filtering null/empty slugs. Whether the unique index is sparse at this baseline is `UNKNOWN — requires follow-up`. | `models/Project.js`, `app/sitemap.js` |
| 3A-R11 | **High (process)** | **Zero automated test coverage** for the entire 3A domain. No unit, integration or UI test references any 3A endpoint. | `tests/` sweep returns no match for any 3A path |
| 3A-R12 | **Low** | Rows 2, 5, 7 and 12 (`services/:id`, `projects/:id`, `testimonials/:id`, `categories`) have **no known browser caller**. They remain implemented, publicly reachable and untested. | reverse caller sweep |

### 5.1 Severity separation

Only 3A-R1 is raised as a security hotfix candidate. It is the single finding in this domain where an unauthenticated caller can mutate an existing record belonging to someone else.

3A-R2 is serious but a different class: anonymous submission that becomes public with no moderation lifecycle is an abuse, content-integrity and product-policy problem. It does not permit arbitrary modification of another party's existing document, and it remains 3I/FND-4 scope together with 3A-R3 through 3A-R12.

## 6. Source-of-truth and side-effect summary

- **Canonical state:** the six Mongo models in §2. React Query caches and the homepage server loader are projections; the homepage loads services twice (server loader + client hook) from one source.
- **Side effects in this domain:** exactly two — the contact email (`lib/email.js` via `sendEmail`) and admin/user notifications (`lib/notify.js` via `notifyAdmins`/`notifyUser`) on rows 15, 16 and 20.
- **External providers:** email delivery only. No Cloudinary or push dependency in 3A (uploads are 3C).
- **Transactions:** none in this domain.

## 7. Target seams — 3I input, not a decision

- One public catalog read model with an explicit publication gate, replacing "created means live".
- A public serializer boundary so no public response returns a raw Mongo document (directly addresses 3A-R3).
- One shared admin authorization policy instead of a per-branch `isAdmin` pair, with authorization answering 403.
- Validated write contracts per resource, ending the `{...body}` spread.
- The anonymous write paths (rows 15, 16) separated as an untrusted-submission boundary with review state and abuse controls.

## 8. Explicit unknowns

- Whether `Project.slug`'s unique index is sparse at this baseline — `UNKNOWN — requires follow-up`.
- Whether any non-browser/external consumer depends on rows 2, 5, 7 or 12 — `UNKNOWN — requires follow-up`; 3H reverse reconciliation owns this.
- Exact credential/origin impact of wildcard CORS on this domain's authenticated rows — deferred to 3H/3B, not assumed here.
- System-wide exact endpoint count — remains `UNKNOWN — requires follow-up` and is 3H's to prove.

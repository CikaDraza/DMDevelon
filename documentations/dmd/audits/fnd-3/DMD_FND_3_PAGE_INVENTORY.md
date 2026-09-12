# DMD-FND-3 — Page and Application Surface Inventory

**Status:** AUDIT EVIDENCE
**Authority:** evidence-only
**Owner domain:** FND-3 / Application Pages
**Supersedes:** —
**Superseded by:** —

**Audit date:** 2026-09-12
**Source baseline:** `staging` @ `156790ac9e1765ede7b12bcb4ddf0ea93243c55d`
**Milestone evidence:** 3G COMPLETE. This static route-surface inventory is the durable 3G artifact. Cross-domain caller/test reconciliation against the central API registry is 3H/3I scope and does not reopen 3G.
**Authority:** `documentations/TODO.md` defines the FND-3 contract and completion status.

This is an evidence record, not a refactor proposal. No runtime file was changed while producing it.

## 1. Global composition and route conventions

- `app/layout.js:18` is a Server Component with async `generateMetadata`; it reads CMS/company data through `lib/seo.js`, then renders every route through the client `QueryProvider` and global toaster.
- No `loading.js`, `error.js`, `not-found.js`, route-group layout or request-boundary `proxy.js` exists under `app/` at this baseline.
- There are 12 `page.js` route files. Nine are full Client Component entrypoints, two are server entrypoints (`/` and `/[...slug]`), and `/[...slug]` immediately hands body loading to a Client Component.
- Authenticated/admin pages use `useAuth()` and client redirects/null rendering as UX gates. These do not replace server authorization in the called API branches.
- Root metadata is specialized in `app/page.js:35`; CMS catch-all metadata is specialized in `app/[...slug]/page.js:4`. Other pages inherit the root layout metadata path.

## 2. Canonical page rows

### PAGE-01 — `/`

- **Source / boundary:** `app/page.js:1-80` Server Component → `components/pages/HomeClient.js:1-2198` Client Component.
- **Auth/access gate:** Public. `HomeClient` mounts `useAuth()` only for login/account projection.
- **Server loaders:** Direct Mongo `Service.find()` in `app/page.js:19-31`; `getSeoMeta("/")` loads `CompanyProfile` SEO/geo in `lib/seo.js`.
- **Browser/API calls:** `useServices`, `useProjects`, `useTestimonials`, `useCompanyProfile`; public contact POST; auth login/register/forgot-password through `useAuth`.
- **State owner:** Mongo public/CMS models are canonical; React Query and local component state are projections. The login modal is the current sign-in surface.
- **Metadata:** Route-specific canonical/OpenGraph/Twitter metadata; `revalidate = 300` for page data.
- **404 behavior:** Not applicable to the fixed root route; loader DB failure degrades to an empty initial service list.
- **Deep-link behavior:** Hash/section navigation is client-owned; service category anchors are mapped in `HomeClient`.
- **Existing tests:** Indirect hook/auth/route integration coverage; no full homepage/page test found.
- **Coverage gap:** No page-level SSR/hydration, metadata/body revision, anchor or contact journey proof.
- **Risk:** `HomeClient` is 2,198 lines and mixes navigation, marketing, public data, auth modal and contact mutation; client hooks refetch data already partly server-loaded.
- **Ownership seam:** Public presentation, public catalog, contact entry and auth modal.
- **Target composition:** Server-owned published loaders/metadata with bounded client islands per public section; preserve one canonical auth provider when introduced by the canonical milestones.

### PAGE-02 — `/[...slug]` public CMS catch-all

- **Source / boundary:** `app/[...slug]/page.js:1-34` Server Component supplies metadata/slug → `app/[...slug]/CMSPageClient.js:1-218` Client Component loads/renders body.
- **Auth/access gate:** Public; no publication gate is visible at the page boundary.
- **Server loaders:** `generateMetadata` reads `CMSPage` through `getSeoMeta(slugPath)`.
- **Browser/API calls:** `GET /api/cms-pages/slug/:slug` after hydration.
- **State owner:** `CMSPage` in Mongo; local `page/loading/error` state is a projection.
- **Metadata:** Server metadata load is separate from the later browser body load and is not pinned to the same revision.
- **404 behavior:** Missing CMS content renders a visual “404” inside a successful route shell; it does not call `notFound()` and therefore does not prove an HTTP 404 response.
- **Deep-link behavior:** Arbitrary multi-segment slugs resolve; reserved-slug/publication policy is not present at this page boundary.
- **Existing tests:** No page-level CMS, reserved-slug, HTTP-404 or metadata/body consistency test found.
- **Coverage gap:** Real response status, publishability, reserved paths, sanitization and metadata/body same-revision behavior.
- **Risk:** `rehypeRaw` renders CMS-provided raw HTML (`CMSPageClient.js:8,113`) without a visible sanitizer; split server/client reads can drift; catch-all can turn mistyped or intended application URLs into CMS shells.
- **Ownership seam:** Public CMS publication/read model, SEO projection and safe content renderer.
- **Target composition:** One server loader resolves publishability, reserved slug, body and metadata revision; use real `notFound()` and a structured/sanitized renderer.

### PAGE-03 — `/projects/[slug]`

- **Source / boundary:** `app/projects/[slug]/page.js:1-317`, full Client Component.
- **Auth/access gate:** Public.
- **Server loaders:** None.
- **Browser/API calls:** `GET /api/projects/slug/:slug` (`page.js:45`).
- **State owner:** `Project` Mongo record; local loading/error/project state is a projection.
- **Metadata:** No route-specific metadata/OG loader; inherits layout metadata.
- **404 behavior:** API 404 becomes an in-page “Project Not Found” view, not an HTTP `notFound()` response.
- **Deep-link behavior:** Direct slug navigation works only after client hydration/API success.
- **Existing tests:** API smoke/route coverage only; no page-level slug/SEO/404 test found.
- **Coverage gap:** SSR/crawler content, project metadata, real 404, invalid/encoded slug and hydration failure.
- **Risk:** Public portfolio content and error status are client-only; crawlers initially receive no project body.
- **Ownership seam:** Published project loader/serializer and project-detail presentation.
- **Target composition:** Server-owned published-project loader, route metadata and `notFound()`, with client islands only where interaction requires them.

### PAGE-04 — `/admin`

- **Source / boundary:** `app/admin/page.js:1-2571`, full Client Component with eleven tab surfaces and several nested managers.
- **Auth/access gate:** `useAuth()` plus `user.isAdmin` redirects to `/` at `page.js:2354-2359`; all real authority must remain in API resource/admin checks.
- **Server loaders:** None.
- **Browser/API calls:** Statistics, services, public projects, client projects/proposals/recovery, chat, project requests, testimonials, users, contact messages, company profile and CMS through hooks/direct Axios.
- **State owner:** Domain Mongo models are canonical; React Query/local state/query string/localStorage select and highlight projections only.
- **Metadata:** No admin-specific metadata/noindex declaration; inherits layout behavior. Robots disallows crawling but is not an access or noindex authority.
- **404 behavior:** Not applicable to the fixed route; failed data panels generally handle errors independently.
- **Deep-link behavior:** `?tab=&id=&m=&proposal=` selects/highlights content; tab state also persists in localStorage (`page.js:2320-2390`).
- **Existing tests:** Strong indirect API/domain coverage and a recovery-controls component test; no admin route/tab/deep-link/browser authorization test found.
- **Coverage gap:** Direct-load auth timing, all tab failure states, query/localStorage precedence, metadata/noindex and cross-account cache behavior at page level.
- **Risk:** A 2,571-line client page composes unrelated domains; repeated nested `useAuth()` calls duplicate session resolution lifecycles; client-only route gate flashes/loads before redirect and cannot be a security boundary.
- **Ownership seam:** Admin shell/navigation separated from bounded domain managers and shared server-authoritative admin policy.
- **Target composition:** Thin admin route shell with independently loaded domain panels; keep query-string deep links but remove duplicated identity orchestration.

### PAGE-05 — `/dashboard`

- **Source / boundary:** `app/dashboard/page.js:1-1138`, full Client Component.
- **Auth/access gate:** `useAuth()` redirects unauthenticated users to `/` (`page.js:105-109`).
- **Server loaders:** None.
- **Browser/API calls:** Auth/profile/avatar, testimonials, client projects, project requests, notifications, chat channels and push through hooks plus direct user update/delete Axios.
- **State owner:** Server domain records are canonical; React Query/localStorage/query parameters drive view state. A cached `user` object in localStorage is explicitly a projection.
- **Metadata:** No dashboard-specific metadata/noindex; inherits layout behavior. Robots disallows crawl only.
- **404 behavior:** Not applicable to the fixed route; empty request/project arrays produce dashboard empty states.
- **Deep-link behavior:** `?tab=services|testimonials`; legacy `?tab=chat&channel=&m=` is rewritten to `/dashboard/chat` (`page.js:115-147`).
- **Existing tests:** Indirect `useAuth`, notification/chat component and API integration tests; no dashboard page or empty-state continuity test.
- **Coverage gap:** Registration/claim continuity, direct-load auth timing, empty-state semantics, tab/deep-link browser flow and cross-user cache clearing as a whole page.
- **Risk:** A 1,138-line client page is simultaneously account, request, project, testimonial, chat and notification navigator; profile update still sends a browser-derived user ID and manually rewrites localStorage.
- **Ownership seam:** Dashboard navigator/account ownership versus Workspace lifecycle surface and bounded domain summaries.
- **Target composition:** Authenticated navigation shell that projects claimed Workspace and formal project states without manufacturing either; domain cards/panels own their own queries.

### PAGE-06 — `/dashboard/chat`

- **Source / boundary:** `app/dashboard/chat/page.js:1-96` Client Component → composed `components/chat/ProjectChat.jsx` domain UI.
- **Auth/access gate:** `useAuth()` redirects unauthenticated users to `/`; channel/resource access is decided by chat APIs.
- **Server loaders:** None.
- **Browser/API calls:** Chat channel/message/read/pin/DM/convert/upload APIs through `ProjectChat` and chat hooks; notification/push components.
- **State owner:** Chat/message/read/pin records are canonical; React Query and `channel`/`m` search params are projections.
- **Metadata:** No route-specific metadata/noindex.
- **404 behavior:** No route-level 404; invalid/unauthorized channels resolve through component/API error behavior.
- **Deep-link behavior:** `?channel=<id>&m=<messageId>` is passed to `ProjectChat` (`page.js:69-73`).
- **Existing tests:** Chat API/domain/serializer suites and several component tests; no complete page/deep-link/browser test found.
- **Coverage gap:** Direct deep-link access, invalid channel/message, auth transition and mobile keyboard/layout as a whole-page flow.
- **Risk:** Client gate is duplicated with nested auth/data consumers; page-level unavailable/forbidden/not-found states are not explicit.
- **Ownership seam:** Thin authenticated chat page shell is already separate from the reusable chat domain UI.
- **Target composition:** Preserve thin shell; converge identity/context resolution and explicit resource-error projection without moving authorization to the page.

### PAGE-07 — `/dashboard/projects/[id]`

- **Source / boundary:** `app/dashboard/projects/[id]/page.js:1-1253`, full Client Component with project, proposal, milestone and milestone-chat UI.
- **Auth/access gate:** `useAuth()` redirects unauthenticated users to `/`; project/proposal APIs enforce resource access.
- **Server loaders:** None.
- **Browser/API calls:** Client project, proposal lifecycle, milestone/task changes, milestone messages/uploads and notifications through hooks/components.
- **State owner:** `ClientProject`, proposal snapshots, milestones/messages and notification records are canonical; local dialog/accordion/deep-link state is projection only.
- **Metadata:** No project-specific metadata/noindex.
- **404 behavior:** Only authoritative single-project API 404 is shown as “Project not found”; other failures get a retry state (`page.js:459-493`). HTTP route status remains 200.
- **Deep-link behavior:** `?proposal=<id>` opens/marks one proposal; `?m=<milestoneId>` opens milestone chat and marks it read (`page.js:243-302`).
- **Existing tests:** Strong proposal/project/chat API/domain coverage and indirect UI components; no full page deep-link/role matrix test.
- **Coverage gap:** Browser owner/admin/member/stranger matrix, simultaneous proposal/milestone links, recoverable error and route-level status semantics.
- **Risk:** A 1,253-line client surface coordinates many authoritative actions and duplicated loading/error policies; route state is not server-resolved.
- **Ownership seam:** Project overview, commercial proposal decision, milestone planning and milestone conversation.
- **Target composition:** Project shell with bounded proposal/milestone/conversation panels sharing one authorized project projection.

### PAGE-08 — `/dashboard/requests/[id]`

- **Source / boundary:** `app/dashboard/requests/[id]/page.js:1-303`, full Client Component.
- **Auth/access gate:** `useAuth()` redirects unauthenticated users to `/`; request APIs enforce owner/admin access.
- **Server loaders:** None.
- **Browser/API calls:** Request detail/messages/upload/accept/request-changes and notification read through hooks/components.
- **State owner:** `ProjectRequest`, proposal fields/messages and resulting project link are canonical; local accordion state is projection.
- **Metadata:** No request-specific metadata/noindex.
- **404 behavior:** API/load-hook state controls the UI; no route-level `notFound()`.
- **Deep-link behavior:** ID direct link; accept may navigate to `/dashboard/projects/:projectId`; a milestone link can navigate into a project.
- **Existing tests:** Project-lifecycle/API coverage; no complete request-detail browser test found.
- **Coverage gap:** Owner/admin/stranger direct links, accept retry/idempotency UI, recoverable failure versus missing and attachment flow at page level.
- **Risk:** Client-only auth/routing and page-local orchestration blur request discussion, proposal decision and created-project navigation.
- **Ownership seam:** Request read/conversation, proposal decision and formal handoff.
- **Target composition:** Thin request shell with source-linked conversation and explicit authoritative transition projection.

### PAGE-09 — `/dashboard/settings`

- **Source / boundary:** `app/dashboard/settings/page.js:1-202`, full Client Component.
- **Auth/access gate:** `useAuth()` redirects unauthenticated users to `/login` (`page.js:23-25`). No `/login` page exists; current login is a homepage modal.
- **Server loaders:** None.
- **Browser/API calls:** `GET /api/auth/me`, `PUT /api/user/settings`, push subscribe/unsubscribe through `usePush`.
- **State owner:** User notification preferences and push subscriptions are canonical; switches/local ready/saving state are projections.
- **Metadata:** No settings-specific metadata/noindex.
- **404 behavior:** Fixed route; failed preference load silently keeps defaults.
- **Deep-link behavior:** Direct route only; back link returns dashboard.
- **Existing tests:** `usePush` and notification delivery coverage; no settings page test.
- **Coverage gap:** Missing/expired auth, failed initial preference read, optimistic rollback and unsupported/denied push at full-page level.
- **Risk:** Redirect target `/login` is absent and can fall through to the CMS catch-all; silently retained defaults can misrepresent stored preferences.
- **Ownership seam:** Account preference query/command and device push-subscription lifecycle.
- **Target composition:** Authenticated settings shell with explicit load/error state and canonical login entry.

### PAGE-10 — `/invite?token=…`

- **Source / boundary:** `app/invite/page.js:1-447`, full Client Component wrapped in Suspense.
- **Auth/access gate:** Public token preview; logged-out registration/login or logged-in acceptance; project authorization is enforced by invitation API commands.
- **Server loaders:** None.
- **Browser/API calls:** Invitation preview/accept plus auth register/login/logout through direct Axios and `useAuth`.
- **State owner:** Invitation/project membership/user records are canonical; raw token and form/mode/error states are page projections.
- **Metadata:** No invite-specific noindex metadata; robots disallows crawl only.
- **404 behavior:** Missing/invalid/dead token produces in-page states, not route HTTP 404/410.
- **Deep-link behavior:** Captures token into state, then removes it from URL with `history.replaceState` to reduce referrer/history exposure (`page.js:74-101`).
- **Existing tests:** Invitation behavior is covered indirectly in chat/project integration/domain tests; no invite-page token-hygiene browser test found.
- **Coverage gap:** Full register/login/accept permutations, back/refresh after token removal and expired/revoked HTTP semantics.
- **Risk:** A security-sensitive claim flow is entirely client-orchestrated; metadata/noindex and refresh-after-URL-cleaning behavior lack page proof.
- **Ownership seam:** Public invitation preview, auth entry and authorized membership acceptance.
- **Target composition:** Keep one bounded invite flow with server-authoritative token/claim policy and explicit resumability semantics.

### PAGE-11 — `/reset-password?token=…`

- **Source / boundary:** `app/reset-password/page.js:1-118`, full Client Component wrapped in Suspense.
- **Auth/access gate:** Public possession-token flow.
- **Server loaders:** None.
- **Browser/API calls:** `POST /api/auth/reset-password` via `useAuth`.
- **State owner:** Reset token/user password state on the server; form/token/loading state is a projection.
- **Metadata:** No route-specific noindex metadata; robots disallows crawl only.
- **404 behavior:** Missing token produces an in-page invalid-link state; invalid/expired server token produces a toast.
- **Deep-link behavior:** Reads token from query string and leaves it visible in the URL during the flow.
- **Existing tests:** Auth endpoint/hook coverage is indirect; no page/token exposure/browser test found.
- **Coverage gap:** Expired/used token, refresh/history/referrer hygiene, password policy parity and successful redirect as one flow.
- **Risk:** Sensitive token remains in the URL; client validation only checks six-character minimum and may drift from server policy.
- **Ownership seam:** Password-recovery token validation and credential command.
- **Target composition:** Dedicated auth recovery surface with explicit token hygiene and shared validated password contract.

### PAGE-12 — `/verify-email?token=…`

- **Source / boundary:** `app/verify-email/page.js:1-88`, full Client Component wrapped in Suspense.
- **Auth/access gate:** Public possession-token flow.
- **Server loaders:** None.
- **Browser/API calls:** `POST /api/auth/verify-email` via `useAuth`.
- **State owner:** User verification state on the server; local loading/success/error and cached user update are projections.
- **Metadata:** No route-specific noindex metadata; robots disallows crawl only.
- **404 behavior:** Missing/invalid/used token becomes a generic in-page failure.
- **Deep-link behavior:** Reads and retains token in query string; a ref guard prevents Strict Mode duplicate POST in one mount.
- **Existing tests:** Auth API/hook coverage indirect; no email-verification page/deep-link browser test found.
- **Coverage gap:** Token hygiene, reload/replay semantics, stale cached user reconciliation and success/failure navigation.
- **Risk:** A GET page load triggers a state-changing verification POST after hydration and keeps the token visible; cached identity is locally mutated before a canonical refresh.
- **Ownership seam:** Email verification command and authenticated identity projection.
- **Target composition:** Dedicated verification boundary with explicit one-time/idempotency and token-removal behavior.

## 3. Non-page route surfaces affecting page correctness

### SURFACE-01 — `/robots.txt`

- **Source:** `app/robots.js`; public file-convention route.
- **State/loader:** Static policy plus `siteUrl()`; no auth.
- **Behavior:** Allows public crawl and disallows `/api`, `/admin`, `/dashboard`, `/invite`, `/verify-email`, `/reset-password`.
- **Risk/gap:** Robots is crawl guidance, not authorization or a guaranteed `noindex`; no route-output test found.
- **Target seam:** Public SEO routing policy.

### SURFACE-02 — `/sitemap.xml`

- **Source:** `app/sitemap.js`; Server route with `revalidate = 3600`.
- **State/loader:** Direct `CMSPage` and `Project` Mongo reads; degrades to homepage-only on DB error.
- **Behavior:** Includes non-noIndex CMS slugs and every project with a non-empty slug.
- **Risk/gap:** Project publication status is not part of the query; duplicate/reserved slugs and response-output tests are not evidenced.
- **Target seam:** Published URL registry sharing the same publication/reserved-slug rules as page loaders.

## 4. 3G count and explicit gaps

- **Page routes:** 12.
- **Supporting route surfaces:** 2 (`robots.txt`, `sitemap.xml`).
- **Global layout/provider surfaces:** 2 (`app/layout.js`, `providers/QueryProvider.js`).
- **Explicitly absent at this baseline:** `/start`, `/login`, route-level `loading.js`, `error.js`, `not-found.js`, nested dashboard/admin layouts and `proxy.js`.
- **Cross-cutting coverage gap:** No complete page-route/browser suite was found; existing coverage is primarily API/domain/hooks/component-level.
- **3H reconciliation required:** Confirm every page caller against the central API registry and distinguish inherited layout metadata behavior empirically before 3G is closed.

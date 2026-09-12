# TODO — Project Communication Hub

Prateći dokument uz [PROJECT_CHAT_PLAN.md](./PROJECT_CHAT_PLAN.md) (v2).
Ovde se označava šta je urađeno, a šta nije.

## Documentation governance

Documentation is part of the implementation contract.

For every approved code/configuration change:

1. update the relevant canonical documentation in the same work cycle;
2. record what changed, why it changed and the resulting invariant;
3. record verification evidence: tests, build, staging smoke and relevant operational checks;
4. include the date and, after commit, the commit SHA when known;
5. do not mark a milestone or task complete from code alone when its documentation/evidence is stale.

When implementation evidence shows that an existing documented design is incomplete or incorrect:

evidence → decision → documentation update → implementation/approval.

Do not silently change architecture, product semantics, security boundaries or lifecycle behavior without updating the authoritative documentation that defines them.

Legenda: `[ ]` nije urađeno · `[x]` urađeno · `[~]` u toku · `[-]` odloženo / preskočeno uz obrazloženje

Status: **Faza 1 u toku — sekcije 1–12 kod-kompletne, plus 12b/12c/12d/12e i 12f (isporuka notifikacija, chat scroll, pin i optimizacija). Sledeća: Sekcija 13 (finalna verifikacija/regresija) — traži dva browsera i dozvolu za pisanje u pravu bazu.**
Poslednje ažuriranje: 2026-08-08 · **365 testova, sve prolazi**: `npm test` 163 (čiste funkcije, `node --test`) + `npm run test:api` 180 (integracioni, pravi route handleri protiv jednokratne Mongo replike) + `npm run test:ui` 22 (jsdom, chat komponente + zvono). `npm run build` prolazi; `npx tsc --noEmit` čist; `pyright` čist. Sekcije 4, 5, 6 i 10 uživo testirane protiv produkcione baze sa jednorazno kreiranim, potom obrisanim test podacima (uz izričitu dozvolu pre svakog destruktivnog koraka)

v3 dopuna ugrađena pre Sekcije 4: **cross-cutting invarijante I1–I10** (sekcija 3A, razrada u planu 4A) i **životni ciklus projekta / preživljavanje istorije** (plan 5A). Modeli su već usklađeni sa I5 i I10 — `dmKey`, `ProjectMember.name/email`, `ChatRead.clearedAt`, `ClientProject.ownerAccountDeletedAt`.

Sekcija 4: `GET /client-projects[/:id]` scoping+serializer, milestone chat otvoren za članove, `/api/upload` gate, i tri `project-requests` 401→404 ispravke — sve implementirano i verifikovano uživo protiv produkcione baze (admin/owner/stranac, isključivo read-only pozivi + jedan upload bez fajla). Nula regresije potvrđeno na realnim podacima, ne samo unit testovima. Detalji i otkriveno neslaganje dokumentacije (nepostojeća `/api/project-proposals` ruta) u sekciji 4 i 4b niže.

Sekcija 5: kompletan invitations/membership API (7 endpointa), transakcioni accept (I2), `app/invite/page.js`, register-kroz-poziv. **Uživo test od 35 provera** pronašao i potvrdio ispravku pravog bug-a u Mongoose `.create()` pozivu unutar transakcije (detalji ispod).

Sekcija 6: kompletan Chat API (11 endpointa: liste, detalj, poruke, pin, read/clear, DM, edit/delete). **Uživo test od 49 provera, sve prošlo bez ijedne ispravke** — prva sekcija u ovom projektu gde uživo test nije otkrio nijedan bug, verovatno zahvaljujući disciplini uspostavljenoj u prethodnim sekcijama (array-oblik `.create()` pod transakcijom, eksplicitno odsustvo ključa umesto `undefined`).

**Homepage asset maintenance (2026-09-12):** Animirani profilni balončić u Hero sekciji koristi zaseban, kodom definisan prezentacioni asset i ne čita `CompanyProfile.heroImage`. Njegov Cloudinary URL je zamenjen novom profilnom slikom, bez promene postojeće entrance animacije, dimenzija ili Company Profile ugovora. `npm run typecheck` prolazi.

---

# NEW BUSINESS MODEL — Foundation & Platform Expansion

**Status:** Foundation execution in progress. DMD-FND-0, DMD-FND-1, DMD-FND-2 and DMD-FND-2A are complete. DMD-FND-3 is in progress: the complete-system API/page/auth/data/side-effect inventory. This is the execution index, while documents under documentations/new-business-model/ remain the architecture and product contracts.

**Binding architecture:** documentations/new-business-model/ARCHITECTURAL RULES/ARCHITECTURAL_RULES_DMD.md.

**Active Workspace companion:** documentations/new-business-model/DMD_WORKSPACE_VERTICAL_SLICE_EXECUTION_PLAN.md. It explains client-visible slice acceptance without replacing this file's canonical IDs, dependencies or status.

**Language decision:** DMD source remains `.js`, `.jsx` and `.mjs` only. TypeScript examples were copied from a different project and have been removed from the active expansion guidance. Do not add TypeScript files or syntax, and do not perform a typed-JavaScript/JSDoc migration: JSDoc is optional only for non-trivial exported boundaries, not local variables, ordinary props or routine helpers. Zod/JSON Schema are runtime validation, while the existing typescript/tsconfig/typecheck tooling remains a JavaScript build/module-resolution check; neither authorizes TypeScript source or generated TS types.

**Historical evidence:** The Project Communication Hub record beginning at section 0 remains unchanged below. Completion in that historical work never means a new-business milestone is complete.

## Dependency direction

DMD-FND-0 → DMD-FND-1 → DMD-FND-2 → DMD-FND-2A → DMD-FND-3 → DMD-FND-4 gates all new domains. After DMD-FND-4, the Workspace and operational foundation may begin independently, while controlled legacy cleanup proceeds on its own branch:

```text
DMD-FND-4 COMPLETE
      ├──────────────→ DMD-WORKSPACE-0 → DMD-WS-1 ───────┐
      ├──────────────→ DMD-OPS-0 ─────────────────────────┤
      │                                                    ↓
      │                                                 DMD-AI-0
      │                                                    ↓
      │                                                 DMD-BI-1
      │                                                    ↓
      │                                                 DMD-BI-2
      │                                                    ↓
      │                                                 DMD-BI-3
      │                                                    ↓
      │                                                 DMD-PI-1
      │                                                    ↓
      │                                                 DMD-PI-2
      │                                                    ↓
      │                                                 DMD-BP-1
      │                                                    ↓
      │                                                 DMD-DES-0 → … → DMD-DES-6
      │                                                    ↓
      │                                                 DMD-COM-0 → …
      │                                                    ↓
      │                                                 DMD-PROJECT-0 → … → DMD-CONV-0
      └──────────────→ DMD-FND-5 → DMD-FND-6 → DMD-FND-7 → DMD-FND-8
```

`DMD-WORKSPACE-0` and `DMD-OPS-0` do not block one another. `DMD-WS-1` establishes the persistent anonymous conversation/session boundary without AI. Real `DMD-AI-0` begins only after both `DMD-WS-1` and the required `DMD-OPS-0` audit/runtime foundation exist. Legacy extraction remains independent and does not block the new client vertical.

The Workspace is the canonical client projection of the complete lifecycle, not a new source-of-truth aggregate: idea → discovery → design → solution → commercial → project all remain one continuous client experience. The underlying product path is DiscoverySession → Living Understanding → Advisory Brainstorming → Verified Business State → Capability Model → Product Route → Solution Blueprint → Design Strategy → curated handoff → candidate/validation/review → immutable Approved Design Revision → commercial configuration/proposal/acceptance/payment → Project/WorkOrder → evidence → Engineering Projection.

## Global invariants

- AI interprets. The system decides. The engine executes.
- New expansion endpoints use dedicated Route Handlers; app/api/[[...path]]/route.js receives no new branch.
- DMD DB owns business/product/design/commercial/client-decision truth. Repository and CI own code/build/test truth. Frontend is a projection, never authority.
- Auth user payloads have one canonical server-side serializer across register, login, refresh and current-user reads.
- Client-side cached identity is a projection for rendering and request continuity, never identity authority.
- Authenticated self-service routes prefer the authenticated actor resolved from the bearer/session context over a user ID supplied by the browser.
- Every state-changing slice has runtime validation, authorization, version/idempotency rule, audit/evidence, tests, staging deploy and smoke evidence.
- No application code, model, migration or route change is performed by this planning milestone.

## Product Quality Gate

The binding Product Quality Doctrine is defined in `ARCHITECTURAL RULES_DMD.md`.

Global product-quality invariants:

- **System quality is measured at the client outcome, not at the internal execution layer.**
- **Complexity may increase internally only if perceived complexity decreases for the client.**
- **The client expresses intent; the system absorbs complexity.**
- **A feature is MVP-ready only when the full client journey is usable end-to-end.**
- Technical completion does not by itself prove client-outcome readiness.
- Human escape, dead ends, repetition, unclear state and failed recovery are first-class product defects.
- Real non-technical user behavior is required evidence for maturing client-facing workflows.
- Do not optimize one internal layer in isolation when the complete client journey remains weak.

### Canonical client journey

For relevant product-facing milestones evaluate the complete path:

```text
Intent
→ Understanding
→ Guidance
→ Decision / routing
→ Action
→ Execution
→ Evidence
→ Recovery
→ Client confirmation
```

### Client Outcome Score

Use a 0–100 aggregate score for comparable real-user scenarios:

```text
Task Success        30
Ease                20
Clarity             20
Recovery            15
Confidence / Trust  15
----------------------
Total              100
```

Record raw evidence alongside the score where applicable:

```text
completed_without_human
human_escape
dead_end_count
user_repeat_count
ai_recovery_count
wrong_route_count
manual_intervention_count
steps_to_outcome
time_to_outcome
user_ease_score
user_clarity_score
user_confidence_score
```

Do not store model chain-of-thought. Store only operational evidence needed to understand routing, execution, recovery and outcome.

### Quality trend

The desired product trend is:

```text
Client Outcome Score       ↑
Task completion            ↑
Confidence                 ↑
Successful recovery        ↑

Human escape rate          ↓
Dead-end rate              ↓
User repetition            ↓
Wrong routing              ↓
Manual intervention        ↓
Time to useful outcome     ↓
```

### Product-facing milestone gate

Before marking a mature client-facing slice complete, ask:

- Can a non-technical user express the goal in their own words?
- Does the system correctly understand or clarify the intent without unnecessary questioning?
- Can the user reach the useful outcome without knowing internal product architecture?
- Does the system distinguish guidance, configuration, bug, feature request, unsupported request and human escalation where relevant?
- Is current state and next action clear?
- If an execution fails, can the system recover without requiring the user to reconstruct prior context?
- Does the user avoid unnecessary repetition?
- Does the system provide evidence of what happened?
- Is human escalation intentional rather than the user escaping the system?
- Has the journey been exercised in staging?
- For sufficiently mature workflows, has at least one relevant non-technical real user exercised the journey without coaching?

A milestone may be recorded as technically complete while the product-quality gate remains open.

### Dogfood baseline

Use real client projects as controlled dogfood when safe and appropriate.

Initial high-value testers should use DMD as normal users rather than as QA operators.

Do not tell them which internal classification or workflow is expected.

Capture what they naturally try to do, including:

```text
"Ne znam gde da kreiram artikal."
"Ne piše mi ko je zakazao."
"Hoću da se uradi ova funkcionalnost."
"Ovo ne radi."
"Ne znam šta sada treba."
```

The resulting evidence should determine whether the failure belongs to:

```text
UI / discoverability
flow
copy / clarity
AI interpretation
routing
engine execution
missing capability
recovery
state continuity
trust
```

Prioritize improvements that reduce client effort and human escape across the complete journey before expanding feature count without evidence of client value.

## DMD-FND-0 — Documentation and architecture baseline

**Goal:** Reconcile source authority and terminology before any new persistence or route work.

**Source documents:** documentations/new-business-model/ARCHITECTURAL RULES/ARCHITECTURAL_RULES_DMD.md; DMD_PLATFORM_EXPANSION_MASTER_PLAN.md; audit-dmd/DMD_PLATFORM_EXPANSION_MASTER_PLAN.md; audit-dmd/DMD_CURRENT_APP_ARCHITECTURE_AUDIT.md; audit-dmd/DMD_EXTENSION_TARGET_ARCHITECTURE.md; audit-dmd/DMD_EXTENSION_EXECUTION_PLAN_V2.md.

**Dependencies:** None.

**Status:** Complete for staging. The two deferred reconciliation items below gate only the affected later domain contracts, not DMD-FND-1.

**Tasks:**

- [x] Confirm the binding architecture path and preserve the existing TODO history.
- [x] Record JavaScript/JSX-only as the active implementation decision; TypeScript suggestions were removed from the audit execution guidance.
- [x] Record that the root master plan is canonical lifecycle guidance and the audit-master copy is its current-app execution addendum.
- [x] Lock the folder convention: server/http, server/auth, server/db, server/modules/<domain>, server/integrations, server/jobs and server/diagnostics are canonical. lib/ remains for genuinely shared non-domain utilities. The audit proposal lib/application + lib/domain + lib/ai is superseded; do not create both structures.
- [x] Lock canonical aggregate names: DiscoverySession, VerifiedBusinessState, CapabilityModel, ProductRouteDecision, SolutionBlueprint, DesignIntent, DesignAsset, DesignStrategy, DesignJob, DesignCandidate, ApprovedDesignRevision, CommercialConfiguration, WorkOrder, ProjectEvidence, EngineeringProjection and ProductInstanceReference. Versioning is an aggregate property, not a parallel Revision aggregate.
- [-] Reconcile only the remaining lifecycle state enums for DiscoverySession and DesignCandidate immediately before their persistence slices; aggregate naming is no longer open and this does not block staging.
- [x] Lock the preview boundary: Instant Design uses a safe DMD renderer/sandbox and creates no production WorkOrder. Supervised Design may include Claude Design → local supervised Claude Code/Codex → tests/build → Vercel Design Preview Work for client review. Production project execution starts only after ApprovedDesignRevision → ProjectProposal → acceptance → payment → WorkOrder.
- [-] Repair the documentation map when those companion artifacts are intentionally authored; do not invent the currently absent DMD_EVIDENCE_KNOWLEDGE_INTEGRATIONS.md, DMD_IMPLEMENTATION_MILESTONES_TASKS.md, DMD_ENGINEERING_PLAN.md or DMD_IMPLEMENTATION_REPORT.md. Their absence does not block staging.
- [x] Lock React target and sequencing: create staging with current code in DMD-FND-1, capture the React 18 baseline in DMD-FND-2, then upgrade React/React DOM to 19.2+ in isolated DMD-FND-2A before catch-all refactor or Discovery implementation.

**Invariants:** Binding rules prevail until an explicit superseding decision exists; documentation is not implementation.

**Verification:** Every cited existing source path exists; closed decisions match the binding contract, while deferred lifecycle/document companions explicitly gate only their affected later slices.

**Explicitly out of scope:** Code, dependencies, models, migrations and route changes.

## DMD-FND-1 — Isolated staging environment

**Goal:** Create a real staging boundary before large refactoring, AI use or private-data workflows.

**Source documents:** ARCHITECTURAL RULES/ARCHITECTURAL_RULES_DMD.md; audit-dmd/DMD_SECURITY_RELIABILITY_GATES.md; audit-dmd/DMD_CURRENT_APP_ARCHITECTURE_AUDIT.md; DMD_COMMERCIAL_PROVISIONING.md; vercel.json; next.config.js; package.json; current environment-variable inventory (secret values must never be copied into TODO/evidence).

**Dependencies:** DMD-FND-0.

**Status:** `DMD-FND-1 COMPLETE` (2026-09-12). The owner explicitly accepts that Vercel schedules run only on Production deployments: staging proves the isolated digest adapter through an authenticated manual sweep, while the unchanged Production `*/15 * * * *` schedule owns automatic execution. This is an operational environment distinction, not permission for staging to share production data, credentials or providers.

**Tasks:**

- [x] Provision a separate staging frontend/deployment, environment variables, auth/session origins and CORS allowlist. The protected `staging` branch deployment and canonical staging origin are active on the existing `dm-develon` Vercel project.
- [x] Provision a separate staging Mongo database and credentials with no production write authority; never reuse production application credentials. The `staging` Preview branch resolves a distinct Mongo user and `MONGO_URL` plus `DB_NAME=staging-portfolio_db`. The read-only authority re-audit confirms staging write capability and zero production-database write privileges; no destructive production probe was used.
- [x] Add a fail-closed configuration guard: when APP_ENV=staging, reject known production Mongo/resource identities before the application can serve traffic or run a job. Repository guards reject production Mongo, application-origin and Cloudinary identities; staging-only credentials, canonical origin, build and authenticated smoke have passed without weakening those resource boundaries.
- [x] Isolate Cloudinary at provider/account credential level where available. The `staging` Preview branch now uses a physically separate Cloudinary environment and canonical `CLOUDINARY_*` application names; the guard denies explicitly listed production cloud identities without introducing parallel `_STAGING` provider variables. A direct isolated-provider smoke uploaded, resolved and removed one bounded 1×1 asset under the staging folder, without calling the production provider.
- [x] Isolate email and push through staging-only provider credentials while allowing normal staging accounts to exercise verification email, notification email, digest and push like production accounts; keep scheduled cron/job effects explicitly staging-enabled. `STAGING_SAFE_RECIPIENTS` is not a normal-delivery authorization gate and remains only an optional explicit manual/bootstrap override. Separate branch-scoped Resend, VAPID and cron credentials, matching VAPID keys, provider-accepted verification/system email, successful secret-gated digests, user-confirmed test push and user-confirmed normal sender-to-Petra push plus digest are verified. Vercel schedules run only on Production deployments; by explicit owner decision, the protected Preview staging environment uses the same isolated digest path through an authenticated manual sweep, while Production retains the automatic 15-minute schedule.
- [x] Scope `NEXT_PUBLIC_APP_URL`/origin configuration so the `staging` Preview resolves only `https://staging.dmdevelon.website`. The fail-closed guard correctly rejected the inherited production origin during the Vercel build; the Preview value was corrected to the canonical staging origin and that build blocker is resolved.
- [x] Before any future production deployment, restore the required production-only Cloudinary, Resend, VAPID and cron variables without restoring their production values to Preview. The 2026-09-11 Vercel inventory confirms Production-scoped Cloudinary, Resend, VAPID and cron variables are present; no production deployment was triggered. Preview has distinct Cloudinary/VAPID public identities and branch-scoped provider configuration, but Mongo remains an explicit exception/blocker as recorded above.
- [x] Disable POST /api/seed outside explicitly allowed local development, or place it behind an equally explicit authenticated/authorized staging-safe control, before the first staging deployment is declared safe.
- [x] Define fixture/anonymization and production-data protection rules; no casual production DB write or clone. The bounded fixtures copied only the five approved users, all services/public projects, three selected client projects, one historical project membership, one company profile, current testimonials and required CMS pages; tokens were cleared and notification preferences disabled.

**Progress evidence (2026-09-10):** The existing Vercel project `dm-develon` now deploys the Git branch `staging` as a protected Preview and binds it to `https://staging.dmdevelon.website`; the obsolete `dm-develon-staging.vercel.app` origin is not canonical or used by the fixture workflow. Preview has staging-scoped `APP_ENV`, JWT, separate `DB_NAME` and `ALLOW_DB_SEED=false`. The initial smoke observed home and the public services/projects/testimonials/company-profile/CMS APIs returning 200 and `POST /api/seed` returning 404. The 2026-09-11 env audit supersedes the earlier assumption that providers were never inherited: shared provider variables had been visible to Preview and were subsequently removed from Preview scope.

**Fixture evidence (2026-09-10):** One-use, digest-locked and `APP_ENV=staging`-only routes imported exactly 5 approved users (Milan Drazic as admin; Gordana, Sanja, Klaudija and Marjan as users), 10 services, 8 public projects, 3 selected client projects, 1 historical project membership, 1 company profile, 3 testimonials and 4 required CMS pages. The client projects are the live Spiritualized Language Tutor and Sanja Neuer records plus the soft-deleted Psihointegritet record; Marjan's production relationship to Psihointegritet is preserved as `collaborator/removed`, while its former owner account remains deleted. Initial runs inserted the exact sets, repeat runs matched every record with zero inserts/modifications, and required unique indexes exist. Notifications, chat/read data, project messages and audit/history were not copied and their staging counts were verified as zero. Production snapshots/counts and all migrated password hashes were checked after import. Temporary routes and local payloads were removed after verification. A separately scoped restore-and-reassign operation must atomically clear `deletedAt`, `deletedByUserId`, `deletedByName` and `ownerAccountDeletedAt`, set the new owner identity, and add audit evidence; the current generic status/update endpoints do not complete that invariant. Credential-level Mongo isolation, provider boundaries and full authenticated browser smoke remain open; DMD-FND-2 has not started.

**Staging-discovered ClientProject lifecycle capability (2026-09-10):** Dedicated admin-only restore and ownership routes now call a transactional application service rather than extending the universal catch-all. Restore requires an explicit `planning`, `on_hold` or `in_progress` target, clears every soft-delete field, and requires a valid current non-admin owner whenever the project is ownerless. Ownership and membership remain separate: an active collaborator is atomically changed to `removed` when promoted, an already-removed historical membership is retained without duplication, and a global admin receives no owner or membership row merely for operator access. Ownerless projects remain read-only under the central access policy. `ProjectAuditLog` records `project.restored`, `project.owner_assigned` and `project.owner_transferred`; neutral project history records `project_restored` and `ownership_transferred`. The generic project editor can no longer bypass this capability by changing owner snapshots or `clientSlug`.

**Psihointegritet lifecycle smoke (2026-09-10):** The existing DMDevelon solution foundation was adopted by a fictional staging-only client Petra and restored `deleted → in_progress`, preserving its historical asset namespace, one milestone, all 26 tasks and the completed-work hash. Petra's subsequent admin-driven account removal set `ownerAccountDeletedAt`, left the project and work history intact, invalidated her access and returned the project to the existing closed/read-only state. Marjan was then assigned as the current owner; his one historical `collaborator/removed` row remained unchanged and unduplicated, `ownerAccountDeletedAt` cleared, and his current identity could resolve the project through owner access. Audit evidence was `project.owner_assigned`, `project.restored`, then `project.owner_assigned`, with corresponding neutral project events. Spiritualized Language Tutor and Sanja Neuer were unchanged, Milan had zero membership rows, and no production resource was targeted or changed. Reactivation of an already-removed member is not a standalone supported command: the current legitimate route requires a new invitation acceptance, so staging did not bypass it with a direct DB mutation; active-collaborator promotion and rollback remain transaction-covered by integration tests. From adoption onward, scope and milestones continue only through the normal reviewed project-change flow; ownership assignment never resets or silently rewrites historical work. This completes only the bounded lifecycle capability, not DMD-FND-1 or DMD-FND-2.

**FND-1 boundary audit (2026-09-11):** The approved Petra staging account was manually marked email-verified so the real-client dogfooding flow can continue without treating the incorrect verification-link origin as a separate feature task. A read-only Vercel environment inventory then showed that Preview still inherits production-shared `MONGO_URL`, Resend, VAPID, Cloudinary and cron variables; only the staging JWT is branch-scoped, while `APP_ENV` and `DB_NAME` are Preview-scoped overrides. A `connectionStatus`/`showPrivileges` audit, which performed no database write, found that the effective Preview Mongo credential exposes write-capable privileges over the production database identity. Therefore a separate database name is not sufficient isolation and DMD-FND-1 remains open. The repository now contains a fail-closed staging configuration policy, exact email/push recipient allowlisting, explicit staging-cron opt-in and a repeatable read-only Mongo authority audit. These controls must be deployed only after a staging-only Mongo credential is provisioned and the inherited Preview provider variables are removed or replaced with isolated/safely guarded staging configuration. The staging verification link pointing at production remains evidence of the unresolved origin/provider boundary; React baseline work has not started.

**Committed foundation handoff (2026-09-11):** `6f1c351` added the fail-closed staging policy, safe-recipient enforcement for email/push, explicit staging cron opt-in, Mongo startup validation, a read-only Mongo privilege audit command and negative unit coverage; it also added the canonical Client Workspace product-direction document. `b1f2006` made Workspace the canonical client projection in the master plan and added `DMD-WORKSPACE-0` as `NOT STARTED`, hard-gated by DMD-FND-4. `f847451` corrected the database contract so staging uses only the environment-scoped `DB_NAME` (no duplicate `STAGING_DB_NAME`), retained rejection of known production DB names, added the Next.js smooth-scroll marker and corrected the hero profile image to its real `696×762` aspect ratio with responsive sizing. Scoped verification for `f847451` passed `npm test`, `npm run typecheck`, `npm run build` and a local browser console/DOM check; the two reported Next.js browser warnings were absent. This scoped verification is not the fresh DMD-FND-2 baseline.

**Deployment/configuration evidence (2026-09-11):** The Vercel deployments for `6f1c351`, `b1f2006` and the initial `f847451` attempt reached `Error`; the latest attempt compiled and typechecked, then the fail-closed policy intentionally stopped page-data collection with `Staging application URL does not match its canonical origin`. This was not a defect in `/api/client-projects/[id]/restore`: that route was only the first page-data import path to load `lib/mongodb.js` and run the staging policy. Preview had inherited a production `NEXT_PUBLIC_APP_URL`; it is now scoped to `https://staging.dmdevelon.website`, resolving the canonical-origin build blocker without weakening the guard. Current Preview inventory no longer lists Resend, VAPID, Cloudinary or cron credentials. The separate staging-only Mongo credential requirement and complete authenticated/provider smoke remain open, so this resolution alone does not complete DMD-FND-1. No production deployment was triggered.

**Post-fix local verification (2026-09-11):** `npm test` passed 8/8 tests, `npm run test:ui` passed 48/48 tests, `npx tsc --noEmit` reported zero errors and `npm run build` completed compilation, typechecking, page-data collection and static generation, including the restore route. `fallow`/`flow` is not installed and was not fetched implicitly. The API integration runner could not execute assertions because the required local Mongo replica set was unavailable at `127.0.0.1:27077`; all 235 API tests were skipped after the shared connection precondition failed, which remains a local test-infrastructure prerequisite rather than evidence of 11 independent application defects.

**FND-1 re-audit and bounded implementation evidence (2026-09-11, implementation commit `30ec3ee`):** The branch remains `staging` from starting SHA `9a5d274`. Vercel configuration now contains canonical branch-scoped Cloudinary, Resend, VAPID and cron variables, `STAGING_SAFE_RECIPIENTS`, `STAGING_CRON_ENABLED=true` and `PRODUCTION_CLOUDINARY_NAMES`; Production-scoped Cloudinary, Resend, VAPID and cron variables are also present, and no Production deploy was requested. Application code now resolves all verification, password-reset, invitation, notification and digest URLs through one fail-closed application-origin boundary; the remaining project-status template no longer hardcodes the production URL. Regression tests prove staging links resolve to `https://staging.dmdevelon.website` and reject the production origin. The Cloudinary guard keeps canonical provider names, requires an explicit folder and a production-identity deny list, and accepts the physically isolated staging provider. A direct provider smoke uploaded, read back and removed one bounded 1×1 asset from `portfolio-staging/fnd1-smoke`; the staging and production cloud identities are distinct and no production Cloudinary call was made. Preview VAPID public/server keys match, the required key shapes are present, and staging provider credentials are separately scoped; true browser push delivery remains unverified. Protected-deployment cron calls with a missing and deliberately wrong secret both returned 401; a correct-secret run was not attempted against the old deployment because it predates the final branch configuration and still has the unsafe Mongo authority. `npm test` passed 8/8 test files, `npm run test:ui` passed 48/48 tests, `npm run typecheck` passed, and `npm run build` passed outside the filesystem sandbox after the sandbox-only Turbopack port-bind denial. `npm run test:api` could not reach the required local replica set at `127.0.0.1:27077`: 11 suites failed their shared setup and all 235 assertions were skipped, so this is not recorded as a pass.

**FND-1 blocking verdict (2026-09-11):** `DMD-FND-1 REMAINS OPEN`. The pulled `staging` Preview and Production configurations resolve an identical `MONGO_URL`; the repository's read-only `connectionStatus`/`showPrivileges` audit then fails with `Staging Mongo credentials expose write-capable production privileges`. This contradicts the intended external provisioning state and blocks deployment, authenticated browser smoke, live Resend delivery, real VAPID delivery and a successful staging cron execution. The staging-only Mongo credential must be assigned specifically to Preview branch `staging`, after which the authority audit must report zero production write privileges and the deferred live smoke must be run. DMD-FND-2 has not started.

**Mongo isolation re-audit — superseding current state (2026-09-11):** A fresh Vercel pull for `Preview (staging)` and Production now resolves distinct `MONGO_URL` values, distinct authenticated Mongo users and distinct database identities (`staging-portfolio_db` versus `portfolio_db`). `node --env-file=<temporary-preview-env> scripts/verify-staging-mongo-authority.mjs` connected successfully and reported one authenticated user, five checked privilege entries and `productionWritePrivileges: 0`. A second read-only privilege summary confirmed two staging write-capable privilege entries and zero production write-capable entries, while `ping` against `staging-portfolio_db` succeeded. No database write or destructive production probe was performed. This closes the Mongo task and supersedes only the Mongo blocker in the preceding historical verdict; DMD-FND-1 as a whole remains open for the separately recorded provider/authenticated staging smoke.

**API integration re-run (2026-09-11):** After the local `dmd-test-mongo` replica set became available, `npm run test:api` completed normally outside the sandbox network restriction: 11/11 test files and 235/235 assertions passed in 27.98s, with zero skipped tests. The expected stderr entries are exercised negative authorization/validation paths, not failures. This supersedes only the earlier local-test-infrastructure limitation; it does not by itself complete the remaining FND-1 provider/authenticated staging smoke.

**Authenticated user identity regression (2026-09-11, implementation commit `0aaa287`):** The production `PUT /api/users/undefined` incident was traced to `/api/auth/me` replacing the cached login payload with a raw user shape that lacked the canonical `id`, while token-derived project APIs continued to work. `/api/auth/me` now returns the same `authUserPayload` contract as register, login and refresh, including the notification preferences consumed by settings. Client identity resolution is centralized as `user?.id ?? user?._id`; avatar, profile update, account deletion and testimonial ownership use that result, and identity absence fails before avatar file encoding or `/api/upload`, preventing a new orphan asset. Settings remains token-scoped and required no ID-bound route change. Cloudinary code and credentials were not changed. This is intentionally a compatibility fix for the existing FND-1 contract, not authorization by a client-supplied identity: replacing self-update calls such as `PUT /api/users/:userId` with an actor-resolved current-user endpoint is deferred to the bounded FND-4/API extraction task below. Local verification passed the focused auth/API regressions, `npm test` (8/8 files), `npm run test:ui` (50/50 assertions), `npm run test:api` (12/12 files, 236/236 assertions), `npm run typecheck` and the production build. The following staging smoke completes deployment evidence for this bounded fix; no production deployment is authorized by this evidence.

**Authenticated user identity staging smoke (2026-09-11):** Preview deployment `dpl_7CrDi2UwYhXTEbR3uEygShE1k3Zt` reached Ready and held the canonical `https://staging.dmdevelon.website` alias. A bounded staging-only account completed register → authenticated `/api/auth/me` → canonical-ID profile `PUT`; `/api/auth/me` returned exactly the locally locked keys with equal `id` and `_id`. The temporary account was deleted successfully in the same smoke. This test deliberately did not call `/api/upload` or Cloudinary; the no-ID pre-upload behavior is covered by the UI regression. No production deployment or production resource was targeted.

**Staging outbound-delivery and account-provenance evidence (2026-09-11, implementation commits `4fdc813` and `0ec875d`):** Normal staging verification, notification, digest and push adapters no longer consult `STAGING_SAFE_RECIPIENTS`; the optional list is retained only behind an explicitly invoked manual/bootstrap helper. Isolation remains fail-closed at the staging database, application origin and provider-credential boundaries. Newly registered accounts receive server-authored `accountOrigin`, `registeredAt` and, only after actual verification or trusted invitation acceptance, `verifiedAt`; these values are serialized by the canonical auth payload, cannot be changed through profile update and are never authorization or delivery inputs. Local verification passed `npm test` (9/9), `npm run test:ui` (52/52), `npm run test:api` (12/12 files, 236/236 assertions), `npm run typecheck` and the production build. Staging Resend recorded an accepted verification message and accepted a bounded system-email probe to the explicitly approved Petra staging account. After explicit approval to process all three existing pending staging digest rows, the branch-scoped cron secret was rotated without exposure, Preview deployment `dpl_4WjRKwWxkFwtNBnBFdfXvzbGiq8v` reached Ready, and the authorized cron returned `sent=1, processed=3`; Resend recorded the project digest as accepted. The user confirmed that test push reaches the device. A stale VAPID-bound subscription had first returned 401 and was pruned as designed; after re-subscription the approved Petra account has one subscription and both delivery preferences enabled. Its delivery metadata contains no notification rows, so the reported absence of push for ordinary activity is not evidence of provider failure: no event targeted that account. A sender-to-Petra event-driven delivery smoke remains open, and the user reports that the delivered test notification does not display its icon even though the configured 192×192 icon and 72×73 badge assets resolve in the repository. DMD-FND-1 therefore remains open and DMD-FND-2 has not started. No production deployment or resource was changed.

**Normal event delivery smoke and completion decision (2026-09-12, implementation commit `4efeebb`):** A real message from another staging account created an unread Petra notification, but Mozilla Push returned 401 for the browser's stale subscription and the server correctly pruned it without falsely stamping `pushedAt`. Firefox did not expose `PushSubscription.options.applicationServerKey`, so key comparison alone could repeatedly restore the stale endpoint. The client now records the public VAPID key used to save the origin's subscription and rebuilds once when that marker is absent or changed; the value is public configuration, not a credential. Three focused regressions cover missing, current and changed markers. Local verification passed UI 55/55, unit 9/9, typecheck and the production build; API integration could not be rerun in this final bounded change because the local Docker daemon was unavailable, while the preceding 236/236 API result remains the latest API baseline. Preview deployment `dpl_73w5XGtapNJyDKZkMA25f2XU9TnP` reached Ready and passed `/api/health`. After reload/re-subscription, a second normal message created an unread `chat_message`, its push was accepted and `pushedAt` was stored; the user confirmed receipt in Firefox. The same notification remained pending for email while the user was offline. With explicit authorization for every pending staging recipient, staging-only cron credentials were refreshed without exposing their values, Preview deployment `dpl_5e58g6M1xw5R6n3SZCK74ep7fCaR` reached Ready, the authenticated digest returned `sent=1, processed=2`, Resend recorded `email.accepted`, `emailedAt` was stored and the user confirmed the digest arrived at the approved Petra staging inbox. The missing notification icon is a presentation defect and did not block delivery. No production deployment or production provider was touched. The provider, policy and normal-user journey pass end-to-end. The owner explicitly accepted manual authenticated staging execution as the Preview equivalent of the Production-only Vercel schedule; the isolated adapter and cron authorization are the same, while automatic timing remains a Production concern. This closes `DMD-FND-1` and opens `DMD-FND-2`.

**Branch status (2026-09-10):** The Git branch `staging` exists from the current `main` baseline and is the branch for all further foundation work. The canonical domain is permanently bound to this branch on the `dm-develon` project. The obsolete `dm-develon-staging` Vercel project and all of its deployments were permanently removed after its unrelated `main` deployment failed without `MONGO_URL`; the canonical `dm-develon` staging Preview remained healthy.

**Invariants:** A staging deployment must not possess or resolve credentials/configuration that can accidentally write to production resources. Invalid, ambiguous or production-pointing staging configuration fails closed. Normal staging users use only staging DB/provider resources but receive the same verification, notification, digest and push behavior as production users; recipient provenance and optional bootstrap allowlists are not authorization mechanisms. Any future provider must be environment-isolated before activation, but FND-1 creates no placeholder credentials or setup for unused providers.

**Verification:** Negative configuration tests reject known production Mongo/resource identities under APP_ENV=staging; credential authority and provider/account or guarded namespace boundaries prove isolation before smoke testing. Normal-user verification email, digest and push, optional manual/bootstrap recipient control, cron behavior and seed denial are exercised, and smoke evidence confirms no production resource was reachable for writes.

**Explicitly out of scope:** React upgrade, catch-all extraction, production promotion, production-data migration, automatic provisioning, future AI-provider configuration and future GitHub/evidence webhook configuration.

**Deferred ownership:** AI-provider environment configuration belongs to DMD-AI-0. GitHub/evidence webhook configuration belongs to DMD-PROJECT-3.

## DMD-FND-2 — Fresh current-system baseline

**Goal:** Establish reproducible legacy behavior and test evidence that expansion must preserve.

**Source documents:** audit-dmd/DMD_CURRENT_APP_ARCHITECTURE_AUDIT.md; audit-dmd/DMD_FRONTEND_BACKEND_IMPLEMENTATION_MAP.md; ARCHITECTURAL RULES/ARCHITECTURAL_RULES_DMD.md.

**Dependencies:** DMD-FND-1.

**Status:** COMPLETE (2026-09-12). Canonical evidence: `audit-dmd/DMD_FND_2_CURRENT_SYSTEM_BASELINE.md`.

**Tasks:**

- [x] Record fresh results for npm test, npm run test:api, npm run test:ui, npm run build and npm run typecheck; never reuse historical TODO counts as fresh evidence. Unit 9/9, API 12/12 files and 236/236 tests, UI 8/8 files and 55/55 tests, typecheck and build are freshly green. API stderr contains the expected negative authorization/validation paths exercised by passing assertions, not suite failures.
- [x] Record that no lint script/config currently exists and make an explicit lint-gate decision before requiring one. FND-2 does not invent a green lint result or add a linter as unrelated baseline work; lint adoption requires its own explicit configuration decision before it becomes a required gate.
- [x] Define staging smoke journeys for login/auth, project request, proposal access, client project, chat, CMS, notifications, admin and dashboard in the canonical FND-2 baseline document.
- [x] Capture contract/authorization behavior for each journey touched by a later slice and name existing coverage gaps in the canonical FND-2 baseline document.
- [x] Capture the React 18 login observation that one login/page mount currently produces approximately 17 successful `GET /api/auth/me` requests in development. It is recorded as a known client-auth ownership/performance gap, not as 17 server-side retries or a completed regression baseline.
- [x] Preserve existing ProjectRequest, ProjectProposal, ClientProject, ProjectItem, chat, central access and notification foundations. FND-2 changes documentation/evidence only; no domain, route, model or UI behavior is changed.

**Fresh baseline evidence (2026-09-12):** Application baseline `4efeebb` resolves Node 24.13.1, npm 11.14.1, Next 16.2.10, React/React DOM 18.3.1, Mongoose 8.24.1, Vitest 2.1.9 and TypeScript checker 5.9.3. Fresh `npm test` passed 9/9 files, API integration passed 12/12 files and 236/236 tests in 28.85s, UI passed 8/8 files and 55/55 tests, typecheck passed and the production build compiled, typechecked and generated all 16 registered routes. API stderr contains the expected negative authorization/validation paths exercised by passing assertions, not failures. No lint script or configuration exists, so lint is explicitly not claimed or required until a separately bounded lint decision defines it. Read-only staging checks passed 14/14: the landing and six public API surfaces returned 200, a deliberately missing CMS slug returned 404, and anonymous auth/request/project/chat/notification/users calls returned 401. Authenticated role journeys remain open exactly as shown in the canonical baseline document; no implementation behavior changed during capture.

**Authenticated staging completion evidence (2026-09-12):** Preview deployment `dpl_7EaC9UXKa8Tp6AVu6V4d78WbStCF` passed the staging-only `scripts/fnd2-authenticated-staging-smoke.mjs` matrix with temporary admin, owner, collaborator, viewer and outsider identities. Login, canonical `/auth/me`, refresh, logout invalidation, project/request access, proposal draft visibility/send, chat read/write boundaries, account-scoped notifications, settings persistence and admin/non-admin boundaries all returned their expected `200/201/401/403/404` contracts. The final run performed its own cleanup and reported zero fixture residue; an independent prefix audit also returned zero across users, projects, requests, memberships, channels, messages, proposals and notifications. All temporary recipients used `@example.invalid` with email/push disabled, and the smoke avoided client-originated actions that would notify real staging admins or create Cloudinary folders. Automated browser navigation reached Vercel Preview SSO, so no SSO credential or protection cookie was extracted or bypassed. The owner then personally completed the authenticated staging UI journeys and accepted the client outcome. This supplies the previously missing rendered login/reload and role-page evidence, closes DMD-FND-2 and permits DMD-FND-2A. Canonical detail is recorded in `audit-dmd/DMD_FND_2_CURRENT_SYSTEM_BASELINE.md`.

**Invariants:** Legacy records with no new-business references remain usable; accepted proposal/history is not replaced.

**Verification:** Baseline output and staging smoke evidence are attached before extracting a touched legacy contract.

**Explicitly out of scope:** Declaring broad legacy coverage complete without running it.

## DMD-FND-2A — React 19.2 compatibility slice

**Goal:** Align the runtime with the binding React 19.2+ contract as one isolated compatibility change after the current baseline is known.

**Source documents:** documentations/new-business-model/ARCHITECTURAL RULES/ARCHITECTURAL_RULES_DMD.md; audit-dmd/DMD_CURRENT_APP_ARCHITECTURE_AUDIT.md; package.json; tsconfig.json.

**Dependencies:** DMD-FND-2.

**Status:** COMPLETE (2026-09-12). React and React DOM are pinned to `19.2.8`; no application-domain, route or page-refactor change is included. The UI test environment now clears Radix's temporary body pointer lock after each test because jsdom has no CSS animation engine to emit the post-unmount animation event that React 19/Radix presence cleanup awaits. This is test-environment compatibility only, not runtime UI behavior. The owner confirmed completion of staging testing against the React 18 baseline and reported no remaining regression blocking DMD-FND-3.

**Tasks:**

- [x] Upgrade only React and React DOM to the binding-compatible 19.2+ versions and record any necessary peer/runtime compatibility changes. `react` and `react-dom` resolve to `19.2.8`; the lockfile resolves React-19-compatible peer variants where required.
- [x] Run npm test, npm run test:api, npm run test:ui, npm run typecheck and npm run build. Unit 9/9, API 12 files and 236/236 tests, UI 8 files and 55/55 tests, typecheck and production build passed locally.
- [x] Run the complete DMD-FND-2 staging smoke suite and compare it with the captured React 18 baseline. Completed and confirmed by the owner on staging.
- [x] Record regressions and resolve them inside this bounded compatibility slice before DMD-FND-3/new vertical-slice work proceeds. Owner confirmation records no remaining regression blocker.

**Invariants:** Do not combine this upgrade with catch-all extraction, page decomposition, Discovery implementation or TypeScript source introduction.

**Verification:** All relevant tests/build pass and staging smoke preserves auth, requests/proposals, projects, chat, CMS, notifications, admin and dashboard behavior.

**Explicitly out of scope:** Next.js migration, route refactor, UI redesign and new business-domain code.

## DMD-FND-3 — Complete System Inventory

**Goal:** Produce one complete, evidence-based API/page/auth/data/side-effect migration map before endpoint extraction or the FND-4 security/architecture shell is scoped.

**Source documents:** ARCHITECTURAL RULES/ARCHITECTURAL_RULES_DMD.md sections 2.1, 9 and 61–63; audit-dmd/DMD_CURRENT_APP_ARCHITECTURE_AUDIT.md; audit-dmd/DMD_EXTENSION_TARGET_ARCHITECTURE.md.

**Dependencies:** DMD-FND-2A.

**Status:** IN PROGRESS — 3G complete, 3H in progress, 3A–3F and 3I not started (2026-09-12). No runtime mutation is authorized.

**Status evidence rule:** A submilestone advances only on a durable artifact committed under `documentations/`. Intent, delegation, an in-flight analysis session or a spawned agent is not `IN PROGRESS`, and an unrecorded reading pass is not evidence. When no artifact exists, the submilestone is `NOT STARTED` regardless of how much informal analysis preceded it.

**Execution rule:** `Parallel discovery / read-only analysis = YES. Parallel architectural mutations / extraction = NO.` Domain audits may gather evidence in parallel, but FND-3 performs no endpoint extraction, auth/routing refactor, page decomposition or other runtime mutation. Integration suites may run concurrently only with isolated databases, separate fixture namespaces and proven independence; otherwise use parallel read-only audit, reconciliation and one canonical integration/full-suite verification.

**Canonical submilestones:**

- [ ] **3A — Public / Marketing / CMS:** public catalog, services, projects, testimonials, company profile, categories, contact/request entry points, homepage, `HomeClient`, metadata, public loaders and CMS catch-all behavior.
- [ ] **3B — Auth / Session / Access:** login/register/reset/verify/refresh/logout, `GET /api/auth/me`, users/settings, access-token ownership, refresh-cookie behavior, every direct/nested `useAuth()` consumer, server authentication, resource authorization, client UX gates, redirects and duplicated identity/session resolution.
- [ ] **3C — Uploads / Assets:** Cloudinary/media dependencies, image/PDF flows, public/private assumptions, validation, ownership, provider side effects and future Design Asset seams.
- [ ] **3D — Notifications / Cron / Operational endpoints:** health/system operations, notifications, email/digest, push, cron entry points, secrets, delivery side effects and operational ownership.
- [ ] **3E — Project Requests / Proposals / Client Projects:** request/proposal/project lifecycle, accepted scope, milestones/tasks, membership/invitations, access/resource ownership, transactions and audit/history.
- [ ] **3F — Communication / Chat / DM / Project Items:** milestone `Ask a question`, group channels, direct messages, reads/pins, message conversion, `ProjectItem`, permissions and notification/evidence relationships.
- [x] **3G — Dashboard / Admin / Application Pages:** every relevant route surface, including admin, dashboard, project/request detail, chat/DM and auth-related pages; map Server/Client boundaries, loaders/browser calls, state ownership, deep links and real decomposition seams. **Evidence:** `audit-dmd/DMD_FND_3_PAGE_INVENTORY.md` (2026-09-12) records 12 page routes, 2 supporting route surfaces and 2 global layout/provider surfaces. Its own caller/metadata reconciliation against the central API registry is carried by 3H/3I, not reopened here.
- [~] **3H — Central Legacy API Registry & Completeness Audit:** this is the single registry populated by 3A–3G, not an eighth duplicate domain audit. Reconcile every HTTP method, catch-all branch and matcher/branch order; include `OPTIONS`, separate `/api/seed`, existing dedicated ownership/restore routes and any other reachable API route. Prove the registry count matches source and no endpoint remains only implicit in a domain note. **Current state:** `audit-dmd/DMD_FND_3_API_INVENTORY.md` (2026-09-12) holds the completeness method, row schema, global dispatcher facts, route-surface control table and initial cross-cutting risks. Section 5 exact endpoint rows are empty and the exact endpoint count remains `UNKNOWN — requires follow-up`.
- [ ] **3I — Reconciliation / Risk Map / Migration Map:** reconcile cross-domain findings, explicit unknowns, source-of-truth ownership, side effects, coverage gaps, risk and future seams; only this pass may recommend the exact FND-4 scope and whether DMD currently needs `proxy.js` for identified coarse request/security boundaries.

### FND-3 evidence ledger

Canonical status is the table below. A submilestone may not be reported complete or in progress anywhere else in this repository against a different value.

| Submilestone | Status | Durable artifact |
|---|---|---|
| 3A Public / Marketing / CMS | NOT STARTED | none |
| 3B Auth / Session / Access | NOT STARTED | none |
| 3C Uploads / Assets | NOT STARTED | none |
| 3D Notifications / Cron / Operational | NOT STARTED | none |
| 3E Project Requests / Proposals / Client Projects | NOT STARTED | none |
| 3F Communication / Chat / DM / Project Items | NOT STARTED | none |
| 3G Dashboard / Admin / Application Pages | COMPLETE | `audit-dmd/DMD_FND_3_PAGE_INVENTORY.md` |
| 3H Central Legacy API Registry | IN PROGRESS | `audit-dmd/DMD_FND_3_API_INVENTORY.md` (method/schema/risks only; endpoint rows empty) |
| 3I Reconciliation / Risk Map / Migration Map | NOT STARTED | none |

**DMD-FND-3 overall: IN PROGRESS.**

3G completing before 3A–3F is a recording order, not a dependency inversion: the page inventory is a static route-surface record, while 3A–3F are domain evidence inputs that 3H merges and 3I reconciles. 3G is not closed against the central API registry until 3H resolves its callers.

These boundaries are organizational, not assumptions about ownership. When evidence shows that a source belongs elsewhere, classify it by actual ownership and record the reason rather than forcing it into the initial category.

### Central API inventory contract

Every exact endpoint/method record uses:

```text
exact method + path/pattern
→ source file / source branch
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

`risk` remains a separate field, not hidden inside general debt. Unknown facts are recorded exactly as `UNKNOWN — requires follow-up`; they are never inferred without evidence.

### Central page inventory contract

HTTP endpoints and pages remain separate registries. Every relevant page/application surface uses:

```text
URL / route surface
→ source file
→ Server / Client Component boundary
→ auth/access gate
→ server loaders
→ browser/API calls
→ state owner
→ metadata behavior
→ 404 behavior
→ deep-link behavior
→ existing tests
→ coverage gap
→ risk
→ ownership seam
→ target composition
```

The inventory is not limited to the initially named surfaces; the audit adds every material page/application surface it discovers.

### Auth and Proxy decision boundary

FND-3 distinguishes `authentication ≠ authorization ≠ client-side UX gate` and documents duplicated protection without repairing it. The current browser-owned access token and refresh-cookie behavior are evidence inputs; FND-3 must not change auth merely to enable Proxy.

The binding Proxy rules describe how `proxy.js` must be built **if adopted**. They do not require FND-4 to implement it regardless of evidence. FND-3 maps existing route families, what credentials/context the server request boundary can actually observe, which coarse gaps Proxy could address and what must remain in Route Handler/application/domain authorization. Do not invent matchers for absent routes such as the future `/start` Workspace surface.

### 3I completion gate

`DMD-FND-3 COMPLETE` requires all of the following, not merely individually finished 3A–3H notes:

- **API completeness:** every endpoint, method, dispatcher branch and relevant ordering rule is recorded.
- **Page completeness:** every material page/application surface and ownership boundary is recorded.
- **Auth completeness:** authentication, authorization and client UX gating locations are distinguished.
- **Data ownership:** the canonical source of truth for every important workflow is known or explicitly unknown.
- **Side effects:** email, notification, upload, cron and provider effects are mapped.
- **Risks:** every known architecture, security and data-integrity risk has explicit evidence.
- **Migration seams:** every major legacy ownership block has a proposed future architectural boundary.
- **Unknowns:** unresolved questions are explicit; no assumption is recorded as fact.

Only after 3I proves this gate may FND-3 be marked complete and the exact FND-4 scope—including the evidence-based Proxy adoption decision—be defined.

**Invariants:** The catch-all is frozen against new branches. No endpoint migrates before its complete row and regression contract exist; the public CMS catch-all is not a business-router precedent. FND-3 documents current reality and does not change it.

**Verification:** Central API registry count equals all reachable dispatcher/dedicated branches with no unclassified row; page registry covers every material surface; 3I closes or explicitly records every cross-domain gap and unknown.

**Explicitly out of scope:** Runtime code, `proxy.js`, route/auth changes, endpoint extraction, page decomposition, tests added solely for implementation behavior, big-bang rewrite or catch-all deletion.

### Required protocol for every DMD-FND-5 through DMD-FND-8 extraction

The migration unit is one exact HTTP method + path contract, not a whole domain or a newly invented API platform. Process the DMD-FND-3 inventory sequentially: the next endpoint does not enter extraction until the current endpoint has completed this protocol.

1. [ ] Identify one endpoint inventory row.
2. [ ] Confirm and document its current HTTP contract, authorization, callers and side effects.
3. [ ] Confirm existing regression coverage or add the missing regression test.
4. [ ] Extract its business/application logic from the catch-all into the canonical server/modules/<domain> boundary.
5. [ ] Add a thin dedicated app/api/**/route.js adapter for the same URL and method.
6. [ ] Preserve observable behavior unless a separately approved/versioned change says otherwise.
7. [ ] Run the relevant tests and full build.
8. [ ] Deploy to staging and smoke-test the affected DMD-FND-2 journey.
9. [ ] Only after the endpoint is green, remove that exact method + path branch from the catch-all.
10. [ ] Update the inventory and commit contract/test/build/staging evidence before selecting the next endpoint.

The catch-all remains a temporary compatibility layer for every endpoint not yet migrated and is deleted only when its inventory reaches zero. New Business Intelligence endpoints do not enter the catch-all or wait for its retirement: after DMD-FND-4 they are created directly as dedicated routes backed by server/modules/<domain>, while legacy extraction continues sequentially on the parallel foundation branch.

## DMD-FND-4 — Security and architecture shell

**Goal:** Establish safe dedicated-route and private-data foundations before new domains.

**Source documents:** ARCHITECTURAL RULES/ARCHITECTURAL_RULES_DMD.md; audit-dmd/DMD_CURRENT_APP_ARCHITECTURE_AUDIT.md; audit-dmd/DMD_SECURITY_RELIABILITY_GATES.md; audit-dmd/DMD_EXTENSION_TARGET_ARCHITECTURE.md.

**Dependencies:** DMD-FND-1, DMD-FND-2 and DMD-FND-3.

**Tasks:**

- [ ] Remove JWT default-secret fallback and validate required server environment fail-closed.
- [ ] Replace wildcard CORS with one explicit same-origin/allowlist policy; do not copy legacy headers into new routes.
- [ ] Implement only the DMD-FND-0-ratified JavaScript HTTP/auth/application/domain/repository boundaries, stable problem responses, correlation IDs and runtime validation.
- [ ] Extract authenticated profile/avatar self-update as one bounded actor-resolved contract, preferring `PATCH /api/auth/me` or `PATCH /api/users/me`: the server derives the target user from the authenticated actor and the browser never submits its own user ID. Preserve the current `PUT /api/users/:userId` compatibility fix until the replacement has contract tests, caller migration, staging smoke and explicit retirement evidence; do not broaden DMD-FND-1 into this refactor.
- [ ] Define idempotency/rate-limit policy, secure secret input, private asset classes, SSRF controls and prompt-injection boundary.
- [ ] Keep provider credentials server-only and route handlers thin.

**Invariants:** JavaScript/JSX only; Route Handlers are adapters, not Mongoose/provider/workflow containers.

**Verification:** Missing secrets fail closed; new routes have no wildcard CORS; auth/validation/private-asset/security tests pass on staging.

**Explicitly out of scope:** Full auth rewrite, provider integration and new domain model.

## DMD-WORKSPACE-0 — Canonical client Workspace shell

**Status:** NOT STARTED — gated by `DMD-FND-4 COMPLETE`.

**Goal:** Establish the first product-facing expansion slice: one continuous client Workspace from idea through future Project Mode, while deeper systems still use bounded fixture projections.

**Source documents:** documentations/new-business-model/DMD_CLIENT_WORKSPACE_PRODUCT_DIRECTION.md; DMD_PLATFORM_EXPANSION_MASTER_PLAN.md; ARCHITECTURAL RULES/ARCHITECTURAL_RULES_DMD.md.

**Dependencies:** `DMD-FND-4 COMPLETE`. Design discussion and prototypes may continue earlier, but production implementation must not start before this gate is closed. DMD-FND-5 through DMD-FND-8 may continue as the controlled parallel legacy-cleanup branch.

**Tasks:**

- [ ] Update the primary public CTA to start with the client's idea and keep portfolio/projects as the secondary path.
- [ ] Replace the current CodeReview/New Extra Services explanation with the canonical idea → discovery → design → solution → commercial → project journey.
- [ ] Add the public fullscreen Workspace route and shell with clear return-to-home navigation and visible guest state.
- [ ] Implement a resizable desktop conversation/work-area split and a mobile `Chat | Preview` state switch that preserves both sides.
- [ ] Add explicit Desktop / Tablet / Mobile preview controls; resizing alone is not the responsive-preview contract.
- [ ] Project bounded fixture conversation, business-understanding and design-preview states to validate the interaction model without inventing backend truth.
- [ ] Preserve layout space for future allowance/unlock and Project Mode states without implementing their economics or workflows.
- [ ] Verify desktop/mobile accessibility, navigation, state preservation and absence of console errors on staging.

**Invariants:** Workspace is the canonical client-facing projection, not a new aggregate or source of truth. Dashboard remains the authenticated navigator and ownership surface; Workspace is where lifecycle work happens. The shell may project only fixture or authorized canonical state and must not infer lifecycle transitions in the frontend. DMD is not a generic page builder.

**Verification:** A guest can move from the primary CTA into the responsive Workspace shell, use conversation/preview modes across desktop and mobile, return home and observe stable fixture state; staging evidence confirms no real AI/provider call, persistence mutation, payment or project automation occurred.

**Explicitly out of scope:** Real AI calls, AgentRun infrastructure, DiscoverySession persistence, payment/preview charging, Product Intelligence, Design Engine execution, proposal generation, project automation, arbitrary canvas/page-builder controls, multiple generated design variants and final preview economics.

## DMD-FND-5 — Operations, auth and users extraction

**Goal:** Extract health, cron, auth/session, user/settings and seed safety sequentially.

**Source documents:** ARCHITECTURAL RULES/ARCHITECTURAL_RULES_DMD.md; audit-dmd/DMD_CURRENT_APP_ARCHITECTURE_AUDIT.md; audit-dmd/DMD_SECURITY_RELIABILITY_GATES.md.

**Dependencies:** DMD-FND-4.

**Tasks:**

- [ ] Process health, cron/email-digest, auth/*, users/* and user/settings inventory rows one endpoint at a time through the required protocol.
- [ ] When the `GET /api/auth/me` inventory row is selected, preserve its access-token/refresh-cookie contract, add regression coverage, extract it to a thin dedicated `app/api/auth/me/route.js` adapter and then consolidate client ownership behind one shared `AuthProvider`. `useAuth()` consumers must read shared state, while callers needing only request headers must not mount a complete auth synchronization lifecycle. Do not disable Strict Mode to hide duplicate calls.
- [ ] Give cron a dedicated signed/secret-validated application-job boundary.
- [ ] Preserve access-token/refresh-cookie behavior until its separately approved hardening migration.
- [ ] Permanently extract or remove the already-contained seed endpoint; place any retained behavior behind a dedicated route and the canonical server/application boundary. FND-1 containment is a prerequisite, not a substitute for this migration.

**Invariants:** Auth/session semantics are not casually changed during extraction; cron is safe/idempotent in staging.

**Verification:** Auth/session, cron authorization and staging smoke contracts pass before each legacy branch is removed.

**Explicitly out of scope:** Discovery identity model.

## DMD-FND-6 — CMS, public catalog, upload and notification extraction

**Goal:** Isolate public/content/media/notification concerns before they support discovery and design.

**Source documents:** ARCHITECTURAL RULES/ARCHITECTURAL_RULES_DMD.md sections 22–26 and 45–47; audit-dmd/DMD_CURRENT_APP_ARCHITECTURE_AUDIT.md.

**Dependencies:** DMD-FND-5.

**Tasks:**

- [ ] Process uploads/downloads, services, public projects, testimonials, company profile, contact messages, categories, CMS, notifications and push inventory rows one endpoint at a time through the required protocol.
- [ ] Migrate CMS to server loader, publication/reserved-slug/real-404 and same-revision metadata/body behavior.
- [ ] Preserve robots/sitemap, notification policy/dedupe and safe push diagnostics.
- [ ] Replace unsafe raw CMS rendering only under explicit sanitize/structured-block policy.

**Invariants:** Cloudinary owns bytes/delivery; DMD owns semantics/authorization. Clients never receive internal notification/process details.

**Verification:** CMS/SEO/slug/upload/notification regressions and staging recipient safety pass.

**Explicitly out of scope:** DesignAsset semantics and new design events.

## DMD-FND-7 — Project, proposal, membership, chat and item extraction

**Goal:** Extract established project/communication domains without weakening authorization, history or evidence.

**Source documents:** ARCHITECTURAL RULES/ARCHITECTURAL_RULES_DMD.md; audit-dmd/DMD_CURRENT_APP_ARCHITECTURE_AUDIT.md; DMD_PROJECT_INTELLIGENCE.md.

**Dependencies:** DMD-FND-6.

**Tasks:**

- [ ] Process project requests, client projects/proposals/milestones/messages, members/invitations/leave, chat/DM/read/pin/convert and ProjectItems inventory rows one endpoint at a time through the required protocol.
- [ ] Reuse current project-access, chat-domain and serializer policy rather than duplicating it.
- [ ] Preserve resource-first authorization, transactions, accepted proposal snapshot, membership audit, DM uniqueness, attachment visibility and chat-to-formal-work provenance.

**Invariants:** Chat is evidence, not automatic project truth; accepted scope/history is never physically rewritten.

**Verification:** Existing proposal/membership/chat integration suites and collaborator/stranger staging security smoke pass.

**Explicitly out of scope:** New-business WorkOrder or AI mutation.

## DMD-FND-8 — Sequential final extraction, catch-all retirement and page composition

**Goal:** Finish the remaining inventory endpoint by endpoint, retire the catch-all only after the last verified extraction and decompose giant pages only along real ownership seams.

**Source documents:** ARCHITECTURAL RULES/ARCHITECTURAL_RULES_DMD.md sections 19, 27–39 and 61–63; audit-dmd/DMD_FRONTEND_BACKEND_IMPLEMENTATION_MAP.md.

**Dependencies:** DMD-FND-7.

**Tasks:**

- [ ] Select exactly one remaining statistics/admin/analytics method + path from the DMD-FND-3 inventory and complete the required extraction protocol before selecting the next one.
- [ ] Keep app/api/[[...path]]/route.js serving all still-unmigrated contracts throughout the sequence; remove only the verified endpoint branch after each staging smoke.
- [ ] After every slice, update the inventory and its contract/test/build/staging evidence so catch-all retirement is an auditable zero-inventory decision.
- [ ] Delete app/api/[[...path]]/route.js only after the final branch is migrated, the inventory is zero, the full test/build suite passes and complete staging smoke is green.
- [ ] Keep new discovery at /start, never inside HomeClient.
- [ ] Split admin/dashboard/project-detail into page shell, feature composition, client leaves and transport modules only when touched; preserve deep links.
- [ ] Move initial reads server-side where suitable and avoid duplicate hydration fetches/new giant files.

**Invariants:** No big-bang extraction, replacement universal dispatcher, parallel API hierarchy or 1,000–6,000 line page/route file. A partially migrated catch-all is expected and remains frozen against new endpoints. New BI routes proceed from DMD-FND-4 without waiting for DMD-FND-8.

**Verification:** Every migrated method + path has individual contract/regression/build/staging evidence; catch-all deletion requires zero remaining inventory branches, no deep-link/console regression and green relevant UI/full-build tests.

**Explicitly out of scope:** Cosmetic full-site redesign.

## DMD-OPS-0 — Durable workflows, audit and diagnostics

**Goal:** Coordinate side effects, retries and risky workflows through durable evidence rather than browser requests.

**Source documents:** audit-dmd/DMD_EXTENSION_TARGET_ARCHITECTURE.md; audit-dmd/DMD_SECURITY_RELIABILITY_GATES.md; ARCHITECTURAL RULES/ARCHITECTURAL_RULES_DMD.md.

**Dependencies:** DMD-FND-4.

**Tasks:**

- [ ] Define outbox/event schema, correlation/causation IDs, idempotency keys and retry/error classification.
- [ ] Define durable lifecycle for analysis, design, provisioning and webhooks, including dead-letter/review/reconciliation state.
- [ ] Add read-only diagnostics that distinguish no finding from collector failure and expose safe evidence IDs.
- [ ] Define operator/client notification audience policy, including design.human_assistance_required without leaking internal details to clients.

**Invariants:** Canonical write precedes side effect; diagnostics never silently repair production state.

**Verification:** Duplicate/retry/failure simulations create no duplicate state/notification and remain diagnosable.

**Explicitly out of scope:** Microservices or worker cluster.

## DMD-AI-0 — Provider-neutral AI infrastructure

**Goal:** Make online AI a schema-bound interpretation layer, never a provider-shaped source of business truth.

**Source documents:** audit-dmd/DMD_AI_ORCHESTRATION_MODEL_ROUTING.md; audit-dmd/DMD_SECURITY_RELIABILITY_GATES.md; DMD_DESIGN_AGENT_PIPELINE_IMPLEMENTATION_v1_0.md.

**Dependencies:** DMD-OPS-0 and DMD-WS-1. DMD-FND-4 and DMD-WORKSPACE-0 are transitive prerequisites through those milestones.

**Tasks:**

- [ ] Define agent registry/policies, allowed tools, JavaScript runtime input/output schemas, provider adapter and one-provider-first policy.
- [ ] Build minimal context assemblers from versioned canonical state; do not send full DB/transcript by default.
- [ ] Persist AgentRun with policy/provider/model/input/output refs, tokens/cost, latency, retry/error and staging tag; never private chain-of-thought.
- [ ] Enforce quotas, public-discovery abuse controls, model routing/fallback rules and emergency disable.
- [ ] Stream low-latency chat only; use durable jobs for design/analysis/provisioning.

**Invariants:** Schema-valid output is not business-valid; AI cannot directly write DB/project truth or gain privilege from external content.

**Verification:** Fake-provider tests cover malformed output, injection, quota, retry/fallback and rejected command proposal.

**Explicitly out of scope:** Autonomous server-side coding, final pricing or multi-provider voting.

## DMD-WS-1 — Anonymous DiscoverySession & Persistent Conversation

**Goal:** Give a guest a secure, resumable, claimable conversation/session boundary without requiring AI or formal business understanding.

**Source documents:** DMD_BUSINESS_INTELLIGENCE_DISCOVERY.md; audit-dmd/DMD_CLIENT_DISCOVERY_DESIGN_LEAD_FLOW_V2.md; audit-dmd/DMD_FRONTEND_BACKEND_IMPLEMENTATION_MAP.md.

**Dependencies:** DMD-FND-4 and DMD-WORKSPACE-0. DMD-FND-5 through DMD-FND-8 continue as a controlled parallel legacy-cleanup branch.

**Tasks:**

- [ ] Bind the Workspace entry to free natural-language input and optional links/assets; do not present technical/product-type shortcut cards or require the client to select an architecture.
- [ ] Persist guest `DiscoverySession` messages independently of later business interpretation.
- [ ] Implement hashed/rotatable opaque guest access, expiry, resume, account claim and cross-account isolation.
- [ ] Preserve captured work during claim; registration must not send an existing Workspace user into an empty unrelated dashboard state.
- [ ] Require registered ownership only where deferred/supervised work genuinely needs it while preserving the approved anonymous flow.

**Invariants:** Raw session ID never authorizes access; claim never makes a client re-enter captured data. WS-1 owns session continuity, not business understanding, brainstorming, VerifiedBusinessState, product routing, design or formal project conversion. AI is not a WS-1 dependency.

**Verification:** Guest message persistence, resume, expiry, rotation, claim and cross-account isolation tests plus mobile staging/browser smoke pass without an AI/provider call.

**Explicitly out of scope:** AI interpretation, business facts, advisory recommendations, formal verification, product routing, design and ProjectRequest/ClientProject materialization.

## DMD-BI-1 — Living Understanding

**Goal:** Continuously build client-correctable business understanding from conversation evidence without prematurely verifying it.

**Source documents:** DMD_BUSINESS_INTELLIGENCE_DISCOVERY.md; DMD_DESIGN_ENGINE_PRINCIPLES.md; audit-dmd/DMD_AI_ORCHESTRATION_MODEL_ROUTING.md.

**Dependencies:** DMD-WS-1 and DMD-AI-0.

**Tasks:**

- [ ] Build a living model of Business, Current workflow, Goals, People, Constraints, Assets, known capabilities/context and Open questions from persistent conversation evidence.
- [ ] Persist raw messages/links/assets separately from extracted, inferred, rejected and conflicted facts; preserve source references, confidence and provenance/status such as unknown, inferred, client_stated, conflicted and not_applicable.
- [ ] Use AI only to propose extraction, clarification and the highest-value unresolved question through validated commands; one message may populate many facts.
- [ ] Enforce no-repeat logic: never re-ask a sufficiently known fact, while keeping genuine contradictions and material unknowns visible.
- [ ] Show editable plain-language understanding/progress and capture existing-system/migration context without collecting ordinary-chat credentials.

**Invariants:** Chat is evidence; client-stated and inferred facts remain distinguishable; future idea/preference is not production requirement; missing facts are not fabricated. BI-1 performs no formal verification.

**Verification:** Tests cover multi-fact extraction, correction, contradiction, provenance/confidence, no-repeat behavior, source references and highest-value-question selection.

**Explicitly out of scope:** Advisory recommendation acceptance, formal verification, ProductRouteDecision and project materialization.

## DMD-BI-2 — Advisory Brainstorming

**Goal:** Offer concise professional recommendations and alternatives without turning model advice into business truth.

**Source documents:** DMD_BUSINESS_INTELLIGENCE_DISCOVERY.md; DMD_PLATFORM_EXPANSION_MASTER_PLAN.md; audit-dmd/DMD_AI_ORCHESTRATION_MODEL_ROUTING.md.

**Dependencies:** DMD-BI-1.

**Tasks:**

- [ ] Produce short useful recommendations, alternative workflows, simpler MVP options, missing opportunities and professional warnings/trade-offs grounded in the living understanding.
- [ ] Identify unnecessary requested technology without forcing an implementation/product selector onto the client.
- [ ] Persist recommendation/proposal evidence separately from facts and require explicit policy/acceptance before any accepted recommendation may affect later canonical state.
- [ ] Preserve rejected recommendations as non-truth evidence; they must not silently enter VerifiedBusinessState.

**Invariants:** `client statement/fact ≠ AI recommendation`. Recommendation is not business truth, and rejection cannot mutate the fact model.

**Verification:** Tests prove fact/recommendation separation, accepted/rejected advisory state, alternatives/trade-offs and no silent promotion into canonical facts.

**Explicitly out of scope:** Formal verification, deterministic product routing, pricing, proposal or project creation.

## DMD-BI-3 — Understanding Gate / VerifiedBusinessState

**Goal:** Produce an authorized, versioned canonical business snapshot only after completeness and visible material conflicts are resolved or explicitly accepted.

**Source documents:** DMD_BUSINESS_INTELLIGENCE_DISCOVERY.md; DMD_PLATFORM_EXPANSION_MASTER_PLAN.md; audit-dmd/DMD_EXTENSION_EXECUTION_PLAN_V2.md.

**Dependencies:** DMD-BI-2.

**Tasks:**

- [ ] Evaluate completeness and expose unresolved material conflicts in plain language.
- [ ] Present the understanding for explicit client confirmation/correction before creating a versioned immutable `VerifiedBusinessState`.
- [ ] Record `verifiedBy` through an authorized actor/system gate, never an LLM assertion.
- [ ] Preserve accepted recommendation provenance without representing rejected/unaccepted advisory output as fact.

**Invariants:** AI interprets/proposes; the system decides; the engine executes. Only authorized `VerifiedBusinessState` enters Product Intelligence. `VerifiedBusinessState` is not automatically a ProjectRequest or formal engineering commitment.

**Verification:** Staging flow proves vague input → living understanding → advisory separation → correction → one authorized versioned snapshot, with no ProjectRequest/ClientProject created implicitly.

**Explicitly out of scope:** ProjectRequest materialization, proposal pricing, provisioning and design execution.

## DMD-PI-1 — Capability registry and ProductDefinition manifests

**Goal:** Publish versioned capability/product contracts for Marysoll, P.DC and Custom.

**Source documents:** DMD_PRODUCT_INTELLIGENCE_ROUTING_BLUEPRINT.md; DMD_PLATFORM_EXPANSION_MASTER_PLAN.md; audit-dmd/DMD_CLIENT_DISCOVERY_DESIGN_LEAD_FLOW_V2.md.

**Dependencies:** DMD-BI-3.

**Tasks:**

- [ ] Define capability namespaces, metadata, dependencies/conflicts and required/optional/future/prohibited sets.
- [ ] Define versioned ProductDefinition manifests with business model, capabilities/configuration, constraints/incompatible patterns, extension policy, design-policy and provisioning references.
- [ ] Preserve Marysoll service/booking/operations and broad P.DC expert/knowledge/learning core models.

**Invariants:** Capability is not UI; brand/tenant request never forks product core.

**Verification:** Manifest tests cover version pinning, conflicts and known Marysoll/P.DC examples.

**Explicitly out of scope:** Profession-specific hardcoded routing or tenant provisioning.

## DMD-PI-2 — Deterministic fit, route and extension governance

**Goal:** Derive auditable product route from verified capability needs and protect product boundaries.

**Source documents:** DMD_PRODUCT_INTELLIGENCE_ROUTING_BLUEPRINT.md; DMD_PLATFORM_EXPANSION_MASTER_PLAN.md.

**Dependencies:** DMD-PI-1.

**Tasks:**

- [ ] Derive CapabilityModel from VerifiedBusinessState with source/version refs.
- [ ] Implement deterministic per-capability fit and route outcomes: native, configurable, product_extension, unsupported/conflict and custom_required.
- [ ] Persist immutable ProductRouteDecision with business/catalog/product/rule versions and human-readable rule reasons.
- [ ] Review extension general value, entitlement, compatibility and migration before approve/reject/custom decision.

**Invariants:** AI cannot set selected product; product_extension is not implementation approval; same versioned inputs reproduce the same route.

**Verification:** Fixtures prove Marysoll, P.DC and Custom decisions; old decisions do not change after catalog update.

**Explicitly out of scope:** Design candidate or product-instance mutation.

## DMD-BP-1 — Versioned Solution Blueprint

**Goal:** Bridge Business/Product truth into design, commercial and project work.

**Source documents:** DMD_PRODUCT_INTELLIGENCE_ROUTING_BLUEPRINT.md; DMD_PLATFORM_EXPANSION_MASTER_PLAN.md; DMD_DESIGN_ENGINE_CLIENT_FLOW.md.

**Dependencies:** DMD-PI-2.

**Tasks:**

- [ ] Define/version validated Blueprint with documented product, actors, included/excluded/extensions, flows, data/integrations/migration, conversion/trust/content/operations, design/commercial/provisioning inputs, risks and unresolved items.
- [ ] Generate only through application orchestration and expose role-safe summaries.
- [ ] Preserve references/version pins for each downstream decision.

**Invariants:** Blueprint is a canonical bridge, not a competing copy of business/product state.

**Verification:** A versioned route/Blueprint passes Design, Commercial and Project contract validators.

**Explicitly out of scope:** Pricing, design execution and proposal acceptance.

## DMD-DES-0 — Design contracts, intake and semantic assets

**Goal:** Capture design meaning/assets before design execution.

**Source documents:** DMD_DESIGN_AGENT_PIPELINE_IMPLEMENTATION_v1_0.md sections 2–5; ARCHITECTURAL RULES/ARCHITECTURAL_RULES_DMD.md section 45; audit-dmd/DMD_SECURITY_RELIABILITY_GATES.md.

**Dependencies:** DMD-FND-0, DMD-BP-1 and DMD-FND-6.

**Tasks:**

- [ ] Use the canonical DMD-FND-0 aggregate names and apply the separately reconciled lifecycle enums to DesignIntent, DesignAsset, DesignStrategy, DesignJob, DesignCandidate and ApprovedDesignRevision contracts.
- [ ] Collect information only the client is expected to know: existing logo/brand assets/photos, existing website, reference sites/materials, source content, business-grounded preferences, elements/colors that must remain and things they strongly want to avoid.
- [ ] Treat CTA hierarchy, UX structure, responsive strategy, device prioritization, typography system, SEO/content architecture, funnel structure, interaction model, component structure and motion policy as professional system decisions. Client preferences are evidence, not a forced questionnaire.
- [ ] Use signed/direct Cloudinary flow; store semantic source/role/title/description/intended placement/person/alt and delivery identity in DMD, never blobs.
- [ ] Require client-upload description; final binding cannot retain role unsure.
- [ ] Create editable DesignMediaSlot and AssetBinding revisions such as home.hero.primary.

**Invariants:** Cloudinary owns bytes/delivery; DMD owns semantics/relationships. Asset replacement is asset_revision, not automatic regeneration.

**Verification:** Tests reject undescribed upload, final unsure/cross-session binding and private asset public leakage.

**Explicitly out of scope:** Generic media CMS or provider generation.

## DMD-DES-1 — Website Analyzer and versioned design grammar

**Goal:** Supply secure design-relevant website evidence and pinned system/rule/component constraints.

**Source documents:** DMD_DESIGN_AGENT_PIPELINE_IMPLEMENTATION_v1_0.md sections 6 and 9–11; DMD_DESIGN_ENGINE_PRINCIPLES.md; audit-dmd/DMD_SECURITY_RELIABILITY_GATES.md.

**Dependencies:** DMD-DES-0, DMD-AI-0 and DMD-PI-1.

**Tasks:**

- [ ] Enforce URL/SSRF/private-network/redirect/timeout/size/sandbox controls; give analyzer no cookies, secrets or mutation tools.
- [ ] Keep RawWebsiteAnalysis separate from DesignRelevantWebsiteAnalysis: structure, CTA, conversion, hierarchy, mobile, SEO, visual language, technical constraints and business conflicts.
- [ ] Define/pin DMD/product/mobile/CTA/accessibility/SEO rule packs, Design System grammar and Component Registry product/capability/responsive/motion entries.
- [ ] Require explicit reusable-component review rather than tenant-only hacks.

**Invariants:** External content is data, not instruction; raw Lighthouse volume is not design-executor context; design system cannot change product semantics.

**Verification:** Private URL/injection tests fail safely; registry rejects unavailable component/capability/version combinations.

**Explicitly out of scope:** General crawling or autonomous remediation.

## DMD-DES-2 — Canonical Design Strategy and curated handoff

**Goal:** Create and lock the provider-neutral design input from canonical structured state, never raw chat.

**Source documents:** DMD_DESIGN_AGENT_PIPELINE_IMPLEMENTATION_v1_0.md sections 7–14; DMD_DESIGN_ENGINE_CLIENT_FLOW.md; design-handoff-package.example.yaml.

**Dependencies:** DMD-DES-1 and DMD-BP-1.

**Tasks:**

- [ ] Orchestrate versioned DesignStrategy from verified state, CapabilityModel, route, Blueprint, DesignIntent, curated website findings, assets and references.
- [ ] Include human-readable project description, business/design goal, audience/outcomes, conversion/CTA/content/page/SEO, visual/brand/type/image, responsive/accessibility/motion and allowed/forbidden capability policies.
- [ ] Validate/lock strategy; pin product/design-system/rule versions and create a new version for meaningful change.
- [ ] Build immutable human/machine handoff with curated asset/reference manifests, not binaries or raw transcript.

**Invariants:** Priority is product constraints → Blueprint → business/conversion → UX/accessibility/security → client intent → visual references → AI interpretation. Handoff is not a second source of truth.

**Verification:** Locked strategy/package is reproducible and rejects forbidden capability/unpinned version.

**Explicitly out of scope:** Provider-specific API dependency.

## DMD-DES-3 — Instant Design MVP

**Goal:** Offer a capped anonymous-compatible candidate through a safe renderer.

**Source documents:** DMD_DESIGN_AGENT_PIPELINE_IMPLEMENTATION_v1_0.md sections 14–16 and 30–31; audit-dmd/DMD_CLIENT_DISCOVERY_DESIGN_LEAD_FLOW_V2.md.

**Dependencies:** DMD-DES-2, DMD-AI-0 and DMD-FND-1.

**Tasks:**

- [ ] Use one adapter and shared DesignJob/DesignCandidate contract.
- [ ] Prefer structured DesignSpec/ComponentGraph rendered by known components; allow sandbox prototype only as non-production fallback.
- [ ] Enforce anonymous claim, quota and durable progress rules; validate candidate before presentation.

**Invariants:** Generated arbitrary React/HTML/JS never becomes production application code; instant design does not create a WorkOrder.

**Verification:** Claim/quota/invalid-spec/provider-failure/safe-preview tests pass on staging.

**Explicitly out of scope:** Full product implementation or payment.

## DMD-DES-4 — Supervised Design, normalizer and validator

**Goal:** Support optional Claude Design/human handoff while guaranteeing a valid implementation map.

**Source documents:** DMD_DESIGN_AGENT_PIPELINE_IMPLEMENTATION_v1_0.md sections 17–22 and 30–33; audit-dmd/DMD_AI_ORCHESTRATION_MODEL_ROUTING.md.

**Dependencies:** DMD-DES-2, DMD-OPS-0 and registered ownership from DMD-WS-1.

**Tasks:**

- [ ] Require registration before awaiting_operator; create operator queue, audited controls and client-safe state.
- [ ] Use supervised/manual Claude Design adapter initially and attach visual artifact to shared candidate lifecycle.
- [ ] Emit design.human_assistance_required for missing assets, ambiguity, special visual language, sourcing/handoff or validation failure.
- [ ] Normalize artifact page/section/component/media/CTA/capability/responsive/motion mappings.
- [ ] Validate Blueprint/product/registry/accessibility/rule constraints and return unsupported functional design to Product Intelligence.

**Invariants:** Claude Design has no DB/capability/proposal/payment authority; normalizer reconstructs mapping but never invents capability.

**Verification:** Registration/audience/non-JSON artifact/invented-capability/invalid-CTA tests take correct paths.

**Explicitly out of scope:** Assumed public Claude Design API or automatic implementation.

## DMD-DES-5 — Implementation classification, preview and review

**Goal:** Turn validated visual intent into safe preview/review evidence without hidden scope expansion.

**Source documents:** DMD_DESIGN_AGENT_PIPELINE_IMPLEMENTATION_v1_0.md sections 22–28; audit-dmd/DMD_REPO_DB_ENGINEERING_HANDOFF.md.

**Dependencies:** DMD-DES-3 or DMD-DES-4; the resolved DMD-FND-0 preview boundary applies.

**Tasks:**

- [ ] Classify visual targets as existing component, approved reusable extension or Product Intelligence return; Claude Code/Codex implement only against real architecture under human supervision.
- [ ] Require design-job commit/evidence metadata, test/build/preview evidence before preview_ready and obey the approved pre-proposal preview policy.
- [ ] Provide mobile/desktop review, content/visual revision and slot-based asset replacement.
- [ ] Classify asset/content/visual versus functional/scope/pivot feedback; functional change returns to capability/Blueprint/change assessment.

**Invariants:** Client review never exposes provider/operator/internal build details. Implemented preview is not accepted scope or paid WorkOrder.

**Verification:** Asset replacement creates no DesignJob; incompatible mapping cannot reach ready preview; functional feedback cannot masquerade as visual revision.

**Explicitly out of scope:** Autonomous cloud coding or unpaid production execution.

## DMD-DES-6 — Approved Design Revision

**Goal:** Freeze the design decision that may enter commercial/project workflow.

**Source documents:** DMD_DESIGN_AGENT_PIPELINE_IMPLEMENTATION_v1_0.md sections 27–29; DMD_DESIGN_ENGINE_CLIENT_FLOW.md.

**Dependencies:** DMD-DES-5.

**Tasks:**

- [ ] Persist immutable client-approved revision with candidate, strategy, Design System, rule, preview/commit and approval refs.
- [ ] Preserve revision history; later change creates a new explicit decision.

**Invariants:** Approved design is not project purchase/payment and cannot mutate after acceptance. Selection/approval may reserve or lock a candidate only through an explicit design-inventory policy; `bought`, commercial acceptance and payment belong to the Commercial layer and never occur implicitly during design approval.

**Verification:** Approval authorization/immutability tests pass.

**Explicitly out of scope:** Proposal acceptance and payment.

## DMD-PROJECT-1 — Project Intelligence read/classification foundation

**Goal:** Add source-safe assistance to existing projects without replacing their aggregates.

**Source documents:** DMD_PROJECT_INTELLIGENCE.md; audit-dmd/DMD_PROJECT_INTELLIGENCE_TICKETING_CHANGE_CONTROL_V2.md; audit-dmd/DMD_CURRENT_APP_ARCHITECTURE_AUDIT.md.

**Dependencies:** Existing-project read/classification work may begin after DMD-FND-4 and DMD-FND-2. In the new Workspace vertical, DMD-PROJECT-0 supplies claimed pre-project continuity before this capability is projected there.

**Tasks:**

- [ ] Assemble authorized context from accepted proposals, milestones/tasks, ProjectItems, messages, decisions, onboarding and evidence.
- [ ] Add read-only message classification/client Q&A with source refs and client-safe answers.
- [ ] Implement versioned ChangeAssessment, deterministic bug/clarification/capability/pivot distinctions, hard triggers and authorized override.
- [ ] Add dependency graph/readiness and separate implementationState from verificationState without breaking legacy status.

**Invariants:** Chat memory alone is not project truth; AI cannot promise scope/date/price or mutate accepted state.

**Verification:** Tests cover scope delta/hard trigger/cycle/failed verification and client-safe status.

**Explicitly out of scope:** Unreviewed project/commercial mutation or repo sync.

## DMD-COM-0 — Commercial configuration and proposal materialization

**Goal:** Separate commercial objects and draft the existing proposal from approved scope/design.

**Source documents:** DMD_COMMERCIAL_PROVISIONING.md; DMD_PROJECT_INTELLIGENCE.md; DMD_DESIGN_AGENT_PIPELINE_IMPLEMENTATION_v1_0.md.

**Dependencies:** DMD-DES-6, DMD-BP-1 and DMD-AI-0.

**Tasks:**

- [ ] Version CommercialConfiguration linked to Blueprint/approved design and distinguish ProjectProposal scope, ProductSubscription entitlement and EngineeringPlan capacity.
- [ ] Reference measured AgentRun/DesignJob/workflow/storage cost evidence without inventing pricing formula.
- [ ] Draft existing ProjectProposal/milestones/tasks/acceptance/evidence policy from approved inputs through authorized review/send/accept lifecycle.

**Invariants:** No AIProposal parallel aggregate; draft/task edit cannot rewrite accepted proposal snapshot. Non-authoritative estimates may be prepared earlier only under a separately approved architecture, but no client-facing commercial decision, proposal/acceptance gate or binding commercial state may depend on an unapproved DesignCandidate.

**Verification:** Contract/integration tests prove separate lifecycles, versioning and authorization.

**Explicitly out of scope:** Automatic price setting or payment provider selection.

## DMD-PROJECT-0 — Claimed Workspace / My Projects continuity

**Goal:** Preserve claimed pre-project Workspace work as an authenticated dashboard projection without prematurely creating `ProjectRequest` or `ClientProject` records.

**Source documents:** DMD_CLIENT_WORKSPACE_PRODUCT_DIRECTION.md; DMD_PLATFORM_EXPANSION_MASTER_PLAN.md; DMD_PROJECT_INTELLIGENCE.md.

**Dependencies:** DMD-WS-1 and the relevant lifecycle state through DMD-COM-0. Formal project materialization remains governed by the existing request → proposal → acceptance/payment → project authority path.

**Tasks:**

- [ ] Project saved Workspace states into My Projects/navigation, including `Understanding in progress`, `Product direction ready`, `Design in progress`, `Commercial review` and `Active project` where canonical state supports them.
- [ ] Ensure registration/claim returns a user with existing Workspace work to that work rather than the unrelated empty “You haven't requested any services yet” state.
- [ ] Keep pre-project Workspace state distinct from `ProjectRequest`, proposal and `ClientProject` authority.
- [ ] When formal materialization is appropriate, reuse the existing `ProjectRequest → proposal → ClientProject` path with an idempotent, source-linked handoff that requires no client retyping.

**Invariants:** `VerifiedBusinessState ≠ ProjectRequest`; claimed Workspace work may be project-visible without being a formal engineering project. Dashboard is the authenticated navigation/ownership surface; Workspace remains the lifecycle work surface.

**Verification:** Claim/registration/dashboard projection tests preserve the same Workspace state, create no premature project aggregate and prove repeated formal handoff creates at most one source-linked ProjectRequest.

**Explicitly out of scope:** Implementing this projection now, automatic proposal creation, implicit commercial acceptance or bypassing existing project authority.

## DMD-COM-2 — Proposal acceptance and payment gate

**Goal:** Define explicit commercial authority before WorkOrder or production-affecting provisioning.

**Source documents:** DMD_COMMERCIAL_PROVISIONING.md; DMD_DESIGN_AGENT_PIPELINE_IMPLEMENTATION_v1_0.md section 29; audit-dmd/DMD_SECURITY_RELIABILITY_GATES.md.

**Dependencies:** DMD-COM-0.

**Tasks:**

- [ ] Approve payment architecture before code: provider, currency/tax, states, idempotency, failures/refunds, entitlement timing and webhook validation.
- [ ] Implement only that approved acceptance/payment contract and define any SaaS-native route exception explicitly.
- [ ] Gate WorkOrder/provisioning on authoritative accepted/payment state required by policy.

**Invariants:** UI/LLM never decides payment success; no silent bypass of approved design → proposal → acceptance/payment → WorkOrder.

**Verification:** Duplicate accept/payment/webhook retry tests prove no double charge, false paid state or double WorkOrder.

**Explicitly out of scope:** Choosing a provider or price before approval.

## DMD-COM-3 — Onboarding, migration and provisioning

**Goal:** Progressively collect safe inputs and provision through plan/verify/reconcile adapters.

**Source documents:** DMD_COMMERCIAL_PROVISIONING.md; DMD_PROJECT_INTELLIGENCE.md; audit-dmd/DMD_SECURITY_RELIABILITY_GATES.md.

**Dependencies:** DMD-COM-2.

**Tasks:**

- [ ] Implement stage-aware OnboardingRequirement with blocking state, secure secret/connection reference and client-safe projection; never collect credentials in normal chat.
- [ ] Implement migration workflow: source discovery/export/profiling → mapping → dry run → validation → import → reconciliation → cutover.
- [ ] Version ProvisioningPlan with prerequisites/resources/verification/reconciliation and adapter contract plan/validate/provision/verify/reconcile.
- [ ] Persist ProductInstanceReference/environment/subscription status without copying Marysoll/P.DC domain data; make external mutation idempotent.

**Invariants:** Non-blocking input does not halt unrelated work; partial external success is reconciliation_required, not active.

**Verification:** Secret-redaction, migration dry-run and repeated-adapter/partial-failure tests pass.

**Explicitly out of scope:** Automatic production provisioning or target-schema deformation by legacy data.

## DMD-PROJECT-2 — WorkOrder and repository binding

**Goal:** Hand accepted scope to local/human-supervised Claude Code/Codex with no second authority.

**Source documents:** audit-dmd/DMD_REPO_DB_ENGINEERING_HANDOFF.md; audit-dmd/DMD_FRONTEND_BACKEND_IMPLEMENTATION_MAP.md; DMD_PROJECT_INTELLIGENCE.md.

**Dependencies:** DMD-COM-2.

**Tasks:**

- [ ] Create least-privilege RepositoryBinding and versioned WorkOrder from accepted proposal, Blueprint, approved design, tasks/dependencies/evidence/client decisions.
- [ ] Define .dmd project/work-order/engineering-state machine schemas and human engineering companions.
- [ ] Implement minimal local link/pull/status/validate/evidence/sync flow and local agent instructions.

**Invariants:** DMD DB owns accepted scope/price/approval; repo/CI owns performed implementation/build/test facts; local agents cannot edit accepted scope through files.

**Verification:** Stale WorkOrder and invalid manifest/ref/dependency tests conflict rather than overwrite.

**Explicitly out of scope:** DMD-hosted autonomous coding or unnecessary GitHub write access.

## DMD-PROJECT-3 — GitHub evidence and Engineering Projection

**Goal:** Translate validated repository/CI evidence into client-safe project truth.

**Source documents:** audit-dmd/DMD_REPO_DB_ENGINEERING_HANDOFF.md; audit-dmd/DMD_SECURITY_RELIABILITY_GATES.md; audit-dmd/DMD_PROJECT_INTELLIGENCE_TICKETING_CHANGE_CONTROL_V2.md.

**Dependencies:** DMD-PROJECT-2 and DMD-OPS-0.

**Tasks:**

- [ ] Use dedicated GitHub App webhook with signature validation, delivery dedupe, repository allowlist/stable ID, EventInbox and asynchronous processing.
- [ ] Validate committed engineering state, WorkOrder version, commit/CI/test/build evidence and persist ProjectEvidence.
- [ ] Derive EngineeringProjection with implementationState, verificationState, blockers/evidence and role-safe client/internal views.
- [ ] Reconcile conflicts, allow manual override only with reason/audit, and never change accepted scope from repo/Markdown claims.

**Invariants:** Commit alone does not complete task; implemented plus failed/pending verification is not client complete; frontend remains a projection.

**Verification:** Staging end-to-end proves local commit → validated webhook → projection, while duplicate/invalid/stale/failed-CI paths remain safe.

**Explicitly out of scope:** GitHub write automation, automatic client acceptance or commercial change.

## DMD-CONV-0 — Shared conversation intelligence

**Sequence:** LAST in the active Workspace vertical-slice plan.

**Goal:** Reuse proven conversation intelligence across project/milestone `Ask a question`, group chat and direct messages without allowing conversation or AI interpretation to mutate project truth directly.

**Source documents:** DMD_CLIENT_WORKSPACE_PRODUCT_DIRECTION.md; DMD_PROJECT_INTELLIGENCE.md; PROJECT_CHAT_PLAN.md.

**Dependencies:** DMD-PROJECT-0 and the relevant implemented/verified Project and conversation foundations. This slice starts only after the preceding Workspace vertical has established stable truth, authorization and formalization boundaries.

**Tasks:**

- [ ] Interpret human messages, including operator answers, into notes or candidate actions with source-conversation provenance.
- [ ] Reuse the existing authorized formalization paths: `Convert message → ProjectRequest | milestone task | ProjectMessage | ProjectItem`.
- [ ] Preserve existing authorization, accepted-scope and change-control policies for every formal target.
- [ ] Keep AI output as interpretation/proposal until an authorized system command performs the formal mutation.

**Invariants:** AI and chat do not directly mutate project truth. Every formalized result remains source-linked, authorized and governed by the owning domain.

**Verification:** Cross-surface tests prove consistent interpretation/provenance and reject unauthorized or direct AI mutation across Ask a question, group chat and DM.

**Explicitly out of scope:** Implementing CONV-0 now, autonomous project mutation or bypassing current convert/change-control flows.

## Explicit deferred decisions

- [-] Final pricing formula, payment provider and detailed payment behavior remain deferred until DMD-COM-2 architecture approval and usage metering.
- [-] Autonomous cloud coding, arbitrary generated React execution, generic Figma importer, collaborative design editor, multi-model voting, microservices and vector DB by default are intentionally deferred.
- [-] Claude Design remains an optional supervised/manual adapter until a stable approved integration exists.

## 0. Dokumentacija

- [x] `documentations/PROJECT_CHAT_PLAN.md` — plan izrade (v1)
- [x] `documentations/TODO.md` — ova lista (v1)
- [x] v2 bezbednosna dopuna oba dokumenta: matrica rola, odvojeni Invitation/Member, allowlist serializeri, audit log, prošireni E2E napadi
- [-] Kratak rezime zatečenog toka pre početka implementacije — **već postoji**, to je Sekcija 2 plana („Zatečeno stanje — tri nepovezana toka poruka", badge sistem, nepostojeći invite flow), napisana pre prve linije koda. Pisanje drugog rezimea istog nalaza bio bi duplikat.
- [x] v3 dopuna: cross-cutting invarijante I1–I10 (plan sekcija 4A) + životni ciklus i preživljavanje istorije (plan sekcija 5A)

---

## 1. Modeli

- [x] `models/ProjectInvitation.js` — poziv kao zaseban entitet
  - [x] `emailNormalized` (literal `trim().toLowerCase()`), `intendedRole`, `personalMessage`
  - [x] **`tokenHash` = sha256(raw)** — sirovi token nikad u bazi
  - [x] `status: pending|accepted|expired|revoked`, `expiresAt` (+7d), `acceptedAt`, `acceptedByUserId`
  - [x] indeksi: unique `(tokenHash)`, unique partial `(projectId, emailNormalized)` za `pending`, `(projectId, status)`
- [x] `models/ProjectMember.js` — samo trajno članstvo (nastaje TEK po prihvatanju)
  - [x] `userId` required, `role: collaborator|viewer|client_lead|project_admin`, `status: active|suspended|removed`, `roleLabel`
  - [x] **`name` + `email` denormalizovani** (I10) — bez njih obrisan nalog daje prazan red u listi učesnika
  - [x] indeksi: unique `(projectId, userId)`, `(userId, status)`
  - [x] `removed` je soft — red ostaje zbog audita
- [x] `models/ProjectAuditLog.js` — eventType enum (invitation.\*, member.\*), `metadata`, indeks `(projectId, createdAt: -1)`
- [x] `models/ChatChannel.js` — `kind: group|dm|system`, `systemKey`, `postingPolicy`, `memberUserIds`, `archivedAt`
  - [x] unique partial `(projectId)` za `kind: 'group'` — jedan grupni kanal po projektu i kad dva zahteva istovremeno pokušaju lazy kreiranje. Ključ je samo `projectId` jer bi indeks sa istim `{projectId, kind}` obrascem a drugim opcijama MongoDB odbio kao `IndexOptionsConflict`
  - [x] **`dmKey` + unique partial `(projectId, dmKey)`** (I5) — `memberUserIds` niz ne može da iznudi jedinstvenost para; bez ovoga dva paralelna zahteva otvaraju dva DM-a za iste dve osobe
- [x] `models/ChatMessage.js` — `flag`, `kind`, `replyToPreview`, `mentions`, `pinned`, `convertedTo[]`, soft delete
  - [x] attachment sub-šema sa **`visibility: project_shared|client_only|internal_team`** (v2)
  - [x] indeksi: `(channelId, createdAt: -1)`, `(channelId, pinned)`, `(projectId, flag)`, `(channelId, mentions)`
- [x] `models/ChatRead.js` — unique `(channelId, userId)` + `clearedAt` (per-user „očisti razgovor", bez nove kolekcije)
- [x] `models/ProjectItem.js` — `kind`, `ref` ("D-041"), `status`, `severity`, `confirmedBy[]`; indeksi `(projectId, kind, status)`, `(sourceMessageId)`, unique `(projectId, kind, ref)`
- [x] `models/Notification.js` — polje `channelId` + indeks `(userId, channelId)`
- [x] `models/ProjectMessage.js` — `authorRole` enum + `'member'` (jedina izmena)
- [x] `models/ClientProject.js` — `ownerAccountDeletedAt` (aditivno, default `null`) — jedini okidač za read-only zatvaranje projekta
- [x] `lib/chat-domain.mjs` — `restrictForClosedProject` + `dmKeyFor`, sa testovima
- [x] Svi novi modeli poštuju konvenciju: `_id` UUID string, `{ timestamps: true, _id: false }`, bez `ref`/`populate`
- [x] Sve šeme se učitavaju pod Mongoose bez upozorenja (provereno kroz privremeni loader)

---

## 2. Čisti moduli i testovi

- [x] `lib/chat-domain.mjs`
  - [x] **`ROLE_PERMISSIONS` preset po roli — tačno po matrici iz plana (sekcija 6)**
  - [x] `PERMISSION_KEYS` + `permissionsForRole` + `hasPermission`; test čuva da nijedan preset ne odluta od skupa ključeva
  - [x] konstante `MESSAGE_FLAGS`, `CHANNEL_KINDS`, `PROJECT_ITEM_KINDS`, `CONVERT_TARGETS`, `MEMBER_ROLES`, `INVITATION_STATUSES`, `ATTACHMENT_VISIBILITIES`, `CHAT_LIMITS`
  - [x] `normalizeEmail` (literal, bez plus-address transformacija) + `maskEmail` (fiksna širina maske — ne odaje dužinu adrese)
  - [x] `canPostToChannel` (+ `admin_only` i arhiviran kanal), `canModerateMessage`, `canInviteToProject`, `canManageMembers`, `canConvertMessage`
  - [x] `parseMentions` — najduže ime prvo, granica reči, `@` unutar mejl adrese se ignoriše
  - [x] `buildReplyPreview`, `sanitizeChatMessagePayload`, `nextItemRef`, `displayRoleLabel`
  - [x] dodat `messagesModerate` i `leaveProject` u permission ključeve — da `canModerateMessage` i „Leave project" ne proveravaju ime role
- [x] `lib/project-serializers.mjs` — **allowlist, nikad blocklist/delete**
  - [x] `serializeProjectForMember` / `serializeMilestoneForMember` / `serializeTaskForMember`
  - [x] `serializeProjectForAccess` — pun dokument **samo** owner i admin; sve ostale role idu kroz allowlist (client_lead dobija finance serializer eksplicitno u Fazi 2, ne nasleđivanjem)
  - [x] `serializeMemberPublic({ includeEmail })` — email samo owner/adminu
  - [x] `serializeInvitationPreview` + `serializeInvitationForManager` — bez `tokenHash`
- [x] `lib/route-match.mjs` — mini matcher za nove grane (`:param` pattern, prazan segment nikad ne prolazi)
- [x] `tests/chat-domain.test.mjs`
- [x] `tests/project-serializers.test.mjs` — **assertuje ODSUSTVO ključa, ne null** (`!('proposalId' in out)`)
- [x] `tests/route-match.test.mjs`
- [x] `npm test` prolazi zeleno, uključujući postojeće proposal testove (tačan broj je u status zaglavlju ovog dokumenta — namerno se ne ponavlja po sekcijama, jer raste sa svakim korakom)

---

## 3. Centralna autorizacija

- [x] `lib/chat-domain.mjs` — dodata čista `resolveRoleFromFacts({ isAdmin, isOwner, membership })`: admin → owner → aktivna membership → null. `removed`/`suspended` i nepoznata `membership.role` vrednost isto padaju na `null` (nerazlikovo od stranca). Testirano bez baze.
- [x] `lib/project-access.js`
  - [x] `resolveProjectAccess(user, project)` → `{ role, permissions, membership }` — DB ljuska tanka, sama odluka delegirana `resolveRoleFromFacts`
  - [x] `requireProjectPermission(user, project, permission)` — **bez odnosa (ili nepostojeći `project`) → `ProjectNotFoundError` 404, član bez dozvole → `ProjectForbiddenError` 403**; obe greške nose `.status`/`.statusCode` pa ih postojeći `errorResponse()` obrađuje bez izmena
  - [x] Ručno provereno (bez žive baze, admin/owner/null-project putanje) da rezolucija radi ispravno pre nego što bilo koji endpoint počne da je zove
- [x] `canAccessClientEntity` u `lib/project-proposal-domain.mjs` **ostao netaknut** — `resolveProjectAccess` ga poziva, ne duplira
- [x] Helper sloj u `route.js`: `requireAuthenticatedUser` (baca `apiError("Unauthorized", 401)`, hvata ga postojeći try/catch), `forbiddenResponse`, `notFoundResponse` — dodati odmah uz `canAccessClientProject`/`canAccessRequest`/`apiError`
- [-] Matcher tabele po verb-u (`matchRoute` + prazan niz ruta ožičen u svaki verb handler) — **namerno odloženo**: prazna tabela ožičena u sve handlere je runtime trošak na svaki zahtev bez ijednog ponašanja dok ne postoji makar jedna prava ruta. `lib/route-match.mjs` je gotov i testiran (sekcija 2); prva tabela se pravi zajedno sa prvim pravim `chat/*` ili `invitations/*` handlerom u sekciji 5/6, ne pre toga.
- [ ] Nove grane grupisane redosledom: auth/invitations → membership → member mgmt → project reads → chat → milestone chat → attachments → proposal/finance (primenjuje se od sekcije 4 nadalje)
- [ ] Postojeće nedosledne 401/403 provere u starim granama (npr. `!canAccessClientProject` nekad 401 "Unauthorized", nekad 403 "Forbidden" za isti slučaj) — **nisu dirane u ovoj sekciji**; ispravljaju se usput kad se ta konkretna grana rewire-uje u sekciji 4, ne kao samostalan refaktor

---

## 3A. Cross-cutting invarijante

Pravila koja važe kroz sve preostale sekcije. Puna razrada: [PROJECT_CHAT_PLAN.md](./PROJECT_CHAT_PLAN.md) sekcija 4A. Najveći rizik nije da je plan pogrešan, nego da se neka od ovih invarijanti primeni **nedosledno** kroz ~18 endpointa — zato se čekiraju ovde, a ne unutar svake sekcije ponaosob.

- [ ] **I1 Child-resource autorizacija** — `projectId` iz učitanog resursa, nikad iz URL/body. Primenjeno u: 4, 6, 12
- [x] **I2 Atomičnost accept-a** — `acceptInvitationForUser` u route.js: membership + invitation status u jednoj `session.withTransaction`, **membership prvi** (redosled deo koda, ne samo komentara); bez fallback grane (transaction-not-supported → čist 503, isti obrazac kao postojeći phase-archive kod); audit + sistemska poruka post-commit, best-effort. **Uživo potvrđeno pod pravom konkurencijom**: dva paralelna accept poziva istim tokenom → tačno jedno `ProjectMember` (test F, Sekcija 5)
- [x] **I3 Sudar sa postojećim nalogom** — register-kroz-poziv za mejl koji već ima nalog → 400, nijedan duplikat naloga. **Uživo potvrđeno** (test C)
- [~] **I4 Token hygiene** — delimično: raw token se nigde ne loguje (potvrđeno) · cookie briše se i na uspeh i na neuspeh (mismatch/revoked/expired) — **uživo potvrđeno**, `Set-Cookie` sa `Max-Age=0` na 403 · `history.replaceState` posle uspešnog preview-a u `app/invite/page.js`. **Nije urađeno**: `Referrer-Policy: no-referrer` u `next.config.js`; rate limit na slanje poziva. Ostaju kao otvorena stavka, ne blokiraju Sekciju 6
- [x] **I5 Konkurentnost kroz indeks** — grupni kanal: `getOrCreateGroupChannel` sa duplicate-key fallback na postojeći (Sekcija 5, unapred za Sekciju 6). DM par i `ProjectItem.ref` retry ostaju za Sekcije 6/12
- [ ] **I6 Fan-out iz aktivnog članstva** — uklonjen/suspendovan član ne dobija ništa; DM pravila posle uklanjanja. Sekcija 10
- [ ] **I7 Javni prilozi** — prihvaćen rezidualni rizik + **helper tekst uz attach dugme** (ne samo u `.md`). Sekcija 8
- [x] **I8 Polling budžet** — 4s samo aktivan kanal, pauza na `document.hidden`, jedan `messages` query po ekranu, cursor paginacija limit 50, debounce na search. Zatvoreno u Sekciji 11 (debounce je bio jedini stvarno nedostajući deo; ostalo već strukturno zadovoljeno od Sekcije 7/8)
- [ ] **I9 Feature flag** — samo **UI ulaz** (Chat stavka u navigaciji), rute se ne flaguju. Sekcija 9
- [x] **I10 Istorija preživljava hard delete** — identitet denormalizovan pri upisu. Modeli već usklađeni (vidi sekciju 1); ponašanje pri brisanju naloga ide u sekciju 4

---

## 4. Postojeći endpointi — member-aware

**Pravilo za celu sekciju — resource-first autorizacija.** `projectId` se izvodi iz **učitanog resursa**, nikad iz URL-a ili body-ja. Resurs se učita prvi, projekat se izvede iz njega, pa se tek onda zove `requireProjectPermission` nad tim projektom. Kada URL nosi i roditelja i dete, `:projectId` služi samo za učitavanje, a pripadnost deteta roditelju se **potvrđuje** pre provere prava — nepodudaranje je **404, ne 403** (403 bi potvrdio da resurs postoji). Detaljno u [PROJECT_CHAT_PLAN.md](./PROJECT_CHAT_PLAN.md) sekcija 7.

- [x] **Preduslov, urađeno pre bilo kog endpointa ispod:** `resolveProjectAccess` ožičen kroz `restrictForClosedProject` ([lib/project-access.js](../lib/project-access.js)) — poslednji korak u rezoluciji, posle koraka 1–4. Namerno **pre**, ne posle, glavnih bullet-a ove sekcije: svaki endpoint koji zove `requireProjectPermission` nasleđuje zatvaranje projekta od prvog dana, umesto da se dodaje naknadno po završenim endpointima. Integraciono provereno (owner na zatvorenom → `chatWrite: false`, `projectRead: true`; admin na zatvorenom → nepromenjen).

- [x] `GET /api/client-projects` — scoping proširen na aktivno članstvo (`ProjectMember.find({userId, status:'active'})` dodaje `_id: {$in: ...}` u `$or`); owner/admin i dalje dobijaju sirov dokument (`canAccessClientEntity` kratko-spaja pre ijednog `resolveProjectAccess` poziva — nula dodatnih upita za postojeće korisnike); projekat dostupan samo preko članstva ide kroz `serializeProjectForMember`
- [x] `GET /api/client-projects/:id` — isti princip; `serializeProjectForAccess` bira projekciju
- [x] **Ispravka nad TODO tekstom:** ne postoji standalone `GET /api/project-proposals*` ruta — proposali su uvek ugnežđeni pod `client-projects/:id/proposals[/:proposalId]`. Gate je `requireProjectPermission(user, project, "proposalsRead")` pozvan **direktno** za tu granu (ne posle opšteg `projectRead`) — tako član sa `projectRead` ali bez `proposalsRead` dobija 403 (ima odnos prema projektu, nema prema ponudi), dok neko bez ikakvog odnosa dobija 404 pre nego što se `proposalsRead` uopšte ispita
- [x] `GET/POST /api/client-projects/:id/messages` (milestone chat) — otvoren za članove kroz `requireProjectPermission(..., "milestoneRead"|"milestoneComment")`; member whitelist `{message, question}` (bez `change_request` — taj tok ostaje između klijenta i operatora)
  - [x] `milestone.projectId === project._id` je **već bilo tačno by construction** — milestone se traži unutar `project.milestones` niza već učitanog, permission-proverenog projekta, nikad iz posebne kolekcije po klijentskom ID-ju. Nema šta da se dodaje, samo potvrđeno i upisano kao napomena u kodu
  - [x] `authorName`/notify tekst popravljeni da ne koriste `project.clientName` za autora koji nije vlasnik (bio bi pogrešno pripisan)
- [x] `POST /api/upload` — projectId grana dozvoljena članu sa `filesUpload`; `visibility` na attachment-u je `ChatMessage` schema default (Sekcija 6), `/api/upload` ga ne dodaje — ispravljeno razumevanje u odnosu na prvobitni tekst ove stavke
  - [x] `projectId` iz body-ja se koristi samo za učitavanje projekta, prava se proveravaju nad učitanim dokumentom
- [x] `project-requests/*` — **bez novog pristupa članovima** (i dalje isključivo owner/admin), ali tri `canAccessRequest` grane ispravljene sa 401→404 (detalj/read, POST sub-actions, upload requestId grana) — „nema odnosa" mora biti 404 svuda, ne samo na client-projects
- [x] List endpointi ne vraćaju ni metapodatke o ponudama (`hasProposal`, `proposalCount`…) — provereno gredom: takvo polje ne postoji nigde u kodu, ništa nije trebalo uklanjati
- [x] Usput ispravljene nedosledne 401/403/404 u svim granama koje su rewire-ovane ovom sekcijom (client-projects detail/list/messages, upload, project-requests × 3)

### 4-lifecycle — brisanje naloga i zatvaranje projekta (I10, plan sekcija 5A)

`resolveProjectAccess` je već ožičen na vrhu ove sekcije — ovde ostaje samo strana koja **postavlja** `ownerAccountDeletedAt`, nezavisno je od read-side bullet-a iznad i ne blokira ih.

- [x] `DELETE /api/users/:id` — pri brisanju naloga:
  - [x] postavi `ownerAccountDeletedAt` na svim `ClientProject` tog klijenta (po `clientUserId` **i** `clientEmail`)
  - [x] prebaci njegove `ProjectMember` redove u `status: 'removed'` (red ostaje — `name`/`email` nose istoriju)
  - [x] audit `member.removed` za svaki
  - [x] postojeći 409 guard za projekat u toku **ostaje nedirnut** — verifikovano uživo, i dalje blokira
  - [x] **Brisanje naloga + zatvaranje projekata + uklanjanje članstava su jedna transakcija** (`session.withTransaction`, isti obrazac kao postojeći phase-archive kod) — primenjeno I2 rezonovanje (atomičnost) na brisanje naloga, ne samo na invitation accept; audit insert je post-commit, best-effort, `.catch()` ne poništava već izvršeno brisanje
- [x] Član koji zadrži nalog vidi projekat u My Projects i posle zatvaranja — read-only, sa istorijom chata
- [x] Provereno da članstvo **ne ograničava sopstveni nalog** — `resolveProjectAccess` je po projektu, ne po nalogu; `ownedProjectQuery` i `ProjectMember` cleanup su nezavisne grane iste transakcije, pa se ispravno primenjuju ZAJEDNO na osobu koja je i vlasnik svog projekta i collaborator na tuđem

**Verifikovano uživo, sa jednorazno kreiranim test nalozima/projektom/članstvom (kreirano → testirano → obrisano, baza vraćena na tačno prethodno stanje, `users`/`clientprojects` count nepromenjen posle):**

1. Projekat u statusu `in_progress` (aktivan) → DELETE vlasnika i dalje **409** — guard netaknut
2. Projekat prebačen na `completed` → DELETE vlasnika → **200**, nalog stvarno obrisan, `ownerAccountDeletedAt` postavljen, `status` polja projekta netaknuta
3. **Prva prava end-to-end potvrda member pristupa sa pravim `ProjectMember` redom** (ranije dostupno samo kroz fixtures/unit testove): surviving collaborator vidi zatvoreni projekat u `GET /client-projects` listi (bez `clientEmail` ključa) i u detalju (potpuna allowlist projekcija, 200) — `resolveProjectAccess` → `restrictForClosedProject` → `serializeProjectForAccess` lanac radi ispravno sa realnim DB upitom, ne samo sa fabrikovanim objektima
4. DELETE collaborator naloga → **200**, `ProjectMember.status` → `removed`, `name`/`email` sačuvani, tačno jedan `ProjectAuditLog` red (`member.removed`, `reason: account_deleted`, ispravan actor/target)

### 4b. E2E odmah po Sekciji 4 — ne čekati kraj Faze 1

Sekcija 4 je jedina koja menja endpointe koje živi klijenti već koriste i jedina koja otvara projekat nekome ko nije vlasnik. Od merge-a je curenje moguće, pa se ovi testovi pokreću **odmah**, sa ručno ubačenim `ProjectMember` redom i dva tokena — ne traže ni chat, ni invite flow, ni UI.

**Napomena o alatu:** SEC 1, 2, 7, 8, 10 (owner), 11, 13-analog su ispod verifikovani **uživo protiv realne DB-je** (`npm run dev`, real admin/owner/stranger JWT za postojeće naloge, isključivo GET/read pozivi + jedan POST /upload bez fajla). Nijedan test nije upisao niti izmenio podatak. Za pravi `ProjectMember` red (collaborator success-path) nema dovoljno osnova da se piše u živu bazu bez izričite dozvole — taj deo ostaje na `tests/project-serializers.test.mjs` (key-absence, već zeleno) dok Sekcija 5 ne napravi invite/accept da se test uradi kroz pravi tok.

- [x] SEC 1 — `GET /api/client-projects` kao stranac: sopstvena lista ne sadrži tuđ projekat (verifikovano uživo, real user)
- [x] SEC 2 — `GET /api/client-projects/:id` kao owner/admin: **identičan** skup ključeva kao pre izmene (verifikovano uživo — svi originalni ključevi prisutni: `clientEmail, requestId, archivedProposalIds, events, milestones[].proposalId/revision/changeHistory`, ...)
- [ ] SEC 3/4 — `GET /api/client-projects/:id/proposals[/:proposalId]` kao collaborator → **403** (ispravljena putanja; kod postoji i logika je testirana na `resolveProjectAccess` nivou, ali sam poziv čeka pravi `ProjectMember` red iz Sekcije 5 da se izvede uživo)
- [ ] SEC 5 — `PUT/PATCH` proposal/milestone mutacije → i dalje netaknuto (`canPerformClientProposalAction`), verifikovano uživo da stranac i dalje biva odbijen (401, nepromenjeno — te grane namerno nisu rewire-ovane ovom sekcijom)
- [-] SEC 6 — duplikat SEC 5, sažeto gore
- [x] SEC 7 — `GET /api/project-requests/:id` postojećeg (tuđeg) zahteva kao stranac → **404** (verifikovano uživo, real request id — pre izmene bio 401)
- [x] SEC 8 — nečlan: `GET /api/client-projects/:tuđiId` → **404** (verifikovano uživo, real project id)
- [x] SEC 10-analog — treći korisnik na `POST /upload` sa tuđim `projectId` (i sa realnim fajlom) → **404**, bez ijednog Cloudinary upload-a (verifikovano uživo)
- [x] SEC 11 — **owner regresija: odgovor identičan kao pre izmena** — verifikovano uživo za `GET /client-projects/:id` (isti skup ključeva) i za milestone chat GET (200, nepromenjeno)
- [ ] SEC 13 — `.../proposals/:idIzProjektaB` sa `?projectId=A` — nije primenjivo u ovom obliku: proposal ruta je uvek `client-projects/:id/proposals/:proposalId`, projectId dolazi iz URL-a roditelja, ne iz query-ja. Stvarni resource-first rizik ovde je collaborator-only slučaj iz SEC 3/4, pokriven istim mehanizmom
- [ ] SEC 14 — `POST /api/client-projects/:A/messages` sa `milestoneId` iz projekta B — kod je **bezbedan by construction** (`project.milestones.find()` ne može pogoditi tuđi milestone), ali test sa dva realna projekta i pravim payload-om nije izveden uživo (nizak prioritet — logika je strukturno neprobojna, ne zavisi od podataka)

---

## 5. Invitations & membership API

- [x] `lib/chat-domain.mjs` dopune: `ChatStateError` (409, state-conflict — revoked/accepted/expired, odvojeno od 403 permission i 400 validation) · `generateInviteToken`/`hashInviteToken` (sha256, jedna imenovana funkcija na oba mesta da kreacija i lookup ne mogu da se raziđu) · `INVITABLE_ROLES` (`collaborator`,`viewer` — Faza 1 UI ne nudi `client_lead`/`project_admin`) · `sanitizeInvitationPayload` · `resolveInvitationAction` (čista odluka: active→already_member, pending→pending_exists, removed/ništa→create) · `assertInvitationAcceptable` (status/rok pre identiteta — mrtav poziv se ne koristi za probing prave adrese). 19 novih testova.
- [x] `models/ProjectInvitation.js` — dodato `roleLabel` polje (nedostajalo je; plan ga je pominjao u payload-u ali model ga nije imao). `serializeInvitationForManager`/`serializeInvitationPreview` popravljeni da koriste `displayRoleLabel(intendedRole, roleLabel)` umesto samo default naziva role.
- [x] `serializeInvitationPreview` dobio `status` polje — stranica može da prikaže "revoked"/"already used" umesto generičke greške; `expiresAt` ostaje da klijent sam proveri istek.
- [x] `POST /api/client-projects/:id/invitations` — permission `membersInvite`; aktivan član → 409; pending → 409 (vraća `invitationId` za resend/revoke); removed → ne blokira (reaktivacija se dešava na accept, ne ovde); guard da vlasnik ne može pozvati sopstveni mejl
- [x] `GET /api/invitations/preview?token=` — samo `serializeInvitationPreview` + HttpOnly `dmdevelon_invite` cookie (1h); bez auth-a
- [x] `POST /api/invitations/accept` — **idempotentan kroz transakciju** (I2); email match obavezan; mismatch → 403 sa maskiranom adresom; state-conflict (revoked/accepted/expired) → 409
- [x] `POST /api/client-projects/:id/invitations/:invId/resend` — novi tokenHash + rok; samo za `pending`
- [x] `DELETE /api/client-projects/:id/invitations/:invId` — revoke; samo za `pending`
- [x] `GET /api/client-projects/:id/members` — aktivni članovi (live `User` podaci preko `serializeMemberPublic`, sa fallback na denormalizovano ime/mejl) + pending pozivi (samo za `membersInvite`); email samo owner/adminu
- [x] `PATCH /api/client-projects/:id/members/:memberId` — `membersManage`; role ograničena na `INVITABLE_ROLES`; audit samo kad se rola stvarno menja
- [x] `DELETE /api/client-projects/:id/members/:memberId` — `removed`
- [x] `POST /api/client-projects/:id/leave` — collaborator/viewer/project_admin; owner i admin nemaju `leaveProject` dozvolu (nema member red da se napusti)
- [x] `POST /api/auth/register` + `inviteToken` — server koristi `invitation.emailNormalized` (ignoriše body email), `emailVerified: true`, `verifyToken` se ne generiše, odmah accept kroz istu `acceptInvitationForUser` funkciju koju koristi i `/invitations/accept`
- [x] `hooks/useAuth.js` — `register(name, email, password, extra={})` proširen dodatnim opcionim parametrom (backward-compatible, jedini postojeći pozivalac šalje tačno 3 argumenta) da bi mogao da nosi `inviteToken`
- [x] Audit log upis za svaki događaj: created / resent / revoked / accepted / role_changed / removed / left — svi post-commit, best-effort, `.catch()` ne ruši glavni zahtev
- [x] `emailTemplates.projectInvite` — ko poziva, projekat, prava, lična poruka, dugme + tekstualni link + rok; `recipientEmail` (stvarna adresa u mejlu) namerno odvojen od `maskedEmail` (masked verzija za preview stranicu) — različita polja, različita svrha
- [x] `app/invite/page.js` — preview → registracija (email polje `disabled`, prikazuje samo maskiranu adresu) ILI prijava na istoj stranici (toggle); već prijavljen → automatski accept; mismatch → ponuda "sign out and use a different account"

**Deljena logika (nova, korišćena i od accept i od register-kroz-poziv):**

- `acceptInvitationForUser(invitation, project, user)` u route.js — jedna transakcija (membership create/reactivate + invitation status flip, redosled membership-pa-status po I2), post-commit audit + sistemska poruka
- `getOrCreateGroupChannel(project)` / `postSystemMessage(channel, body)` — mali, samostalan deo Sekcije 6 povučen unapred jer accept treba da upiše "`<Name>` joined the group"; Sekcija 6 ponovo koristi iste funkcije, ne pravi svoje

**Uživo test (35 provera, jednorazni test podaci kreirani→testirani→obrisani, uz izričitu dozvolu):**
create/duplicate/revoke/resend/permission-boundary (11) · preview + register-kroz-poziv sa punim lancem provera (invitation accepted, ProjectMember, audit, chat kanal, sistemska poruka) (9) · I3 duplicate-account guard + accept preko postojećeg naloga (4) · email mismatch bez otkrivanja prave adrese (1) · istekao poziv (2) · **konkurentnost — dva paralelna accept poziva istim tokenom, tačno jedno članstvo** (2) · member management: patch/leave/owner-ne-može/remove (5). Sve 35 prošlo, baza vraćena na tačno prethodno stanje.

**Pravi bug pronađen i ispravljen tokom uživo testa:** `ProjectMember.create({...}, { session })` — Mongoose tretira single-object + options kao DVA dokumenta za upis (options objekat kao drugi dokument!) kad prvi argument nije niz, ne kao "dokument + opcije". Ispravljeno na `ProjectMember.create([{...}], { session })`. Bez uživo testa ovo bi prošlo sintaksnu proveru i sve postojeće unit testove neotkriveno — pure funkcije ne dodiruju bazu, a ovo je čisto Mongoose API ponašanje.

---

## 6. Chat API

- [x] `lib/chat-domain.mjs` dopune: `canViewAttachment(role, visibility)` (project_shared→svi, client_only→owner+admin, internal_team→samo admin) · `escapeRegExp` (search input nikad ide sirov u `$regex`). 8 novih testova.
- [x] `lib/chat-serializers.mjs` (novi fajl) — `serializeChatMessageForAccess` (attachment filtriranje po `canViewAttachment`, soft-deleted poruka zadržava `convertedTo`/`flag`/`pinned` ali redaguje `body`/`attachments` za SVAKOG gledaoca), `serializeChannelSummary`, `serializeChannelDetail`, `serializeChannelMember`. 16 novih testova — uključujući isti „ključ mora biti odsutan, ne `undefined`" bug koji smo uhvatili u Sekciji 4, ovog puta na `memberUserIds` (prisutan samo za `kind: 'dm'`).
- [x] `GET  /api/chat/channels` — unread + lastMessage; grupni kanal se **lazy kreira ovde** za svaki projekat kom korisnik ima pristup (owner/admin/member); **DM filtriran po `memberUserIds` već u listi** — projekat kome je pristup u međuvremenu izgubljen tiho isključuje i njegove DM-ove iz liste
- [x] `GET  /api/chat/channels/:id` — meta + roster (`loadChannelRoster`: owner + aktivni `ProjectMember`; globalni admin namerno nije mention/roster kandidat u Fazi 1)
- [x] `GET  /api/chat/channels/:id/messages?before=&limit=50&flag=&q=` — `limit` ograničen na [1,100]; `q` prolazi kroz `escapeRegExp`; `flag=pinned` je poseban alias za `pinned:true`, ne pravi flag vrednost
- [x] `GET  /api/chat/channels/:id/pinned`
- [x] `POST /api/chat/channels/:id/messages` — `chatWrite`; DM dodatno `memberUserIds` (kroz `loadChannelWithAccess`); slanje **implicitno označava kanal pročitanim za pošiljaoca** — niko ne vidi sopstvenu poruku kao nepročitanu
- [x] `POST /api/chat/channels/:id/read` — opcioni `messageId`, inače "sada"
- [x] `POST /api/chat/dm` — `{ projectId, userId }` (plan je pominjao samo `{userId}`, ali `dmKey` je unique po `(projectId, dmKey)` — ispravljeno u dokumentaciji); get-or-create preko `dmKeyFor` u `getOrCreateDmChannel`, **duplicate key → učitaj postojeći** (I5), ne „proveri pa kreiraj"; cilj mora već biti pravi učesnik ISTOG projekta (owner/admin/member) — ne može se DM-ovati proizvoljan stranac pogađanjem `userId`-ja
- [x] `POST /api/chat/channels/:id/clear` — postavlja `ChatRead.{lastReadAt,clearedAt}` za **tog** korisnika na "sada"; poruke ostaju svima ostalima; nova poruka POSLE clear-a se ispravno ponovo broji kao nepročitana (`readCutoff` = max(lastReadAt, clearedAt))
- [x] Čitanje poruka poštuje `clearedAt` pozivaoca — i u listi poruka i u pinned listi i u lastMessage prikazu
- [x] `POST /api/chat/messages/:id/pin` — `{ pinned }`
- [x] `PATCH /api/chat/messages/:id` — edit, **samo autor** (bez admin override-a, za razliku od delete-a), `editedAt`; obrisana poruka se ne može editovati (409)
- [x] `DELETE /api/chat/messages/:id` — soft delete, autor ili admin (`canModerateMessage`) — druga (ne-autor, ne-admin) osoba dobija 403
- [x] Lazy kreiranje `group` kanala — u `GET /chat/channels` (deljena `getOrCreateGroupChannel` funkcija, ista koja je već korišćena u Sekciji 5 za sistemsku poruku pri accept-u)
- [x] Validacija: `sanitizeChatMessagePayload` (već testiran u Sekciji 2) pokriva `cleanString` max 10000, flag enum, reply iz istog kanala, mentions ∩ članstvo, `admin_only` → 403 (kroz `canPostToChannel` unutar njega)
- [x] Sve grane kroz `requireProjectPermission` (preko `loadChannelWithAccess`/`loadMessageWithAccess` deljenih helpera); svi odgovori sa `getCorsHeaders()`

**Uživo test (49 provera, jednorazni test podaci — 5 naloga, 1 projekat, 3 članstva — kreirani→testirani→obrisani):** lazy kreiranje kanala + izolacija od stranca (4) · detalj + roster + 404 za stranca (4) · slanje + tačan unread (nepročitano samo za tuđe poruke) + read (7) · viewer read-only (2) · flag filter + pretraga + regex metakarakteri u pretrazi ne ruše upit (4) · pin (2) · reply sa denormalizovanim preview-om (2) · @mention razrešen na pravi userId (1) · **filtriranje priloga po vidljivosti za tri različite role u ISTOJ poruci** (4) · edit samo autor + delete autor-ili-admin, treće lice ne može ni jedno ni drugo (6) · **DM: get-or-create vraća isti kanal, cilj mora biti pravi učesnik projekta, treći član ne vidi DM ni u listi ni direktno ni ne može da pošalje u njega** (7) · clear je per-user i nova poruka posle clear-a se ispravno broji (5) · stranac ne može ništa (1). Sve 49 prošlo **bez ijedne ispravke koda** — prva sekcija gde uživo test nije otkrio bug.

---

## 7. Frontend — hookovi

- [x] `hooks/useProjectChat.js`
  - [x] `useChatChannels()` — 15s; dodatno `startDirectMessage` mutacija (`POST /chat/dm`) — nije bila eksplicitno u TODO listi, ali endpoint iz Sekcije 6 mora nekako biti dostupan iz UI-ja
  - [x] `useChatMessages(channelId, { flag, q })` — `useInfiniteQuery` (prva upotreba u ovom kodbejzu; TanStack Query v5 zahteva eksplicitni `initialPageParam`), 4s, `staleTime: 0`, `refetchOnMount: 'always'`. Stranice stižu najnovije-prvo (`before` kursor traži starije); `messages` izlaz je jedan hronološki niz (`pages.reverse().flat()`)
  - [x] mutacije: `sendMessage`, `editMessage`, `deleteMessage`, `togglePin`, `markRead`, `uploadAttachment` — plus `clearConversation` (isti razlog kao `startDirectMessage`: endpoint postoji od Sekcije 6, mora biti dostupan)
  - [x] **`convertMessage` namerno NIJE dodat** — `POST /chat/messages/:id/convert` ne postoji do Sekcije 12; hook za nepostojeću rutu bi bio mrtav kod
  - [x] `useChatPinned(channelId)` — mala zasebna funkcija u istom fajlu za `GET /chat/channels/:id/pinned` (PinnedBar iz Sekcije 11 treba nešto gotovo)
- [x] `hooks/useProjectMembers.js` — `members`, `invitations`, `invite`, `resendInvitation`, `revokeInvitation`, `updateMember`, `removeMember`, `leaveProject`; `leaveProject` dodatno invalidira `client-projects` i `chat-channels` (napuštanje projekta mora da ga skloni i sa liste kanala)

**Verifikacija:** `npm test` (130/130, nepromenjeno — hookovi nisu pure funkcije pa nisu node:test-abilni). Sintaksno provereno (`node --check`). Uživo: privremena test stranica (van `app/`, izbrisana posle) montirala sva četiri hook-a kroz pravi dev server — stranica se kompajlira i renderuje bez greške, početno SSR stanje (`loading: true`, `count: 0`) je razumno. Otkriven usput: Next.js App Router tretira foldere sa `_` prefiksom kao privatne (isključene iz rutiranja) — prvi pokušaj (`app/__hooktest`) je pao na 404 iz drugog razloga, ne iz mog koda. Dublja provera (da li se stvarni fetch posle hidratacije zaista okida) čeka Sekciju 8, gde ovi hookovi prvi put dobijaju pravu, interaktivnu komponentu da ih koristi u browseru.

---

## 8. Frontend — komponente

- [x] `components/chat/ProjectChat.jsx` — shell, dve kolone (`ChannelSidebar` + glavni panel), `viewerRole` prop (`"client"`|`"admin"`, samo utiče na bubble poravnanje/moderaciju klijentski — server ostaje jedini autoritet); prati prvi kanal iz liste čim stigne, resetuje `replyTo` na promenu kanala, prazno/loading stanje pre nego što ijedan kanal postoji
- [x] `components/chat/ChannelSidebar.jsx` — tri sekcije: Channels (grupni kanali + numerički unread bedž), Members (roster aktivnog kanala, klik-za-DM, self isključen), Direct (postojeći DM-ovi, labela = ime DRUGOG učesnika izvedeno iz rostera). **Numerički unread bedž** (ne samo tačka kao drugde u aplikaciji) — svesna odluka, chat generiše više poruka nego ostala mesta pa je broj korisniji signal
- [x] `components/chat/ChatHeader.jsx` — ime/ikonica kanala (Hash za group, MessageCircle za DM) + Select filter (All/Pinned/po flagu) + Input pretraga
- [x] `components/chat/PinnedBar.jsx` — collapsible, `null` kad nema pinovanih; koristi `useChatPinned`
- [x] `components/chat/MessageList.jsx` — `useChatMessages(channelId, {flag, q: search})` direktno; scroll-to-bottom samo na novu poruku (ne na prepend), `scrollTop < 80` okida `loadMoreHistory()` uz očuvanje scroll pozicije preko `scrollHeight` delte; `markRead` na svaku promenu `messages.length`
- [x] `components/chat/MessageBubble.jsx` — sistemska poruka kao razdelnik, korisnička kao bubble (isMine boja/poravnanje po `MilestoneChat.jsx` konvenciji); `FLAG_META` mapa boja/ikonica/labela tačno po planu; reply citat, pinned/edited indikator, inline edit, prilozi (image/pdf), soft-deleted placeholder; dropdown Reply/Pin/Edit(samo autor)/Delete(autor ili `canModerate`) — **namerno bez „Convert to…"** (Sekcija 12)
- [x] `components/chat/MessageComposer.jsx`
  - [x] auto-grow textarea (max 200px); **Enter = novi red (podrazumevano, netaknuto), Ctrl+Enter/Cmd+Enter = pošalji**
  - [x] Send dugme, attach (Paperclip, `uploadAttachment` mutacija sa validacijom tipa/veličine), flag picker (dropdown), `@` mention autocomplete (regex na poziciju kursora, filtrira `useProjectMembers(projectId).members`)
  - [x] **Deljeni query key sa `MessageList`** — `flag`/`search` prosleđeni kroz prop samo da bi `useChatMessages(channelId, {flag, q})` u oba mesta rešio na ISTI React Query cache/polling ciklus, umesto dva nezavisna pollinga za isti kanal
- [-] `components/chat/ConvertMessageDialog.jsx` — **namerno odloženo za Sekciju 12**: `POST /chat/messages/:id/convert` ne postoji dok Sekcija 12 ne implementira `ProjectItem`/convert logiku; dijalog bez cilja bi bio mrtav kod. `MessageBubble`-ov dropdown eksplicitno nema „Convert to…" stavku iz istog razloga
- [x] `components/chat/InviteMemberDialog.jsx` — email (required) + rola Select (**samo Collaborator/Viewer** — `client_lead`/`project_admin` rezervisani za Fazu 2, isto kao i u planu) + roleLabel (opciono) + lična poruka (opciono)
- [x] `components/chat/TeamPanel.jsx` — aktivni članovi (ime, roleLabel, email ako prisutan, „(you)" sufiks, Leave za sebe / Remove za druge) + pending pozivi (email, rola, ko je pozvao, Resend/Revoke ikonice) + „Invite team member" dugme koje otvara `InviteMemberDialog`; destruktivne akcije (remove/leave) idu kroz `window.confirm()`
  - [x] `onOpenTeamPanel` dostupan iz `ChannelSidebar`-a **za oba `viewerRole`**, ne samo za admina — originalni zahtev eksplicitno traži da i klijent može da pozove saradnika sa svog dashboard-a, a `membersInvite` dozvolu ionako drže owner/admin/client_lead na nivou servera, ne globalni admin flag
- [x] Globalni admin se ne prikazuje kao „superadmin" — `roleLabel`/`displayRoleLabel` iz Sekcije 2 već rešava poslovnu etiketu, komponente ovde je samo renderuju
- [x] Boje/ikonice/labele flagova tačno po mapi iz plana (`FLAG_META` u `MessageBubble.jsx`, `FILTER_OPTIONS` u `ChatHeader.jsx`)
- [x] Refaktor: `readAsDataURL` → `lib/utils.js` (dodata jednom, uklonjena duplirana lokalna definicija sa 3 mesta: `hooks/useAuth.js`, `components/dashboard/MilestoneChat.jsx`, `components/dashboard/RequestConversation.jsx` — sve tri sada importuju iz `@/lib/utils`)

**Verifikacija:** `npm test` i dalje 130/130 (nepromenjeno — nijedna pure funkcija nije dirana u ovoj sekciji). Sintaksno provereno svih 9 novih/izmenjenih `.jsx` fajlova (`.jsx`→privremeni `.js` kopija trik, isti kao u Sekciji 7, jer `node --check` ne prepoznaje `.jsx` ekstenziju direktno). Uživo mount test: privremena ruta `app/chattestxyz/page.js` (van postojeće strukture, izbrisana posle) je renderovala `<ProjectChat viewerRole="client" />` kroz pravi dev server — `curl` na `/chattestxyz` vraća **200**, marker `CHAT_MOUNT_OK` prisutan u HTML-u, `ProjectChat` ispravno prikazuje loading spinner (bez auth tokena u ovom curl testu `useChatChannels` ostaje u loading stanju, što je očekivano ponašanje, ne greška) — nema Next.js error overlay-a, `providers/QueryProvider.js` iz root layout-a već pokriva sve nove hookove bez dodatnog provider wiring-a. Ruta potom obrisana i potvrđena kao 404.

---

## 9. Integracija u dashboard

- [x] `app/dashboard/page.js` — `DASHBOARD_TABS` → `["services", "testimonials", "chat"]`
- [x] Nav dugme **Chat** sa ikonicom (`MessagesSquare`, različita od `MessageSquare` koju već koristi Testimonials), odmah posle Testimonials + unread tačka (`totalUnreadChat = chatChannels.reduce(...unreadCount)` preko `useChatChannels()`, deli isti `['chat-channels']` query ključ sa `ProjectChat`-om iznutra — nema duplog pollinga)
  - [x] Tačka se namerno **ne prikazuje dok je Chat tab aktivan** (odstupanje od plana koji je pominjao samo „unread tačku" bez tog detalja) — na aktivnom dugmetu je pozadina već `bg-[#FFB633]`, ista boja kao tačka, pa bi bila nevidljiva; a i nema smisla da govori „imaš nepročitano" na tabu koji upravo gledaš
- [x] `{activeTab === "chat" && <ProjectChat viewerRole="client" />}`
- [x] **Invite team member** dugme na kartici projekta (u „Projects & history" listi, pored „View progress", sa `e.stopPropagation()`) — otvara `TeamPanel` sa `projectId={project._id}`; dugme na `pendingRequests` karticama namerno izostavljeno (zahtev još nije pravi `ClientProject`, nema `projectId` niti chat kanal dok ne bude odobren)
- [x] `app/admin/page.js` — tab `chat` u `menuItems` (odmah posle „Client Projects", ikonica `MessagesSquare`), `ADMIN_TABS`, `renderContent()` → `<ProjectChat viewerRole="admin" />`. Admin nema poseban project-picker — `ChannelSidebar`-ova „Channels" lista (jedan grupni kanal po projektu kom admin ima pristup) služi kao picker, isto kao za klijenta, samo duža lista

**Verifikacija:** `npm test` nepromenjeno 130/130. Sintaksno provereno `node --check` direktno na oba fajla (`dashboard/page.js`, `admin/page.js` — oba su već `.js`, nije trebao `.jsx`→`.js` kopija trik iz Sekcije 8). Uživo: `curl` na `/dashboard` i `/admin` na pravom dev serveru → oba **200**, telo sadrži samo „Loading…" (očekivano — oba `useEffect`-based auth gate-a počinju sa `loading:true` bez prave sesije u ovom testu), bez `Application error`/error-overlay markera. Ovo je isti nivo provere kao Sekcije 7/8: budući da su i `ProjectChat`, `TeamPanel`, `useChatChannels` i nove ikonice statički importovani na vrhu oba fajla, Next.js/Turbopack kompajlira ceo modul-graf pri prvom zahtevu bez obzira da li JSX grana koja ih koristi trenutno renderuje — čist 200 bez overlay-a znači da se ceo lanac importa (uključujući sve `components/chat/*` iz Sekcije 8) uspešno razrešio i kompajlirao. **Puna interaktivna provera (klik na Chat tab, slanje poruke, otvaranje Invite dijaloga u pravom browseru sa pravim nalogom) nije urađena** — zahteva pravu ulogovanu sesiju, što prevazilazi compile-time proveru korišćenu do sada; ostaje kao otvorena stavka za ručnu proveru pre produkcije, van obima automatskih testova ovog projekta.

---

## 10. Notifikacije i email

- [x] `POST /api/notifications/read` — podržava `{ channelId }` samostalno (novi `else if` grana **pre** postojeće `entityId` grane, tako da postojeći pozivaoci koji nikad ne šalju `channelId` ostaju netaknuti), plus `{ entityId, channelId }` zajedno ako je pozivalac zna oboje
- [x] `lib/notify.js` — `"chat_message"` dodat u `DIGEST_TYPES`; `"chat_mention"` **nije** → mejl odmah preko postojeće `if (email && !DIGEST_TYPES.has(type))` grane, bez izmene te logike
  - [x] `notifyUser()` dobio novi `channelId` parametar, upisuje se na `Notification` dokument (polje je već postojalo od Sekcije 1, samo ga `notifyUser` do sada nije punio)
  - [x] **Ispravka nad tekstom plana:** `DIGEST_TYPES` u `lib/notify.js` kontroliše samo _inline vs. odloženo_ slanje u `notifyUser()`; sam digest cron (`runEmailDigest()` u `route.js`) ima **svoju odvojenu, hardkodiranu** `type: {$in: [...]}` listu koja se nigde ne referiše na `DIGEST_TYPES` — dodavanje `"chat_message"` samo u `lib/notify.js` ne bi bilo dovoljno, cron petlja nikad ne bi pokupila red iz baze. Ažurirano na oba mesta
- [x] `hooks/useNotifications.js` — invalidacija `['chat-messages']` dodata pored postojeće `['project-messages']` (svaki put kad 30s notifikacioni poll sleti)
  - [-] **`unreadChannelIds`/`unreadByChannel` namerno NISU dodati** — za razliku od milestone chata i proposal-a (koji nemaju sopstveni read-tracking, pa je `Notification` zapis JEDINI signal za "nepročitano"), chat već ima namenski, precizniji `ChatRead` sistem (Sekcija 6) koji `GET /chat/channels` pretvara u tačan `unreadCount` po kanalu — `useChatChannels()` (Sekcija 8/9) to već koristi za bedž u `ChannelSidebar`-u i tačku na Chat tabu. Dodavanje paralelnog notification-based brojanja bilo bi samo netačnija senka onoga što već postoji, sa rizikom da se dva sistema razminu (npr. push stigne, notifikacija ostane "nepročitana" iako je poruka odavno viđena na drugom uređaju kroz ChatRead)
- [x] `components/NotificationBell.jsx` — kategorija `"Chat"` dodata u `CATEGORY_ORDER.client` i `.admin`; `categoryOf()` proverava `n.channelId` **PRE** `entityType`-baziranih provera (chat notifikacije nose `entityType: "project"` radi ponovne upotrebe postojeće project-link/email infrastrukture, pa bi bez ove provere redom bile pogrešno svrstane u "Projects"/"My Projects")
- [x] Web push radi za chat poruke i mentions — **besplatno**, bez ijedne nove linije koda: `notifyUser()` već bezuslovno zove `sendPushToUser()` za svaki tip notifikacije (osim ako je korisnik isključio push), pa čim se `notifyUser` pozove sa `type: "chat_message"`/`"chat_mention"` push jednostavno radi
- [x] **Fan-out logika (I6)** u `POST /api/chat/channels/:id/messages` (zamenjen prethodni „Section 10's job, not built here" komentar):
  - Grupni kanal: svi iz `roster`-a (owner + aktivni članovi) osim autora, plus svi globalni admini osim autora — **ali ne oba uvek**: ako je autor sam admin, admin-leg (`notifyAdmins`) se preskače, isto kao postojeća asimetrija u milestone chatu (admin-ova poruka ne obaveštava ostale admine, samo klijenta/članove)
  - DM kanal: samo „drugi učesnik"; link zavisi od toga da li je taj učesnik globalni admin (`/admin?tab=chat&channel=`) ili ne (`/dashboard?tab=chat&channel=`) — proveren jednim `User.findById(...).select("isAdmin")`, jedini slučaj gde je ta provera uopšte potrebna (grupni roster nikad ne sadrži globalne admine, `loadChannelRoster` ih namerno isključuje)
  - Mention (`chat_mention` tip, ime u naslovu) vs obična poruka (`chat_message`) — mentions mogu pogoditi samo roster (owner/member), nikad globalnog admina (isti razlog kao gore), pa je admin-leg uvek `chat_message`
- [x] **Deep-link `?channel=<channelId>`** (nije bilo eksplicitno u planu, ali neophodno da linkovi iz notifikacija/mejlova/push-a uopšte imaju svrhu): `ProjectChat` prima novi opcioni `initialChannelId` prop — bira taj kanal kao podrazumevani SAMO dok ništa nije ručno izabrano (efekat se ne aktivira ponovo na svaki 15s poll kanala, pa ne otima izbor koji je korisnik već napravio); `app/dashboard/page.js` i `app/admin/page.js` čitaju `searchParams.get("channel")` i prosleđuju ga
- [x] **Admin sidebar unread tačka za Chat** (mala dopuna otkrivena dok se zaokruživala priča o nepročitanom — Sekcija 9 je ovo dodala klijentskom dashboard-u, ali ne i admin sidebar-u): `AdminPageInner` sad računa `totalUnreadChat` preko `useChatChannels()` (deli isti `['chat-channels']` ključ, bez dodatnog pollinga) i prosleđuje ga u `AdminSidebar`, ista logika kao klijentska strana (tačka se ne prikazuje dok je Chat tab aktivan)

**Uživo test (28 provera, 4 jednorazna naloga — owner/member/admin/stranger — + 1 projekat + 1 članstvo, kreirani→testirani→obrisani):** register (4) · lazy kanal vidljiv članu, nevidljiv strancu (3) · slanje poruke sa @mention (2) · fan-out: owner dobija `chat_mention`, admin dobija `chat_message`, autor i stranac ne dobijaju ništa (5) · digest query filter zaista pokupi `chat_message` red, `chat_mention` zaista nije u tom skupu (2) · `POST /notifications/read` sa `{channelId}` označi TAČNO tog korisnika kao pročitanog, ne dira tuđe redove za isti kanal (3) · baseline brojevi svih 7 dotaknutih kolekcija vraćeni na prethodno stanje (7). **Nije pušten pravi cron digest endpoint** (`GET/POST /api/cron/email-digest`) — taj posao šalje mejlove SVIM korisnicima sa bilo kojim čekajućim digest-notifikacijama u celom sistemu, ne samo test podacima, pa bi to bio neprihvatljivo širok domašaj za jednorazni test; umesto toga, direktno je upoređen isti upit (`type: {$in: [...]}, emailedAt: null, read: false`) koji `runEmailDigest()` koristi, dokazujući da bi red zaista bio pokupljen bez stvarnog slanja mejla bilo kome.

**Otkriveno tokom testa (nije bug u proizvodnom kodu, nego u prvoj verziji test skripte):** `notifyAdmins()` je ispravno obavestio i STVARNOG, postojećeg admin naloga u produkcionoj bazi (ne samo jednorazni test-admin nalog) — to je tačno očekivano ponašanje (fan-out mora da pogodi SVE admine, ne samo one iz test seta). Prvi prolaz čišćenja je filtrirao `Notification` brisanje po `userId: {$in: testUserIds}}`, pa je taj jedan real-admin red preživeo prvi cleanup (baza je posle prvog prolaza imala 49 umesto originalnih 48 `notifications`). Ispravljeno brisanjem po `channelId` samostalno (bez `userId` filtera) — baza vraćena na tačnih 48. Zapisano kao podsetnik za buduće live testove ovog tipa: čišćenje notifikacija posle bilo kog testa koji uključuje `notifyAdmins()` mora ići po `channelId`/`entityId`, nikad po unapred poznatom skupu test-user-id-jeva, jer fan-out namerno i ispravno dohvata i naloge van tog skupa.

---

## 11. Pin, filteri, pretraga

- [x] `PinnedBar` collapsible ispod header-a — već gotovo u Sekciji 8, bez izmena
- [x] Filter: All / Request / Task / Idea / Problem / Incident / Decision / Pinned — već gotovo (Sekcija 6 backend `flag=pinned` alias + Sekcija 8 `ChatHeader` `FILTER_OPTIONS`), bez izmena
- [x] Pretraga po tekstu unutar kanala — već gotovo (Sekcija 6 `escapeRegExp` + Sekcija 8 search input), **plus nova dopuna ove sekcije:** debounce (I8) — videti dole
- [x] Pin / unpin iz dropdown menija (permission `pin`) — **pravi nedostatak pronađen i ispravljen ovde**, videti dole

**Stvarni nedostatak pronađen pri proveri ove sekcije:** `MessageBubble`-ov dropdown je do sada UVEK prikazivao Pin/Unpin stavku, bez obzira na dozvolu — server je ispravno vraćao 403 (`loadMessageWithAccess(id, user, "pin")` je već postojao od Sekcije 6), ali UI to nije znao unapred. Uzrok: `viewerRole` prop ("client"/"admin") opisuje **u kom dashboard-u** je komponenta montirana, ne stvarnu ulogu korisnika NA TOM projektu — `owner`, `collaborator` i `viewer` svi stižu kroz isti klijentski dashboard sa `viewerRole="client"`, a samo `viewer` rola nema `pin` dozvolu (matrica u `lib/chat-domain.mjs`). `canModerate` je slučajno ispravan (`viewerRole === "admin"` se poklapa sa `messagesModerate` jer JEDINO globalni admin ima tu dozvolu, a admin panel je i inače zaključan samo za njih), ali `pin` dozvolu ima skoro svaka rola OSIM viewer-a, pa isti trik ne radi.

Ispravka — server sad izlaže stvarnu, već izračunatu dozvolu umesto da frontend nagađa:

- [x] `lib/chat-serializers.mjs` — `serializeChannelSummary` dobija `canPin`/`canWrite` polja (`Boolean(accessObj?.permissions?.pin)` / `.chatWrite`) — `accessObj` je već postojao na ovom pozivnom mestu (`GET /chat/channels`) od Sekcije 6/9 (koristio se za `unreadCount`/`lastMessage` filtriranje priloga), samo se dosad nije čitalo van toga
- [x] `tests/chat-serializers.test.mjs` — 2 nova testa (`canPin`/`canWrite` prate stvarnu dozvolu, ne kind kanala; default `false` bez bacanja greške kad `accessObj` nedostaje)
- [x] `components/chat/ProjectChat.jsx` → `MessageList.jsx` → `MessageBubble.jsx` — `canPin` prosleđen kroz sve tri komponente; Pin/Unpin stavka u dropdown-u sad uslovna na `canPin`
- [-] `canWrite` izložen u serializeru ali **namerno još NIJE ožičen u `MessageComposer`-u** (kompozitor bi trebalo da se onemogući/sakrije za viewer rolu) — ovo je srodan, ali odvojen nedostatak od onoga što ova sekcija konkretno traži (pin), zastavljen za sledeći „fino podešavanje" prolaz, ne rešen ovde da se ne širi domašaj van doslovnog Section 11 zahteva

**I8 dopuna (Polling budžet, sekcija 3A) zatvorena ovde, jer joj je „Pretraga" iz ove sekcije prirodno mesto:**

- [x] **debounce na search** — `ChatHeader.jsx` dobija lokalni `draft` state (trenutačan UI feedback) + 400ms debounce pre nego što `onSearchChange` stvarno promeni `search` state u `ProjectChat`-u (koji hrani `useChatMessages`-ov query ključ). Bez ovoga je svaki pritisnut taster pravio nov HTTP poziv i nov React Query cache unos
- Preostala 4 pod-stavke I8 (4s samo aktivan kanal, pauza na `document.hidden`, jedan `messages` query po ekranu, cursor paginacija limit 50) su bila **već zadovoljena strukturno** još od Sekcije 7/8, samo formalno neoznačena: aktivan-kanal-only i jedan-query-po-ekranu su posledica `MessageList`/`MessageComposer` deljenog query ključa (Sekcija 8); pauza-na-`document.hidden` je React Query v5 podrazumevano ponašanje (`refetchIntervalInBackground` je `false` po difoltu, nije trebalo ništa dodavati); cursor paginacija je iz Sekcije 6/7. **I8 se sad može označiti kao gotov u sekciji 3A.**

**Verifikacija:** `npm test` → 132/132 (2 nova testa). Sintaksno provereno (`node --check` na sva 4 dotaknuta `.jsx` fajla + `lib/chat-serializers.mjs`). **Nije rađen nov live DB test za ovu sekciju** — namerna odluka, ne propust: tačno ovaj pozivni put (`resolveProjectAccess` → `accessObj` → `serializeChannelSummary`) je već uživo proveren u Sekciji 6-ovom testu od 49 provera (za `unreadCount`/`lastMessage`), a `permissions.pin`/`.chatWrite` su već garantovano prava bulova vrednost kroz postojeće `tests/chat-domain.test.mjs` provere matrice. Nova promena je čisto dodavanje dva polja na već uživo dokazan tok podataka, pokriveno sopstvenim jediničnim testovima — dodatni pun round-trip test (novi jednorazni nalozi, čišćenje, itd.) bi bio nesrazmeran za ovu veličinu izmene. Ako se ipak želi, može se dodati.

---

## 12. Konverzije — „Pretvori u…"

- [x] `POST /api/chat/messages/:id/convert` — `convertToFormal` (owner/admin) vs `convertToItem` (i collaborator); permission provera i unutar `sanitizeConvertPayload` (defense-in-depth, isti obrazac kao `sanitizeChatMessagePayload`/`canPostToChannel`)
- [x] Cilj **zahtev** → `ProjectRequest` + `sourceMessageId` + novo `sourceProjectId` polje (nije bilo u planu, ali neophodno — request treba da zna iz kog postojećeg projekta potiče; namerno odvojeno od `linkedClientProjectId`, koje ima suprotno značenje — projekat u koji se zahtev PRETVORIO posle odobrenja)
- [x] Cilj **zadatak** → task u milestone-u (`milestone.tasks.push`, isti resource-first lookup obrazac kao postojeća milestone chat grana)
- [x] Cilj **komentar na milestone** → `ProjectMessage` (`messageType: "message"`, autor je onaj ko konvertuje — owner ili admin, nikad `change_request`)
- [x] Cilj **item** → `ProjectItem` (idea/problem/incident/decision); `decision` dobija odmah `confirmedBy: [{konvertujuci korisnik}]` i `decidedAt` — konvertovanje poruke označene kao "decision" u formalnu Odluku JESTE čin potvrde, ne prazna stavka
- [x] `ref` sekvenca po `(projectId, kind)` → `D-041`, retry na duplikat (I5), **lastRef se traži po `createdAt: -1`, ne `ref: -1`** — leksikografsko sortiranje refova bi se pokvarilo posle 999 stavki iste vrste u istom projektu ("D-1000" ide pre "D-999")
- [x] `convertedTo[]` na izvornoj poruci + UI oznaka „Converted to…" sa ref/target linkom (`MessageBubble.jsx`)
- [x] `GET /api/project-items` (filter `kind`/`status`, permission `projectRead`) + `ProjectItemsPanel.jsx` lista u UI, otvara se iz `ChatHeader`
- [x] „Save as decision" beleži `confirmedBy[]` i `decidedAt` — videti gore
- [x] `canConvertToItem`/`canConvertToFormal` izloženi na `serializeChannelSummary` (ista logika kao `canPin` iz Sekcije 11) — frontend ne nagađa dozvolu iz `viewerRole`

**Verifikacija:** `npm test` → 141/141 u trenutku implementacije (7 novih `sanitizeConvertPayload` testova + 2 nova `serializeProjectItem` testa). Sintaksno provereno svih izmenjenih/novih fajlova. Uživo mount test kroz privremenu rutu na pravom dev serveru (200, marker prisutan, bez greške). **Live DB test za sâm convert endpoint namerno NIJE urađen od strane asistenta** — korisnik je eksplicitno rekao da će prvo sam testirati konverziju uživo pre nego što se zatraži poseban uživo test.

---

## 12c. Odlučivanje o item-ima (traženo posle korisnikovog uživo testa Convert-a)

Korisnik je konvertovao Ideju u Odluku kao član i pitao: „kako superadmin da odobri, ili samo da doda u milestone?" Odgovor je bio da **ništa od toga nije postojalo** — `ProjectItem` je imao `status`/`confirmedBy[]`/`decidedAt` u modelu, ali nijedan endpoint ih nije pisao posle kreiranja. Korisnik je izabrao: odobravanje + co-sign + prebacivanje u task, sa odobravanjem **samo za admina**.

- [x] `lib/chat-domain.mjs` — nov permission ključ `itemsApprove`. Dodat samo u `PERMISSION_KEYS`; pošto `admin` preset uzima sve ključeve konstrukcijom (`PERMISSION_KEYS.filter(k => k !== "leaveProject")`), a svi ostali preseti su eksplicitne liste, ključ je **operator-only bez ijedne provere imena role**. Postojeći „preset drift" test to automatski čuva
- [x] `PROJECT_ITEM_STATUSES` konstanta + `sanitizeProjectItemUpdate(input, accessObj)` — čista, testirana. **Potvrda je spojena sa promenom statusa**, nije zaseban poziv: operator koji prihvata odluku TIME i potpisuje; razdvajanje bi dozvolilo stanje „accepted" bez ičijeg imena, a upravo to ime je dokazna vrednost zbog koje Odluka i postoji. 3 nova testa
- [x] `PATCH /api/project-items/:id` — permission `itemsApprove`; resource-first (projekat se izvodi iz učitanog item-a, nikad iz poziva); `accepted` dodaje potpisnika u `confirmedBy[]` (idempotentno — isti korisnik se ne potpisuje dvaput) i postavlja `decidedAt`
- [x] `POST /api/project-items/:id/task` — permission `convertToFormal` (owner+admin, isto kao konverzija poruke u task: oba prave obavezu); pravi task u izabranom milestone-u i upisuje `item.milestoneId` kao vezu ka nastalom radu (postojeće polje, bez novog)
- [x] `serializeChannelSummary` dobija `canApproveItems` (isti server-sourced obrazac kao `canPin`/`canConvert*`)
- [x] `hooks/useProjectItems.js` — `decideItem` + `promoteToTask` mutacije; `promoteToTask` invalidira i `client-projects` (milestone je upravo dobio task)
- [x] `ProjectItemsPanel.jsx` — status bedž po item-u, Accept/Reject dugmad (samo uz `canApprove`), „Add to milestone…" select (samo uz `canPromote`, i samo dok item još nije prebačen)
- [-] **Nije uživo testirano** — testira korisnik

### 12c-2. Novi milestone / nova faza iz odobrene odluke

Korisnik je tražio još dva dugmeta („add milestone" i „add task") i opisao tri slučaja: task u postojeći milestone, novi milestone, i nova faza. **Pre implementacije provereno kako faze zaista rade** — nalaz je bitan i menja šta je uopšte moguće:

- **Faza NIJE samostalan entitet — faza JESTE proposal.** Lanac: `POST .../proposals` (`kind: "phase"`, `phaseNumber = max(2, last+1)`, `status: "draft"`) → admin šalje → **klijent prihvata** → `reconcileProposalMilestones` materijalizuje milestone-ove te faze sa `proposalId`-jem. Brisanje faze je `$pull: { milestones: { proposalId } }` — **milestone-ove poseduje njihov proposal**
- Zato „dodaj novu fazu" ne može biti obično dugme: bez proposal-a nema šta da drži fazu, a klijent ništa nije prihvatio. Taj tok prihvatanja je i razlog zašto proposals uopšte postoje

Korisnikove odluke posle tog objašnjenja: novi milestone **ulazi u postojeću fazu** (bira se koja), a „nova faza" **pravi draft proposal** koji se dalje šalje normalnim tokom.

- [x] `POST /api/project-items/:id/milestone` — `{ proposalId, title? }`; permission `convertToFormal`. Faza je **obavezna**, ne opciona (milestone bez `proposalId` ne bi pripadao nijednoj fazi i nikad se ne bi obrisao sa njom). Proposal se traži scope-ovan na TAJ projekat (resource-first) i mora biti `accepted` — inače 409. Novi milestone nasleđuje `phaseNumber`/`phaseLabel`, dobija item kao svoj prvi task, i upisuje se `events` zapis
- [x] `POST /api/project-items/:id/phase` — pravi **draft** phase proposal sa `title`/`scope`/`milestonePlan` popunjenim iz item-a, kroz isti `normalizeProposalFields` + `phaseNumber` obrazac kao postojeći endpoint. Namerno staje na draft-u; klijent ga i dalje mora prihvatiti. Permission `itemsApprove` (operator-only konstrukcijom, poklapa se sa postojećim pravilom da proposal crta samo admin, bez druge provere po imenu role)
- [x] `useProjectItems` — `createMilestone` + `createPhaseDraft`; prvi invalidira i `client-projects`, drugi `project-proposals`
- [x] `ProjectItemsPanel` — tri kontrole po item-u: „Add task to milestone…", „New milestone in phase…" i „New phase (draft)". **Lista faza se izvodi iz već učitanih milestone-ova** (distinct `proposalId`), bez drugog zahteva ka `/proposals`: milestone postoji samo ako je njegova faza prihvaćena, pa su ti `proposalId`-jevi tačno žive faze u koje se sme dodati
- [-] **Nije uživo testirano** — testira korisnik. Poseban oprez pri probi: `New phase (draft)` piše pravi `ProjectProposal` u bazu (u `draft` statusu, klijentu nevidljiv dok se ne pošalje)

---

## 12b. UX ispravke posle uživo testiranja (van redosleda sekcija)

Korisnik je uživo testirao Sekcije 8–11 u pravom browseru i vratio konkretnu listu nedostataka i UX poboljšanja. Ovo nije bilo u planu — ubačeno je između Sekcije 12 i 13 jer je korisnik eksplicitno tražio da se prvo završe manje ispravke, pa dva veća stavke (mobilni layout, prisustvo), pre nego što se nastavi dalje.

**Manje ispravke:**

- [x] `ChannelSidebar.jsx` — dugme za dodavanje člana: `Settings`/gear ikonica → `Plus` sa zlatnom (`#FFB633`) ivicom, "+ Add" umesto samo ikonice
- [x] `PinnedBar.jsx` — flag bedž (boja/ikonica/labela) po pinovanoj poruci, ista `FLAG_META` mapa kao `MessageBubble` (eksportovana odatle, ne duplirana)
- [x] Filter po tipu priloga — `ChatHeader`-ov POSTOJEĆI dropdown dobija dve nove opcije ("Images"/"Documents") sa `attachment:` prefiksom u vrednosti; `useChatMessages` prevodi u novi `attachmentType` (image|pdf) query parametar (odvojen od `flag`, GET `/chat/channels/:id/messages` handler)
- [x] `AttachmentPreview.jsx` (nova komponenta) — klik na sliku/dokument otvara modal (slika inline, PDF kroz iframe/browser viewer) umesto novog Cloudinary taba; „⋯" meni ima Download koji fetch-uje kao blob i čuva pod pravim imenom (obično `download` atribut ne radi pouzdano cross-origin)
- [x] Reply — klik na citat sad radi smooth-scroll do izvorne poruke (`data-message-id` + `querySelector`, isti obrazac kao postojeći `card-${id}` scroll-to u dashboard/page.js) sa privremenim gold ring highlight-om (1.5s); plutajuće „↓ Back to reply" dugme vraća na polaznu poruku. **Poznato ograničenje:** ako izvorna poruka nije još učitana (starija istorija), klik ne radi ništa — nije dodato auto-učitavanje istorije radi ograničenja obima ove izmene
- [x] I8 debounce na search (već zabeleženo u Sekciji 11)

**Veliki item A — mobilni responsive layout:**

- [x] Ispod `md:` breakpoint-a prikazuje se TAČNO jedna kolona odjednom (sidebar ILI razgovor), puna širina; na `md:` i više obe kolone kao pre (side-by-side)
- [x] Klik na kanal/DM prebacuje na razgovor (`mobileView` state u `ProjectChat.jsx`); `ChatHeader` dobija `onBack` dugme (`ChevronLeft`, `md:hidden`) koje vraća na listu kanala
- [x] `ChatHeader`-ov red kontrola (filter/search/items dugme) sad `flex-wrap` sa užim `w-*` na mobilnom (`w-28`→`w-40` search, `w-[110px]`→`w-[130px]` filter) — bez ovoga bi red kontrola i dalje prelivao na uskom ekranu čak i posle sidebar/chat toggle-a
- [-] Fina vizuelna polura (razmaci, veličine fontova na baš uskim telefonima) ostaje na korisniku da proveri uživo — nemam pristup pravom mobilnom browseru za vizuelnu proveru, samo compile/mount

**Veliki item B — prisustvo (online/offline) + owner/admin pojedinačno u DM listi:**

- [x] `models/User.js` — novo `lastActiveAt` polje
- [x] `lib/chat-domain.mjs` — `isUserOnline(lastActiveAt, now)` (čista, testirana funkcija) + `PRESENCE_ONLINE_THRESHOLD_MS = 45_000` (3× postojeći 15s `chat/channels` poll interval, da ostavi marže za mrežni jitter/pozadinski tab bez da lažno pokazuje offline)
- [x] **Heartbeat bez novog endpointa** — `GET /api/chat/channels` (već se poll-uje na 15s dok je chat otvoren) sad usput (fire-and-forget, ne blokira odgovor) upisuje pozivaočev `lastActiveAt`
- [x] `GET /client-projects/:id/members` prošireno: pored postojećih aktivnih `ProjectMember` redova, sad vraća i **vlasnika projekta** i **svakog globalnog admina pojedinačno** (sintetički `_id: "owner:<userId>"`/`"admin:<userId>"` redovi kroz isti `serializeMemberPublic`, sad sa `isOnline` poljem) — odluka: svaki admin nalog posebno u listi, ne jedan zajednički "Support" identitet (korisnikov izričit izbor)
- [x] `TeamPanel.jsx` — Remove/Leave dugmad sakrivena za `role === "owner"`/`"admin"` redove (nisu pravi, uklonjivi `ProjectMember` redovi; klik bi tiho ništa ne uradio na serveru bez ove ispravke) + zeleno/sivo prisustvo tačka po redu
- [x] `ChannelSidebar.jsx` — `PresenceDot` pored svakog Members reda i svakog Direct/DM reda (za DM, izvedeno unakrsnom pretragom `memberUserIds` protiv već učitanog roster-a, isti obrazac kao postojeći `dmLabel`)
- [-] **Nije uživo testirano od strane asistenta** — korisnik je eksplicitno rekao da će sam testirati u browseru
- [x] **BUG uveden ovom izmenom, pronašao korisnik uživo, ispravljen:** roster nije imao dedupe po `userId`. Ista osoba koja je istovremeno globalni admin I aktivan `ProjectMember` (korisnikov slučaj: `drazic.milan@gmail.com` je admin, pa prihvatio i poziv kao collaborator) pojavljivala se **dva puta** u listi. Posledice: React duplicate-key upozorenje (`key={m.userId}`), i — vidljivi simptom koji je korisnik prijavio — oba reda vode na **isti DM kanal**, jer je `dmKey` po PARU korisnika; izgledalo je kao da je poruka „stigla u pogrešan chat", a u stvari nikad nisu ni postojala dva razgovora. Ispravka: `Map` po `userId` sa precedencijom **admin → owner → membership**, tj. isti redosled kojim `resolveRoleFromFacts` razrešava prava (osoba se prikazuje kao ono što zaista JESTE na tom projektu), što je usput i redosled prikaza koji plan traži („admin na vrhu, pa vlasnik, pa ostali")
- [-] **Poznata posledica dedupe-a:** ako je globalni admin ujedno i pravi `ProjectMember`, njegov red sad nosi admin identitet (`_id: "admin:…"`), pa `TeamPanel` na njemu ne nudi Remove — njegovo stvarno članstvo se ne može ukloniti kroz UI. Prihvaćeno za sada: admin ionako ima pun pristup projektu bez članstva, pa uklanjanje reda ne bi ništa oduzelo

**Dev/prod — invite/verify/reset linkovi na localhost tokom razvoja:**

- [x] `resolveAppUrl(request)` (novo, u `route.js`) — u produkciji uvek konfigurisani `APP_URL` (poverenje request Host header-u u produkciji bilo bi rizik od spoofing-a); van produkcije, koristi PRAVI origin dolaznog zahteva (`new URL(request.url)`) umesto `NEXT_PUBLIC_APP_URL`, koji je i tokom lokalnog razvoja tipično već postavljen na produkcioni domen (`dmdevelon.website`) — bez ove izmene, svaki verifikacioni/reset/invite mejl poslat sa `localhost:3003` vodio je na produkciju, gde taj token ne postoji
- [x] **Dopuna posle prve uživo probe korisnika:** prvi mejl je stigao sa linkom na `http://0.0.0.0:3003/...` — `0.0.0.0` je adresa na koju dev server SLUŠA (`next dev --hostname 0.0.0.0`), ne adresa na koju bilo ko može da se poveže. Dodato: `UNROUTABLE_HOSTS` skup (`0.0.0.0`, `[::]`, `localhost`, `127.0.0.1`) + `detectLanIPv4()` (Node `os.networkInterfaces()`, prva ne-interna IPv4 adresa) — kad je host zahteva iz tog skupa, `resolveAppUrl` ga zamenjuje pravom LAN IP adresom mašine (npr. `192.168.1.108`), zadržavajući port. Ovo pokriva i slučaj kad je pošiljalac na `localhost`, ne samo `0.0.0.0` — ni `localhost` ne bi radio za drugi uređaj na mreži
- [x] Primenjeno na svih 5 mesta gde se generiše link koji korisnik odmah klika: verifikacija (2×), reset lozinke (1×), invite (2×)
- [x] **Uživo provereno** kroz privremenu debug granu (`GET /api/debug/resolve-app-url`, dodata pa odmah uklonjena posle provere) na pravom dev serveru: zahtev sa `Host: localhost:3003`, `Host: 0.0.0.0:3003` i direktno na `192.168.1.108:3003` — sva tri slučaja ispravno razrešena na `http://192.168.1.108:3003`. Debug grana uklonjena, potvrđeno 404 posle
- [-] **Namerno NIJE dirano:** `runEmailDigest()`-ov `APP_URL` (cron posao, ne interaktivan tok koji se testira klikom) i `lib/notify.js`-ov sopstveni `APP_URL` (koristi se za bell/push notifikacije kroz `notifyUser`, koji nema pristup `request` objektu — protezanje kroz ~15+ pozivnih mesta bilo bi nesrazmerno veći refaktor od onoga što je zaista traženo, „ceo proces" = invite/verify/reset tok, ne svaka notifikaciona email veza)

**Dev-server: HMR websocket preko LAN IP-a (`allowedDevOrigins`):**

- [x] Korisnik je prijavio `Firefox can't establish a connection to the server at ws://192.168.1.108:3003/_next/webpack-hmr`. **Nije problem porta** (predlog `next dev -p 8080` ne bi pomogao — blokada je po HOSTNAME-u, ne po portu, pa bi `192.168.1.108:8080` udario u isto ograničenje). Od Next.js 15.2 dev server blokira HMR/asset zahteve sa svakog origin-a osim `localhost`. Rešenje: `allowedDevOrigins: ["192.168.1.108"]` u `next.config.js` (dev-only opcija, ignoriše se u produkcionom build-u). **Zahteva restart dev servera** — `next.config.js` se čita samo pri startu. Ako se LAN IP promeni (DHCP), vrednost treba ažurirati

**PRAVI BUG pronađen korisnikovim uživo testom — invite stranica odbijala validan poziv:**

- [x] Simptom: mejl stigao ispravno sa `http://192.168.1.108:3003/invite?token=…`, ali stranica prikaže „Invalid invitation link — This link is missing its token or does not match any invitation", a URL u adresnoj traci je `…/invite` **bez tokena**. Server-side je poziv bio potpuno ispravan (`GET /api/invitations/preview?token=…` → `status: "pending"`, nije istekao) — greška je bila čisto klijentska
- [x] **Uzrok:** `app/invite/page.js` je čitao `const token = searchParams.get("token")` i posle uspešnog preview-a zvao `window.history.replaceState(null, "", "/invite")` radi token higijene (I4). Moj komentar uz taj poziv je tvrdio da „ručni history poziv ne utiče na Next-ov searchParams snapshot" — **to je bilo netačno**. Potvrđeno u izvoru instalirane verzije (`node_modules/next/dist/client/components/app-router.js:268`): App Router **patch-uje** `window.history.replaceState` i uz komentar „Ensures usePathname and useSearchParams hold the newly provided url" dispatch-uje `ACTION_RESTORE`. Lanac: preview uspe → `previewState: "ready"` → replaceState skine token iz URL-a → `useSearchParams()` se re-emituje bez tokena → `token` postane `null` → efekat sa `[token]` dependency-jem se ponovo izvrši → `setPreviewState("not_found")` → poruka o nevalidnom pozivu
- [x] **Ispravka:** token se sad drži u komponentnom stanju (`useState(() => searchParams.get("token"))`), nezavisno od URL-a; dodat efekat koji token SAMO usvaja, nikad ne briše (`if (fromUrl && fromUrl !== token) setToken(fromUrl)`) — tako kasnije pristigao token biva pokupljen, a čišćenje URL-a ga ne može oduzeti. Higijena (skidanje tokena iz adresne trake/istorije/referrer-a) je zadržana, komentar ispravljen da opisuje stvarno ponašanje
- [x] **POTVRĐENO ISPRAVNIM od strane korisnika** (uživo, pravi klik iz Gmail-a, preko LAN IP-a, posle restarta dev servera): mejl → klik na link → preview stranica sa ponudom „Create account / Sign in" → prijava postojećim nalogom → **korisnik je odmah u grupi**. Ceo lanac radi: kreiranje poziva → mejl sa LAN IP linkom → `GET /invitations/preview` → login → `POST /invitations/accept` → `ProjectMember` → grupni kanal
- Napomena o metodu: asistent ovo NIJE mogao sam da verifikuje (nema puppeteer/playwright u projektu; bug je čisto React-runtime ponašanje koje `curl` ne izvršava — preko `curl`-a se stranica vidi samo u „Loading invitation…" stanju). Asistent je proverio samo da se fajl kompajlira, da dev server servira stranicu bez greške i da je token i dalje `pending`; **pravu potvrdu dao je korisnikov klik**

**Verifikacija cele serije:** `npm test` → 144/144. Sintaksno provereno (`node --check`) na svih ~12 izmenjenih/novih fajlova. Uživo mount test kroz privremenu rutu na pravom dev serveru posle svakog većeg koraka (small fixes batch, mobilni layout) — 200, marker prisutan, bez greške. Live DB test za presence/roster promenu **namerno preskočen na korisnikov zahtev** — korisnik testira sam u browseru.

**Pouka (treći put u ovom projektu):** komentar koji tvrdi kako se framework ponaša mora biti proveren u izvoru/dokumentaciji, ne pretpostavljen. Prethodna dva slučaja: Mongoose `.create(doc, options)` (Sekcija 5) i `runEmailDigest()`-ova zasebna lista tipova nezavisna od `DIGEST_TYPES` (Sekcija 10). Sva tri su prošla sintaksnu proveru i sve unit testove — uhvatio ih je isključivo pravi, uživo test.

---

## 12d. Handoff, auto-osvežavanje i politika notifikacija

Posle korisnikovog uživo korišćenja: „handoff je konfuzan, ne zna se gde ide", „klijent potvrdi ali se ne ažurira bez refreša", „spamuje notifikacijama". Puni plan: `.claude/plans/` (v3).

**Ograničenje utvrđeno pre implementacije (nije pretpostavka):** `ProjectProposal` ima **unique indeks `{ projectId, phaseNumber }`** — jedna ponuda po fazi. Zato milestone ne može da se doda u već prihvaćenu fazu uz odobrenje; **svaki novi odobreni rad postaje nova faza**. Korisnik je to potvrdio kao odluku (bez migracije).

**Handoff:**

- [x] `POST /api/project-items/:id/handoff` — pravi **draft** phase ponudu iz item-a (`normalizeProposalFields`, `phaseNumber = max(2, last+1)`), upisuje `sourceItemId`/`sourceItemRef` na ponudu i `handoffProposalId` na item; guard 409 ako item već ima živ handoff
- [x] **UKLONJEN `POST /api/project-items/:id/milestone`** — upisivao je živ milestone **bez ikakvog odobrenja klijenta**, što je suprotno zahtevu da novi rad znači nove sate i cenu. Ovo je ispravka, ne nova funkcija
- [x] `POST .../proposals/:pid/withdraw` — `sent` → `draft`, dok klijent još nije odgovorio
- [x] `DELETE .../proposals/:pid` — samo `draft`/`rejected` (ništa nije materijalizovano); oslobađa `handoffProposalId` na item-u
- [x] `POST /api/project-items/:id/task` — nepromenjen: task u prihvaćen milestone je u dogovorenom obimu, primenjuje se odmah
- [x] `components/chat/HandoffDialog.jsx` — jedno „Hand off…" dugme umesto tri kontrole; cilj bira **task u postojeći milestone** (dropdown **grupisan po fazi**) ili **predloži novi rad**; dijalog objašnjava komercijalnu razliku
- [x] `ProjectItemsPanel` prikazuje ishod po item-u („Added to a milestone" / „Proposed as new work")
- [x] `components/admin/PendingWorkSection.jsx` — sve što čeka klijenta na vrhu kartice projekta: status rečima („Awaiting client · 2d"), poreklo (`D-001`), Edit/Send/Withdraw/Delete. Prihvaćene ponude se ne prikazuju (one su već u stablu)
- [x] **Admin stablo grupisano po fazama** — sortiranje `(phaseNumber, order)` + separator, preko postojećeg `getMilestonePhase()`. Ranije se sortiralo samo po `order`, a `order` je faza-lokalan (`baseOrder: 0`), pa su se **faze preplitale** — glavni izvor „ne zna se redosled"

**Auto-osvežavanje (bez websocket-a):**

- [x] `useNotifications` 30s poll sad invalidira i `['client-projects']`, `['project-proposals']`, `['project-items']` — mehanizam je već postojao, samo je pokrivao isključivo chat. Nijedan od ovih ključeva nema sopstveni polling, pa je ovo jedini cross-browser signal
- [x] `acceptProposal` upisuje `data.project` u keš (`setQueryData`) — nove milestone-ove vidiš odmah po kliku, ne tek posle refetch-a
- [x] Ispravljene bare-prefiks invalidacije u `useProjectItems`

**Notifikacije:**

- [x] `lib/notification-policy.mjs` (novo, čist + 10 testova) — `resolveDeliveryChannels`. `inApp` **uvek** `true`; konverzacijski tipovi se prigušuju ako je primalac online ili je isti kanal već slat unutar 1 h; akcioni tipovi (`chat_mention`, `project_proposal_*`, `request_created`) **nikad** — ponuda koja čeka odobrenje mora da stigne i na mejl
- [x] `Notification.pushedAt` — push se prigušuje nezavisno od mejla
- [x] Prisustvo: `GET /api/notifications` je **drugi heartbeat** (radi na svakoj prijavljenoj stranici, ne samo u chatu); prag `45s → 90s` (3× najsporiji poll koji ga hrani)
- [x] `runEmailDigest` poštuje istu politiku (preskače online primaoce i konverzacije unutar prozora) i **importuje `DIGEST_TYPES`** umesto druge hardkodirane liste — te dve liste su se već jednom razišle (Sekcija 10)
- [x] **Uklonjeno dupliranje:** admin koji je i član projekta dobijao je **dve** notifikacije za istu poruku (roster fan-out + `notifyAdmins`); sad se preskaču oni koji su već obavešteni
- [x] `useNotifications` šalje **toast za dolazne notifikacije** — do sada nije postojao nijedan; sa odbijenim/prigušenim push-om poruka je mogla da stigne bez ijednog vidljivog znaka. Dedupe je **modul-level**, jer je hook montiran na 7 mesta istovremeno i per-instance stanje bi dalo 7 toastova za istu poruku

**Bug uhvaćen uživo (ne `npm test`, ne `node --check`):** `models/Notification.js` je posle izmene imao vislicu `pushedAt: {…}, email` — validan JS (shorthand property), pa je prošao `node --check`, ali `ReferenceError: email is not defined` pri učitavanju modula **oborio je ceo API** (svi endpointi 500). Uhvaćeno jedino jer se posle izmena gađao živ endpoint. Isti obrazac kao Mongoose `.create()` (Sekcija 5) i razdvojene digest liste (Sekcija 10) — treći put da sintaksna provera i unit testovi propuste grešku koju uživo poziv otkrije odmah.

**Usput ispravljeno:** `DELETE` handler je imao hardkodiran `500` u catch bloku umesto `errorResponse` — što je ravnalo svaki namerni status (401/403/404/409) na 500. Pogađalo je i postojeću granu za opoziv poziva, ne samo nove rute.

**Vidljivost onoga što čeka (dodato posle korisnikove povratne informacije „klijenti neće odmah shvatiti šta da pogledaju u Proposals & phases"):**

- [x] `tailwind.config.js` — nov keyframe **`attention-glow`** (2s, pulsira SAMO `box-shadow`). Namerno **nije** korišćen ugrađeni `animate-pulse`: on menja `opacity` celog elementa, pa bi tekst koji treba pročitati treperio zajedno sa ivicom
- [x] Klijentska strana (`app/dashboard/projects/[id]/page.js`): ponuda u statusu `sent` dobija zlatnu ivicu + `animate-attention-glow`, bedž **„Needs your approval"** pored postojećeg status pill-a (status opisuje šta smo MI uradili, ovaj kaže šta KLIJENT treba da uradi), i brojač u zaglavlju sekcije („1 proposal is waiting for your approval")
- [x] Puls prestaje čim klijent otvori ponudu (`reviewedProposalIds`) i tada se skida i iz zvona (`markRead` sa `proposalId`); **zlatna ivica ostaje** dok god ponuda stvarno čeka odluku. Na sledećoj poseti puls se vraća ako i dalje nije odlučeno — nerešena ponuda košta, pa je to namerno
- [x] Admin strana (`PendingWorkSection`): pulsiraju samo redovi gde je **potez na operateru** (`draft`, `changes_requested`, `rejected`); `sent` je parkiran kod klijenta i ostaje miran — da puls ne izgubi značenje

**Potpuno brisanje i povratak iz arhive (traženo posle testiranja — test podaci se nisu mogli ukloniti):**

- [x] `DELETE .../proposals/:pid` prošireno sa `archived` (bilo samo `draft`/`rejected`). Time **svaki status ima pun put do potpunog uklanjanja**: `sent` → withdraw → delete · `accepted` → „Delete phase" (arhivira i vraća milestone-ove iz plana) → delete · `draft`/`rejected`/`archived` → delete odmah
- [x] Brisanje čisti i tragove: `$pull` iz `project.archivedProposalIds` (tombstone postoji samo da spreči da accept-replay ponovo materijalizuje fazu — kad ponude više nema, nema šta da se replay-uje) i `handoffProposalId` na izvornom chat item-u
- [x] Odbrambena provera: ako ijedan milestone još uvek pokazuje na tu ponudu (polovično odrađena arhiva) → **409**, da brisanje ne ostavi milestone-ove bez porekla
- [x] UI dugme **„Delete forever"** za `draft`/`rejected`/`archived`, odvojeno od postojećeg „Delete phase" (koji je i dalje meko arhiviranje). Traži da se **otkuca ime faze** — isti nivo potvrde koji `DeletePhaseDialog` traži za mnogo blažu akciju
- [x] **BUG prijavljen uživo i ispravljen:** prva verzija je koristila `window.prompt`. Brisanje `rejected` je radilo, ali `archived` posle toga „ne otvara modal" — jer posle prvog nativnog dijaloga browser ponudi _„spreči ovu stranicu da pravi još dijaloga"_, i od tada `prompt()` **vraća `null` bez prikazivanja**. Kod je `null` tretirao kao „otkazano" i tiho izlazio, pa je dugme delovalo pokvareno. Zamenjeno pravim dijalogom `components/admin/DeleteProposalForeverDialog.jsx` (Radix, kao i ostatak aplikacije), sa objašnjenjem po statusu zašto je brisanje bezbedno. Pouka: nativni `prompt`/`confirm` nisu pouzdani za ponovljene destruktivne radnje — aplikacija ionako svuda koristi Radix dijaloge
- [x] **„Restore as draft"** za `archived` — arhivirana ponuda sad nudi `Create revision` (pod tim imenom) i `Add milestone`, što je ranije imala samo `rejected`/`accepted`. Stari plan se vraća kao nov draft i ide ponovo kroz send/approve

**Brisanje prihvaćene faze — operatorski override (promena politike, potvrdio korisnik):**

- [x] Zatečeno stanje bio je **ćorsokak**: `preparePhaseArchive` je bezuslovno odbijao arhiviranje ako je bilo šta u fazi započeto, dugme je bilo `disabled`, pa prihvaćena faza sa započetim radom **nikad** nije mogla da se ukloni — ni meko ni tvrdo. Dokumentacija to nije rešavala; `DeletePhaseDialog` je izričito pisao da server odbija takvo brisanje. Dakle: promena politike, ne nedostajuće dugme
- [x] `preparePhaseArchive(..., { force })` — override **samo** nad započetim radom. Master proposal (`MASTER_PROPOSAL_IMMUTABLE`) i ne-`accepted` statusi (`PHASE_NOT_ACCEPTED`) ostaju odbijeni i sa `force: true`; 4 nova testa to zaključavaju
- [x] Endpoint traži **drugu potvrdnu frazu** `"DELETE STARTED WORK"` pored postojeće `"DELETE"`, plus obavezan razlog
- [x] Razlog se čuva sa prefiksom `[Force-deleted over N started milestone(s)]` u `archiveReason`, i ide u `project_proposal_archived` događaj — arhivirani red je jedini preostali trag, pa mora da kaže i šta je odbačeno
- [x] UI: dugme više nije `disabled` kad je rad započet, nego menja tekst u **„Force delete phase"**; dijalog tada prikazuje crveno upozorenje, traži frazu, i menja tekst čekboksa (ranije je tvrdio „has not started", što bi u force režimu bila neistina)
- [x] **Master proposal (faza 1) ostaje nedodirljiv** — svesna odluka korisnika: to je ceo dogovoreni obim projekta, ispravlja se kroz `Create revision`
- [-] Nije uživo testirano nad pravom bazom — korisnik čisti svoje test podatke sam

**Verifikacija:** `npm test` → **161** (14 novih ukupno u ovoj rundi). Sintaksno provereno sve izmenjeno. Uživo: `/admin` i `/dashboard` se kompajliraju; `POST /project-items/:id/handoff`, `.../withdraw`, `DELETE .../proposals/:pid` vraćaju 401 (ruta postoji, auth radi), uklonjeni `.../milestone` vraća 404, postojeće `DELETE /api/services/x` i dalje 401 (bez regresije). Tailwind je pokupio novi keyframe bez restarta — potvrđeno čitanjem servirane CSS datoteke (`@keyframes attention-glow` + `.animate-attention-glow` prisutni).

- [-] **Puni uživo tok nije testiran** (dva browsera, admin+klijent, send → accept → auto-refresh; throttle; toast) — traži pisanje u pravu bazu i izričitu dozvolu

---

## 12e. Fino podešavanje chata (korisnik testira sam u dev modu)

- [x] Pinovana poruka je anchor — klik skače na tu poruku u threadu, sa istim highlight-om koji već koristi „reply" citat. Ako poruka još nije učitana u istoriji, javi toast umesto tihog ne-reagovanja
- [x] Pinovana poruka sa flagom ima i malo **Convert** dugme desno — konverzija bez traženja poruke u threadu. Ako je već konvertovana, umesto dugmeta stoji njen `ref`
- [x] Obrisana poruka se sada **automatski skida sa pinova** (`pinned:false` pri brisanju), a `GET /pinned` dodatno filtrira `deletedAt: null` da pokrije i ranije obrisane-a-pinovane redove
- [x] Mobilni header: naslov u prvom redu punom širinom, kontrole (flag / search / Decisions & items) u drugom; search uzima preostalu širinu, dugmad `auto`. Od `md:` naviše ostaje jedan red
- [x] Preview slike: `⋯` više ne stoji ispod ugrađenog `X` dugmeta dijaloga (`pr-12`) — ranije je na dodir uvek pobeđivalo zatvaranje
- [x] Dokumenti se **odmah preuzimaju** umesto preview-a (PDF u `iframe`-u je na mobilnom prikazivao ikonicu oštećenog fajla); zajednički `downloadFileToDevice` u `lib/utils.js` (fetch → blob, jer `<a download>` ne radi cross-origin)
- [x] Mobilni composer: `⋮` meni (otvara se nagore) sa **Attach** i **Flag** podmenijem umesto dva zasebna dugmeta — tekstualno polje i Send dobijaju širinu. Desktop zadržava zasebna dugmad
- [x] `items-center` poravnanje u headeru i composeru
- [x] Admin panel header — `overflow-hidden` + `gap-2 lg:gap-4` + `hidden sm:inline` na `Welcome, {name}` + `shrink-0` na kritičnim elementima — sprečava horizontalni scroll na mobilnom
- [x] Mobilni composer textarea: `rows={3}` na mobilnom, `rows={1}` na desktopu — `useEffect` sa `matchMedia("(max-width: 767px)")`
- [x] Mobilni Flag submenu (`DropdownMenuSubContent`): `side="top" align="end"` — meni ide ka gore od Flag dugmeta, donja ivica poravnata
- [x] Hydration mismatch warning (`cz-shortcut-listen="true"`) — **nije bug u kodu**: ColorZilla browser ekstenzija ubacuje atribut na `<body>` pre nego što React hidrira. `suppressHydrationWarning` na `<html>` i `<body>` u `app/layout.js`

Sintaksno provereno; `npm test` 161/161. **Uživo nije testirano — korisnik testira u dev modu.**

- [x] Proxy download endpoint `GET /api/download` + prošireni tipovi fajlova (PDF/DOC/DOCX/TXT) + download slika na uređaj putem proxy-ja — **potvrdio korisnik**: slike rade kroz proxy, PDF/DOC/DOCX/TXT koriste Cloudinary Admin API signed URL fallback (`cloudinary.utils.private_download_url`) jer "Restricted media types" blokira `image/upload` za ne-slikovne formate. Upload endpoint proširen da prihvata DOC/DOCX/TXT i koristi `uploadRawToCloudinary` (`resource_type: "raw"`) za sve ne-slikovne fajlove — novi fajlovi dobijaju `/raw/upload` putanju koja nije blokirana
- [x] Mobilni tri tačkice (`⋮`) pored poruka — `md:opacity-0 md:group-hover:opacity-100` umesto `opacity-0 group-hover:opacity-100`, tako da su na mobilnom uvek vidljive a na desktopu se i dalje pojavljuju na hover
- [-] Chat workspace visina — zamenjen `h-[calc(100vh-220px)]` u `ProjectChat.jsx` sa `h-full`; roditeljski kontejneri (`app/admin/page.js`, `app/dashboard/page.js`) sada koriste `h-dvh flex flex-col` + `shrink-0` na headeru + `flex-1 min-h-0` na `<main>`/content oblasti tako da chat prirodno ispuni sav raspoloživ prostor. Dashboard koristi uslovne klase (`activeTab === "chat" ? flex-1 min-h-0 : container mx-auto`) da ne polomi izgled ostalih tabova. **Potvrdio korisnik — radi**
- [x] Klikabilni linkovi u chatu — `MessageBubble.jsx` parsira URL-ove u telu poruke (`autolink` regex), renderuje ih kao `<a target="_blank" rel="noopener noreferrer">` sa bojom `rgb(0, 69, 156)` i underline. **BUG ispravljen 2026-07-29:** `renderBodyWithLinks` je vraćao sirov tekst kad je cela poruka samo URL (`parts.length <= 1 ? text : parts` ne razlikuje `[plainText]` od `[<a>]`); ispravljeno na `last > 0 ? parts : text` gde `last` napreduje samo kad je URL zaista pronađen
- [x] Chat na zasebnoj stranici `/dashboard/chat` — izmešten iz taba u `app/dashboard/page.js` na svoju stranicu (novi `app/dashboard/chat/page.js`) sa `h-dvh flex flex-col` layoutom i back dugmetom u headeru, identičan obrazac kao admin stranica. Rešava problem gde je Danger Zone sekcija (brisanje naloga) završavala preklopljena ispod chat kontejnera pune visine. Navigacija sad koristi `<Link href="/dashboard/chat">` umesto `onClick` tab switcher-a; `totalUnreadChat` tačka ostaje na linku
- [x] DM lista u sidebar-u filtrirana po `rosterProjectId` — **BUG ispravljen 2026-07-29:** adminu su se u Direct sekciji prikazivali DM-ovi iz SVIH projekata, a `members` roster je scope-ovan na jedan projekat, pa DM-ovi iz drugih projekata nisu mogli da razreše ime partnera (prikazivalo se "Direct message"). `dmChannels` sada filter dodaje `(!rosterProjectId || c.projectId === rosterProjectId)` — prikazuju se samo DM-ovi koji pripadaju trenutno aktivnom projektu

---

## 12f. Isporuka notifikacija, chat scroll i optimizacija (2026-08-08)

Korisnikov izveštaj: „notifikacije i push kao PWA rade povremeno", „mejlovi za novi Proposal i izmene moraju raditi precizno", „scroll to bottom pri ulasku i pri slanju", „pinovana poruka da se učita i skroluje", „unpin ikonica u Pinned panelu", „klik na notifikaciju da vodi do akcije", plus provera pre-renderinga i nepotrebnih učitavanja u chatu.

### Test infrastruktura — popravljena PRE svega ostalog

- [x] **`fileParallelism: false` u `vitest.workspace.mjs` nije radilo.** To je root-only opcija; unutar `defineWorkspace` projekta se prihvata i **tiho ignoriše**. Posledica: svih 7 integracionih fajlova je radilo paralelno nad **istom** bazom, a `resetDb()` u jednom fajlu je brisao fixtures drugog → **143 lažna 401/404/E11000 pada** koji svi prolaze kad se fajl pusti sam. Rešeno novim root `vitest.config.mjs` (`workspace` + `fileParallelism`)
- [x] `harness.mjs` `MODELS` proširen na **sve** kolekcije koje suite ume da PIŠE (`ProjectRequest`, `ProjectMessage`, `ProjectProposal`, `ProjectAuditLog`, `PushSubscription`) — konverzija pravi zahteve i poruke, pa je jedan test brojao šest tuđih `ProjectRequest` redova
- [x] `subscribeToPush(user)` i `runDigestSweep()` helperi; `CRON_SECRET` u test env-u (digest ruta je bearer-gated)
- [x] `tests/ui/setup.js` (nije postojao, a `chat-ui` projekat ga je referencirao) + `esbuild: { jsx: "automatic" }` — bez toga svaki render puca na `React is not defined`, jer projekat nigde nema `jsx` compiler opciju
- [x] Skripte: `test:api`, `test:ui`, `test:all`, `typecheck`

### Push i mejl — četiri prava bug-a

- [x] **Push se nije čekao.** `notifyUser` je zvao `sendPushToUser(...).then(...)` bez `await`. Na serverless runtime-u instanca sme da se zamrzne čim odgovor ode, pa push u letu jednostavno nikad nije završen — **najverovatniji uzrok „radi povremeno"**. Sad je `await`-ovan
- [x] **`pushedAt` se upisivao i kad nijedan uređaj nije primio poruku.** `sendPushToUser` sad vraća `{ sent, failed, pruned, skipped }`, a stamp ide samo uz `sent > 0`. Ranije je istekla pretplata izgledala kao uspešna isporuka i **gušila sledećih sat vremena pravih push-eva**
- [x] **Throttle je čitao oba vremena sa JEDNOG dokumenta.** Uzimao je najskoriji red koji ima `emailedAt` ILI `pushedAt` i sa njega čitao oba polja — red koji je push-ovan a nije mejlovan prijavljivao je „nikad mejlovano". Sad dva nezavisna, scope-ovana upita
- [x] **`resolveClientUserId` je bio case-sensitive.** `User.email` se upisuje kako ga klijent otkuca, `ClientProject.clientEmail` kako ga operator otkuca — jedno veliko slovo i ponuda nije stizala ni u zvono ni na mejl, **bez ijednog traga u logu**. Dodat case-insensitive fallback; `notifyUser` sad i loguje kad primalac ne postoji umesto da tiho izađe
- [x] `runEmailDigest`: per-user throttle sužen na `DIGEST_TYPES` — ranije je **bilo koji** inline mejl (npr. „Proposal ready") držao digest poruka sat vremena; i `emailedAt` se sad upisuje **tek posle uspešnog slanja**, pa ispad mejl provajdera više ne „pojede" batch
- [x] `lib/push.js`: truncate body na 300 znakova (push servisi odbijaju prevelik payload), `tag` po razgovoru
- [x] `public/sw.js`: `notificationclick` bira tab koji je **već na cilju** (fokus bez re-navigacije), inače fokusira pa navigira — oba `await`-ovana unutar `waitUntil`; ranije `navigate()` nije bio čekan pa je klik znao da samo fokusira staru stranicu

### Notifikacija vodi do akcije

- [x] Chat notifikacije nose i **poruku**, ne samo kanal: `?channel=…&m=<messageId>`; `ProjectChat` prima `initialMessageId`, čisti filtere i skroluje do te poruke (učitavajući stariju istoriju ako treba)
- [x] `initialMessageId` se **latch-uje u state**, ne čita iz props-a uživo — URL sync efekat prepisuje adresu na `?channel=…` i oduzeo bi `m` pre nego što se pročita (isti obrazac kao `useSearchParams` bug na invite stranici, 12b)
- [x] `/dashboard?tab=chat` legacy redirect prosleđuje i `m`
- [x] `NotificationBell`: `fallbackLinkFor(n, variant)` — red bez `link`-a više nije mrtav klik; preskače se samo navigacija na **identičan** URL (isti kanal na istoj stranici), dok promena query-ja i dalje ide kroz `router.push`
- [x] `/dashboard/chat` dobio **`NotificationBell` i `PushManager`** — bila je jedina autentifikovana stranica bez oba, a to je stranica na kojoj se najduže sedi (bez zvona nema ni „Enable push notifications" ponude, bez `PushManager`-a se pretplata ne osvežava)

### Chat scroll i pin

- [x] Ulazak u kanal uvek sleti na **poslednju poruku** — dupli `rAF` + `ResizeObserver` na omotaču sadržaja, pa slika koja se učita posle prvog paint-a ne ostavi pogled na pola threada
- [x] **Slanje poruke uvek skroluje dole**, i kad je korisnik pre toga skrolovao gore: `MessageComposer` javlja `onSent`, plus pravilo „poslednja poruka je moja → prati je" (pokriva i slanje sa drugog uređaja). Tuđa poruka dok čitaš istoriju i dalje daje „New messages" pilulu umesto trzaja
- [x] Reset scroll stanja i na promenu **filtera/pretrage**, ne samo kanala (svaki je zaseban query — zaseban thread); `prevLengthRef` se sad takođe resetuje
- [x] Klik na pinovanu poruku **stranica po stranicu učitava istoriju** dok je ne nađe (do 20 stranica), i čeka da se prva stranica uopšte razreši pre nego što zaključi da poruke nema — ranije je deep-link uvek završavao na toastu
- [x] Skok **čisti aktivni filter/pretragu** — sa filterom „Problem" ciljna poruka nije ni u upitu, pa bi pretraga istorije došla do kraja i ništa ne našla
- [x] `pendingJumpRef` (računat u renderu) sprečava trku između „prvi paint → skroluj dole" i „skoči na poruku", pošto čišćenje filtera menja query ključ i broji se kao svež thread
- [x] **Unpin ikonica skroz desno** u `PinnedBar`-u, uslovljena serverskim `canPin`-om
- [x] `['chat-pinned']` dodat u invalidaciju `useNotifications` poll-a — tuđ pin se sad pojavi bez refreša (pinned lista nema sopstveni polling)

### Pre-render, re-render, nepotrebna učitavanja

- [x] **Prefetch prve stranice svakog kanala** (`usePrefetchChannelMessages`, max 12, jednom po kanalu po sesiji) — prvi klik na bilo koji kanal se sad iscrta iz keša umesto „Loading…"
- [x] `staleTime: 3000` + `refetchOnMount: true` umesto `staleTime: 0` + `'always'` — prefetch-ovan kanal se prikazuje odmah; budžet svežine je nepromenjen (4s poll + invalidacija iz notifikacionog poll-a), nestao je samo prazan frejm
- [x] `messages` niz **memoizovan** na identitet `pages` — nepromenjen 4s poll više ne pravi nov niz i ne re-renderuje svaku poruku
- [x] `MessageBubble` u `React.memo`, sa **stabilnim** handler identitetima iz `MessageList`-a (`onJumpToReply` prima izvorni id kao drugi argument umesto da se zatvara po redu — inače memo ne radi ništa)
- [x] `ProjectChat`: `activeChannel` kroz `useMemo`, svi handleri kroz `useCallback`, URL sync čuvan ref-om da `router.replace` ne okida sam sebe
- [x] `markRead` vezan za **id poslednje poruke**, ne na `messages.length` — svaki prepend istorije je ranije slao dva upisa i dve invalidacije za thread u kom se ništa novo nije desilo; dodat `visibilitychange` listener da povratak u tab ipak označi pročitano
- [x] **Filter i pretraga se resetuju pri promeni kanala** — zaostao filter iz prethodnog kanala je najverovatnije objašnjenje za „poruke se ne učitaju": kanal je izgledao prazan jer se gledala filtrirana projekcija

### Novi testovi

- [x] `tests/integration/notification-delivery.test.mjs` (12) — ceo lanac isporuke: proposal sent/changes-requested notifikacija i mejl, mejl i kad je klijent online, case-insensitive pronalaženje klijenta, push završen **pre** povratka odgovora, `pushedAt` NIJE upisan bez uređaja, `tag` po razgovoru, nezavisni email/push throttle, digest (inline mejl ne blokira, throttle po primaocu, batch preživi pad provajdera)
- [x] `tests/ui/message-list.test.jsx` (6) — sleti na poslednju poruku, sleti i iz keša, prati sopstvenu poruku dole i kad si skrolovao gore, pilula za tuđu, `scrollRequest` iz composera, skok učitava istoriju unazad
- [x] `tests/ui/pinned-bar.test.jsx` (4) — unpin po redu i šta zove, sakriven bez `canPin`, klik traži skok
- [x] `tests/ui/notification-bell.test.jsx` (8) — klik navigira na poruku, označava ceo kanal pročitanim, fallback link, bez duplog history unosa za istu stranicu, drugi kanal na istoj stranici JESTE navigacija
- [x] `chat-notifications.test.mjs` ažuriran na novi ugovor linka i na pravu push pretplatu (stub sad broji stvarne `PushSubscription` redove umesto da uvek vraća `sent: 1` — inače bi sakrio baš bug koji čuva)

### Health check

- [x] `npm run build` — prolazi (Next 16.2.10, 14 stranica)
- [x] `npx tsc --noEmit` — čist. Dodat `tsconfig.json` (`allowJs`, `checkJs: false`) i `typescript` u devDependencies; TypeScript ranije nije bio ni instaliran, pa `npx tsc` nije mogao da se pokrene
  - [-] `checkJs: true` namerno **nije** uključen: daje **~1374** nalaza kroz ceo kodbejz (uglavnom React Query mutation generici koji se izvode kao `void` i Radix `forwardRef` prop inference) — to je zaseban posao, ne nalaz ove runde. Jedini pravi nalaz u dodirnutim fajlovima (prefetch poziv bez `flag`/`q`) je ispravljen default vrednostima
- [x] `pyright backend_test.py tests/__init__.py` — 0 errors, 0 warnings
- [-] **Uživo u browseru nije testirano od strane asistenta** — scroll i push traže pravi uređaj/sesiju; ostaje na korisniku

---

## 12g. Druga runda posle korisnikovog testiranja (2026-08-08)

Prijava: „ne dobijam push na telefonu", „scroll opet ne radi — otvori poruke na pola prepiski", „textarea na mobilnom ide ispod ekrana preko 6 redova".

### Scroll — prava trka, ne podešavanje

Prethodna runda je i dalje koristila **one-shot** flag (`isInitialLoadRef`). Lanac koji ga obara:

1. prvi paint troši flag i **zakazuje** scroll za sledeći frejm;
2. u toj rupi stigne scroll event sa `scrollTop` još uvek 0;
3. `scrollTop < 80` + `hasMoreHistory` se čita kao „korisnik je skrolovao gore po istoriju" → učita se prethodna stranica;
4. restore vraća poziciju **starog vrha** — sredinu prepiske — a flag je već potrošen, pa ništa ne vraća dole.

Grizlo je samo kanale sa punom prvom stranicom (50+ poruka), zato je izgledalo povremeno.

- [x] Model promenjen sa „skroluj dole jednom" na **„drži se dna dok korisnik ne kaže drugačije"** (`stickToBottomRef`)
- [x] **Istorija se ne učitava dok se pogled nije slegao na dno** (`settledRef`) — `scrollTop` je legitimno 0 par frejmova pri otvaranju
- [x] **Samo scroll koji je korisnik napravio** gasi praćenje (`programmaticUntilRef`). Smooth scroll emituje evente i posle poziva; instant ne dobija prozor uopšte, da korisnik koji odmah po otvaranju skroluje gore ne bi bio ignorisan
- [x] Restore posle prepend-a koristi **stvarni prethodni `scrollTop`**, ne 0 — ranije je pogled odlutao naviše sa svakom stranicom

### Layout — textarea nije rastao naopako, cela kolona je prelivala

- [x] `ProjectChat` je imao **`min-h-[500px]`**. Sa otvorenom tastaturom na telefonu vidljiva visina padne na ~350px, pa je kutija bila viša od ekrana → composer na njenom dnu ispod preloma, a rast textarea izgleda kao širenje **nadole van ekrana**. Sad `min-h-0 md:min-h-[500px]`
- [x] `MessageList` `min-h-[200px]` → `min-h-0`; unutrašnja kolona dobila `min-h-0` — bez toga thread ne može da ustupi mesto composeru
- [x] `viewport.interactiveWidget = "resizes-content"` — bez toga Chrome na Androidu ne smanjuje `dvh` kad se tastatura otvori, nego samo gurne stranicu naviše
- [x] Mobilni cap rasta 200px → **120px**, početni `rows` 3 → 2 (200px na telefonu je pojelo ceo razgovor); `items-center` → `items-end` u redu composera
- [x] `py-8` → `py-3` na telefonu na `/dashboard/chat`

### Push — presence je bio po NALOGU, a push je po UREĐAJU

Uzrok „ne dobijam push na telefonu": `resolveDeliveryChannels` je gasio push čim je nalog bio „online". Otvoren dashboard na laptopu = **telefon ćuti sat vremena** — baš uređaj zbog kog push i postoji.

- [x] Uvedena razlika: `recipientOnline` (nalog aktivan bilo gde) vs **`recipientViewingConversation`** (pročitao BAŠ ovaj kanal unutar prozora, iz postojećeg `ChatRead.lastReadAt` — bez novog state-a)
  - čita razgovor → nema ni mejla ni push-a
  - aktivan negde drugde → **nema mejla** (zvono na laptopu to pokriva), **push ide**, i dalje ograničen throttle-om na jedan po razgovoru na sat
  - offline → oba, po throttle-u
- [x] **Rotacija VAPID ključa se sad sama leči.** Pretplata u browseru je trajno vezana za `applicationServerKey` sa kojim je napravljena; posle rotacije `getSubscription()` je i dalje vraća, red u bazi i dalje postoji, ali push servis odbija **svaki** send sa 403 — simptom je tačno „radilo pa jednog dana prestalo", bez ijedne greške bilo gde. `usePush.ensureSubscribed` sad poredi ključ na pretplati sa aktuelnim i, ako se razlikuju, radi `unsubscribe()` pa novu pretplatu; `lib/push.js` tretira 401/403 kao mrtvu pretplatu (uz `console.warn`) umesto da je večno pokušava. **Provereno da rotacija NIJE potrebna** za trenutne ključeve: par u `.env.local` je validan (javni == `NEXT_PUBLIC_` kopija, 65B nekompresovana P-256 tačka, 32B privatni, `web-push` gradi ispravan `Authorization` header)
- [x] `POST /api/push/test` + dugme **„Send a test push to this device"** u zvonu — „push ne radi" ima najmanje pet različitih uzroka (nema VAPID ključeva · nijedna pretplata · istekla pretplata · politika isporuke · OS blokira) i nijedan se ne vidi spolja. Endpoint zaobilazi politiku namerno: to je provera ožičenja, ne notifikacija. Vraća `sent/failed/pruned`, broj pretplata, host i user-agent po uređaju — **nikad pun endpoint URL**, jer je njegova putanja bearer kredencijal za taj browser

### Zašto push, install banner i settings switch ne rade na telefonu — jedan uzrok

Korisnik: „kad instaliram app na telefon kaže ne mogu da uključim push · switch u Settings se sam vrati na off · nema više install banner-a". Sva tri imaju **isti** uzrok, koji aplikacija nigde nije pominjala.

**Service Worker, `PushManager` i `Notification` postoje samo u secure context-u** — https, ili izuzetak za `localhost`/`127.0.0.1`. Plain-http LAN adresa (`http://192.168.1.x:3003`, tačno kako se ovaj dev server otvara sa telefona, vidi 12b) **nije** secure context, pa browser te API-je uopšte ne definiše. Otud:

- `usePush.supported` → `false` → switch u Settings je `disabled` i `checked={pushOn && push.supported}` ga crta kao **off**
- `beforeinstallprompt` se nikad ne okine (traži isti secure context + registrovan SW) → **nema install banner-a**
- poruka koju je korisnik video bila je „Not supported on this device/browser" — što šalje čoveka da traži problem na telefonu, a problem je adresa na kojoj je otvorio aplikaciju

- [x] `usePush` vraća `unavailableReason` + `unavailableMessage` — `insecure-origin` · `missing-key` (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` nedostaje u buildu) · `unsupported-browser` · `ios-needs-install` · `blocked`. Redosled je od najkonkretnijeg: prvi tačan razlog je onaj koji stvarno treba popraviti
- [x] `blocked` **ne** obara `supported` — to je stanje dozvole, ne sposobnosti uređaja; UI sad može da objasni umesto da tvrdi da telefon ne ume
- [x] Settings prikazuje konkretan razlog i u opisu i u toastu kad switch odbije da se uključi
- [x] `PWAInstallBanner`: novi `insecure` režim koji kaže zašto instalacija nije moguća, umesto uputstva koje ne može da uspe
- [x] **Odbacivanje banner-a više nije trajno** — bio je `localStorage` flag bez isteka, pa je „nema banner-a" imalo dva nerazlučiva uzroka (ne može da se prikaže / dodirnuo si × pre par nedelja). Sad je datirano, 30 dana; stara `"1"` vrednost se migrira na „prikaži ponovo"
- [x] **BUG u prethodnoj rundi, moj:** dugme „Send a test push to this device" bilo je uslovljeno sa `isSubscribed`, pa je jedina kontrola koja objašnjava zašto push ne radi **bila sakrivena svima kojima push ne radi**. Sad je uvek prisutno; bez pretplate menja tekst u „Why can't I get notifications?" i prijavljuje razlog sa klijentske strane pre nego što uopšte pozove server

### „Permission odobren, pa ipak Couldn't enable push" (Android Chrome, produkcija)

Sledeća prijava: na deployovanom https sajtu, sa sva četiri VAPID vara na Vercelu, Android prikaže sistemski prompt, korisnik potvrdi — i **onda** aplikacija kaže „Couldn't enable push notification". Dakle pada **posle** dozvole, a `subscribe()` je celu grešku gutao u `console.error` i vraćao `false`. Dve runde nagađanja su bile posledica toga; ovo je zatvoreno tako što aplikacija sad **prijavljuje pravu grešku**.

- [x] `subscribe()` prati **fazu** (`permission` → `service-worker` → `subscribe` → `save`) i pamti `{ stage, name, message }`; `lastErrorMessage` je rečenica tipa „Push service: AbortError — Registration failed - push service error". Svaka od tih faza pada iz nepovezanih razloga (browser · push servis/FCM · naš server) i traži drugu ispravku
- [x] Greška se prikazuje u toastu (12s) **i trajno** u Settings ispod prekidača — toast nestane pre nego što se stigne pročitati ili slikati
- [x] **`InvalidStateError` se sad sam leči.** Klasično Android Chrome odbijanje: push servis još drži pretplatu za tu registraciju pod **drugim** ključem, a `getSubscription()` je ne prijavljuje. Bez toga je uključivanje push-a na tom uređaju **trajno nemoguće**, bez ijednog načina da korisnik to očisti. Sad: `unsubscribe()` postojeće pa jedan ponovni pokušaj
- [x] Provera poklapanja VAPID ključa dodata i u `subscribe()` (ranije samo u `ensureSubscribed`) — ponovna upotreba pretplate vezane za stari ključ je gore od nijedne: „uspešno" uključivanje koje ne isporučuje ništa
- [x] `next.config.js` CSP: `worker-src 'self'` i `manifest-src 'self'` napisani eksplicitno. Oba su i ranije prolazila kroz fallback na `default-src 'self'`, ali PWA stoji i pada na njima, a implicitna dozvola se lako slomi prvim stezanjem `default-src`
- [x] **Trajno mesto za „Install on your phone" u Settings** — banner je odbaciv, a Chrome-ov sopstveni prompt ima svoja pravila prigušivanja; između to dvoje je sasvim moguće ostati bez ijednog puta do instalacije, što se korisniku i desilo. Tekst se menja po platformi i po tome da li je adresa secure

### Ishod — potvrđeno uživo od strane korisnika ✓

Pravi uzrok cele serije „push ne radi na telefonu" bio je **zastareo keš u Chrome-u**: telefon je držao stariji deployovan build. Otvaranje svežeg Vercel deploy-a bez zastarelog keša → **radi na sva tri uređaja**.

Redosled koji je korisnik prošao, i koji je tačno ono za šta je dijagnostika napravljena:

1. „Enable push notifications" → sistemski prompt → dozvolio
2. **„Send a test push to this device"** → javio da je push **ugašen u Settings** za taj nalog (`pushEnabledOnAccount: false`) — podatak koji se ranije nije video nigde
3. uključio u Settings → push radi
4. install banner se pojavio (datirano odbacivanje iz ove runde ga je vratilo)

Napomena za ubuduće: `public/sw.js` **ne kešira** ništa (`skipWaiting` + `clients.claim`), pa se sam osvežava; zastarelost je bila u Chrome-ovom HTTP kešu instalirane aplikacije, ne u service worker-u. Pri testiranju PWA izmena na telefonu vredi otvoriti svež deploy (ili hard-reload), inače se debug-uje stari kod.

**Sve stavke iz 12g su potvrđene uživo osim chat scroll-a i textarea layout-a** (korisnik nije eksplicitno potvrdio; ostaju za proveru).

### Testovi

- [x] `tests/ui/notification-bell.test.jsx` +2: dijagnostika je ponuđena i kad push NE radi; postaje pravi test tek kad je uređaj pretplaćen
- [x] `tests/ui/message-list.test.jsx` +2: istorija se NE učitava pre nego što se pogled slegao (regresija sredine prepiske); smooth follow-scroll ne broji svoje evente kao korisnikov scroll
- [x] `tests/notification-policy.test.mjs` +2 / izmenjen 1: čitanje razgovora gasi oba kanala; online negde drugde gasi mejl ali **ne** push; push i tada poštuje throttle
- [x] `tests/integration/chat-notifications.test.mjs`: „online negde drugde i dalje dobija push na telefon", „star read receipt ne znači da čita sada"
- [x] `tests/integration/notification-delivery.test.mjs` +2: `push/test` izveštaj sa i bez uređaja, i 401 za anonimnog

**Verifikacija:** 163 (`npm test`) + 202 (`vitest`: 180 API + 22 UI) = **365 testova, sve prolazi**. `npm run build` prolazi, `npx tsc --noEmit` čist, `pyright` čist. Scroll i push na pravom telefonu ostaju na korisniku — dugme „Send a test push to this device" je tu baš zato.

---

## 13. Verifikacija

### Testovi i pokretanje

- [ ] `npm test` zeleno
- [ ] `npm run dev` bez grešaka (port 3003)

### E2E bezbednost — direktni API pozivi collaborator tokenom (ne UI!)

SEC 1–8, 11, 13, 14 se prvi put pokreću **odmah po Sekciji 4** (vidi 4b), a ovde se ponavljaju kao regresija na kraju Faze 1.

- [ ] SEC 1 — `GET /api/client-projects` 200; `jq`: **ključevi ne postoje** (`proposalId`, `changeHistory`, `clientEmail`, `requestId`, `archivedProposalIds`) — odsustvo ključa, ne null
- [ ] SEC 2 — `GET /api/client-projects/:id` 200 + ista provera ključeva
- [ ] SEC 3 — `GET /api/project-proposals?projectId=X` → **403**
- [ ] SEC 4 — `GET /api/project-proposals/:poznatiId` (projekat gde JE član) → **403**
- [ ] SEC 5 — `POST/PUT/PATCH/DELETE` proposal → **403**
- [ ] SEC 6 — `PUT .../milestones/:mid`, `PATCH .../milestone/*` → **403**
- [ ] SEC 7 — `GET /api/project-requests/:id` istog projekta → **404**
- [ ] SEC 8 — nečlan: `GET /api/client-projects/:tuđiId` → **404**
- [ ] SEC 9 — treći korisnik ne vidi tuđ DM u `GET /api/chat/channels` (prvi put po Sekciji 6)
- [ ] SEC 11 — owner regresija: odgovor identičan kao pre izmena
- [ ] SEC 13 — `GET /api/project-proposals/:idIzProjektaB` sa `?projectId=A` → **404** (resource-first)
- [ ] SEC 14 — `POST /api/client-projects/:A/messages` sa `milestoneId` iz projekta B → **404**
- [ ] SEC 15 — `POST /api/chat/channels/:kanalIzB/messages` kao član samo projekta A → **404** (po Sekciji 6)
- [ ] SEC 16 — `POST /api/chat/messages/:id/convert` gde poruka pripada projektu B → **404** (po Sekciji 12)

### E2E funkcionalnost

- [ ] F 1 — lazy kanal + prva poruka
- [ ] F 2 — poruka ≤4s kod klijenta; unread nestaje po otvaranju
- [x] F 3 — invite mejl (ko, projekat, prava, adresa, rok) — **potvrdio korisnik uživo**: mejl sadrži ko poziva („Gordana invited you…"), projekat („Spiritualized Language Tutor"), rolu („as a Consultant, Expert"), ličnu poruku, dugme + tekstualni link, adresu na koju glasi i rok („expires on August 4, 2026")
- [x] F 4a — **postojeći nalog**: preview → „Sign in" → prijava → odmah član grupe. **Potvrdio korisnik uživo** (posle ispravke `useSearchParams`/`replaceState` bug-a, sekcija 12b)
- [ ] F 4b — **novi nalog**: registracija sa zaključanim mejlom → odmah član + My Projects. Još nije prošlo uživo — korisnik je testirao putanju sa postojećim nalogom; registraciona grana (`register` + `inviteToken`) je uživo testirana samo sintetički u Sekciji 5 (test C/D), ne pravim klikom kroz UI
- [ ] F 5 — **dupli klik na Accept ne pravi duplo članstvo**
- [ ] F 6 — resend (stari token mrtav) + revoke
- [ ] F 7 — leave project → `removed` + audit
- [ ] F 8 — reply, mention (mejl odmah), upload, edit, delete
- [ ] F 9 — pin + PinnedBar + filter + pretraga
- [ ] F 10 — convert to request (`sourceMessageId`) + oznaka na poruci
- [ ] F 11 — save as decision (`D-001`, `confirmedBy`)
- [ ] F 12 — regresija milestone chata + member komentar (`authorRole: 'member'`)
- [ ] F 13 — audit log: created → resent → accepted → role_changed → removed/left

---

## Parkirane dopune — razrešeno

Sve stavke sa ove liste su razrešene i prebačene u **sekciju 3A** kao invarijante I1–I10, sa punom razradom u [PROJECT_CHAT_PLAN.md](./PROJECT_CHAT_PLAN.md) sekcija 4A. Ostavljeno kao trag odluka:

| Dopuna                                  | Ishod                                                                                                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic invitation accept                | → **I2**. Transakcija (Atlas ima replica set, presedan već postoji u kodu), **bez fallback grane**; dodato pravilo redosleda: membership pre invitation statusa |
| Postojeći nalog vs invite registracija  | → **I3**. Uz konstataciju da suspendovan/obrisan nalog **ne postoji kao stanje** (`User` nema `status`, brisanje je hard delete)                                |
| Token hygiene i rate limiting           | → **I4**. Rate limit premešten sa preview/accept na **slanje poziva** — 32 nasumična bajta se ne probijaju, spam mejlova jeste realan vektor                    |
| DM concurrency i `ProjectItem` sekvence | → **I5**. `dmKey` dodat u model odmah (izbegnuta migracija); za `ref` izabran **retry**, `ProjectSequence` model odbačen                                        |
| Notification fan-out                    | → **I6**                                                                                                                                                        |
| Polling budget                          | → **I8**                                                                                                                                                        |
| Feature flag                            | → **I9**. Prihvaćen, ali **sužen na UI ulaz**; rute se ne flaguju                                                                                               |
| Javni Cloudinary URL                    | → **I7**. Prihvaćen rezidualni rizik + obavezan helper tekst u UI-ju, ne samo u dokumentaciji                                                                   |
| _(novo, nije bilo na listi)_            | → **I10** i plan 5A. Preživljavanje istorije posle hard delete-a naloga                                                                                         |

---

## Faza 2 — kasnije, ne u ovoj isporuci

- [ ] Sistemski kanali: `Announcements` (`admin_only`), `Ideas`, `Development`, `Design & Content`
- [ ] `Incidents` kanal — auto-feed iz `ProjectItem`
- [ ] `Milestone Activity` kanal — auto-feed iz `ClientProject.events`
- [ ] **Privatni storage + signed URL za SVE priloge** (novi chat + retrofit postojećih); AV sken, sanitizacija imena, zabrana izvršnih fajlova
- [ ] `client_lead` / `project_admin` u UI + transfer vlasništva pri napuštanju
- [ ] Task assignee + `taskUpdateOwn`
- [ ] Interna finansijska polja iza `internalFinanceRead` (marža, trošak, kalkulacija)
- [ ] Thread-ovi (odgovori u pod-niz)
- [ ] Typing indikator i presence
- [ ] Arhiviranje kanala, moderacija
- [ ] AI rezimei: dnevni/nedeljni, nove odluke, otvorena pitanja, nepotvrđeni predlozi, poruke za taskove
- [ ] Globalna pretraga po projektu, članu, datumu, milestone-u i tipu odluke
- [ ] Migracija milestone chata (`ProjectMessage`) pod isti model kanala
- [ ] Razbijanje `route.js` na module
- [ ] Razmotriti SSE ako polling na 4s postane usko grlo

---

## 14. SEO — tehnički (2026-08-08)

Povod: analiza od „Google SEO Optimizations Studio" + mejl iz Search Console-a („Blocked by robots.txt").

### Šta je zaista bilo pokvareno (izmereno, ne pretpostavljeno)

`curl` na produkciju je pokazao uzrok Search Console greške, i on nije bio u sadržaju robots.txt-a — **robots.txt uopšte nije postojao**:

```
GET https://dmdevelon.website/robots.txt
  status=200 · content-type: text/html · x-matched-path: /[...slug]
GET https://dmdevelon.website/sitemap.xml
  status=200 · content-type: text/html · x-matched-path: /[...slug]
```

Catch-all ruta `app/[...slug]` je hvatala oba i odgovarala HTML dokumentom CMS stranice. Google je tražio robots.txt, dobio HTML sa statusom 200, i prijavio sajt kao blokiran. Sitemap-a nije bilo uopšte.

Drugi nalaz: `HomeClient` je imao **jedan zajednički loading gate** za pet klijentskih upita — dok bilo koji traje, cela stranica vraća `<Loader/>` („Processing…"). Na serveru nijedan od njih nema podatke, pa je serviran HTML sadržao **nula** tekstualnog sadržaja: bez heroja, usluga, projekata, kontakta. Analiza je bila u pravu za simptom; uzrok je bio ovaj gate, ne „SPA arhitektura" kao takva — Next je već renderovao na serveru, gate ga je poništavao.

### Urađeno

- [x] `app/robots.js` — pravi robots.txt (`text/plain`), disallow za `/api/ /admin /dashboard /invite /verify-email /reset-password`, plus `Sitemap:` i `Host:`. File-convention ruta se poklapa **pre** catch-all-a, pa je to ceo popravak
- [x] `app/sitemap.js` — sitemap iz baze (CMS stranice bez `seo.noIndex` + Portfolio projekti), `revalidate 3600`; pad baze degradira na „samo početna", nikad na 500
- [x] `lib/site-url.js` — jedno mesto za apsolutni origin. `app/page.js` je ranije interpolirao `process.env.NEXT_PUBLIC_APP_URL` direktno i pravio `undefined/` kad var nedostaje
- [x] **Uklonjen blokirajući preloader.** Svaka sekcija se sad renderuje odmah; `projects`/`testimonials` već imaju `[]` default, svi `profile` pristupi su optional-chained
- [x] **Početna čita bazu direktno** umesto `fetch()` na sopstveni `/api/services`. Taj round trip je bio čist trošak (dodatni mrežni hop + druga serverless invokacija za podatke koje proces već ume da upita), padao je pri buildu, i **terao stranicu da bude dinamička**. Sad je `○` sa `revalidate: 300` — prerenderovan, keširan HTML
- [x] Metadata: `alternates.canonical` (stari top-level `canonical` u `layout.js` **nije** deo Metadata API-ja i nije emitovao ništa), `metadataBase`, `openGraph.images` (staro `ogImage` polje nije validno pa je tiho ispadalo — svaki share je bio bez slike), `twitter` card
- [x] `lib/seo.js` fallback opis: „Web Development" → stvarni opis usluge sa cenom. Fallback je ono što se indeksira onog dana kad neko isprazni polje u CMS-u
- [x] Nova **About + finansiranje** sekcija između heroja i Services (`#about`, dodata i u nav): kako se radi (zahtev → ponuda → faze), i sufinansiranje sa pretplatama $49 / $149 / $299 / $549

**Rezultat na prerenderovanom HTML-u:** 22 KB (samo meta) → **120 KB sa stvarnim sadržajem**; „Processing" se više ne pojavljuje.

### Ostaje korisniku (sadržaj i off-page, ne kod)

- [ ] Search Console: posle deploy-a `robots.txt` → Validate Fix, i submit `sitemap.xml`
- [ ] SEO title/description po stranici kroz CMS (kod sad ima solidan fallback, ali fallback nije strategija)
- [ ] Namenske landing stranice po usluzi — CMS ih već podržava (`/[...slug]`), treba tekst
- [ ] Case studies (npr. Marysoll) — najjači E-E-A-T signal za B2B i prirodan izvor linkova
- [ ] Blog / vodiči za vlasnike salona
- [ ] „Powered by DMDevelon" u footeru klijentskih platformi

---

## 15. Paddle i pretplate — dogovoreno, nije započeto

Sledeći posao. Ovde stoji samo ono što je **odlučeno**, da se ne izgubi između sesija; pun plan se piše pre prve linije koda.

### Zahtev

`ProjectProposal` danas nosi **ručno unetu cenu koja se ne naplaćuje automatski**. Pored nje treba da nosi i **odgovarajući plan pretplate**: Website $49 · WebApp $149 · Workspace $299 · Growth $549 mesečno (isti skup je u `PRICING_TIERS`, `components/pages/HomeClient.js`). Pretplata kreće **mesec dana posle prihvatanja** ponude.

Poslovni razlog: model je sufinansiranje — nema velike fakture unapred, izgradnja se plaća kroz pretplatu — pa je ponuda mesto gde se komercijalna odluka donosi i prirodno mesto da se plan zapiše.

### Pravilo koje sve ostalo mora da poštuje

> **Jedan projekat — jedna pretplata.** Nikad jedna po milestone-u ili po fazi.

Dodavanje milestone-a ili faze **pomera postojeću pretplatu na viši (ili isti) tier — nikad ne pravi drugu**. Naplata prati ukupan obim projekta, ne zbir naplata po fazama. Iz toga sledi da „tier za projekat" i „tier upisan na prihvaćenoj ponudi" moraju završiti kao **ista vrednost**, ne dve koje mogu da se raziđu.

### Otvorena pitanja — rešiti PRE implementacije

- [ ] **Da li tier ikad ide naniže?** Pravilo iznad pokriva samo put nagore. Šta se dešava kad se faza arhivira, force-obriše ili se obim smanji?
- [ ] **Koji događaj je okidač naplate?** `accept` je očigledan kandidat, ali životni ciklus već ima `withdraw` i `archive` **posle** prihvatanja (sekcija 12d), pa i ti slučajevi traže odgovor.
- [ ] **Gde tier autoritativno živi?** Polje na projektu koje ponuda samo *predlaže*, ili izvedeno iz poslednje prihvaćene ponude. Šta god se izabere, ono drugo mora biti **čitanje** toga, nikad drugi izvor istine.

### Zatečeno stanje koje ograničava dizajn

**Faza *jeste* ponuda** — `kind: "phase"`, uz unique indeks `{projectId, phaseNumber}` (sekcija 12d). Svaki novi prihvaćen obim kreira **novi** `ProjectProposal` red. Zato „pretplata po projektu" ne može naivno da se izvede iz jedne ponude; to je tačka na kojoj se dizajn lomi ako se ne odluči unapred.

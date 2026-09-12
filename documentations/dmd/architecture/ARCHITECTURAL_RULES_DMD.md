# DMD — Architectural Rules & Coding Standards

**Status:** ACTIVE
**Authority:** canonical
**Owner domain:** DMD Architecture
**Supersedes:** `documentations/archive/dmd/superseded-architecture/DMD_EXTENSION_TARGET_ARCHITECTURE.md` where they conflict
**Superseded by:** —

**Version:** 1.2
**Contract class:** binding implementation contract
**Date:** 2026-09-12
**Applies to:** DMD Next.js application, Route Handlers, React UI, server modules, tests, scripts and all AI coding agents
**Primary architecture:** Next.js 16+ App Router + React 19.2+ + JavaScript + MongoDB/Mongoose
**Language rule:** DMD source is `.js`, `.jsx` and `.mjs` only. Do not introduce TypeScript files, TypeScript syntax, TypeScript-only architecture or a typed-JavaScript migration.

---

## 0. Purpose

This document exists to prevent the DMD codebase from turning product complexity into framework-level code slop.

The application may grow substantially in product surface, but routing files, pages and UI components must remain small adapters/compositions around explicit domain modules.

The primary current architecture debt this contract addresses is the pattern represented by:

```text
app/api/[[...path]]/route.js
```

where unrelated HTTP endpoints, authentication, MongoDB access, notifications, uploads, project workflows, chat, CMS, cron work and serialization are accumulated in one catch-all file.

It also addresses giant page files and client-side page loaders that duplicate work already available to Server Components.

The desired direction is:

```text
HTTP route / page
      ↓
thin adapter or composition
      ↓
application use case / server loader
      ↓
domain policy / workflow
      ↓
repository or provider adapter
      ↓
MongoDB / Cloudinary / Resend / external system
```

For UI:

```text
page.js / layout.js
      ↓
feature composition
      ↓
Server Components by default
      ↓
small Client Component boundaries only where interaction is required
      ↓
feature hooks / browser transport only when client-side server state is actually needed
```

---

# Part A — Rule hierarchy and hard invariants

## 1. Rule hierarchy

When rules compete, use this priority:

1. Security and privacy.
2. Data integrity and authorization.
3. Domain invariants and product contracts.
4. Correctness and testability.
5. Accessibility and user experience.
6. Performance and caching.
7. Maintainability.
8. Style and convenience.

An AI coding agent must not silently:

- move business logic between architectural layers;
- introduce a new state-management system;
- replace authentication/session strategy;
- change persistence semantics;
- change public API contracts;
- create a second source of truth;
- add a new provider or framework abstraction for hypothetical future use.

A material architecture change requires a documented decision before broad implementation.

---

## 2. Core invariants

### 2.1 Routing files are adapters, not applications

`page.js`, `layout.js`, `route.js`, `loading.js`, `error.js`, `not-found.js` and `proxy.js` are framework entry points.

They must not become domain modules.

#### 2.1.1 General Next.js Proxy contract

These rules are reusable and binding for DMD and any Next.js application governed by this contract **when that application adopts `proxy.js`**. They standardize how a Proxy is built; they do not require every project or milestone to add one.

`proxy.js` is only a thin framework entry point. Its responsibilities are limited to:

1. receive `NextRequest`;
2. create, or delegate creation of, the bounded request/proxy context actually needed;
3. call one small proxy policy or a justified explicit pipeline;
4. return `NextResponse`.

```text
proxy.js
   ↓
create/request context
   ↓
proxy policy / pipeline
   ↓
NextResponse
```

It must not contain:

- business or domain logic;
- a large authentication/session implementation;
- tenant lookup implementation;
- database queries;
- a large route switch or complex route-family branching;
- provider SDK implementation;
- product-specific workflows.

Framework entry-point size must remain proportional to adapter work even when the application becomes large. This extends the `Routing files are adapters, not applications` invariant; it does not create a separate architecture for Proxy.

#### 2.1.2 Resolve shared request classification once

Shared request context needed for routing or coarse security decisions must be resolved once and passed to the downstream proxy policy or pipeline. Depending on the real application requirement, that context may include only a subset of:

```text
pathname
hostname
surface / domain type
authenticated actor
workspace / project / tenant identifier
environment / preview mode
trusted proxy-derived headers
debug trace
```

> Resolve shared request classification once; do not make multiple downstream layers independently rediscover the same host, surface, tenant, workspace or routing context.

Downstream code must not guess again what the gateway has already determined reliably. A request context contains only gateway/request-classification data required by the active policy. It is not a global business-state object, a replacement for application input or a cache of arbitrary domain records.

#### 2.1.3 Proxy authentication is lazy and coarse

Proxy is not the complete authorization engine.

Where justified by actual route surfaces, it may establish coarse boundaries such as:

```text
anonymous user cannot enter a protected platform surface
internal endpoint requires its internal credential
superadmin surface requires an authenticated superadmin
protected API family requires authentication
```

The application/domain policy that owns the protected resource remains authoritative for questions such as:

```text
Can this collaborator read this project?
Can this actor approve this proposal?
Can this user mutate this workspace?
```

> Proxy may establish coarse request/security boundaries. Domain authorization remains with the application/domain policy that owns the protected resource.

Authentication is resolved lazily when possible. Public marketing, public product and intentionally public recovery requests must not pay JWT/session verification cost merely because a global Proxy exists. Public bypasses must be explicit, narrow and tested; self-verifying webhooks remain responsible for their own cryptographic verification.

A route, Server Function or application use case must never treat a successful Proxy pass as proof of resource-level authorization.

#### 2.1.4 DMD current baseline and adoption decision

DMD is currently not a multi-tenant routing platform. Its current product requirements do not justify:

- tenant subdomain resolution;
- custom tenant-domain resolution;
- path-based tenant routing;
- tenant-specific URL rewrites;
- per-tenant domain canonicalization;
- a multi-tenant gateway pipeline.

The presence of this architectural standard does **not** mean that DMD-FND-4 must implement `proxy.js`. DMD-FND-3 must first inventory the actual route families, current credential visibility and coarse request/security gaps. FND-3 reconciliation then defines whether FND-4 needs Proxy and, if so, its exact bounded scope.

If DMD adopts Proxy, it starts with the smallest implementation justified by that evidence:

```text
proxy.js
   ↓
small request/security policy
```

Only demonstrated multi-surface complexity may justify:

```text
proxy.js
   ↓
bounded request context
   ↓
small explicit pipeline
```

Do not change DMD authentication merely to make Proxy possible. In the current baseline, a browser-owned access token is not automatically visible at the server request boundary; any refresh-cookie-derived decision must be documented as coarse/optimistic unless the server auth contract proves more. Resource authorization remains:

```text
Route Handler
   ↓
authenticated actor
   ↓
application use case
   ↓
resource/domain authorization policy
```

Do not predefine Proxy matchers for routes or surfaces that do not yet exist. Do not copy a larger product's gateway solely because it may be useful later. This applies the existing rule against provider/framework abstractions for hypothetical future use.

#### 2.1.5 Reusable Pattern — Multi-Tenant / Multi-Domain Next.js Gateway

> This is not the current DMD proxy requirement. It is a reusable high-level pattern for products whose actual domain model requires multi-tenant or multi-domain routing.

When that requirement is proven, the reference flow is:

```text
Request
   ↓
proxy.js
   ↓
createProxyContext(request)
   ↓
executePipeline(context)
   │
   ├── system
   ├── detect-domain / resolve-context
   ├── public
   ├── auth
   └── routing
   ↓
finalize(response)
```

The first step that makes a final decision may return `NextResponse`. A step that only enriches context returns `null`/continue. `finalize()` may apply bounded cross-cutting response behavior, such as one refreshed cookie or an explicitly enabled safe debug trace.

##### Gateway entry point

`proxy.js` remains only:

```text
request
→ createContext()
→ executePipeline()
→ response
```

Tenant, identity and product implementation remain outside the framework file.

##### ProxyContext

One explicit context object travels through the pipeline instead of an expanding list of unrelated parameters. It may contain only data justified by the gateway contract, for example:

```text
request
hostname
pathname
surface / domain type

tenant:
  public identifier / slug
  canonical tenant ID
  custom domain

request headers/context
auth result
debug trace
```

This is a runtime JavaScript contract. It does not authorize TypeScript source or a repository-wide typed-JavaScript migration.

##### System

Infrastructure traffic that must be decided before product routing belongs here, such as cron, internal server-to-server endpoints, internal-secret validation and health/system callbacks. This layer must not contain product workflow.

##### Detect domain / resolve context

This layer normalizes public request identity. A multi-tenant application may distinguish:

```text
base / marketing domain
admin domain
superadmin / platform domain
tenant subdomain
tenant custom domain
preview / staging host
localhost / development mode
path-based preview tenant
```

Different public addresses must resolve to the same canonical context where they represent the same tenant:

```text
tenant.example.com
custom-client-domain.com
preview.example.com/tenant-slug

            ↓

canonical tenantId
canonical tenant context
```

##### Canonical tenant identity security invariant

> Public slug/domain is an address. Canonical tenant ID is the security identity.

A slug such as `kiki-kiss-beauty` is not authorization evidence. It must resolve to a canonical tenant record and identifier. If resolution is not reliable, deny or return not-found; never continue as though the public slug were a verified tenant identity.

Cross-tenant access requires both identities:

```text
authenticated identity
        +
resolved canonical tenantId
        ↓
tenant access policy
```

A valid global JWT/session does not grant access to every tenant.

##### Public

The public layer handles explicitly unauthenticated categories such as public APIs, authentication/recovery endpoints, cryptographically self-verifying webhooks and tenant-specific public metadata such as manifest/favicon. Bypasses must be explicit and tested; broad wildcard bypasses are prohibited without a documented requirement.

##### Auth

Authentication runs only for a surface that requires it:

```text
extract credentials
→ verify
→ optional refresh
→ verify refreshed credentials
→ coarse role/surface check
→ tenant access check where required
```

When authentication refreshes a cookie/token, response mutation may be centralized in `finalize()` rather than performed independently by several steps. Resource/domain authorization still occurs in the owning application policy.

##### Routing

Routing is the final gateway decision layer. For a multi-tenant product it may pass marketing traffic, reject unresolved tenant traffic, optionally canonical-redirect legacy hosts, apply a coarse guard to protected route families and rewrite a public tenant URL to one canonical internal application tree.

Public and internal route structures need not be identical:

```text
https://client-domain.com/services
              ↓ internal rewrite
/tenant/services
```

The public URL remains unchanged unless a deliberate canonical redirect is part of the contract.

##### Preview and staging

Production host-based routing and preview/staging path-based routing must be distinct explicit policies. Preview must never accidentally canonical-redirect QA traffic to a production custom domain. Host/environment behavior must be directly tested rather than inferred accidentally from a hostname pattern.

##### Adapter boundary

A complex gateway depends on contracts, not engine implementation:

```text
proxy pipeline
      ↓
platform/service adapter
      ↓
tenant / identity implementation
```

The pipeline may depend on operations such as `resolveTenant`, `resolveDomain`, `verifyIdentity` and `validateTenantAccess`; it must not know whether they are implemented by a database service, internal HTTP endpoint, RPC service or cache. Do not introduce these adapters in a small application without a real requirement.

##### Debug trace

A complex pipeline may expose an optional trace only behind an explicit debug control, for example:

```text
domain=client
tenant=<canonical-id>
auth=skipped
rewrite=/tenant/services
```

Normal production requests must not pay unnecessary trace overhead or expose internal diagnostics. A trace must never contain JWTs, session tokens, secrets, passwords or sensitive PII.

##### Testing contract

A multi-tenant/multi-domain gateway requires its own behavior matrix:

```text
host × pathname × environment × auth state → expected action
```

Expected actions include pass, rewrite, redirect, `401`, `403` and not-found. Cover the real product variants among marketing/base domain, tenant subdomain, custom domain, unresolved tenant, admin/platform host, preview, staging, localhost/development, public API, protected API, internal endpoint, canonical redirect, cross-tenant denial and debug trace.

Tests assert behavior contracts, not the private implementation shape of pipeline steps.

#### 2.1.6 Proxy architecture decision rule

First decide whether the product has a request-boundary problem that requires Proxy. If it does, complexity follows demonstrated product requirements:

```text
Simple application
    ↓
thin proxy entrypoint
    ↓
small explicit request/security policy

Multi-surface application
    ↓
thin proxy entrypoint
    ↓
shared request context
    ↓
small pipeline if justified

Multi-tenant / multi-domain platform
    ↓
thin gateway
    ↓
context resolution
    ↓
pipeline
    ↓
tenant + identity adapters
    ↓
routing/security tests
```

Do not introduce the multi-tenant gateway pattern merely because it is technically attractive. Proxy complexity must reduce a concrete product/security/routing problem rather than become mandatory boilerplate.

### 2.2 Next.js filesystem routing is the HTTP map

One unrelated business API must not be hidden behind a universal path dispatcher.

Prefer:

```text
app/api/auth/login/route.js
app/api/auth/register/route.js
app/api/projects/route.js
app/api/projects/[id]/route.js
app/api/client-projects/[id]/proposals/route.js
app/api/chat/channels/route.js
app/api/chat/channels/[id]/messages/route.js
app/api/cms-pages/route.js
app/api/cms-pages/[id]/route.js
app/api/cms-pages/slug/[...slug]/route.js
app/api/uploads/sign/route.js
app/api/cron/email-digest/route.js
```

not:

```text
app/api/[[...path]]/route.js
    ↓
if (path === ...)
else if (...)
else if (...)
...
```

### 2.3 A catch-all public CMS page is allowed

A CMS owns an open-ended set of content slugs, so one public content resolver may legitimately use:

```text
app/(cms)/[...slug]/page.js
```

That route is a CMS adapter only.

It must not become a generic fallback controller for dashboard, auth, projects or product workflows.

### 2.4 A catch-all business API is prohibited as the target architecture

`app/api/[[...path]]/route.js` may exist only as temporary migration compatibility code.

It must not receive new endpoints.

Every touched endpoint should move toward a dedicated Route Handler unless a bounded migration plan explicitly says otherwise.

### 2.5 Server Components first

Pages, layouts, public content, project shells, metadata and server-side data composition are Server Components by default.

`"use client"` is a boundary, not a default.

### 2.6 Database access is server infrastructure

React UI components and Route Handlers must not contain ad-hoc Mongoose business queries.

Only repositories or explicitly named server data-access modules may import Mongoose models for business workflows.

### 2.7 AI-generated code obeys the same rules

Claude Code, Codex and any other coding agent are not allowed to bypass these boundaries because a change is “small” or “faster”.

---

## Product Quality Doctrine

DMD product quality is measured by the client's ability to reach a useful outcome, not by the sophistication or apparent correctness of any individual internal layer.

The following principles are binding product and architecture rules.

### 1. Client outcome is the quality boundary

> **System quality is measured at the client outcome, not at the internal execution layer.**

A technically successful internal execution is not sufficient evidence of product success.

An AI agent may correctly interpret a request, an engine may successfully execute a task, tests may pass and persistence may be correct, while the client still fails to understand what happened, cannot continue, reaches a dead end or abandons the system and contacts a human.

In that case the client journey failed.

Internal subsystem quality remains necessary, but final product quality is evaluated at the end-to-end client outcome.

The canonical client path is:

```text
Client intent
      ↓
Understanding
      ↓
Guidance
      ↓
Decision / routing
      ↓
Action
      ↓
Execution
      ↓
Evidence
      ↓
Recovery when required
      ↓
Client understanding / confirmation
```

A failure at any material step is an end-to-end quality failure even when preceding layers behaved correctly.

---

### 2. Internal complexity must reduce client complexity

> **Complexity may increase internally only if perceived complexity decreases for the client.**

DMD may add engines, agents, workflows, policies, evidence, orchestration, background jobs and internal state only when that complexity makes the client's work simpler, clearer, safer or faster.

Internal architecture must absorb complexity rather than expose it.

The client should express intent in their own language.

The client must not be required to understand:

* engine boundaries;
* AI agent topology;
* workflow state machines;
* internal task classifications;
* technical implementation terminology;
* repository structure;
* provider boundaries;
* work-order internals;
* evidence infrastructure;
* whether a request was resolved by AI, deterministic code, an engine or a human.

Where the system can infer, route or execute safely, the client should not be asked to perform that coordination manually.

---

### 3. The client expresses intent; the system absorbs complexity

The default interaction model is:

```text
Client:
"Ne piše mi ko je zakazao."

System:
understands project + surface + expected outcome
        ↓
determines whether this is:
GUIDANCE
BUG
CONFIGURATION
FEATURE REQUEST
UNSUPPORTED / DEAD END
        ↓
takes or proposes the appropriate next action
```

The client must not be forced to first decide whether their problem is a bug, feature request, support question, configuration problem or implementation task.

That classification belongs to the system.

The same rule applies to navigation.

If the client says:

```text
"Ne znam gde da kreiram artikal."
```

the preferred result is guidance or direct navigation to the correct capability, not forcing the client to understand the information architecture before receiving help.

---

### 4. MVP means smallest complete client journey

DMD does not define MVP as the smallest number of implemented features.

A DMD capability is MVP-ready only when the smallest useful end-to-end client journey works coherently.

> **A feature is MVP-ready only when the full client journey is usable end-to-end.**

A product-facing capability is not complete merely because:

* the API exists;
* the database schema exists;
* the UI exists;
* the agent can answer;
* the engine can execute;
* automated tests pass.

For MVP readiness, the relevant client scenario must function across all required layers:

```text
Intent
→ Understanding
→ Guidance
→ Action
→ Execution
→ Evidence
→ Recovery
→ Client confirmation
```

Prefer five complete high-quality client journeys over thirty disconnected capabilities.

Development should therefore favor vertical slices that produce measurable client value rather than maximizing completion of one internal subsystem in isolation.

---

### 5. Product development is balanced across the whole system

No internal layer is optimized as an end in itself.

Do not maximize:

* AI capability while UX remains unclear;
* engine automation while recovery is poor;
* feature count while discoverability declines;
* workflow sophistication while client effort increases;
* UI polish while execution is unreliable;
* automation rate while client trust decreases.

The development question is not:

```text
"Is Engine X finished?"
```

The preferred question is:

```text
"Which real client scenario now works better than before?"
```

A change is valuable when it measurably improves the client outcome while preserving security, correctness and product invariants.

---

### 6. Human escape is a first-class failure signal

A **human escape** occurs when the client abandons the intended DMD interaction and contacts a human because the system could not carry them to a useful outcome.

Examples:

```text
"Ne razumem šta treba da uradim."
"Ne mogu ovo."
"Ne znam gde dalje."
"Bolje da pišem Milanu."
"Objasni mi ti šta se ovde dešava."
```

Human escalation is not automatically a failure.

A correct escalation is valid when the system identifies that human authority, judgment or implementation is genuinely required and manages that handoff clearly.

A **human escape** is different: the user bypasses the system because the system became confusing, repetitive, untrustworthy, blocked or burdensome.

Human escape rate is therefore a primary product-quality metric.

---

### 7. Dead ends must become explicit system states

The system must not leave the client in an ambiguous state when it cannot complete an action.

A request that cannot proceed must resolve to an explicit outcome such as:

```text
supported and executable
supported but requires configuration
requires reusable product extension
requires project-specific implementation
requires human decision
temporarily blocked
unsupported
```

The client must receive:

* what happened;
* whether anything was changed;
* what is blocked;
* what happens next;
* whether the system or a human owns the next action.

Silent failure, circular AI conversation and unexplained inability to continue are prohibited product states.

---

### 8. Recovery quality is part of normal quality

Misunderstanding and failure are expected operating conditions.

A high-quality system is not one that never encounters errors; it is one that recovers without making the client reconstruct the system state.

The system should preserve known context and avoid requiring the client to repeat information already available in the current project/session.

Recovery should preserve:

```text
client intent
project context
previous decisions
current lifecycle state
completed actions
failed action
evidence
next valid options
```

AI repetition without progress is a product defect.

---

### 9. Real non-technical users are required evidence

Product-facing quality cannot be proven only by developers, automated tests or agents evaluating their own output.

DMD must periodically be exercised by real users who:

* do not know the implementation;
* do not know internal terminology;
* are not trained to use the system;
* have a real task or project;
* are allowed to use their own natural language.

Dogfooding with real client projects is therefore part of product validation.

The tester should not be coached through the intended architecture unless safety requires it.

Confusion is evidence.

Unexpected navigation is evidence.

Repeated questions are evidence.

Calling a human is evidence.

The goal is not to make the tester succeed artificially. The goal is to discover where the product fails to carry them.

---

### 10. Canonical client outcome metrics

The primary aggregate quality metric is:

```text
Client Outcome Score: 0–100
```

Initial weighting:

```text
Task Success        30%
Ease                20%
Clarity             20%
Recovery            15%
Confidence / Trust  15%
```

Definitions:

**Task Success**

* Did the client reach the intended useful outcome?
* Could they do it without unplanned human intervention?

**Ease**

* How much navigation, repetition, unnecessary input and cognitive effort was required?

**Clarity**

* Did the client understand what was happening and what the next step was?

**Recovery**

* When misunderstanding, failure or a dead end occurred, did the system restore progress?

**Confidence / Trust**

* Did the client feel that continuing inside DMD was the fastest and safest path to solving the problem?

The score is not a substitute for raw behavioral evidence.

The following metrics must also be retained where applicable:

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

Do not persist private model chain-of-thought.

Only operational classification, actions, state transitions, outcomes and client feedback may be retained as product evidence.

---

### 11. Hard-failure indicators

The following are high-severity product-quality signals even when an aggregate score remains acceptable:

* the client abandons the task without a useful result;
* the client bypasses DMD and contacts a human because DMD became unusable or unclear;
* the system requires the client to repeat information already available;
* the system claims an action succeeded when it did not;
* the client cannot determine whether the request was accepted, blocked, completed or failed;
* the system enters a repetitive AI loop without progress;
* a recoverable error becomes a terminal dead end;
* the system exposes internal implementation complexity as required client knowledge.

These signals must be investigated independently of aggregate scores.

---

### 12. Improvement is measured as a trend

Product quality is measured across repeated real scenarios.

Desired trend:

```text
Client Outcome Score       ↑
Task completion            ↑
Confidence                 ↑
Successful AI recovery     ↑

Human escape rate          ↓
Dead-end rate              ↓
User repetition            ↓
Wrong routing              ↓
Manual intervention        ↓
Steps to useful outcome    ↓
Time to useful outcome     ↓
```

A larger system is not automatically a better system.

If internal capability increases while these client metrics deteriorate, the product has regressed.

---

### 13. Release and milestone consequence

For client-facing milestones, technical completion and client-outcome readiness are separate gates.

A milestone may be:

```text
TECHNICALLY COMPLETE
```

while remaining:

```text
CLIENT OUTCOME NOT VALIDATED
```

Product-facing work should not be described as mature, production-ready or validated solely from code/test completion.

Relevant milestones require evidence appropriate to their maturity:

```text
automated correctness
+ staging smoke
+ end-to-end journey
+ real-user evidence when the capability is intended for real client use
```

Early MVP work may use small samples.

The purpose is not statistical certainty; it is to identify major friction, dead ends and human escapes before adding broader complexity.

---

### 14. Governing rule

When choosing between adding a new capability and removing friction from an existing client journey, prefer the work that produces the larger improvement in real client outcome unless another binding security, integrity or commercial requirement takes precedence.

DMD should become more sophisticated internally while feeling progressively simpler to use.

That is the target architecture at the product boundary.

---

# Part B — Technology baseline

## 3. Frontend and server runtime baseline

Use:

- Next.js 16+, App Router only for new work;
- React 19.2+;
- JavaScript (`.js` / `.jsx` / `.mjs`) only;
- Tailwind according to the existing project setup;
- MongoDB/Mongoose through server-side modules;
- Zod or equivalent runtime validation at untrusted boundaries when already available/approved;
- Motion through the project-approved React motion package only where motion is part of the UX requirement;
- the existing notification, email, Cloudinary and auth providers behind provider-specific adapters.

Do not add `.ts` or `.tsx` files.

Do not migrate the project to TypeScript as part of unrelated work.

Do not reinterpret JavaScript-only as a requirement to migrate the repository to typed JavaScript through JSDoc. JSDoc typing is optional and reserved for non-trivial exported application/server boundaries where it materially clarifies the contract. Do not add type annotations to local variables, ordinary component props or routine helpers merely to increase type coverage.

Zod and JSON Schema provide runtime validation. They do not authorize generated TypeScript types or TypeScript syntax. Existing `typescript`, `tsconfig.json` and `typecheck` tooling are JavaScript build/module-resolution checks and do not authorize TypeScript source or a JSDoc typing campaign.

### 3.1 JavaScript contract discipline

Because DMD is JavaScript, runtime boundaries matter more, not less.

Mandatory for untrusted input:

- validate request bodies;
- validate URL/search parameters;
- validate provider/webhook payloads;
- validate persisted configuration read from flexible JSON structures;
- normalize identifiers before use;
- reject unknown state-machine values.

JSDoc may be used for non-trivial exported application/server functions when it materially improves the contract; it is not a repository-wide typing requirement.

Example:

```js
/**
 * @param {{ projectId: string, actorId: string, status: string }} input
 * @returns {Promise<object>}
 */
export async function changeProjectStatus(input) {
  // ...
}
```

JSDoc is documentation and editor assistance. It does not replace runtime validation.

---

# Part C — Target project structure

## 4. DMD directory ownership

The exact repository may evolve incrementally, but responsibility must converge toward this shape:

```text
app/
├── (marketing)/
├── (auth)/
├── (client)/
├── (admin)/
├── (cms)/
├── api/
├── layout.js
├── page.js
├── error.js
├── global-error.js
├── not-found.js
├── robots.js
└── sitemap.js

components/
├── ui/                  # generic visual primitives only
├── shared/              # cross-feature presentation
└── motion/              # reusable interactive/motion boundaries

features/
├── auth/
├── discovery/
├── design/
├── projects/
├── proposals/
├── chat/
├── notifications/
├── cms/
└── admin/

server/
├── http/                # problem responses, parsing, request helpers
├── auth/                # server auth/session adapter and authorization helpers
├── db/                  # connection/transaction infrastructure
├── modules/
│   ├── discovery/
│   ├── design/
│   ├── projects/
│   ├── proposals/
│   ├── chat/
│   ├── notifications/
│   ├── cms/
│   └── users/
├── integrations/
│   ├── cloudinary/
│   ├── email/
│   ├── push/
│   ├── github/
│   └── ai/
├── jobs/
└── diagnostics/

lib/                       # genuinely shared non-domain utilities
models/                    # legacy/current Mongoose model definitions
```

### 4.1 `app/` ownership

`app/` owns:

- URL structure;
- Next.js layouts/pages;
- metadata entry points;
- HTTP Route Handler entry points;
- loading/error/not-found boundaries;
- framework-specific composition.

`app/` does not own:

- project business rules;
- proposal lifecycle rules;
- chat moderation rules;
- notification policy;
- design workflow rules;
- AI orchestration;
- raw Mongoose query workflows;
- provider-specific implementation details.

### 4.2 `features/` ownership

A feature contains frontend behavior and presentation that belongs together.

Recommended shape for a non-trivial feature:

```text
features/design/
├── components/
├── hooks/
├── helpers/
├── api/
└── schemas/
```

Do not create empty directories “for later”.

### 4.3 `server/modules/` ownership

A server module owns one business capability.

Example:

```text
server/modules/projects/
├── application/
│   ├── create-project.js
│   ├── get-project.js
│   └── change-project-status.js
├── domain/
│   ├── project-policy.js
│   └── project-status.js
├── repositories/
│   └── project-repository.js
├── serializers/
│   └── project-serializer.js
└── validation/
    └── project-input.js
```

Do not require every small module to contain every folder. Create only boundaries that correspond to real code.

### 4.4 Mongoose model rule

Existing `models/` may remain during migration.

New route/page/UI code must not import business Mongoose models directly.

Allowed:

```text
server/modules/projects/repositories/project-repository.js
    ↓
models/Project.js
```

Prohibited:

```text
app/api/projects/[id]/route.js
    ↓
models/Project.js
```

and:

```text
components/project-card.js
    ↓
models/Project.js
```

---

# Part D — Route Handler architecture

## 5. Dedicated Route Handlers

A Route Handler represents one HTTP resource or one tightly related resource action.

Example:

```text
GET    /api/projects
POST   /api/projects

GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id
```

Maps to:

```text
app/api/projects/route.js
app/api/projects/[id]/route.js
```

A nested resource:

```text
GET  /api/client-projects/:id/proposals
POST /api/client-projects/:id/proposals
```

maps to:

```text
app/api/client-projects/[id]/proposals/route.js
```

Do not re-create an internal string router inside these files.

---

## 6. Route Handler responsibility

A Route Handler may:

1. read the request;
2. await and validate route params;
3. parse and validate query/body input;
4. resolve authentication context;
5. call one application use case, or a very small endpoint-specific query service;
6. convert a known result into an HTTP response;
7. map known application/domain failures to the stable HTTP problem contract.

A Route Handler must not:

- contain Mongoose query sequences;
- implement lifecycle/state-machine rules;
- decide authorization from raw client fields;
- send email/push inline as ad-hoc side effects;
- implement proposal calculations;
- contain chat moderation rules;
- contain file-provider logic;
- implement retry loops;
- contain long serialization maps duplicated across endpoints;
- catch every error and return raw `error.message`;
- define dozens of unrelated helper functions above the handler.

### 6.1 Size limits

Route Handler target:

```text
<= 100 lines per route.js
```

Review threshold:

```text
150 lines
```

A `route.js` over 200 lines requires decomposition before merge unless it contains a documented, cohesive protocol adapter such as a complex webhook verifier.

A route file above 300 lines is prohibited for ordinary CRUD/workflow endpoints.

---

## 7. Route Handler example — JavaScript

```js
import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/require-user";
import { parseJson } from "@/server/http/parse-json";
import { toProblemResponse } from "@/server/http/problem-response";
import { updateProjectInput } from "@/server/modules/projects/validation/project-input";
import { updateProject } from "@/server/modules/projects/application/update-project";

export async function PATCH(request, { params }) {
  try {
    const actor = await requireUser(request);
    const { id } = await params;
    const raw = await parseJson(request);
    const input = updateProjectInput.parse(raw);

    const project = await updateProject({
      projectId: id,
      actor,
      input,
    });

    return NextResponse.json(project);
  } catch (error) {
    return toProblemResponse(error);
  }
}
```

The handler does not know how a project is saved, which transitions are legal, or which notification is emitted.

---

## 8. Next.js 16 dynamic params rule

Treat `params` as asynchronous in pages, layouts, metadata functions and Route Handlers.

Correct:

```js
export async function GET(request, { params }) {
  const { id } = await params;
  // ...
}
```

Correct page:

```js
export default async function Page({ params }) {
  const { slug } = await params;
  // ...
}
```

Do not introduce new synchronous param access patterns.

---

## 9. Catch-all API migration rule

The current:

```text
app/api/[[...path]]/route.js
```

is a migration source, not a destination architecture.

### 9.1 Freeze rule

No new endpoint may be added to the catch-all file.

### 9.2 Touch rule

When a feature materially changes an endpoint currently inside the catch-all route, evaluate extracting that endpoint/domain into its dedicated route and server module in the same work item.

Do not perform a risky all-at-once rewrite solely for aesthetics.

### 9.3 Temporary compatibility dispatcher

If a compatibility catch-all must temporarily remain, it may only:

```text
path/method
   ↓
explicit allowlisted legacy adapter
   ↓
existing extracted handler/use case
```

It must not contain business implementation.

Target temporary dispatcher shape:

```js
const legacyRoutes = new Map([
  ["GET services", legacyGetServices],
  ["POST contact-messages", legacyCreateContactMessage],
]);

export async function GET(request, context) {
  return dispatchLegacy("GET", request, context, legacyRoutes);
}
```

Even this is temporary. Dedicated filesystem routes remain the end state.

### 9.4 Optional catch-all prohibition

Do not create another `[[...path]]` API route to replace the current one under a different folder.

Optional catch-all is allowed only where matching the route with no path segment is itself a real requirement.

---

## 10. HTTP method and resource semantics

Use methods consistently:

- `GET` — read only;
- `POST` — create or explicit command that does not map cleanly to resource replacement;
- `PUT` — full replacement only when the contract truly means full replacement;
- `PATCH` — partial mutation/state transition;
- `DELETE` — deletion/archive command according to domain rules;
- `OPTIONS` — only where cross-origin behavior is intentionally supported.

Do not choose the method based on which branch is convenient in a catch-all file.

---

## 11. Error contract

Unexpected server errors must not return raw provider/database exception messages to clients.

Use a stable envelope, for example:

```json
{
  "type": "https://dmd.app/problems/project-conflict",
  "title": "Project could not be updated",
  "status": 409,
  "code": "PROJECT_VERSION_CONFLICT",
  "detail": "The project changed before your update was applied.",
  "correlationId": "..."
}
```

Rules:

- known validation error → 400/422 according to the endpoint contract;
- unauthenticated → 401;
- authenticated but forbidden → 403;
- missing resource → 404;
- version/state/idempotency conflict → 409;
- rate limit → 429;
- unexpected error → generic 500 + correlation ID.

A 500 response must not expose:

- `error.message` from MongoDB;
- stack traces;
- Cloudinary/Resend/provider raw failures;
- secrets or tokens;
- internal filesystem paths.

---

## 12. CORS

DMD is same-origin by default.

Do not add:

```text
Access-Control-Allow-Origin: *
```

to every API response.

Cross-origin APIs require an explicit allowlist and a real consumer requirement.

Credentials and wildcard origins must never be combined.

CORS policy belongs in one server HTTP boundary, not duplicated in every route.

---

## 13. Authentication and authorization

Authentication answers:

```text
Who is calling?
```

Authorization answers:

```text
May this actor perform this operation on this resource now?
```

They are not the same.

Route Handlers resolve authenticated actor context.

Application/domain policy decides access to the business operation.

Prohibited:

```js
if (body.isAdmin) {
  // trust client
}
```

or business authorization derived only from client-side state.

Project/member/resource authorization must be server-authoritative.

---

# Part E — Server application/domain structure

## 14. Application use cases

An application use case coordinates one business operation.

Examples:

```text
createProjectRequest
acceptProjectProposal
requestProposalChanges
inviteProjectMember
convertChatMessageToTask
approveDesignRevision
createDesignJob
```

A use case may:

- load repositories;
- call domain policies;
- enforce authorization;
- coordinate multiple writes;
- emit persisted events/outbox records;
- invoke provider ports after commit where appropriate;
- return an application DTO/view model.

A use case must not import React or Next.js request/response APIs.

---

## 15. Domain rules

Stable product rules belong outside routing/UI.

Examples:

```text
proposal may only be accepted from allowed states
project member role controls action capability
message conversion preserves source evidence
DesignJob may not become preview_ready without build evidence
ApprovedDesignRevision is immutable
```

If the same rule must be true from API, cron, webhook or admin repair tooling, it is not a Route Handler rule.

---

## 16. Repository rules

Repositories own persistence queries for a module.

A repository:

- imports Mongoose models;
- applies bounded queries;
- applies projections/population intentionally;
- does not make UI decisions;
- does not send email/push;
- does not return raw provider failures as user messages;
- must not silently swallow database errors.

Avoid universal repository functions like:

```js
findEverything(filter, populate, sort, extra, options, magic)
```

Prefer explicit operations that expose intent.

---

## 17. Multi-document consistency

When one operation changes multiple documents that represent one business transition:

- define the invariant first;
- use MongoDB transactions where required and supported;
- otherwise design explicit idempotent/recoverable sequencing;
- persist durable evidence/events before relying on external side effects;
- provide diagnostics for high-risk transitions.

Do not rely on “these saves usually happen one after another”.

---

## 18. External providers

Cloudinary, Resend, web push, GitHub and AI providers are infrastructure adapters.

Domain/application code calls provider-neutral functions/ports.

Example:

```text
server/modules/design/application/create-design-asset.js
      ↓
storage adapter
      ↓
Cloudinary
```

not:

```text
React component
      ↓
Cloudinary Admin SDK
```

Provider response shapes must not become domain contracts.

---

# Part F — App Router page architecture

## 19. Pages are compositions

A `page.js` should normally do only this:

1. read/await route/search params;
2. perform server auth gate if required;
3. call one or a few server loaders needed for page composition;
4. call `notFound()` / `redirect()` when routing semantics require it;
5. render feature/section components.

It must not contain hundreds of lines of cards, modals, mutation logic, request code and transformations.

### 19.1 Size limits

Page target:

```text
<= 150 lines
```

Review threshold:

```text
250 lines
```

A page above 350 lines requires decomposition before merge.

A page above 500 lines is prohibited except generated artifacts that are not hand-maintained application code.

Current giant page files are migration debt, not examples for new work.

---

## 20. Route groups

Use route groups to organize experiences without changing URL paths.

Recommended conceptual grouping:

```text
app/
├── (marketing)/
│   ├── page.js
│   └── ...
├── (auth)/
│   ├── login/
│   ├── reset-password/
│   └── verify-email/
├── (client)/
│   └── dashboard/
├── (admin)/
│   └── admin/
└── (cms)/
    └── [...slug]/
        └── page.js
```

Route group names must express UI/ownership boundaries, not arbitrary developer categories.

Do not create conflicting routes in separate groups that resolve to the same URL.

---

## 21. Private folders and colocation

Use `_components`, `_lib`, `_actions` or similar private folders inside route trees when local colocation makes the route easier to understand and those folders must never become routes.

Example:

```text
app/(client)/dashboard/projects/[id]/
├── page.js
├── loading.js
├── error.js
├── _components/
│   ├── project-header.js
│   └── project-tabs.js
└── _lib/
    └── project-page-model.js
```

Feature logic reused across routes belongs under `features/`, not duplicated in route-private folders.

---

# Part G — Catch-all CMS page

## 22. Root catch-all page contract

The root catch-all exists only to resolve CMS-managed public pages.

Target location:

```text
app/(cms)/[...slug]/page.js
```

It must:

- resolve slug segments into one canonical slug path;
- validate the slug;
- reject reserved application namespaces;
- load only a published CMS revision;
- return real `notFound()` when no published page exists;
- generate metadata from the same published revision used for body rendering;
- render on the server by default;
- isolate only genuinely interactive blocks as Client Components.

It must not:

- fetch its own CMS API from a client `useEffect` just to display the page;
- render a visual “404” while returning HTTP 200;
- load draft content publicly;
- render unsafe raw HTML without sanitization;
- own dashboard/auth/project routing logic;
- decide arbitrary application behavior from the slug.

---

## 23. CMS slug ownership and reserved paths

CMS creation/update must reject paths owned by the application.

Maintain a centralized reserved first-segment registry, for example:

```js
export const RESERVED_PUBLIC_SEGMENTS = new Set([
  "api",
  "admin",
  "dashboard",
  "invite",
  "projects",
  "login",
  "logout",
  "register",
  "reset-password",
  "verify-email",
]);
```

The exact list must match DMD routing reality and be covered by tests.

Do not rely only on Next.js route precedence to prevent CMS collisions.

The write boundary must reject conflicting slugs.

---

## 24. CMS server loader

Use a server-only loader/application query.

Example:

```js
import { cache } from "react";
import { getPublishedPageBySlug } from "@/server/modules/cms/application/get-published-page-by-slug";

export const loadPublishedCmsPage = cache(async (slug) => {
  return getPublishedPageBySlug({ slug });
});
```

The page and `generateMetadata` may call the same loader so the source revision remains consistent.

Do not maintain separate SEO and body lookup logic that can drift to different revisions.

---

## 25. CMS catch-all page example

```js
import { notFound } from "next/navigation";
import { loadPublishedCmsPage } from "@/server/modules/cms/application/load-published-cms-page";
import { CmsPageView } from "@/features/cms/components/cms-page-view";

function normalizeSlug(parts) {
  if (!Array.isArray(parts) || parts.length === 0) return null;
  return parts.join("/");
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const slugPath = normalizeSlug(slug);
  if (!slugPath) return {};

  const page = await loadPublishedCmsPage(slugPath);
  if (!page) return {};

  return {
    title: page.seo.title || page.title,
    description: page.seo.description,
    robots: page.seo.noIndex ? "noindex, nofollow" : "index, follow",
  };
}

export default async function CmsRoute({ params }) {
  const { slug } = await params;
  const slugPath = normalizeSlug(slug);
  if (!slugPath) notFound();

  const page = await loadPublishedCmsPage(slugPath);
  if (!page) notFound();

  return <CmsPageView page={page} />;
}
```

No browser request is required merely to load the page.

---

## 26. CMS rendering safety

Preferred order:

1. structured CMS blocks with explicit component mapping;
2. trusted Markdown with controlled extensions;
3. sanitized HTML only when genuinely required.

Do not enable raw HTML parsing merely because Markdown supports it.

If raw HTML is allowed:

- sanitize with an explicit allowlist;
- strip scripts/event handlers/unsafe URLs;
- cover security behavior with tests.

---

# Part H — Server and Client Component boundaries

## 27. Server Components are default

Keep server-rendered unless interactivity requires otherwise:

- marketing pages;
- CMS pages;
- SEO content;
- public project/design previews that do not need local interaction;
- shells/layouts;
- server-side page composition;
- authenticated page auth gate;
- initial project/request/proposal read where server rendering is appropriate.

---

## 28. `"use client"` rule

Use `"use client"` only for components requiring:

- event handlers;
- local interactive state;
- browser APIs;
- client-only context;
- dialogs/drawers/menus;
- rich editors;
- browser upload UX;
- live/polling server state;
- Motion hooks;
- push subscription APIs.

A server parent may render a client child.

Do not mark a whole page, dashboard branch or layout as client-only because one button needs state.

Once a file is marked `"use client"`, its imported client module graph contributes to the browser bundle. Keep that boundary low.

---

## 29. Client Components do not fetch by default on mount

The following pattern is prohibited for basic page loading:

```js
"use client";

useEffect(() => {
  fetchPage();
}, []);
```

when the same data can be loaded in the Server Component page.

Use client-side server-state fetching only when the data genuinely changes after mount or interaction requires browser-side synchronization.

Examples:

- chat;
- live notifications;
- dashboard filters;
- polling status;
- optimistic mutation;
- interactive search;
- client-side design review/editor controls.

If TanStack Query v5 is adopted/present in DMD, it is the approved client server-state cache for these areas. Do not combine multiple competing client cache libraries.

Introducing TanStack Query into a codebase that does not yet contain it must be an intentional bounded dependency change, not incidental to an unrelated component edit.

---

# Part I — React 19 rules

## 30. Effects

Effects synchronize React with an external system.

Do not use effects for:

- derived values;
- formatting props;
- copying server data into local state for rendering;
- event-handler logic;
- basic page fetching;
- state that can be derived during render.

When async effect work is genuinely required:

- use an inner async function;
- support cancellation/ignore stale work;
- handle rejection;
- declare correct dependencies.

---

## 31. `useEffectEvent`

Use `useEffectEvent` only for non-reactive event logic that is conceptually triggered from an Effect and needs the latest props/state without reconnecting the external system.

Do not use it to silence dependency warnings.

Do not use it as a general event-handler abstraction.

---

## 32. `<Activity>`

Use React `<Activity>` only when hidden UI should preserve state or be pre-rendered for likely navigation.

Do not wrap ordinary conditional rendering in `<Activity>` by default.

If state reset on hide/unmount is desired, ordinary conditional rendering is correct.

---

## 33. Memoization and React Compiler

Do not mechanically add:

- `useMemo`;
- `useCallback`;
- `React.memo`.

Use manual memoization only when:

- profiling shows meaningful cost;
- stable identity is required by a third-party API or memoized boundary;
- a real expensive deterministic computation repeats;
- there is another explicit correctness/performance reason.

If React Compiler is enabled in DMD, treat it as the default automatic memoization mechanism.

Do not enable React Compiler as an incidental change without running the compatibility/build/test gate.

---

# Part J — State ownership

## 34. State matrix

| State | Owner |
|---|---|
| Public page/server data | Server Component/server loader |
| Authenticated initial page data | Server Component/server loader where appropriate |
| Live/remote client data | approved client server-state layer |
| Bookmarkable filter/tab/page | URL/search params |
| Temporary modal/menu state | local React state |
| Complex editable form | approved form layer/local reducer as appropriate |
| Optimistic remote mutation | approved client mutation strategy |
| Business truth | MongoDB/server domain |
| Auth/authorization truth | server |
| Cross-feature global client state | prohibited without architecture decision |

Do not copy remote server data into `useState` merely to render it.

An editable draft may detach from the server snapshot intentionally; that ownership must be explicit.

---

# Part K — Component and feature boundaries

## 35. One meaningful component per file

Do not define large React components inside another component.

Small render callbacks are fine when they are truly local and do not become hidden component systems.

### 35.1 Size thresholds

UI component target:

```text
<= 200 lines
```

Review threshold:

```text
300 lines
```

A hand-maintained UI component above 400 lines requires decomposition.

A 1,000+ line React component/page is prohibited target architecture.

### 35.2 UI primitive rule

`components/ui` receives prepared props and emits UI events.

It must not:

- call MongoDB;
- know Mongoose models;
- perform business authorization;
- know several API URLs;
- send email/push;
- implement project/proposal/design lifecycle rules;
- transform large raw backend payloads.

---

## 36. Feature colocation

Logic used by one component family stays with that family.

Example:

```text
features/design/components/design-review/
├── design-review.js
├── design-preview.js
├── asset-replace-control.js
├── use-design-review.js
└── design-review.helpers.js
```

When reused across the feature:

```text
features/design/
├── components/
├── hooks/
├── helpers/
├── api/
└── schemas/
```

Global `hooks/`, `helpers/`, `utils/` folders must not become dumping grounds.

---

# Part L — Data fetching and browser transport

## 37. Server reads

A Server Component may call a server loader/application query directly.

Do not make a Server Component call DMD's own HTTP API solely to reach code running in the same process.

Prefer:

```text
Server Component
    ↓
server application/query module
    ↓
repository
```

not:

```text
Server Component
    ↓
fetch("/api/...")
    ↓
Route Handler
    ↓
same server application
```

HTTP remains necessary for browser clients, external consumers and explicit HTTP boundaries.

---

## 38. Browser transport

Browser HTTP calls belong in centralized/feature transport modules, not visual components.

Example:

```text
features/projects/api/get-project.js
features/projects/api/update-project.js
```

A button/card should call a hook or action abstraction, not contain raw endpoint construction and response mapping.

---

## 39. Duplicate network requests

Do not fetch the same initial data:

1. in the Server Component for metadata/layout;
2. then again in a Client Component `useEffect` immediately after hydration.

Design the server/client boundary so one side owns the initial read.

---

# Part M — Mutations

## 40. Business mutation boundary

DMD business mutations with an HTTP contract remain dedicated Route Handlers.

Server Actions may be used only for tightly page-scoped web mutations when intentionally adopted and when doing so does not create a second competing business API.

Do not duplicate one mutation as:

```text
Server Action implementation A
Route Handler implementation B
```

Both must call the same application use case if both interfaces exist.

---

## 41. Idempotency and concurrency

Use idempotency/version checks where duplicate/reordered requests can create damage.

High-value examples:

- payment commands;
- proposal acceptance;
- invite acceptance;
- design approval;
- GitHub webhook processing;
- job/cron dispatch;
- booking/provisioning if introduced through product integrations.

Do not assume a button can only be clicked once.

---

# Part N — Caching and rendering policy

## 42. No implicit caching assumptions

For every significant route/page, know:

- is it public or user-specific;
- is it static, request-time, or mixed;
- may it be shared across users;
- what invalidates it;
- may it be indexed;
- does it contain sensitive data.

Do not assume “Server Component” means “cached”.

Do not assume `GET route.js` is statically cached.

---

## 43. Next.js 16 Cache Components

Next.js 16 supports Cache Components and `use cache`, but DMD must only rely on that model when `cacheComponents` is intentionally enabled and tested in the project configuration.

Do not enable it as an incidental refactor.

When enabled:

- cache only stable shareable reads;
- use explicit cache lifetime/tag policy;
- invalidate publication/projected content from the mutation boundary;
- never shared-cache user-specific/auth-sensitive data.

Without Cache Components, use the project's explicit current caching/revalidation strategy.

Caching policy must be visible in code/review, not assumed.

---

## 44. CMS caching

Published CMS content may be cached.

Rules:

- draft content is never shared/public cache;
- metadata and body must resolve from the same published revision;
- publish/update invalidates the corresponding public content cache;
- deleting/unpublishing invalidates the public path;
- fixed time-based revalidation is not a substitute for publication-aware invalidation when correctness requires immediate change.

---

# Part O — Images, uploads and Cloudinary

## 45. Upload architecture

Do not send large image/file payloads as base64 JSON through a giant generic API route.

Preferred flow:

```text
browser
   ↓
request signed/authorized upload parameters
   ↓
direct upload to Cloudinary
   ↓
provider result
   ↓
DMD API stores semantic metadata/reference
```

This is especially important for Design Assets.

DMD DB owns semantic meaning:

```text
what the asset is
what it represents
who supplied it
where it is intended to be used
which DesignJob/revision uses it
Cloudinary public/resource identifier
```

Cloudinary owns:

```text
file bytes
format
delivery
transformations
dimensions
```

### 45.1 Upload signer route

Upload signer/provider routes are legitimate Route Handler adapters.

They must be dedicated and bounded, for example:

```text
app/api/uploads/cloudinary/sign/route.js
```

They must enforce:

- authenticated/authorized purpose where required;
- allowed MIME types;
- size constraints;
- destination/folder policy;
- rate limits;
- no arbitrary provider operation supplied by the client.

---

# Part P — Cron, webhooks and background work

## 46. Cron routes

Cron endpoints get dedicated routes.

Example:

```text
app/api/cron/email-digest/route.js
```

The route validates the scheduler secret/signature and calls one job use case.

The entire digest implementation must not live in `route.js`.

---

## 47. Webhooks

Each provider webhook gets its own explicit endpoint.

Example:

```text
app/api/webhooks/github/route.js
app/api/webhooks/paddle/route.js
```

Rules:

- verify signature before business processing;
- preserve raw body when signature algorithm requires it;
- deduplicate by provider event ID;
- persist evidence/state before long external work;
- return bounded responses;
- process retry-safe/idempotently.

---

# Part Q — Metadata, SEO and navigation

## 48. Metadata

Metadata belongs in Server Component route metadata functions/static metadata.

`generateMetadata` must not depend on client fetching.

For CMS content, metadata and page content must use the same publication source/revision.

SEO metadata is metadata, not visible page content.

Do not map SEO title/description into Hero/body fields unless the content model explicitly says they are the same field.

---

## 49. Internal navigation

Use Next.js `Link` for normal internal navigation.

Use `router.push/replace` only for programmatic navigation resulting from an interaction/workflow.

Do not use full-page `<a href="/...">` navigation for ordinary internal links without a specific reason.

---

# Part R — Loading, errors and not-found boundaries

## 50. Loading

Use `loading.js` and Suspense where they represent actual deferred server work or route-level streaming.

Do not add Suspense decoratively around synchronous UI.

Client mutation buttons must expose pending state and prevent accidental duplicate submission where required.

---

## 51. Not found

Missing route-owned resources should use `notFound()` from the server routing boundary.

Do not render a fake 404 component from a successful HTTP 200 page response when the resource does not exist.

CMS catch-all is specifically required to use `notFound()` for missing/unpublished pages.

---

## 52. Error boundaries

Use:

```text
error.js
```

for route-segment render failures and:

```text
global-error.js
```

for root-level failures where needed.

Expected API/form/domain errors are not global render crashes; display them in the relevant UI with actionable messages.

---

# Part S — Security baseline

## 53. Required baseline

New/refactored code must preserve or improve:

- fail-closed secrets;
- server-only credentials;
- exact authorization;
- bounded request payloads;
- rate limits for abuse-sensitive public/auth endpoints;
- webhook signature verification;
- idempotency where duplicates are dangerous;
- sanitized public content;
- safe redirects;
- validated URLs for any server-side URL analyzer/fetcher;
- SSRF protection for website analysis;
- no secrets in client bundles/logs/errors;
- no private tokens in URLs;
- safe Cloudinary/provider restrictions;
- dependency security updates.

### 53.1 Current catch-all patterns are not precedents

Historical patterns such as universal CORS headers, broad exception mapping, direct model access from Route Handlers or base64 uploads inside the universal API route are migration debt.

Do not copy them into extracted routes.

---

# Part T — Website Analyzer and AI boundaries

## 54. Website Analyzer

The future DMD Website Analyzer is server-side infrastructure/application work.

Public URL input must go through:

```text
URL validation
  ↓
SSRF/private-network rejection
  ↓
bounded fetch/browser analysis
  ↓
raw analysis evidence
  ↓
DesignRelevantWebsiteAnalysis projection
```

Route/page/UI files must not implement crawling logic.

---

## 55. AI provider boundary

UI and Route Handlers must not embed provider-specific prompt orchestration.

Use:

```text
Route Handler / job
     ↓
application use case
     ↓
agent registry/orchestrator
     ↓
provider adapter
```

Provider model names, token accounting, retry policy and raw responses belong behind the AI infrastructure boundary.

AI output affecting product state must be validated before persistence/use.

---

# Part U — Diagnostics and observability

## 56. Correlation IDs

Every non-trivial API/job/webhook failure should be traceable by a correlation/event ID safe to show to an administrator.

Do not require reading a raw stack trace to understand which workflow failed.

---

## 57. Diagnostics

Risky workflows that touch several models or external providers should ship with read-only diagnostics when practical.

A diagnostic:

- reads only;
- returns `ok`, `warning`, `error` or `failed`;
- distinguishes collector failure from zero findings;
- exposes safe evidence identifiers;
- recommends repair steps;
- never silently mutates production data.

Superadmin diagnostics are consumers of these diagnostics, not separate hidden repair logic.

---

# Part V — Tests and verification

## 58. Required test classes

Use the test runner already adopted by DMD. Do not introduce a second overlapping test stack without need.

Cover:

### Server/domain

- state-machine/domain policies;
- authorization;
- repository queries for critical workflows;
- idempotency/concurrency boundaries;
- serializers;
- validation.

### Route contracts

- method/path maps to correct use case;
- params are validated;
- auth failures;
- forbidden access;
- not found;
- conflict;
- expected response shape;
- raw internal errors are not leaked.

### CMS catch-all

- one-level slug;
- nested slug;
- missing slug → real 404;
- unpublished page → real 404;
- reserved path cannot be created;
- metadata/body use same published revision;
- unsafe content is rejected/sanitized according to policy.

### React/UI

- key interactive feature components;
- client/server boundary regressions where relevant;
- critical project/proposal/design journeys;
- accessibility for critical controls;
- preview asset replace without full design regeneration.

---

## 59. Verification gate

At minimum run the scripts that actually exist for the repository and are relevant to the change.

Expected baseline:

```bash
npm run lint
npm run test
npm run build
```

If the repository has dedicated formatting, integration or E2E scripts, run them for relevant work.

Do not invent a green command result.

Do not claim completion if the production build fails.

Next.js/React security patch upgrades must be validated with this gate.

---

# Part W — Explicit anti-patterns

## 60. Prohibited patterns

The following are prohibited target architecture:

- one 1,000–6,000+ line Route Handler;
- `app/api/[[...path]]` as the permanent business API;
- adding new endpoint branches to the legacy catch-all;
- a second catch-all router disguised as a helper switch;
- giant `page.js` files containing whole dashboards;
- root layouts marked `"use client"` without strong need;
- client `useEffect` fetching for basic public page content;
- page metadata fetched separately from a different CMS truth;
- visual 404 rendered with HTTP 200;
- Mongoose queries inside visual React components;
- Mongoose workflow logic directly inside Route Handlers;
- provider SDK calls from presentation UI;
- business authorization based on client payload/state;
- raw database/provider error messages returned to users;
- wildcard CORS copied onto every response;
- base64 multi-megabyte uploads through generic JSON endpoints;
- unsanitized arbitrary CMS HTML;
- duplicated API/business logic between Server Actions and Route Handlers;
- multiple server-state libraries without an architecture decision;
- effects used for derived state or event handlers;
- mechanical memoization everywhere;
- empty abstraction folders/classes added only “for future use”;
- silent architectural rewrites by coding agents;
- new JavaScript files that duplicate an existing domain rule instead of reusing the canonical rule.

---

# Part X — Current DMD migration boundaries

## 61. Current `app/api/[[...path]]/route.js`

Treat the current universal route as legacy migration debt.

Do not try to rewrite all endpoints in one uncontrolled pass.

Recommended extraction sequence follows business boundaries, for example:

```text
1. health / operational adapters
2. auth
3. uploads
4. CMS
5. notifications / push
6. project requests
7. client projects / proposals
8. chat / project items
9. admin/statistics
10. remaining legacy resources
```

Exact order may change based on active product work and risk.

Each extraction must preserve the public URL/HTTP contract unless an explicit API migration is approved.

---

## 62. Current catch-all CMS page

The current public CMS concept may remain catch-all, but migrate from:

```text
Server page
   ↓
Client component
   ↓
useEffect
   ↓
/api/cms-pages/slug/...
   ↓
MongoDB
```

to:

```text
Server catch-all page
   ↓
CMS server loader
   ↓
CMS application query
   ↓
CMS repository
   ↓
MongoDB
```

Then render only interactive CMS blocks as client leaves.

This is not merely a performance refactor. It fixes ownership, metadata consistency, correct 404 semantics and unnecessary client/server duplication.

---

## 63. Current giant pages

`admin/page.js`, `dashboard/page.js` and other oversized pages must be treated as decomposition candidates when those areas are touched.

Do not perform meaningless file splitting.

Split by real ownership:

```text
page shell
feature section
interactive client boundary
query/mutation hook
pure helper
server use case
```

Do not split one giant page into ten arbitrary components that all share the same tangled state and API knowledge.

---

# Part Y — Agent implementation contract

## 64. Before editing

A coding agent must first identify:

1. route/page being changed;
2. current source of truth;
3. domain invariant involved;
4. server/client ownership;
5. whether the legacy catch-all is involved;
6. whether extraction is required/appropriate;
7. tests protecting current behavior.

---

## 65. While editing

The agent must:

- preserve public API contracts unless explicitly changing them;
- avoid broad unrelated refactors;
- reuse canonical domain helpers;
- keep routing files thin;
- keep pages compositional;
- preserve Server Components where possible;
- validate runtime input;
- keep provider code behind adapters;
- add/update tests for the changed contract.

---

## 66. Completion report

Before claiming completion, report:

1. files created/modified;
2. endpoints/pages affected;
3. business behavior preserved/changed;
4. architecture extraction performed;
5. tests added/updated;
6. exact commands executed and results;
7. known limitations;
8. follow-up migration explicitly out of scope.

Never report a build/test as passing unless it was executed.

---

# Part Z — Canonical dependency directions

## 67. Server HTTP flow

```text
app/api/**/route.js
       ↓
server/http + auth adapter
       ↓
server/modules/<domain>/application
       ↓
server/modules/<domain>/domain
       ↓
server/modules/<domain>/repositories / integrations
       ↓
models / providers
```

Never reverse these arrows.

---

## 68. Server page flow

```text
app/**/page.js
      ↓
server loader / application query
      ↓
repository
      ↓
prepared view model
      ↓
feature/server presentation components
      ↓
small client interactive leaves
```

---

## 69. Browser mutation flow

```text
Client Component
      ↓
feature hook/action
      ↓
feature API transport
      ↓
dedicated app/api/**/route.js
      ↓
application use case
      ↓
domain + repository/provider
```

---

## 70. DMD design pipeline flow

```text
CLIENT LANGUAGE
      ↓
Business Intelligence
      ↓
Verified Business State
      ↓
Product Intelligence
      ↓
Capability Model
      ↓
Product Route
      ↓
Solution Blueprint
      ↓
Design Intelligence
      ↓
Design Strategy
      ↓
Curated Design Handoff
      ↓
Claude Design / AI Design Agent
      ↓
Visual Artifact
      ↓
Design Artifact Normalizer
      ↓
Compatibility Validator
      ↓
Implementation Classification
      ↓
Claude Code / Codex
      ↓
real product components
      ↓
backend + DB + frontend
      ↓
tests / build
      ↓
preview
```

This architectural document governs the software boundaries used to implement every step of that pipeline.

---

# Final invariant

DMD may have many products, agents, workflows, pages and integrations.

It must not have many responsibilities hidden inside a few framework files.

The invariant is:

```text
Route knows HTTP.
Page knows composition.
Component knows presentation/interaction.
Application use case knows workflow.
Domain knows rules.
Repository knows persistence.
Provider adapter knows external systems.
DB remains source of business truth.
Framework files never become the product architecture.
```

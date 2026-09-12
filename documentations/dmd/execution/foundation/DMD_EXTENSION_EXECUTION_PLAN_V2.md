# DMD Platform Expansion — Execution Plan V2 After Current-App Audit

**Status:** ACTIVE
**Authority:** companion
**Owner domain:** Foundation Execution
**Supersedes:** earlier un-audited implementation ordering
**Superseded by:** —

**Date:** 2026-09-09
**FND-3 reconciliation:** 2026-09-12
**Baseline:** DMDevelon `main` @ `4e75c893a6fa7b92cf57efca115faacc60c7f322`

---

## 1. Strategy

The conceptual M0–M12 roadmap remains valid, but the repo audit changes the implementation order.

`documentations/TODO.md` is the canonical execution index. The active foundation order before any new-business implementation is:

`documentations/dmd/workspace/DMD_WORKSPACE_VERTICAL_SLICE_EXECUTION_PLAN.md` is the operational companion for the post-FND-4 client vertical. It carries no independent milestone status.

```text
DMD-FND-0 complete
→ DMD-FND-1 isolated staging
→ DMD-FND-2 fresh baseline
→ DMD-FND-2A React 19.2 compatibility
→ DMD-FND-3 complete-system inventory
→ DMD-FND-4 security/architecture shell
```

After DMD-FND-4, `DMD-WORKSPACE-0` and `DMD-OPS-0` may progress independently while DMD-FND-5 through DMD-FND-8 migrate legacy endpoints sequentially on the parallel cleanup branch. `DMD-WS-1` follows the Workspace shell; real `DMD-AI-0` waits for both the persistent session boundary and required OPS foundation before Business Intelligence begins.

After DMD-FND-4 the default development model becomes vertical slices. Targeted audits remain allowed when new evidence exposes an unresolved architectural, security or data-integrity risk.

The existing project/chat/proposal core is stronger than expected, so Project Intelligence can be developed earlier in parallel, while discovery/product/design still form the primary new client vertical.

Do not start with AI providers.

Overall implementation starts with DMD-FND-1 isolated staging. After the foundation sequence reaches DMD-FND-4, the new-business branch starts with contracts, state, security and one end-to-end vertical slice.

---

## 2. Phase A — Baseline hardening and architecture shell

This is a conceptual grouping, not permission to collapse or reorder DMD-FND-1 through DMD-FND-4. Execute these concerns only through the bounded milestones in `documentations/TODO.md`; do not combine staging isolation, baseline capture, React compatibility or catch-all inventory into one change.

### FND-3 execution boundary

FND-3 is one complete-system audit milestone whose canonical contract lives in `documentations/TODO.md`. Read-only discovery may run in parallel by domain; endpoint extraction, auth/routing refactor, page decomposition and other architectural mutations may not.

```text
3A Public / Marketing / CMS
3B Auth / Session / Access
3C Uploads / Assets
3D Notifications / Cron / Operational endpoints
3E Project Requests / Proposals / Client Projects
3F Communication / Chat / DM / Project Items
3G Dashboard / Admin / Application Pages
3H Central Legacy API Registry & Completeness Audit
3I Reconciliation / Risk Map / Migration Map
```

3A–3G populate the same API/page registries. 3H is the global method/path/branch completeness control, not a duplicate domain audit. 3I is the completion gate and must reconcile API/page/auth/data ownership, side effects, risks, migration seams and explicit unknowns before FND-3 can define the exact FND-4 scope.

The binding `proxy.js` architecture is conditional: it defines how Proxy must be built if DMD adopts it, but does not require FND-4 to add Proxy without evidence. FND-3 must first establish existing route families, current credential/context visibility and concrete coarse request/security gaps. Resource authorization remains in the owning Route Handler/application/domain policy.

### A1 Documentation reconciliation

- mark audited commit;
- update README architecture/stack later;
- add expansion docs into repo `documentations/` when approved;
- define active implementation plan.

### A2 Security baseline

- remove JWT default-secret fallback;
- env validation;
- production CORS allowlist;
- rate-limit plan;
- private asset classification;
- access-token storage migration decision.

### A3 New API/application structure

- dedicated routes for expansion;
- canonical `server/http`, `server/auth`, `server/db`, `server/modules/<domain>`, `server/integrations`, `server/jobs` and `server/diagnostics` boundaries;
- application/domain/repository/validation separation inside `server/modules/<domain>` where needed; `lib/` is reserved for genuinely shared non-domain utilities;
- no new extension branches in catch-all API;
- standard error/response/idempotency utilities.

### A4 JavaScript contract discipline

- JavaScript/JSX only; do not add .ts or .tsx source files;
- Zod schemas at untrusted and cross-domain boundaries;
- JSDoc for non-trivial exported application/server contracts where it improves clarity.

**Exit:** safe architecture exists before model calls.

---

## 3. Phase B — Guided Discovery umbrella, executed as independent vertical slices

This conceptual phase is implemented through the canonical milestone order in `documentations/TODO.md`; it is not one batch.

### B1 DMD-WORKSPACE-0 — interaction shell

- extract new `How DMD works` section;
- primary CTA to `/start`;
- accept free natural-language intent without product-type/technical shortcut cards;
- do not redesign entire marketing site yet.

### B2 DMD-WS-1 — persistent anonymous conversation

- guest session;
- session access token/cookie;
- persistent messages;
- resume;
- user/account claim and isolation;
- no AI dependency.

### B3 DMD-OPS-0 + DMD-AI-0 — operational and interpretation foundations

- establish durable audit/runtime foundations;
- provider-neutral AI orchestrator;
- one schema-bound interpretation path after WS-1 and OPS-0 are available.

### B4 DMD-BI-1 — Living Understanding

- sourced facts, provenance and confidence;
- contradictions and open questions;
- no-repeat logic and highest-value unresolved question;
- no formal verification.

### B5 DMD-BI-2 — Advisory Brainstorming

- recommendations, alternatives and trade-offs;
- facts remain separate from AI recommendations;
- rejected recommendations never become canonical truth.

### B6 DMD-BI-3 — Understanding Gate / VerifiedBusinessState

- completeness rules;
- client “this is what you mean” confirmation;
- VerifiedBusinessState revision.
- no automatic ProjectRequest conversion.

**Exit:** a real lead can go from vague description to a verified structured business state.

---

## 4. Phase C — Capability and Product Routing

### C1 Capability registry v1

Start only with capabilities already proved by Marysoll/P.DC plus custom fallback.

### C2 Product contracts

- Marysoll v1;
- P.DC product family v1;
- Custom v1.

### C3 Deterministic fit evaluator

- native;
- configurable;
- product_extension;
- custom_required.

### C4 Solution Blueprint

- actors;
- flows;
- capabilities;
- content;
- integrations;
- migration;
- constraints.

**Exit:** DMD can explain why it recommends a product and what will actually be built.

---

## 5. Phase D — Design Engine online vertical

### D1 Design contract

- DesignStrategy;
- DesignSpec;
- allowed block registry;
- product compatibility validator.

### D2 One provider first

Do not integrate three providers simultaneously.

Implement provider-neutral interface and one high-quality provider end-to-end. Add second provider only after schemas/metrics are stable.

### D3 Design candidate renderer

- candidate job;
- known components only;
- immutable candidate revision;
- preview route.

### D4 Client selection

- select;
- refine;
- design-vs-business feedback classification.

### D5 Website/CTA analyzer

Add after basic design works, because it is an independent untrusted-content/security surface.

**Exit:** lead can see and select a product-compatible design generated from verified business state.

---

## 6. Phase E — Commercial and claimed-project continuity

### E1 Approved design → Commercial

The authoritative sequence remains:

```text
DMD-DES-3
→ DMD-DES-4
→ DMD-DES-5
→ DMD-DES-6 ApprovedDesignRevision
→ DMD-COM-0
```

The compact Workspace label `DESIGN` may group these canonical detailed milestones, but it must not renumber them or reuse `DMD-DES-0…3` for different meanings.

Commercial preparation may produce non-authoritative internal estimates earlier only under separately approved architecture. No client-facing commercial decision, proposal/acceptance gate or binding commercial state may depend on an unapproved design candidate.

### E2 Commercial configuration → existing proposal lifecycle

AI may draft scope and milestone suggestions from approved, version-pinned inputs, but the existing proposal lifecycle remains authoritative. Explicit proposal acceptance/payment policy gates production WorkOrder/provisioning.

### E3 Claimed Workspace → My Projects continuity

`DMD-PROJECT-0` projects claimed pre-project work into the authenticated Dashboard/My Projects navigator without prematurely creating `ProjectRequest` or `ClientProject`. When formal materialization becomes appropriate, it reuses the existing request/proposal/project authority path through an idempotent source-linked handoff and requires no client retyping.

### E4 Design selection versus purchase

Design approval creates the immutable `ApprovedDesignRevision`. It may reserve or lock inventory only through an explicit design-inventory policy; it never means `bought`, proposal acceptance or payment. Those transitions belong to the Commercial layer.

Add:

- AgentRun usage;
- DesignJob usage;
- workflow/storage cost tracking;
- later PlanDefinition.

**Exit:** accepted lead solution becomes existing DMD project cleanly.

---

## 7. Phase F — Project Intelligence V2 (can start in parallel after A)

### F1 AI message classifier

Use existing ChatMessage/ProjectItem.

### F2 Project Q&A

Read accepted proposal + project state.

### F3 ChangeAssessment

Implement weighted scope-delta rules and hard triggers.

### F4 Dependency DAG

Extend tasks with dependencies and blocker/readiness projection.

### F5 AI command review

Evolve HandoffDialog to review/apply AI recommendations.

**Exit:** client communication is triaged without turning every idea into production work.

---

## 8. Phase G — Repo/DB engineering handoff

### G1 RepositoryBinding

Map DMD project ↔ GitHub repository.

### G2 WorkOrder contract

- `.dmd/project.json`;
- `.dmd/work-order.json`;
- human engineering plan.

### G3 Local CLI alpha

```text
dmd link
dmd pull
dmd validate
```

### G4 Engineering state contract

- `.dmd/engineering-state.json`;
- implementation report;
- evidence policy.

### G5 GitHub App/webhooks

- push;
- PR;
- CI/check/workflow;
- signature/dedupe;
- event queue.

### G6 Engineering projection

Repo evidence updates DMD client-safe project status.

**Exit:** local Claude/Codex work becomes visible in DMD after commit without manual re-entry.

---

## 9. Phase H — Onboarding and provisioning

### H1 OnboardingRequirement registry

- domain;
- email;
- phone;
- brand assets;
- Google;
- Instagram;
- DB export;
- provider integrations.

### H2 Secure connection flows

No credentials in normal chat.

### H3 Migration workflow

- inspect export;
- mapping;
- dry run;
- count/errors;
- client/admin review;
- import;
- reconciliation.

### H4 Provisioning adapters

- Marysoll;
- P.DC;
- Custom.

**Exit:** requirements arrive progressively and no forgotten setup item silently blocks launch.

---

## 10. Phase I — Premium design and advanced automation

Only after basic system is proven:

- Claude Design premium/manual handoff;
- additional model providers;
- provider fallback/quality routing;
- automated local agent SDK flows;
- DMD GitHub App write capabilities if justified;
- cross-product DMD assistant surfaces inside Marysoll/P.DC;
- richer semantic knowledge search.

---

## 11. What not to build early

Do not start with:

- microservices;
- vector DB for everything;
- autonomous coding through API;
- arbitrary generated React executed in DMD;
- automatic production provisioning without review;
- three-provider voting on every question;
- full auth rewrite unless security requirements demand it;
- final pricing before usage/cost ledger;
- automatic scope pricing from LLM output.

---

## 12. First new-business/product epic recommendation

After DMD-FND-1 through DMD-FND-4 are complete, the planning umbrella is:

> **DMD-E1 — Guided Discovery → Verified Business State**

`DMD-E1` is a planning umbrella, not an implementation batch. The first product-facing implementation slice is `DMD-WORKSPACE-0`. Every contained slice is implemented independently, tested, deployed to staging and browser-verified before expansion.

### E1 contained slices

1. `DMD-WORKSPACE-0`;
2. `DMD-WS-1`;
3. `DMD-AI-0`, after the required `DMD-OPS-0` foundation;
4. `DMD-BI-1`;
5. `DMD-BI-2`;
6. `DMD-BI-3`.

After E1, implement Capability/Route/Blueprint as E2.

---

## 13. Definition of done for every new engine

A feature/engine is not done until it has:

1. domain contract;
2. lifecycle/state machine;
3. authorization policy;
4. schema validation;
5. application command/query;
6. API surface;
7. client/internal serializer/projection;
8. audit/event behavior;
9. idempotency/concurrency rule;
10. unit tests;
11. integration tests for mutations;
12. observability/error classification;
13. docs.

---

## 14. Target proof points

### Proof 1

A salon owner says “I need a site so clients stop calling me.” DMD discovers the real workflow and recommends/configures Marysoll instead of selling website + CRM + calendar separately.

### Proof 2

An expert network says “we need a presentation site” but describes provider registration + intake + matching. DMD identifies a P.DC network product rather than a brochure site.

### Proof 3

A lead gets a compatible design preview before formal build acceptance.

### Proof 4

Client writes “this is broken”; DMD links it to accepted scope and creates a problem/task path without new charge.

### Proof 5

Client writes a major pivot; DMD computes material scope impact and opens a new proposal path.

### Proof 6

Claude/Codex implements locally, updates repo state/docs, commits, CI passes, and DMD project progress updates without manual duplicate administration.

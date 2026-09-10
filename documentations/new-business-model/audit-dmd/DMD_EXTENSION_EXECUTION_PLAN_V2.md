# DMD Platform Expansion — Execution Plan V2 After Current-App Audit

**Date:** 2026-09-09  
**Baseline:** DMDevelon `main` @ `4e75c893a6fa7b92cf57efca115faacc60c7f322`

---

## 1. Strategy

The conceptual M0–M12 roadmap remains valid, but the repo audit changes the implementation order.

`documentations/TODO.md` is the canonical execution index. The active foundation order before any new-business implementation is:

```text
DMD-FND-0 complete
→ DMD-FND-1 isolated staging
→ DMD-FND-2 fresh baseline
→ DMD-FND-2A React 19.2 compatibility
→ DMD-FND-3 endpoint/page inventory
→ DMD-FND-4 security/architecture shell
```

After DMD-FND-4, the Business Intelligence branch may begin while DMD-FND-5 through DMD-FND-8 migrate legacy endpoints sequentially on the parallel cleanup branch.

The existing project/chat/proposal core is stronger than expected, so Project Intelligence can be developed earlier in parallel, while discovery/product/design still form the primary new client vertical.

Do not start with AI providers.

Overall implementation starts with DMD-FND-1 isolated staging. After the foundation sequence reaches DMD-FND-4, the new-business branch starts with contracts, state, security and one end-to-end vertical slice.

---

## 2. Phase A — Baseline hardening and architecture shell

This is a conceptual grouping, not permission to collapse or reorder DMD-FND-1 through DMD-FND-4. Execute these concerns only through the bounded milestones in `documentations/TODO.md`; do not combine staging isolation, baseline capture, React compatibility or catch-all inventory into one change.

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

## 3. Phase B — First Business Intelligence vertical slice

### B1 Landing refactor minimal

- extract new `How DMD works` section;
- primary CTA to `/start`;
- do not redesign entire marketing site yet.

### B2 DiscoverySession

- guest session;
- session access token/cookie;
- resume;
- user/account linkage.

### B3 Discovery chat without autonomous routing

- persist messages;
- provider-neutral AI orchestrator;
- one discovery agent + structured extractor;
- business-state draft;
- missing-information UI.

### B4 Understanding Gate

- completeness rules;
- client “this is what you mean” confirmation;
- VerifiedBusinessState revision.

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

## 6. Phase E — Formal project conversion

### E1 Discovery → ProjectRequest

No retyping.

### E2 Blueprint → Master Proposal draft

AI can draft scope/milestone plan.

Existing proposal lifecycle remains authoritative.

### E3 Selected design/provenance linkage

Project/request/proposal references selected design and blueprint versions.

### E4 Commercial catalog preparation

Do not finalize prices yet.

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

After DMD-FND-1 through DMD-FND-4 are complete, the first new-business/product epic should be:

> **DMD-E1 — Guided Discovery → Verified Business State**

It proves the differentiating product concept without requiring Design Engine, provisioning or GitHub automation yet. It is not the first implementation work overall: DMD-FND-1 isolated staging is the next implementation milestone.

### E1 tasks

1. architecture/security prerequisites;
2. landing CTA + `/start` shell;
3. DiscoverySession model/API;
4. message persistence;
5. AgentRun/provider adapter v1;
6. VerifiedBusinessState schema;
7. extraction + missing fields;
8. Understanding Gate;
9. client summary/correction;
10. VerifiedBusinessState snapshot;
11. tests + browser acceptance.

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

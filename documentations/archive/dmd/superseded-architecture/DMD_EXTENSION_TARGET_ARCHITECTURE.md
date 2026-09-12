# DMD Extension — Target Application Architecture

**Status:** ARCHIVED
**Authority:** evidence-only
**Owner domain:** DMD Architecture
**Supersedes:** —
**Superseded by:** `documentations/dmd/architecture/ARCHITECTURAL_RULES_DMD.md`

**Parent:** `DMD_PLATFORM_EXPANSION_MASTER_PLAN.md`
**Foundation:** `DMD_DESIGN_ENGINE_PRINCIPLES.md`
**Baseline audit:** `DMD_CURRENT_APP_ARCHITECTURE_AUDIT.md`

---

## 1. Architecture decision

DMD expansion should be built as a **modular monolith** first.

Not microservices.
Not a second application.
Not a single growing route file.

The target is one deployable DMD application with explicit bounded contexts and replaceable infrastructure adapters.

Reason:

- current scale does not justify distributed-service complexity;
- Mongo transactions and existing project flows are already local;
- domain boundaries are the urgent problem, not process boundaries;
- AI providers, GitHub and provisioning systems already create enough distributed failure modes.

Rule:

> First separate responsibility and authority. Split processes only when operational evidence proves it is necessary.

---

## 2. High-level layers

```text
┌────────────────────────────────────────────────────────────┐
│                       Frontend surfaces                    │
│ Landing · Discovery · Solution · Dashboard · Project       │
└────────────────────────────┬───────────────────────────────┘
                             ↓
┌────────────────────────────────────────────────────────────┐
│                     API / Transport layer                  │
│ auth · schema validation · rate limit · request identity   │
└────────────────────────────┬───────────────────────────────┘
                             ↓
┌────────────────────────────────────────────────────────────┐
│                     Application layer                      │
│ commands · queries · workflows · transaction boundaries    │
└────────────────────────────┬───────────────────────────────┘
                             ↓
┌────────────────────────────────────────────────────────────┐
│                       Domain engines                       │
│ Business · Product · Design · Commercial · Project         │
│ Evidence · Provisioning                                   │
└────────────────────────────┬───────────────────────────────┘
                             ↓
┌────────────────────────────────────────────────────────────┐
│                    Infrastructure adapters                 │
│ Mongo · AI providers · GitHub · QStash · mail · storage   │
│ Marysoll · P.DC · deployment providers                    │
└────────────────────────────────────────────────────────────┘
```

---

## 3. Domain boundaries

### 3.1 Business Intelligence

Owns:

- DiscoverySession;
- conversational extraction;
- business facts;
- uncertainty/conflicts;
- completeness;
- VerifiedBusinessState.

Does not own:

- product choice;
- design;
- commercial terms;
- project execution.

### 3.2 Product Intelligence

Owns:

- Capability Model;
- Product Catalog;
- fit evaluation;
- ProductRouteDecision;
- SolutionBlueprint;
- product extension classification.

Does not mutate Marysoll/P.DC business logic.

### 3.3 Design Intelligence / Design Engine orchestration

Owns:

- DesignStrategy;
- UX pattern selection rules;
- design-system/block compatibility;
- design jobs/candidates;
- design validation;
- client design revision/selection.

AI proposes candidate specs. Engine validates and renders them.

### 3.4 Commercial

Owns:

- product plan reference;
- DMD engineering plan reference;
- one-time items/credits;
- cost basis;
- commercial recommendation;
- connection to ProjectProposal.

Accepted `ProjectProposal` remains contract/scope snapshot.

### 3.5 Provisioning

Owns:

- onboarding requirements;
- dependencies;
- provisioning plan;
- provider adapters;
- provisioning run;
- verification/reconciliation;
- ProductInstanceReference (the DMD-side reference to the provider-owned instance).

### 3.6 Project Intelligence

Owns AI-assisted interpretation of project communication and project planning, but uses existing canonical project objects.

Owns:

- message classification;
- draft project commands;
- client Q&A;
- scope delta assessment;
- dependency planner;
- status explanation;
- project context assembly.

Does not directly own persistence of `ProjectProposal` or `ClientProject`; their application services do.

### 3.7 Evidence / Engineering Sync

Owns:

- GitHub event ingestion;
- CI/build/test evidence;
- engineering-state manifest ingestion;
- repo document knowledge;
- evidence conflicts;
- project execution projection;
- reconciliation.

---

## 4. Recommended code organization

Do not reorganize the entire repository first. Create the canonical structure around each implemented slice and migrate legacy code only when touched.

```text
app/
  api/
    discovery/
    ai/
    design/
    products/
    provisioning/
    project-intelligence/
    integrations/
      github/
    [[...path]]/route.js        # legacy endpoints remain

server/
  http/
  auth/
  db/
  modules/
    <domain>/
      application/
      domain/
      repositories/
      validation/
  integrations/
  jobs/
  diagnostics/

lib/
  genuinely shared non-domain utilities only
```

Existing pure-domain files can stay in place until moved safely.

---

## 5. Transport rule

For the expansion, do not add another long series of branches to `app/api/[[...path]]/route.js`.

Use explicit Next route handlers for new bounded contexts.

A route handler may do only:

```text
parse request
→ auth/authorization
→ validate schema
→ call application command/query
→ serialize response
```

It may not contain:

- model prompt logic;
- product fit rules;
- direct multi-model orchestration;
- long provisioning flows;
- scope-delta calculation;
- GitHub reconciliation logic.

---

## 6. Command/query separation

Not full CQRS infrastructure; use the useful part of the idea.

### Command

Changes canonical state.

Examples:

```text
verifyBusinessState
acceptProductRoute
selectDesignRevision
createProposalDraft
recordClientDecision
addTask
requestOnboardingInput
applyEngineeringEvidence
```

Every command receives:

```text
actor
aggregate id
expected version
validated payload
idempotency key where needed
provenance/evidence refs
```

### Query

Reads a role-safe projection.

Examples:

```text
getDiscoveryWorkspace
getSolutionSummary
getClientProjectView
getInternalEngineeringView
getOnboardingQueue
```

---

## 7. AI command gateway

Never:

```text
LLM → Mongoose model.save()
```

Always:

```text
LLM
→ structured CommandProposal
→ schema validation
→ policy evaluation
→ actor/resource authorization
→ lifecycle validation
→ optional approval
→ application command
→ transaction
→ audit/event
```

`CommandProposal` example:

```text
{
  commandType: "create_project_item",
  projectId: "...",
  payload: {
    kind: "problem",
    title: "...",
    body: "..."
  },
  evidenceRefs: ["chat-message:..."],
  confidence: 0.94,
  policyVersion: "pi-command-v1"
}
```

The LLM's confidence never bypasses policy.

---

## 8. Events and outbox

Side effects must not be mixed casually with canonical writes.

For important mutations:

```text
transaction
  canonical write
  outbox event
commit
      ↓
worker/workflow
  notification
  AI job
  GitHub sync
  provisioning step
```

Initial implementation can use Mongo `OutboxEvent` + Upstash Workflow/QStash delivery.

Required properties:

```text
eventId
eventType
schemaVersion
aggregateType
aggregateId
actorRef
occurredAt
correlationId
causationId
payload
status / attempts
```

Every handler must be idempotent.

---

## 9. Durable jobs

AI design and multi-step provisioning must not depend on one long browser request.

Use job lifecycle:

```text
queued
→ running
→ waiting_external / waiting_client
→ succeeded

         ↘ failed_retryable
         ↘ failed_terminal
         ↘ cancelled
```

Recommended first durable executor: **Upstash Workflow/QStash**, because it fits Next.js/serverless, provides retries/delivery guarantees, and avoids introducing a worker cluster immediately.

Use one workflow per logical run and checkpoint meaningful steps.

---

## 10. JavaScript/schema strategy

The repository remains JavaScript/JSX. Do not block the expansion on a rewrite and do not introduce .ts or .tsx source files.

Recommended incremental approach:

1. keep legacy JavaScript working;
2. implement new contracts in JavaScript with JSDoc where it materially clarifies an exported boundary;
3. use Zod/JSON Schema at every external, persisted-configuration, webhook and AI boundary;
4. generate provider schemas from one canonical runtime contract when possible.

Strong candidates for early runtime schemas:

- AI structured outputs;
- CommandProposal;
- Discovery/Capability/Blueprint contracts;
- DesignSpec;
- webhook events;
- WorkOrder/EngineeringState manifests.

Pure business rules may remain .mjs when that minimizes migration risk.

---

## 11. Persistence model rule

Do not create one giant `ProjectIntelligence` document containing everything.

Use aggregates according to lifecycle/change rate:

```text
DiscoverySession
VerifiedBusinessState
ProductRouteDecision
SolutionBlueprint
DesignJob
DesignCandidate
ApprovedDesignRevision
CommercialConfiguration
OnboardingRequirement
ProvisioningRun
ProductInstanceReference
AgentRun
ChangeAssessment
ProjectEvidence
EngineeringProjection
IntegrationConnection
```

Existing project/commercial aggregates remain separate.

---

## 12. Projection rule

The client should not read raw internal engineering state.

Use explicit projections:

```text
ClientSolutionView
ClientProjectView
InternalProjectView
EngineeringView
CommercialView
```

This continues the existing project serializer/access-control philosophy.

---

## 13. Versioning rule

Version anything that can change a decision:

```text
business schema
business state
capability registry
product definition
routing rules
solution blueprint
design grammar
design strategy
design candidate
scope-delta rules
agent policy/prompt
work order
engineering state schema
```

Never rely on “current code probably means the same thing”. Store rule/config version with every decision.

---

## 14. Reliability rule

For distributed boundaries:

- idempotency keys;
- expected version / optimistic concurrency;
- retry classification;
- timeout;
- circuit breaker for failing AI/provider calls;
- dead-letter/review queue;
- reconciliation.

Never retry a non-idempotent action without a stable idempotency key.

---

## 15. Architecture invariant summary

```text
AI = interpretation / proposal
System = decisions / authorization
Engine = deterministic execution
Workflow = durable coordination
Evidence = project truth input
Frontend = projection, never authority
```

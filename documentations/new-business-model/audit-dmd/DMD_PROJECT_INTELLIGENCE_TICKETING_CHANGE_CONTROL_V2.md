# DMD Project Intelligence — Ticketing, Change Control & Dependency Planning V2

**Existing foundation:** `ProjectItem`, `ChatMessage`, `ProjectProposal`, `ClientProject`, `HandoffDialog`  
**Goal:** Turn daily client communication into controlled project work without drowning development in ideas and manual tracking.

---

## 1. Current foundation is closer to the target than it appears

DMD already models:

```text
chat message
→ flag
→ formal ProjectItem/request/task
```

and already distinguishes:

- existing accepted work → task in current milestone;
- new paid work → draft new phase proposal.

AI should automate interpretation around this system, not replace it.

---

## 2. Client message pipeline

```text
Client message
      ↓
Message classifier
      ↓
question / idea / problem / incident / change / approval / input
      ↓
Project Context lookup
      ↓
Intent + scope analysis
      ↓
recommended formal action
      ↓
policy / authorization / approval
      ↓
existing DMD command
      ↓
ProjectItem / Task / Proposal / Answer / OnboardingRequirement
```

---

## 3. Classification model

Machine classification should include:

```ts
ProjectMessageIntent {
  primary:
    | "question"
    | "idea"
    | "future_idea"
    | "bug_report"
    | "incident"
    | "change_request"
    | "pivot_request"
    | "approval"
    | "rejection"
    | "asset_or_input"
    | "status_request"
    | "other"

  confidence
  relatedScopeRefs[]
  relatedMilestoneIds[]
  relatedTaskIds[]
  requiresResponse
  proposedFormalAction
}
```

User/admin can correct classification. Correction becomes training/evaluation data, not hidden model memory.

---

## 4. Bug vs change is a deterministic business distinction

### Bug / defect

A behavior violates accepted scope, acceptance criteria or verified product invariant.

Result:

- problem/incident record;
- task under existing accepted work or defect queue;
- no automatic new price.

### Clarification

The client explains how an accepted feature should behave within the agreed boundary.

Result:

- decision/clarification;
- update implementation task if necessary;
- accepted proposal remains unchanged.

### New capability

The client asks for behavior not contained in accepted scope/product configuration.

Result:

- ChangeAssessment;
- maybe new phase/proposal.

### Pivot

The new request materially changes actor model, core workflow, product route or architecture.

Result:

- new/revised Solution Blueprint;
- new proposal;
- new timeline;
- commercial re-evaluation.

---

## 5. 30% scope-delta rule

Do **not** ask an LLM:

> Did this change more than 30% of the project?

Instead, map the request to structured changes and let a versioned evaluator calculate the delta.

### Initial dimensions

Each dimension gets normalized impact `0..1`:

```text
capability set           30%
data model               20%
integrations             15%
user roles / workflows   15%
infrastructure/security  10%
delivery/dependency      10%
```

Example:

```text
score =
  capabilityDelta * 0.30 +
  dataModelDelta * 0.20 +
  integrationDelta * 0.15 +
  workflowDelta * 0.15 +
  infrastructureDelta * 0.10 +
  dependencyDelta * 0.10
```

Initial policy:

```text
score < 0.15      minor/refinement candidate
0.15–0.29         explicit admin review
>= 0.30           new proposal required
```

Weights and thresholds are versioned configuration and should be calibrated from real projects.

### Hard triggers regardless of score

Automatically require new proposal/review when request introduces:

- new Product Route/Product Family;
- new tenant/security boundary;
- new actor class that changes authorization model;
- new payment/billing model;
- new compliance/data-sensitivity boundary;
- material data migration/schema redesign;
- new external integration with substantial operational liability;
- destructive replacement of accepted core workflow.

### Override

Admin may override only with reason and audit.

AI supplies structured mapped deltas; it does not select the commercial consequence.

---

## 6. ChangeAssessment model

```ts
ChangeAssessment {
  id
  projectId
  sourceMessageIds[]
  requestedBy

  classification
  mappedChanges {
    capabilities[]
    dataModel[]
    integrations[]
    workflows[]
    infrastructure[]
  }

  dimensionScores
  weightedScore
  hardTriggers[]
  ruleVersion

  decision
  decisionReason
  decidedBy
  proposalId?
  createdAt
}
```

---

## 7. Task dependency graph

The user's desired “redni broj” should be a **display order**, not the source of dependency truth.

A task must explicitly know prerequisites.

Extend tasks with:

```ts
{
  dependsOnTaskIds: [],
  dependencyMode: "all" | "any",
  blockedReason: null,
  originType,
  originRef,
  evidencePolicy,
  implementationState,
  verificationState
}
```

### Dependency rules

- graph must be acyclic;
- no dependency on a task in inaccessible/deleted project;
- cross-phase dependency allowed only explicitly;
- accepted/current scope boundary checked;
- readiness is derived.

### Display sequence

Compute topological order, then stable order within equal-ready groups.

UI can display:

```text
#21 Database schema
#22 API contract        blocked by #21
#23 Frontend wiring     blocked by #22
#24 Browser QA          blocked by #23
```

Numbers are presentation references, not the dependency model.

---

## 8. Execution and verification should be separate

Current `pending/in_progress/completed` is not expressive enough for evidence automation.

Do not break legacy UI immediately. Add orthogonal fields/projection:

```text
implementationState:
  planned | ready | in_progress | blocked | implemented

verificationState:
  not_required | pending | tests_passed | qa_passed | accepted | failed
```

Then derive legacy/client status.

Example:

```text
implemented + tests_passed + browser QA pending
→ client status: In verification
→ not completed
```

---

## 9. AI project assistant

The project assistant may answer:

- What is done?
- What is blocked?
- Why is this not finished?
- Was this included in the proposal?
- What do you need from me?
- Can we add this new feature?
- What happens if we pivot?

It reads:

```text
accepted proposal
current Solution Blueprint
project decisions/items
milestones/tasks/dependencies
engineering evidence
onboarding requirements
recent relevant messages
```

It must not answer from chat memory alone.

---

## 10. Suggested response behavior

### Status question

Return verified status and missing verification.

### Bug report

Acknowledge the issue, create/propose a problem/incident item, request only missing reproducibility details, and link it to existing scope when possible.

### Idea

Record as idea if useful, but explicitly say it has not entered production scope.

### Change request

Run ChangeAssessment before promising schedule/price.

### Pivot

Explain impact, create review item, and prepare new proposal only after system decision.

Never tell a client “we will do it” before scope policy has resolved it.

---

## 11. Formal action approvals

### Can be automatic after schema/policy validation

- classify message;
- create non-destructive idea/problem candidate;
- link message to existing task;
- request missing onboarding input;
- produce Q&A answer.

### Require admin/project authority

- add new implementation task when scope ambiguity exists;
- move/change dependency affecting timeline;
- mark defect as resolved when evidence insufficient;
- create/send proposal;
- change accepted schedule/commercial promise;
- cancel/supersede milestone;
- apply pivot.

### Require client

- accept proposal;
- approve solution/design where required;
- confirm material business fact;
- authorize credentials/integration connection.

---

## 12. Existing HandoffDialog evolution

Do not delete it.

Version 2 can become the human review surface for AI-generated recommendations:

```text
AI proposes:
“Convert P-014 into existing task under Booking QA”

Admin sees:
reason
scope evidence
change score
candidate milestone

[Apply] [Edit] [Keep as item]
```

For obvious low-risk cases, future policy can allow auto-apply.

---

## 13. Ticket/client UI

Project workspace should expose a filterable “Items” view:

```text
All
Problems
Incidents
Decisions
Ideas
Pending review
```

Client-visible state should distinguish:

```text
Received
Needs information
Planned
In progress
Resolved
Not in current scope
Proposal required
```

Do not expose internal engineering/security details by default.

---

## 14. Acceptance criteria

1. 90% of non-production ideas can be stored without changing active plan.
2. A bug inside accepted scope never becomes paid work automatically.
3. New work is assessed before becoming task/proposal.
4. >= configured scope-delta threshold produces a proposal requirement.
5. Hard pivot triggers work even if numeric score is low.
6. Dependency graph cannot contain cycles.
7. UI order follows dependencies but does not encode them implicitly.
8. AI cannot promise completion/date/price without system state.
9. Every applied AI-originated command has source message + policy/audit refs.

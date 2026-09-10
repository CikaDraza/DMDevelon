# DMD Repository ↔ Database Engineering Handoff & Evidence Sync

**Goal:** Make local Claude/Codex/documentation work automatically visible in DMD without creating two conflicting sources of truth.

---

## 1. Critical architecture decision

Do not implement:

```text
DB is source of truth
AND
repo Markdown is source of truth
```

for the same fact.

That creates inevitable conflict.

Instead assign authority by fact type.

---

## 2. Source-of-truth matrix

| Fact | Authority |
|---|---|
| Client identity / permissions | DMD DB |
| Discovery conversation | DMD DB |
| Verified Business State | DMD DB/versioned snapshot |
| Product route | DMD DB/rule result |
| Selected design | DMD DB/immutable revision |
| Accepted proposal / price / scope | DMD DB |
| Client decisions / approvals | DMD DB |
| Onboarding requirements | DMD DB |
| Engineering work order at project start | generated from DMD DB, versioned |
| Actual implementation state | repository commit + machine engineering manifest + CI evidence |
| Code/build/test truth | GitHub/CI/repository |
| Client-safe project progress | DMD projection derived from engineering evidence + DB decisions |

This gives both directions without equal-authority conflict.

---

## 3. Frontend/DB → local engineering flow

When a proposal/phase is accepted:

```text
Accepted ProjectProposal
+ Solution Blueprint
+ Approved Design Revision
+ known decisions
       ↓
WorkOrder vN
       ↓
DMD API / CLI pull
       ↓
local repository
```

The local coding agent does not need to scrape DMD pages.

---

## 4. `.dmd/` repository contract

Recommended initial structure:

```text
.dmd/
  project.json
  work-order.json
  engineering-state.json

  schemas/
    # optional pinned schema metadata later

documentations/
  DMD_ENGINEERING_PLAN.md
  DMD_IMPLEMENTATION_REPORT.md
```

### `project.json`

Stable project/repository binding:

```json
{
  "schemaVersion": "1",
  "dmdProjectId": "...",
  "productInstanceId": "...",
  "repository": "owner/repo",
  "defaultBranch": "main"
}
```

### `work-order.json`

Generated from accepted DB truth.

Contains:

- workOrderId/version;
- proposal/phase ref;
- Solution Blueprint version;
- selected design ref;
- milestones/tasks;
- dependencies;
- acceptance criteria;
- evidence policies;
- constraints;
- client decisions relevant to implementation.

Local agents may read it. They should not rewrite accepted scope inside it.

### `engineering-state.json`

Local/repo execution truth.

Contains:

```text
workOrderVersion
baseCommit
milestone/task refs
implementation state
verification state
evidence refs
known blockers
last updated by
```

This is machine-validated and committed with code/docs.

### Human Markdown

`DMD_ENGINEERING_PLAN.md` and `DMD_IMPLEMENTATION_REPORT.md` are human-readable companions.

They can contain architecture reasoning and implementation notes that do not fit the machine schema.

Free-form Markdown is knowledge/evidence, not permission to change commercial scope.

---

## 5. Minimal DMD CLI

Do not start with a complex local daemon.

Initial CLI can expose:

```text
dmd link
dmd pull
dmd status
dmd validate
dmd evidence
dmd sync
```

### `dmd link`

Binds local repo to DMD project using user-authenticated short-lived token/device flow.

### `dmd pull`

Downloads latest accepted work order and generated engineering plan.

### `dmd validate`

Validates `.dmd/*.json`, refs, dependency graph and expected workOrderVersion.

### `dmd evidence`

Creates/updates a structured implementation report from local state/tests.

### `dmd sync`

Optional explicit push of state metadata to DMD; GitHub webhook remains the preferred automatic ingestion trigger after commit.

---

## 6. Claude Code / Codex local flow

```text
dmd pull
↓
Claude Code / Codex reads:
  .dmd/work-order.json
  engineering plan
  repo architecture/docs
↓
plans implementation
↓
changes backend → DB → frontend end-to-end
↓
runs tests/build
↓
updates engineering-state.json + report
↓
developer reviews/corrects
↓
commit / PR
```

This preserves human control and avoids building another coding-agent orchestration platform inside DMD prematurely.

---

## 7. Local agent instruction contract

Each repo should have a concise agent instruction file explaining:

1. `work-order.json` is accepted implementation scope;
2. do not change budget/client commitments;
3. update `engineering-state.json` only for work actually performed;
4. cite task/milestone refs;
5. run required evidence checks;
6. update human documentation;
7. do not mark verified when required check has not run;
8. commit machine state with implementation.

Claude/Codex can create detailed local plans, but DMD state contract remains stable.

---

## 8. Repository → DMD automatic flow

Preferred production integration: a DMD GitHub App with least privilege and webhooks.

Events initially needed:

```text
push
pull_request
check_run/check_suite or workflow_run
```

Flow:

```text
GitHub webhook
→ signature verification
→ delivery-id dedupe
→ EventInbox
→ async worker
→ fetch expected repo files/commit metadata
→ validate engineering-state schema
→ verify workOrderVersion
→ ProjectEvidence records
→ EngineeringProjector
→ allowed project commands/projection
→ notifications/frontend
```

Do not perform large GitHub/API/model work inside webhook response.

Webhook responds quickly after authenticity + enqueue.

---

## 9. GitHub security model

Use GitHub App, not a long-lived personal token.

Start read-only where possible:

- Metadata read;
- Contents read;
- Pull requests read;
- Checks/Actions read as needed.

DMD does not need repository write permission merely to track development.

If future DMD features create branches/files automatically, add narrowly scoped write permission intentionally and separately.

Webhook security:

- high-entropy secret;
- validate `X-Hub-Signature-256` with constant-time comparison;
- dedupe `X-GitHub-Delivery`;
- allow only installed/linked repositories;
- map repository stable ID, not name alone.

---

## 10. Evidence policy

A commit alone should not finish a task.

Example task evidence policy:

```json
{
  "required": ["code_commit", "tests_green"],
  "optional": ["browser_qa"],
  "completionGate": "all_required"
}
```

High-risk task:

```text
commit
unit/integration tests
production build
browser acceptance
diagnostic/integrity check
```

Content task might require:

```text
document revision
client approval
```

---

## 11. EngineeringProjection

Do not rewrite accepted proposal from repo events.

Create a derived projection:

```text
EngineeringProjection {
  projectId
  workOrderVersion
  repositoryId
  headSha

  tasks {
    taskId
    implementationState
    verificationState
    blockerRefs[]
    evidenceRefs[]
  }[]

  generatedAt
  sourceEventIds[]
}
```

Frontend uses this plus existing ClientProject to show truth.

---

## 12. Conflict rules

### DB plan changed after local pull

Local manifest says workOrder v5, DB is v6.

Result:

```text
CONFLICT — sync latest work order before applying state changes to altered tasks.
```

Unaffected refs may still ingest as evidence if policy allows, but no silent overwrite.

### Agent says complete, tests fail

Result:

```text
implementation = implemented
verification = failed
client status != completed
```

### Documentation says old behavior, newer accepted decision exists

DB accepted decision wins for business/scope truth.

Documentation becomes stale knowledge and reconciliation alert.

### Repo removes a task from manifest

Repo cannot erase accepted scope.

DMD records inconsistency. Cancellation/supersession requires DMD project command.

---

## 13. Commit/reference convention

Useful, not sole authority:

```text
[DMD:TASK-123]
[DMD:MILESTONE-45]
[DMD:PHASE-3]
```

Engineering manifest has stable IDs; commit reference helps humans/search/reconciliation.

---

## 14. Documentation ingestion

Repo docs should be indexed as knowledge:

- ADRs;
- TODO/current plan;
- implementation reports;
- migration notes;
- acceptance reports.

Parser can extract claims:

```text
planned
implemented
verified
blocked
deprecated
```

But free-text claims never directly bypass machine state/evidence policy.

---

## 15. Product-specific repos

DMD Project can link to:

- DMD repo;
- Marysoll repo/tenant/product instance;
- P.DC repo/deployment/org;
- custom platform repo(s).

Use `ProjectIntegration` / `RepositoryBinding`:

```text
projectId
productInstanceId
provider=github
repositoryId
fullName
defaultBranch
trackedBranches
status
```

One project may later have multiple repos without changing evidence model.

---

## 16. Why this is better than “AI reads GitHub and updates DB”

Because it gives:

- deterministic task IDs;
- accepted-scope protection;
- conflict detection;
- versioning;
- reproducible project state;
- provider-independent local agents;
- no dependence on prompt interpretation of arbitrary Markdown;
- exact evidence for client answers.

---

## 17. Acceptance criteria

1. An accepted phase can produce a versioned WorkOrder without manual copy/paste.
2. Claude/Codex can understand work from repo files alone after `dmd pull`.
3. A commit updates DMD only after webhook/event validation.
4. Duplicate webhook deliveries do not duplicate evidence/state changes.
5. Repo state cannot change accepted budget/scope.
6. A stale work-order version creates conflict instead of overwrite.
7. Tests/build can prevent false “completed” status.
8. Developer can still manually override project projection with explicit reason/audit.
9. DMD frontend shows new engineering state without retyping the same work manually.

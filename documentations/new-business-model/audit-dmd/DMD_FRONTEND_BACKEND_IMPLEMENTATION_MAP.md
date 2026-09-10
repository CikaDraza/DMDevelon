# DMD Expansion — Frontend & Backend Implementation Map

**Purpose:** Translate the target architecture into concrete changes around the existing DMDevelon repository.

---

## 1. Frontend information architecture

### Public

```text
/
  Landing
  ├─ Hero
  ├─ How DMD works
  ├─ Product/problem examples
  ├─ Existing work
  ├─ commercial explanation
  └─ CTA → /start

/start
  Discovery workspace

/start/[session]
  resumable discovery/design workspace

/solution/[id]
  solution/design approval surface when a durable lead solution exists
```

### Authenticated client

```text
/dashboard
  projects / requests / notifications

/dashboard/projects/[id]
  project overview
  ├─ Plan / phases
  ├─ Items / tickets / decisions
  ├─ Inputs & onboarding
  ├─ Proposals
  ├─ Engineering status
  └─ AI project assistant

/dashboard/chat
  existing communication hub
```

Do not duplicate chat. Project assistant can link/reference existing project channel and formal artifacts.

---

## 2. Landing refactor

### Current

`components/pages/HomeClient.js` owns too much.

### Target

Extract:

```text
components/landing/
  Header
  Hero
  HowDmdWorks
  DmdIntelligenceOverview
  ProductExamples
  ProjectsShowcase
  CommercialExplanation
  DiscoveryCTA
  Footer
```

Server-render static/SEO content where practical. Keep Framer Motion only in client islands that need it.

### Pricing

Remove future DMD pricing architecture from component constants.

Introduce later:

```text
GET /api/commercial/public-plans
```

or server-side catalog query.

For now, pricing can remain current/legacy until unit economics are measured.

---

## 3. Discovery workspace components

```text
components/discovery/
  DiscoveryShell
  DiscoveryChat
  DiscoveryProgress
  BusinessSummaryCard
  MissingInfoPanel
  AssetUploader
  WebsiteSourceCard
  CapabilitySummary
  ProductRecommendation
  SolutionBlueprintView
  DesignJobProgress
  DesignCandidateGallery
  DesignCandidatePreview
  RevisionComposer
  AcceptSolutionPanel
```

Key rule: chat is not the only UI. As facts become structured, show them as editable cards/progress.

---

## 4. Frontend state strategy

Use React Query for server state.

Do not put canonical discovery/business/product state in one huge local React object.

Query keys example:

```text
['discovery-session', id]
['business-state', id]
['product-route', id]
['solution-blueprint', id]
['design-job', jobId]
['design-candidates', sessionId]
['project-intelligence', projectId]
['onboarding-requirements', projectId]
['engineering-projection', projectId]
```

Local state only for ephemeral composer/open-panel state.

---

## 5. AI chat transport

For discovery/Q&A:

- POST user message;
- server persists message first;
- agent run begins;
- stream response where useful;
- extraction/state updates arrive as separate typed events;
- React Query invalidates/reconciles canonical state.

Do not trust streamed model tokens as committed business state.

Example event types:

```text
assistant_text_delta
agent_run_started
business_state_candidate
business_state_applied
missing_information_changed
design_job_started
```

---

## 6. Design preview rendering

Avoid running model-generated React/HTML in the public app.

Build a renderer:

```text
DesignSpec
→ Block Registry
→ safe React components
→ preview route
```

Possible route:

```text
/design-preview/[candidateId]
```

Preview fetches immutable candidate revision and renders known components/tokens.

Custom code generation happens only in engineering repo after project acceptance.

---

## 7. Project workspace evolution

Current project page is already complex. Do not keep appending sections indefinitely.

Recommended incremental split:

```text
components/project-workspace/
  ProjectHeader
  ProjectOverview
  ProposalPanel
  MilestonePlan
  ProjectItemsPanel
  OnboardingPanel
  EngineeringStatusPanel
  ProjectAssistantPanel
```

Later move to nested routes/layout if page complexity demands it.

Preserve legacy query deep links during migration.

---

## 8. Project item/ticket UI

Extend current chat conversion UX with:

- AI suggested flag;
- classification confidence only internally/admin if useful;
- “not in current scope” status;
- related proposal/milestone/task;
- ChangeAssessment result;
- handoff action.

Client should always be able to see whether an idea is merely recorded or actually scheduled.

---

## 9. Onboarding UI

New project panel:

```text
What we need from you
```

Each requirement:

```text
Domain                         Ready
Business email                 Needed
Google Calendar connection     Connect
Existing DB export             Waiting for file
Instagram                      Not needed yet
```

Requirements appear progressively based on dependency, not as an overwhelming 30-field form.

### Credential rule

Never ask client to paste passwords/API keys into chat.

Use:

- OAuth/connect flow;
- secure credential input/vault reference;
- file upload for export;
- explicit verification state.

---

## 10. Backend route map

### Discovery

```text
POST /api/discovery/sessions
GET  /api/discovery/sessions/:id
POST /api/discovery/sessions/:id/messages
POST /api/discovery/sessions/:id/assets
POST /api/discovery/sessions/:id/verify
```

### Product

```text
GET  /api/discovery/sessions/:id/capabilities
POST /api/discovery/sessions/:id/route
GET  /api/discovery/sessions/:id/blueprint
```

Routing endpoint performs system decision, not free model classification.

### Design

```text
POST /api/design/jobs
GET  /api/design/jobs/:id
GET  /api/design/sessions/:sessionId/candidates
POST /api/design/candidates/:id/select
POST /api/design/candidates/:id/revisions
```

### Project Intelligence

```text
POST /api/projects/:projectId/assistant/messages
POST /api/projects/:projectId/items/:itemId/assess-change
POST /api/projects/:projectId/commands/:commandType
GET  /api/projects/:projectId/engineering
GET  /api/projects/:projectId/onboarding
```

### Integrations

```text
POST /api/integrations/github/webhook
GET  /api/projects/:projectId/repositories
POST /api/projects/:projectId/repositories/link
```

Exact route shape may adjust during implementation, but bounded ownership must remain.

---

## 11. Backend model additions — first pass

### Discovery/Product

```text
DiscoverySession
VerifiedBusinessState
ProductRouteDecision
SolutionBlueprint
```

Capability/Product registry can begin as versioned code/config before persistence is needed.

### Design

```text
DesignJob
DesignCandidate
ApprovedDesignRevision
```

### AI

```text
AgentRun
```

### Project Intelligence

```text
ChangeAssessment
```

Extend existing task/project models with dependency/evidence references carefully.

### Provisioning

```text
OnboardingRequirement
ProvisioningRun
ProductInstanceReference
```

### Evidence

```text
RepositoryBinding
WebhookInboxEvent
ProjectEvidence
EngineeringProjection
OutboxEvent
```

---

## 12. Application services

Examples:

```text
CreateDiscoverySession
AppendDiscoveryMessage
ApplyDiscoveryPatch
VerifyBusinessState
DeriveCapabilities
EvaluateProductRoute
BuildSolutionBlueprint
StartDesignJob
SelectDesignCandidate
CreateMasterProposalFromBlueprint
ClassifyProjectMessage
AssessScopeChange
ApplyProjectCommand
IngestGitHubDelivery
ProjectEngineeringState
```

Each is testable without frontend.

---

## 13. Background workflow map

### Design job

```text
create job
→ assemble context
→ strategy agents
→ design composer
→ validate DesignSpec
→ render candidate
→ optional candidate alternatives
→ mark ready
→ notify
```

### GitHub delivery

```text
verify webhook
→ enqueue
→ fetch commit/manifest/CI state
→ validate
→ evidence
→ projection
→ notify if meaningful
```

### Provisioning

```text
validate plan
→ wait for required inputs
→ execute adapter steps
→ verify
→ reconcile if partial
→ record the active ProductInstanceReference after provider verification
```

---

## 14. Tests

### Unit

- discovery completeness rules;
- capability derivation;
- product fit;
- DesignSpec validator;
- scope delta;
- dependency DAG;
- command policy;
- evidence precedence.

### API integration

Use existing replica-set setup for state-changing flows:

- guest/session ownership;
- verify/route idempotency;
- proposal materialization;
- AI command authorization;
- duplicate GitHub delivery;
- stale work-order conflict.

### UI

- discovery progressive disclosure;
- design selection;
- project item classification review;
- onboarding panel;
- engineering status.

### Browser E2E later

- full lead → design → account → proposal → project;
- client change request → assessment → proposal;
- local commit → GitHub webhook → DMD progress.

---

## 15. Performance/optimization rules

1. Landing static/server-first; do not hydrate everything for animations/auth.
2. Discovery sends state diffs, not entire transcript every turn.
3. Stable AI policy prefixes designed for provider prompt caching.
4. Large assets stored separately; model receives resized/selected versions.
5. Project queries use projections, not dozens of model reads in frontend.
6. GitHub webhook returns fast and does heavy work asynchronously.
7. Design candidates are immutable revisions and CDN-cacheable where safe.
8. Poll only where real-time is needed; prefer event invalidation/push for long jobs.

---

## 16. Accessibility/responsive rules

The new lead flow must work from phone because many small-business owners will arrive from social networks.

Required:

- keyboard support;
- focus management for chat/sheets/dialogs;
- reduced motion;
- readable progress without color only;
- text alternatives for generated visual candidate thumbnails;
- mobile design candidate comparison;
- no forced desktop canvas to complete discovery.

---

## 17. Acceptance criteria

1. Landing is not coupled to discovery implementation details.
2. Discovery has its own route and resumable server state.
3. New backend routes do not enlarge the legacy catch-all chain.
4. AI-generated design code is not executed directly in the browser.
5. Project page reuses existing proposal/chat/project models.
6. Private onboarding data follows separate storage/credential policy.
7. Full flow is observable through AgentRun/Job/Event records.

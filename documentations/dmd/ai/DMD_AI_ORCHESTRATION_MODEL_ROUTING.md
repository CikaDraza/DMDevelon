# DMD AI Orchestration & Model Routing

**Status:** ACTIVE
**Authority:** canonical
**Owner domain:** AI Orchestration
**Supersedes:** —
**Superseded by:** —

**Scope:** Online DMD agents that use model APIs.
**Not scope:** local end-to-end coding performed interactively with Claude Code/Codex.

---

## 1. Core decision

DMD should not become a collection of provider-specific prompts scattered across API routes.

Use a provider-neutral AI orchestration layer:

```text
DMD domain task
→ Agent Policy
→ Context Assembler
→ Model Router
→ Provider Adapter
→ Structured Output
→ Schema Validator
→ Domain Validator
→ recommendation / CommandProposal
```

The domain never depends on OpenAI/Anthropic/DeepSeek response objects.

---

## 2. What belongs to API-model agents

Good online/API use cases:

- guided discovery conversation;
- fact extraction;
- ambiguity detection;
- existing-site analysis summary;
- CTA strategy proposals;
- SEO/content architecture proposals;
- UX strategy proposals;
- structured design candidate generation;
- scope/milestone/task draft generation;
- client-message classification;
- project Q&A from verified state;
- change-request interpretation;
- onboarding question wording.

These jobs benefit from immediate web interaction and structured output.

---

## 3. What should remain local/human-supervised

Do not build an expensive DMD server-side “autonomous coding cloud” in the first architecture.

Complex implementation remains:

```text
DMD WorkOrder
→ local repository
→ Claude Code / Codex / developer
→ code + tests + documentation
→ commit / PR
→ DMD evidence ingestion
```

This matches the desired workflow: developer watches terminal/VS Code, resolves architectural bottlenecks, and keeps control of critical decisions.

Later, Claude Agent SDK / Codex SDK can automate selected low-risk local flows, but the contract remains the same WorkOrder/Evidence protocol.

---

## 4. Provider capability baseline — verified 2026-09-09

### OpenAI

Current Responses API supports:

- function/custom tools;
- structured JSON-schema outputs;
- conversations/state options;
- usage accounting;
- async/background capabilities on supported flows.

### Anthropic

Current Claude Platform supports:

- client/server tool use;
- strict tool schema validation;
- structured outputs;
- SDK tool runners/agent loops.

### DeepSeek

Current API supports:

- tool calling;
- Responses-style API;
- JSON output;
- strict function schema mode in beta.

### Architectural consequence

DMD can normalize all three behind one agent contract instead of hardcoding product logic to a model vendor.

---

## 5. Agent registry

Use configuration, not one giant system prompt.

```text
AgentDefinition {
  key
  purpose
  inputSchema
  outputSchema
  allowedTools
  modelPolicy
  maxTurns
  maxTokens
  timeoutMs
  approvalPolicy
  promptPolicyVersion
}
```

Initial agent keys:

```text
business.discovery
business.extractor
business.conflict_detector
website.analyzer
strategy.cta
strategy.content
strategy.seo
strategy.ux
design.composer
project.message_classifier
project.scope_planner
project.qa
project.change_interpreter
onboarding.assistant
```

Names represent responsibility, not a permanent model/provider.

---

## 6. Shared state rule

Specialized agents do not maintain separate realities.

They all read versioned canonical state:

```text
VerifiedBusinessState
CapabilityModel
ProductRouteDecision
SolutionBlueprint
ApprovedDesignRevision
AcceptedProjectProposal
ClientProject projection
```

Example:

- CTA strategist may propose a funnel;
- UX strategist may propose hierarchy;
- design composer may propose sections;

but all use the same Blueprint/version.

No agent may silently rewrite the input state for another agent.

---

## 7. Structured output rule

Free text is for client communication.

Machine decisions use schemas.

Examples:

```text
DiscoveryPatch
MissingInformationProposal
CapabilityCandidateSet
CtaStrategyDraft
DesignSpec
ScopeDraft
MessageClassification
ChangeIntent
CommandProposal
```

Provider output first passes provider/schema validation, then DMD domain validation.

Schema-valid does not mean business-valid.

---

## 8. Model Router

Model selection should depend on task, not brand preference.

```text
ModelRoutePolicy {
  agentKey
  requiredCapabilities[]
  preferredProviders[]
  qualityTier
  maxCost
  maxLatency
  fallbackOrder[]
}
```

Examples:

### Cheap/high-volume

- message classification;
- extraction;
- simple onboarding wording.

### Medium

- discovery follow-up;
- content/CTA analysis;
- project Q&A.

### High-quality

- ambiguous product discovery;
- design composition;
- difficult scope/change analysis.

Final models/prices remain config, not architecture.

---

## 9. Provider adapter

Canonical provider-adapter contract:

```text
AiProviderAdapter {
  generateStructured(request) -> StructuredResult
  streamConversation(request) -> async stream of AiEvent
}
```

Adapter owns:

- provider request format;
- retryable error classification;
- usage normalization;
- provider request/response IDs;
- model name/snapshot;
- provider-specific caching options;
- tool schema conversion.

Domain owns none of these.

---

## 10. AgentRun / usage ledger

Every API-model run should produce an operational record.

```text
AgentRun {
  id
  agentKey
  provider
  model
  policyVersion
  inputStateRefs[]
  outputArtifactRef?
  status
  startedAt
  completedAt
  inputTokens
  cachedInputTokens
  outputTokens
  providerCostSnapshot
  retryCount
  errorClass?
  correlationId
}
```

Do not store hidden chain-of-thought.

Store:

- structured result;
- short decision explanation when needed;
- evidence/state refs;
- provider metadata;
- token/cost usage.

This data is necessary before new DMD pricing is finalized.

---

## 11. Context assembly

Do not send the whole database and complete chat history on every request.

### Discovery context

- stable system/product policy;
- current verified/draft business state;
- missing/ambiguous fields;
- last relevant turns;
- allowed question types.

### Project Q&A context

- project identity;
- accepted proposal excerpts relevant to question;
- current milestone/task projection;
- ProjectItem/decision records;
- verified engineering evidence;
- relevant recent messages.

Retrieve by structured IDs first. Add semantic/vector retrieval only when corpus size justifies it.

---

## 12. Website/repository content is untrusted input

Any of these can contain prompt injection:

- client website;
- GitHub issue;
- README;
- uploaded PDF;
- copied email;
- model-generated report.

Rules:

1. label source content as data;
2. do not expose mutation tools to pure analysis agents;
3. tool permissions are minimal per agent;
4. outputs must pass deterministic policy;
5. high-impact actions require explicit system/human approval;
6. never let content tell the model to reveal secrets or invoke unrelated tools.

---

## 13. Tool design

Avoid open-ended tools such as:

```text
run_any_shell_command
write_any_database_document
call_arbitrary_url
```

Prefer narrow commands:

```text
read_project_scope
list_project_tasks
propose_project_item
propose_task_change
request_onboarding_requirement
submit_design_spec
```

The application executes the tool after authorization.

---

## 14. Retry/fallback policy

Retry only transient errors:

- provider timeout;
- rate limit;
- temporary 5xx.

Do not retry blindly:

- schema/domain rejection;
- authorization failure;
- invalid user input;
- safety/policy rejection.

Fallback to another model/provider only if the agent policy allows it and the task semantics remain equivalent.

Record fallback in AgentRun.

---

## 15. Streaming vs jobs

### Stream

Good for:

- discovery chat;
- client Q&A;
- low-latency explanation.

### Durable job

Required for:

- multi-agent website analysis;
- design generation;
- multiple candidates;
- premium design handoff;
- large scope planning;
- provisioning.

Never couple a multi-minute design process to a browser connection.

---

## 16. Premium Claude Design decision

Claude Design is currently a beta visual product that can consume design systems and hand off to Claude Code.

Do not assume a stable public automation API contract for DMD.

Architecture:

```text
PremiumDesignAdapter
  mode: manual_handoff initially
```

DMD exports a complete package:

- Blueprint;
- Design Strategy;
- assets;
- allowed components;
- design-system instructions;
- target routes/screens;
- content/CTA strategy.

Operator uses Claude Design, returns approved artifact/handoff, and local coding agents implement it.

If Anthropic later provides a stable programmatic surface that fits DMD, only the adapter changes.

---

## 17. Acceptance criteria

1. No domain object depends on provider-specific response shapes.
2. Every machine-relevant AI output has a schema.
3. Every AgentRun records provider/model/policy/usage.
4. AI cannot write project/business truth directly.
5. Website/repo content cannot expand agent privileges.
6. Model selection is configuration-driven.
7. Expensive design jobs are asynchronous and quota-controlled.
8. Local coding remains compatible with both Claude Code and Codex without requiring DMD to buy coding API tokens for every implementation turn.

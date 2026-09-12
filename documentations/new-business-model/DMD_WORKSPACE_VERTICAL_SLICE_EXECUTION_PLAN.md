# DMD Workspace — Vertical Slice Execution Plan

**Status:** Active operational companion  
**Date:** 2026-09-12  
**Authority:** [`../TODO.md`](../TODO.md) is the canonical milestone, dependency and completion-status authority. This companion does not maintain an independent status tracker.  
**Scope:** Client-visible Workspace path after `DMD-FND-4`; every slice is implemented, deployed and browser-verified independently.  
**Not a status tracker:** This file records no completion state for any milestone and no state at all for the `DMD-FND-*` foundation stream. FND-3 submilestone status lives only in the `TODO.md` FND-3 evidence ledger. The per-slice acceptance rule in §3 adds a required client-visible proof; it never grants completion authority on its own.

---

## 1. Execution order

```text
DMD-FND-4
├─ DMD-WORKSPACE-0 → DMD-WS-1 ─┐
└─ DMD-OPS-0 ───────────────────┤
                                ↓
                             DMD-AI-0
                                ↓
                             DMD-BI-1
                                ↓
                             DMD-BI-2
                                ↓
                             DMD-BI-3
                                ↓
                             DMD-PI-1
                                ↓
                             DMD-PI-2
                                ↓
                             DMD-BP-1
                                ↓
DESIGN — Intake → Strategy → Generation / Preview → Review / Revision
                                ↓
                 DMD-DES-6 ApprovedDesignRevision
                                ↓
                             DMD-COM-0
                                ↓
                           DMD-PROJECT-0
                                ↓
                           DMD-PROJECT-1
                                ↓
                            DMD-CONV-0
```

`DMD-WORKSPACE-0` and `DMD-OPS-0` may progress independently. `DMD-AI-0` waits for both `DMD-WS-1` and the required operational foundation. `DMD-FND-5 → DMD-FND-8` remain a separate sequential legacy-cleanup stream after `DMD-FND-4` and do not block this vertical unless a canonical TODO dependency explicitly says otherwise. `DMD-CONV-0` is last.

`DESIGN` is only a client-visible grouping. Its implementation authority remains the detailed TODO sequence:

```text
DMD-DES-0 → DMD-DES-1 → DMD-DES-2 → DMD-DES-3
→ DMD-DES-4 → DMD-DES-5 → DMD-DES-6 ApprovedDesignRevision
→ DMD-COM-0
```

The former compact use of `DES-0…3` for different client-facing meanings is retired. No proposal/acceptance/payment gate or other binding Commercial state may depend on an unapproved DesignCandidate.

---

## 2. Vertical slices

### DMD-WORKSPACE-0 — Workspace interaction shell

- **Client-visible result:** A responsive `/start` Workspace shell accepts a free natural-language description and optional links/assets without forcing a product or architecture choice.
- **System/domain capability:** Fixture-backed lifecycle projection and interaction boundaries, without creating a new source-of-truth aggregate.
- **Hard dependencies:** `DMD-FND-4`.
- **Explicit out of scope:** Persistence, AI, product routing, Design execution, pricing and project automation.
- **Real staging/browser proof:** On mobile and desktop staging, the primary CTA opens `/start`, free text works, no technical/product-type shortcut cards appear and refresh behavior is explicit rather than misleading.

### DMD-WS-1 — Anonymous DiscoverySession and persistent conversation

- **Client-visible result:** A guest can start, refresh, resume and later claim the same conversation without losing work.
- **System/domain capability:** Persistent `DiscoverySession`, ordered messages, opaque scoped access, expiry/rotation, isolation and idempotent account claim.
- **Hard dependencies:** `DMD-WORKSPACE-0`, `DMD-FND-4`.
- **Explicit out of scope:** AI interpretation, VerifiedBusinessState, Product Intelligence and implicit ProjectRequest creation.
- **Real staging/browser proof:** Two isolated browser contexts cannot read each other's session; refresh/resume preserves messages; registration returns the owner to the same claimed Workspace state.

### DMD-OPS-0 — Operational foundation

- **Client-visible result:** Long-running work exposes durable progress, actionable failure and safe retry instead of a silent spinner or duplicate result.
- **System/domain capability:** Audit/event baseline, job/runtime state, idempotency, retry classification, cost/usage evidence and operational diagnostics required by later engines.
- **Hard dependencies:** `DMD-FND-4`.
- **Explicit out of scope:** Provider-specific AI behavior and client-domain decisions.
- **Real staging/browser proof:** A controlled delayed/failing operation survives refresh, reports a client-safe state, retries safely and leaves one traceable authoritative result.

### DMD-AI-0 — Provider-neutral interpretation foundation

- **Client-visible result:** The Workspace can return one useful schema-bound interpretation while preserving the conversation on provider failure.
- **System/domain capability:** Provider/model policy, validated structured output, timeout/fallback, prompt/version record, usage/cost ledger and no-mutation tool boundary.
- **Hard dependencies:** `DMD-WS-1`, required `DMD-OPS-0` capability.
- **Explicit out of scope:** Product selection, commercial decisions, project mutation and autonomous code execution.
- **Real staging/browser proof:** A staging conversation produces a validated interpretation; malformed output/provider failure takes the declared fallback path without corrupting or duplicating session state.

### DMD-BI-1 — Living Understanding

- **Client-visible result:** The client sees and edits what DMD currently understands, what is uncertain and the next highest-value question.
- **System/domain capability:** Sourced facts, provenance, confidence, contradiction/open-question tracking and no-repeat logic.
- **Hard dependencies:** `DMD-AI-0`.
- **Explicit out of scope:** Recommendations promoted to facts, formal verification, product routing and ProjectRequest creation.
- **Real staging/browser proof:** The staging flow corrects a fact, preserves its source/history, surfaces a contradiction and does not repeat an already answered question.

### DMD-BI-2 — Advisory Brainstorming

- **Client-visible result:** The client receives clear recommendations, alternatives and trade-offs that can be accepted or rejected.
- **System/domain capability:** Advisory proposals remain explicitly separate from observed/confirmed facts, with provenance and decision history.
- **Hard dependencies:** `DMD-BI-1`.
- **Explicit out of scope:** Silent fact mutation, formal verification, deterministic product route and commercial commitment.
- **Real staging/browser proof:** Accepting or rejecting a recommendation changes only advisory state; rejected advice never appears later as a canonical business fact.

### DMD-BI-3 — Understanding Gate / VerifiedBusinessState

- **Client-visible result:** The client reviews “this is what you mean”, resolves material gaps and explicitly confirms a stable understanding.
- **System/domain capability:** Completeness rules, authorized verification and immutable/versioned `VerifiedBusinessState` revisions.
- **Hard dependencies:** `DMD-BI-2`.
- **Explicit out of scope:** Automatic `ProjectRequest`, proposal, pricing, Design execution or ClientProject creation.
- **Real staging/browser proof:** A vague input reaches an explicitly confirmed versioned snapshot only after visible material conflicts are resolved or accepted; no project/commercial record appears implicitly.

### DMD-PI-1 — Capability and product contracts

- **Client-visible result:** DMD can explain available solution capabilities without asking the client to choose technical architecture.
- **System/domain capability:** Versioned capability registry and ProductDefinition manifests for Marysoll, P.DC and Custom.
- **Hard dependencies:** `DMD-BI-3`.
- **Explicit out of scope:** Tenant-specific product forks, final route decision, design or provisioning.
- **Real staging/browser proof:** Known Marysoll/P.DC scenarios render client-safe capability explanations from pinned manifests; invalid/conflicting manifest fixtures fail validation.

### DMD-PI-2 — Deterministic product routing

- **Client-visible result:** The client receives a product direction and understandable reasons, alternatives or a custom-required outcome.
- **System/domain capability:** Reproducible CapabilityModel evaluation and immutable `ProductRouteDecision` with version/rule evidence.
- **Hard dependencies:** `DMD-PI-1`.
- **Explicit out of scope:** AI-selected product authority, extension implementation, design candidate and product-instance mutation.
- **Real staging/browser proof:** Pinned staging fixtures reproduce the same route/reasons; catalog-version changes do not rewrite prior decisions.

### DMD-BP-1 — Versioned Solution Blueprint

- **Client-visible result:** The client can inspect what is included, excluded, unresolved and why before design work starts.
- **System/domain capability:** Validated, versioned bridge from business/product truth into Design, Commercial and Project inputs.
- **Hard dependencies:** `DMD-PI-2`.
- **Explicit out of scope:** Pricing, proposal acceptance, Design execution and provisioning.
- **Real staging/browser proof:** A routed staging case produces a role-safe Blueprint whose pinned inputs validate at Design and Commercial boundaries without copying or drifting canonical state.

### DESIGN — canonical DMD-DES-0 through DMD-DES-6

- **Client-visible result:** The client supplies only information they reasonably know, reviews/refines validated previews and explicitly approves one immutable revision.
- **System/domain capability:** Canonical intake, analysis/strategy, safe generation, supervised normalization/validation, preview/revision and `ApprovedDesignRevision` through the detailed `DMD-DES-0 → DMD-DES-6` milestones.
- **Hard dependencies:** `DMD-BP-1` plus each detailed Design dependency in the canonical TODO.
- **Explicit out of scope:** Making the client choose UX/CTA/responsive/SEO/component architecture; treating selection/approval as `bought`, proposal acceptance, payment or WorkOrder.
- **Real staging/browser proof:** A staging case reaches mobile/desktop review, classifies visual versus functional feedback correctly, preserves revisions and creates one immutable authorized approval; no binding Commercial/project state exists before it.

### DMD-COM-0 — Commercial configuration and proposal materialization

- **Client-visible result:** After approved design, the client receives a coherent, reviewable commercial proposal derived from version-pinned scope/design.
- **System/domain capability:** Separate CommercialConfiguration and existing ProjectProposal lifecycle with source/version/evidence links.
- **Hard dependencies:** `DMD-DES-6`, `DMD-BP-1`, `DMD-AI-0`.
- **Explicit out of scope:** Automatic price authority, implicit acceptance/payment and any binding client-facing decision based on an unapproved candidate.
- **Real staging/browser proof:** Staging proves an unapproved candidate cannot open/send/accept the authoritative commercial gate; an approved revision can create one source-linked draft without rewriting an accepted snapshot.

### DMD-PROJECT-0 — Claimed Workspace / My Projects continuity

- **Client-visible result:** Claimed discovery/design/commercial work remains visible from Dashboard/My Projects and reopens at the same Workspace state.
- **System/domain capability:** Authenticated projection of pre-project ownership and an idempotent source-linked handoff into the existing formal request/proposal/project path when appropriate.
- **Hard dependencies:** `DMD-WS-1` and relevant lifecycle state through `DMD-COM-0`.
- **Explicit out of scope:** Treating `VerifiedBusinessState` as `ProjectRequest`, premature `ClientProject`, automatic proposal creation or bypassing payment/project authority.
- **Real staging/browser proof:** Registration/claim never shows an unrelated empty dashboard; repeat navigation preserves one Workspace; repeated formal handoff creates at most one linked ProjectRequest.

### DMD-PROJECT-1 — Project Intelligence read/classification foundation

- **Client-visible result:** An authorized project member gets source-grounded answers, clear status and correctly classified change implications.
- **System/domain capability:** Authorized project context assembly, read-only Q&A, versioned ChangeAssessment and dependency/readiness projections over existing aggregates.
- **Hard dependencies:** For the Workspace path, `DMD-PROJECT-0`; the canonical TODO retains any independently executable existing-project foundation dependencies.
- **Explicit out of scope:** Unreviewed scope/date/price promises, proposal mutation, repository sync and AI completion claims without evidence.
- **Real staging/browser proof:** Owner/member/outsider browser scenarios enforce access; a scope delta and bug/clarification case show distinct sourced outcomes without mutating accepted state.

### DMD-CONV-0 — Shared conversation intelligence

- **Client-visible result:** Across the completed lifecycle, the client can turn a message into an appropriate formal candidate action with a visible confirmation step.
- **System/domain capability:** Shared classification/provenance layer that routes through existing authorized conversion commands and preserves the source message.
- **Hard dependencies:** Last in this active sequence, after `DMD-PROJECT-1` and the established domain conversion paths it reuses.
- **Explicit out of scope:** A universal chat aggregate, direct AI mutation, bypassed auth/business rules and inventing a second task/request/change model.
- **Real staging/browser proof:** Staging messages in supported contexts produce source-linked candidate actions; confirm/cancel, duplicate submission and unauthorized-user cases all take the expected path.

---

## 3. Per-slice acceptance rule

A slice advances only when its canonical TODO contract and its real staging/browser scenario are satisfied. Unit/integration/build evidence remains required where the canonical milestone specifies it, but technical success alone does not replace the client-visible browser proof recorded for that slice.

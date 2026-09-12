# DMD Platform Expansion — Current-Application Audit Addendum

**Status:** AUDIT EVIDENCE
**Authority:** evidence-only
**Owner domain:** Current System / Platform Expansion
**Supersedes:** the former duplicate audit master-plan name
**Superseded by:** —

**Document class:** Current-app execution addendum; not canonical lifecycle or product guidance.
**Canonical authority:** [`DMD_PLATFORM_EXPANSION_MASTER_PLAN.md`](../../product/DMD_PLATFORM_EXPANSION_MASTER_PLAN.md)
**Execution authority:** [`documentations/TODO.md`](../../../TODO.md) owns milestone IDs, dependencies and completion status.
**Reconciled:** 2026-09-12

## 0. Authority and scope

This file previously carried a full second copy of the canonical master plan. Two independently editable copies of the same canonical lifecycle existed, and they had diverged: this copy was missing the canonical Client Workspace projection and still described a retired `Guided Discovery` step. That ambiguity is now removed.

Rules:

1. `documentations/dmd/product/DMD_PLATFORM_EXPANSION_MASTER_PLAN.md` is the single canonical source for purpose, the core DMD model, the canonical lifecycle, architectural invariants, product families, target-state objects, the M0–M12 milestone roadmap, dependency chain, implementation principles, acceptance criteria, the documentation map and the definition of success.
2. This file holds only current-application audit findings and implementation deltas measured against the existing codebase.
3. Do not restate canonical guidance here. Reference the canonical product document instead.
4. Where an audit finding contradicts the canonical product document, that is `evidence → decision → documentation update`: update the canonical document, do not fork it here.
5. Milestone IDs (`DMD-FND-*`, `DMD-WS-*`, `DMD-BI-*`, `DMD-PI-*`, `DMD-DES-*`, `DMD-COM-*`, `DMD-PROJECT-*`, `DMD-CONV-*`) are defined in `documentations/TODO.md` only. The historical M0–M12 roadmap in the canonical product document is the earlier planning numbering and is not a competing execution index.

## 1. Canonical content removed from this file

Sections 1–12 were byte-identical to the canonical master plan except for three places where this copy was **stale**, and are removed rather than maintained twice. They live in `documentations/dmd/product/DMD_PLATFORM_EXPANSION_MASTER_PLAN.md` at:

| Section | Canonical location |
|---|---|
| 1. Purpose | canonical master plan §1 |
| 2. Core DMD model (2.1–2.3) | canonical master plan §2 |
| 3. Canonical DMD lifecycle | canonical master plan §3 |
| 3.1 Client Workspace — canonical lifecycle projection | canonical master plan §3.1 — **was absent from this copy** |
| 4. Architectural invariants (4.1–4.7) | canonical master plan §4 |
| 5. Product families (5.1–5.3) | canonical master plan §5 |
| 6. Target state objects | canonical master plan §6 |
| 7. Milestone roadmap (M0–M12) | canonical master plan §7 |
| 8. Milestone dependency chain | canonical master plan §8 — this copy lacked `DMD-WORKSPACE-0 shell → Entry` |
| 9. Implementation principles (9.1–9.4) | canonical master plan §9 — this copy still read `→ Guided Discovery` instead of `→ Living Understanding → Advisory Brainstorming` |
| 10. Acceptance criteria | canonical master plan §10 |
| 11. Documentation map | canonical master plan §11 |
| 12. Definition of success | canonical master plan §12 |

No unique content was lost in that removal. The audit-specific material this file did own is preserved below in full.

## 2. Audit-specific source documents

The current-app audit used the sources below. Their taxonomy now records whether they remain active inputs or historical evidence:

- `documentations/dmd/audits/current-system/DMD_CURRENT_APP_ARCHITECTURE_AUDIT.md` — audit evidence;
- `documentations/dmd/ai/DMD_AI_ORCHESTRATION_MODEL_ROUTING.md` — active domain contract;
- `documentations/dmd/domains/project-intelligence/DMD_PROJECT_INTELLIGENCE_TICKETING_CHANGE_CONTROL_V2.md` — active supporting contract;
- `documentations/dmd/architecture/DMD_REPO_DB_ENGINEERING_HANDOFF.md` — active architecture contract;
- `documentations/dmd/execution/DMD_FRONTEND_BACKEND_IMPLEMENTATION_MAP.md` — active execution companion;
- `documentations/dmd/architecture/DMD_SECURITY_RELIABILITY_GATES.md` — active architecture companion;
- `documentations/dmd/execution/foundation/DMD_EXTENSION_EXECUTION_PLAN_V2.md` — active foundation companion;
- `documentations/archive/dmd/superseded-architecture/DMD_EXTENSION_TARGET_ARCHITECTURE.md` — archived, replaced by binding Architectural Rules;
- `documentations/archive/dmd/superseded-flows/DMD_CLIENT_DISCOVERY_DESIGN_LEAD_FLOW_V2.md` — archived, replaced by canonical Client Workspace direction.

---

## 3. Current-application audit addendum — 2026-09-09

A repo audit was performed against `CikaDraza/DMDevelon` `main` at commit `4e75c893a6fa7b92cf57efca115faacc60c7f322`.

The audit changes implementation strategy but not the canonical lifecycle.

### Existing foundations to preserve

- versioned `ProjectProposal` lifecycle;
- `ClientProject` milestones/tasks/change history;
- Project Communication Hub;
- `ProjectItem` idea/problem/incident/decision model;
- chat → request/task/item handoff;
- central project permission policy;
- notification infrastructure;
- Mongo integration test environment.

### New implementation decisions

1. New extension endpoints do not keep growing the legacy catch-all route.
2. Landing gets a dedicated `/start` discovery flow; the new engine is not added inside `HomeClient.js`.
3. AI writes only structured proposals/commands; application/domain engines mutate canonical state.
4. Online API agents are separated from local Claude/Codex engineering execution.
5. Repository execution truth and DMD client/commercial truth have different authorities and are synchronized through versioned WorkOrder/Evidence contracts.
6. GitHub App/webhooks become the preferred automatic engineering evidence input.
7. Final pricing waits for AgentRun/DesignJob/infrastructure usage metering.
8. Scope pivot rule is a deterministic versioned ChangeAssessment, not an LLM percentage guess.

Detailed implementation documents are listed in `README.md`.

*(Preserved verbatim from this file's former §13; renumbered only.)*

---

## 4. Remaining reconciliation cleanup

Recorded explicitly rather than performed in this bounded pass:

- [ ] The audit addendum above is dated 2026-09-09 against `CikaDraza/DMDevelon` `main` @ `4e75c893a6fa7b92cf57efca115faacc60c7f322`. The current FND-3 baseline is `staging` @ `156790ac9e1765ede7b12bcb4ddf0ea93243c55d`. Re-verify the eight implementation decisions against the current baseline during DMD-FND-3 3I.
- [ ] Decision 2 (`/start` discovery flow) is now owned by `DMD-WORKSPACE-0` and `DMD-WS-1` in `documentations/TODO.md`. `/start` does not exist at the current baseline; see `documentations/dmd/audits/fnd-3/DMD_FND_3_PAGE_INVENTORY.md` §4.
- [ ] Decision 1 (no new branches in the legacy catch-all) is already a binding FND-3 invariant in `TODO.md`. Keep one statement, not two.
- [ ] `README.md` is referenced as the index of detailed implementation documents. Confirm that pointer still resolves during 3I.

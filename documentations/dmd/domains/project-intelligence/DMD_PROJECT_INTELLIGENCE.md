# DMD Project Intelligence — Proposals, Milestones, Tasks, Progress & Communication

**Status:** ACTIVE
**Authority:** canonical
**Owner domain:** Project Intelligence
**Supersedes:** —
**Superseded by:** —

**Parent:** `documentations/dmd/product/DMD_PLATFORM_EXPANSION_MASTER_PLAN.md`
**Primary milestone:** M11
**Existing foundation:** `ProjectRequest`, `ProjectProposal`, `ClientProject`, milestones/tasks, project messages and notifications.

---

## 1. Purpose

Project Intelligence treba da ukloni dupli administrativni rad tokom razvoja.

DMD već ima project/proposal/milestone osnovu. Novi sloj treba da omogući da:

- AI razume ceo kontekst projekta;
- proposal/scope draft nastaje iz verified business/product state-a;
- milestones/tasks mogu da se draftuju i menjaju kroz autorizovane komande;
- klijent dobija tačne odgovore iz canonical project state-a;
- poruke se klasifikuju kao pitanje, ideja, change request ili production requirement;
- projekat se ažurira iz stvarnih engineering dokaza.

---

## 2. Existing project model remains canonical

Ne praviti paralelan AI project model.

Canonical operativni objekti ostaju:

```text
ProjectRequest
ProjectProposal
ClientProject
Milestone
Task
ProjectMessage
Notification
```

Accepted proposal je commercial/scope snapshot.

Operational milestone/task state može da se razvija uz audit, ali accepted proposal ostaje nepromenjen.

---

## 3. Project Intelligence context

Agent/engine treba da može da čita:

```text
Verified Business State
Capability Model
Product Route Decision
Solution Blueprint
Selected Design
Commercial Configuration
accepted proposals
milestones
tasks
project messages
change requests
onboarding requirements
product instance references
engineering evidence
knowledge records
```

Nijedan pojedinačni chat transcript nije kompletan source of truth.

---

## 4. AI role

AI može:

- draftovati scope;
- draftovati proposal;
- predložiti milestones/tasks;
- sažeti status;
- pronaći relevantan accepted requirement;
- objasniti klijentu šta je završeno;
- klasifikovati novu poruku;
- pripremiti change proposal;
- predložiti project command.

AI ne sme:

- samostalno prihvatiti proposal;
- menjati accepted snapshot;
- brisati istorijski dogovor;
- označiti task complete bez odgovarajućeg event/evidence/actor pravila;
- menjati cenu bez komercijalne komande;
- obećati feature koji nije u scope-u.

---

## 5. Command model

AI radi kroz commands.

Primeri:

```text
createProposalDraft
reviseProposalDraft
sendProposal
requestProposalChanges
createMilestone
updateMilestone
cancelOrSupersedeMilestone
addTask
updateTask
moveTask
markTaskComplete
recordProgress
recordClientDecision
classifyClientMessage
createChangeProposalDraft
requestOnboardingInput
```

Svaka komanda mora proći:

```text
actor
+ ownership
+ lifecycle
+ scope rules
+ validation
→ mutation
→ audit/event
```

---

## 6. Destructive changes

Ako je milestone deo accepted proposal-a:

> „Obriši milestone“

ne znači fizički obrisati istoriju.

Mogući rezultat:

```text
cancelled
superseded
removed_from_execution
```

uz razlog i change history.

Accepted proposal snapshot ostaje isti.

---

## 7. Client communication center

Cilj je centralizovati komunikaciju bez obzira da li projekat pripada:

- DMD;
- Marysoll;
- P.DC;
- budućem product family-ju.

Project Intelligence treba da koristi isti project context i da klijent može pitati iz bilo kog povezanog project surface-a.

Primer pitanja:

> „Da li je login završen?“

Odgovor se generiše iz task/milestone/evidence stanja, ne iz generičkog LLM sećanja.

---

## 7.1 Pending decisions, notifications and asynchronous project review

Project communication is naturally asynchronous.

A client message does not require an immediate implementation commitment, commercial answer or final project decision.

The first responsibility is to understand and preserve the request correctly.

Example:

```text
client message
→ interpretation
→ project/scope/evidence lookup
→ classification
→ candidate action
→ policy/authority check
```

If the required formal action is already authorized by deterministic policy, the normal command flow may continue.

If the action requires project/admin/client authority, Project Intelligence must preserve it as pending review rather than inventing a decision.

Example:

```text
message:
"Add export of all appointments to Excel."

possible result:
change request candidate
→ accepted-scope lookup
→ impact assessment
→ pending project decision
→ notification
→ later formal Task / Change Proposal / rejection
```

The client may immediately receive an acknowledgement without receiving a false commitment:

> Zabeležio sam zahtev za export termina. Tim će proveriti kako se uklapa u trenutni scope i javićemo vam odluku.

This means “the request is understood and being reviewed”, not “the feature has been accepted”.

### Formalization boundary

The following remain separate:

```text
message understood
candidate action created
decision pending
decision resolved
formal project record created/updated
engineering execution started
```

A candidate incident, task, change request or proposal is not canonical project commitment merely because an AI agent produced it.

The existing project policy/command boundary remains authoritative.

### Pending decision state

Project Intelligence must be able to determine, directly or through a future bounded representation:

```text
source message/evidence
decision required
reason
decision owner/authority
requested time
affected project objects
blocked actions
unblocked actions
recommendation/options where useful
resolution
decidedBy
decidedAt
```

The exact database model is deferred until the implementation slice that owns it.

Do not create a parallel project-truth model only for AI decisions.

### Continue accepted work

A pending project decision blocks only dependent work.

Existing accepted work that does not depend on the unresolved decision may continue.

Engineering evidence may also continue to be collected and normalized while a decision is pending.

However, Project Intelligence must not:

- turn an unapproved candidate into accepted scope;
- create a commercial promise;
- change an accepted schedule;
- cross a security/architecture approval boundary;
- represent proposed work as committed work.

### Notification policy

Project Intelligence should use the existing `Notification` capability rather than inventing a separate AI notification system.

Notifications should progressively support importance and action semantics, including:

```text
information
action required
decision required
blocking decision
incident/security escalation
```

The exact channel policy is configurable.

A decision may initially appear in the project/in-app notification surface and, according to importance and policy, escalate through push, email or reminders.

Notification delivery must be idempotent/deduplicated enough to avoid repeated agent analysis generating repeated alerts for the same unresolved decision.

### Resolution

When the authorized decision arrives:

```text
decision
→ policy validation
→ canonical command / formal record where applicable
→ audit/evidence
→ unblock dependent work
→ client/project update
```

The agent resumes from canonical project context and the preserved source request.

The client should not need to repeat the original message.

### No artificial escalation

Project Intelligence must not send ordinary decisions to a human simply because a model is uncertain.

If accepted scope, project policy, product rules or existing canonical state already answer the question, the system applies those rules.

Human/team review is reserved for genuine authority, ambiguity, risk or judgment boundaries.

---

## 8. Requirement vs idea filtering

Klijenti često šalju ideje koje nisu deo produkcionog scope-a.

Project Intelligence treba da klasifikuje:

```text
question
idea
future_idea
production_requirement
change_request
bug_report
approval
rejection
asset/input
```

Primer:

> „Bilo bi lepo da jednog dana imamo AI voice.“

ne menja project scope.

Primer:

> „Ovo mora da bude dostupno pre produkcije i dogovorili smo ga u Fazi 2.“

može zahtevati lookup accepted proposal-a i eventualnu correction/command.

---

## 9. Change impact analysis

Kada klijent traži nešto novo:

1. proveri Verified Business State;
2. proveri Capability Model;
3. proveri selected Product;
4. proveri accepted scope;
5. proveri existing capability;
6. klasifikuj kao:
   - design/content refinement;
   - in-scope implementation clarification;
   - product configuration;
   - product extension;
   - new custom scope.

Tek onda pripremiti change proposal ili task.

---

## 10. Proposal drafting

Master proposal može koristiti:

- Solution Blueprint;
- Commercial Configuration;
- implementation estimate;
- milestone templates;
- known product capabilities.

AI draft nije accepted contract.

Lifecycle i dalje mora biti explicit.

---

## 11. Milestone/task planning

Planner može da predlaže:

```text
phase
milestone
objective
dependencies
tasks
acceptance criteria
evidence requirements
```

Task treba po mogućnosti da zna koji dokaz očekuje:

```text
commit
test
build
browser QA
client approval
migration dry-run
deployment verification
```

To kasnije omogućava Evidence Engine-u automatsko ažuriranje.

---

## 12. Project status answers

Client answer mora moći da razlikuje:

```text
planned
in_progress
implemented
verified
accepted
blocked
```

„Kod je napisan“ nije isto što i „milestone je završen“.

Primer:

```text
implementation complete
tests green
browser acceptance pending
```

Status ostaje `in_progress/verification_pending`.

---

## 13. Onboarding communication

Project Intelligence može da šalje konkretne zahteve:

- domen;
- email;
- telefon;
- logo;
- DB export;
- Google account;
- Zoho;
- Resend;
- Clerk;
- Railway;
- MongoDB;
- Instagram;
- calendar;
- druge integracije.

Zahtev se kreira iz `OnboardingRequirement`, ne iz slobodne improvizacije.

---

## 14. Cross-project context

Ako jedan klijent ima više povezanih product instance/projekata, Project Intelligence može imati organizacioni overview.

Ali:

- tenant/project ownership se poštuje;
- context ne sme procureti između nepovezanih klijenata;
- product-specific secrets nisu deo generalnog chat konteksta.

---

## 15. Tasks

### PJ-1 — Project context assembler

- canonical refs;
- accepted scope;
- current operations;
- product state references.

### PJ-2 — Message classifier

- question/idea/change/etc.;
- confidence;
- user correction.

### PJ-3 — Proposal drafting

- Blueprint → proposal;
- versioning;
- admin review.

### PJ-4 — Milestone/task planner

- dependencies;
- acceptance criteria;
- evidence needs.

### PJ-5 — AI command gateway

- allowed commands;
- authorization;
- confirmation policy;
- audit.

### PJ-6 — Client Q&A

- retrieval from project state;
- source references internally;
- no unsupported promises.

### PJ-7 — Change impact

- in-scope vs new scope;
- product extension;
- change proposal.

### PJ-8 — Cross-product communication

- DMD/Marysoll/P.DC project context;
- ownership boundaries;
- unified notification center.

---

## 16. Acceptance criteria

1. AI odgovor o projektu dolazi iz canonical state-a.
2. Accepted proposal se ne menja kroz task edit.
3. Ideja ne postaje produkcijski task bez odluke.
4. Scope change prolazi change-impact klasifikaciju.
5. AI može pripremiti command, ali engine autorizuje mutation.
6. Destructive action čuva istoriju.
7. Onboarding zahtev nastaje iz tracked requirement-a.
8. Isti project context može služiti DMD/Marysoll/P.DC surfaces bez cross-client curenja.

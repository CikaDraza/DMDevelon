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

# DMD Current Application Architecture Audit

**Repository:** `CikaDraza/DMDevelon`  
**Audited branch:** `main`  
**Audited commit:** `4e75c893a6fa7b92cf57efca115faacc60c7f322` — `NEW EXTRA SERVICES, Code review`  
**Audit date:** 2026-09-09  
**Purpose:** Establish the real baseline before implementing DMD Platform Expansion.

---

## 1. Executive conclusion

DMDevelon ne treba prepisivati i ne treba praviti novu paralelnu aplikaciju.

Postojeća aplikacija već ima nekoliko vrlo vrednih domena koji su direktno kompatibilni sa budućim DMD Project Intelligence slojem:

- `ProjectRequest`;
- versioned `ProjectProposal` lifecycle;
- `ClientProject` sa phase-linked milestones/tasks;
- milestone audit/change history;
- Project Communication Hub;
- `ProjectItem` za `idea | problem | incident | decision`;
- chat → formal request/task/item handoff;
- project membership i centralnu permission politiku;
- notification/push/email infrastrukturu;
- integration test setup sa pravim route handlerima i Mongo replica-set test bazom.

Najveća promena nije zamena project sistema, već dodavanje slojeva koji trenutno ne postoje:

```text
Business Intelligence
→ Product Intelligence
→ Design Intelligence / Design Engine orchestration
→ Commercial + Provisioning
→ Evidence-driven Project Intelligence
```

Najveći tehnički rizik je da se novi sistem samo doda u postojeće velike frontend/backend fajlove. To bi vrlo brzo pretvorilo DMD u monolit koji je teško menjati i testirati. Ekspanziju zato treba uraditi kao **modularni monolit sa jasnim domain/application/infrastructure granicama**, bez prerane mikroservisne podele.

---

## 2. Real current stack

Repo dokumentacija trenutno nije potpuno usklađena sa kodom. README još opisuje stariji Next.js baseline, dok `package.json` već koristi noviju Next.js verziju i ima znatno razvijeniji chat/project sistem.

Aktuelni važni delovi stack-a:

- Next.js App Router;
- React;
- MongoDB + Mongoose;
- TanStack React Query;
- Axios;
- Tailwind CSS;
- Framer Motion;
- JWT access + refresh session model;
- Resend/email;
- Web Push / VAPID;
- Cloudinary;
- Zod;
- Vitest + Testing Library;
- MongoDB transaction-capable integration tests.

### Consequence

Pre M1 implementacije novi documentation set mora postati canonical arhitektonski dokument, a README/TODO treba kasnije uskladiti sa stvarnim stanjem.

---

## 3. Existing assets that should be preserved

### 3.1 ProjectProposal is already the correct commercial/scope aggregate

`models/ProjectProposal.js` već poseduje:

- `master | phase`;
- `phaseNumber` / `phaseLabel`;
- scope, timeline i budget;
- `draft | sent | changes_requested | accepted | rejected | archived` lifecycle;
- versioning/revision history;
- milestone plan snapshot;
- provenance sa chat item-a;
- lifecycle timestamps;
- optimistic concurrency;
- uniqueness po projektu/fazi.

**Decision:** Ne uvoditi `AIProposal`, `ChangeProposalAI` ili paralelni proposal model. AI pravi draft/command nad postojećim `ProjectProposal` domenom.

### 3.2 ClientProject is already the correct operational aggregate

`models/ClientProject.js` već ima:

- proposal-linked milestones;
- tasks;
- `githubBranch`;
- `workStartedAt` safety marker;
- milestone revision/change history;
- request linkage;
- events;
- optimistic concurrency.

**Decision:** Project Intelligence proširuje ovaj sistem evidence/dependency/status projekcijama. Ne pravi novu kopiju project plan-a.

### 3.3 Chat already distinguishes communication from formal project truth

`ChatMessage.flag` već podržava:

```text
request
task
idea
problem
incident
decision
```

Poruka može da se konvertuje u formalni resurs, a `ProjectItem` već predstavlja trajnu evidenciju za:

```text
idea
problem
incident
decision
```

Postoji i `HandoffDialog` koji eksplicitno razlikuje:

- task unutar već prihvaćenog scope-a;
- novi rad koji postaje draft nove phase proposal-a.

**Decision:** AI ticketing mora da sedne na ovaj model. Ne uvoditi Jira-like paralelni ticket aggregate osim ako kasniji zahtev dokaže da `ProjectItem` više nije dovoljan.

### 3.4 Authorization foundation is strong

`lib/project-access.js` već centralizuje:

```text
user + project facts
→ role
→ permissions
→ resource access
```

i razlikuje:

- 404 kada korisnik nema odnos sa projektom;
- 403 kada odnos postoji ali konkretna dozvola ne postoji.

**Decision:** Novi AI/project endpoints moraju koristiti istu resource-first authorization filozofiju. Agent nikada nije authorization authority.

### 3.5 Notifications can be reused

Postoje:

- notification records;
- deep links;
- proposal/milestone/channel refs;
- dedupe key;
- email digest;
- push delivery.

To je dovoljna osnova za:

- onboarding input requests;
- design ready notifications;
- ticket/status updates;
- proposal/change approval;
- provisioning dependency alerts.

### 3.6 Test foundation is usable

`vitest.workspace.mjs` već ima:

- real API integration tests;
- isolated Mongo replica set;
- UI tests;
- transaction-capable environment.

Novi domain engines treba da dobiju čist unit test sloj, a state-changing endpoints integration testove u istom stilu.

---

## 4. Current gaps against the new canonical DMD lifecycle

| Target stage | Current DMD | Gap |
|---|---|---|
| DMDevelon Entry | Landing + authenticated Start Project modal | Nema lead/discovery workspace pre običnog request-a |
| Guided Business Discovery | title + free description | Nema adaptive structured intake-a |
| Verified Business State | ne postoji | Potreban versioned verified state |
| Capability Model | ne postoji | Potrebni capability registry + derivation |
| Product Routing | ne postoji | Marysoll/P.DC/Custom contracts + deterministic fit |
| Solution Blueprint | ne postoji | Potreban canonical solution spec |
| Design Strategy | samo postojeći portfolio/design UI | Potreban product-aware strategy contract |
| Design Candidates | ne postoji | Potreban generation job + structured candidate renderer |
| Client Selection | proposal UI postoji, design selection ne | Potrebne design revisions/approval |
| Commercial Model | hardcoded landing tiers + proposal budget | Potrebno razdvajanje product subscription / engineering / proposal |
| Provisioning | ručno | Potrebni requirements + plan + adapters |
| Product Instance | ne postoji kao DMD aggregate | Potrebna external product instance reference |
| Project Intelligence | jaka baza | Potrebni AI classifier/Q&A/commands/change analysis |
| Evidence lifecycle | uglavnom manual status | Potrebni GitHub/CI/docs evidence + projection |

---

## 5. Frontend findings

### 5.1 Landing is already server-fed but HomeClient is too broad

`app/page.js` dobro radi server-side data read i cache/revalidation. To treba zadržati.

Problem je što `components/pages/HomeClient.js` nosi veliki broj odgovornosti:

- navigation;
- hero;
- about;
- hardcoded pricing;
- services;
- projects;
- code-review offers;
- auth UI;
- contact flow;
- animations.

**Do not add Discovery Engine here.**

Refactor cilj:

```text
app/page.js
  ↓
landing server sections
  ├─ Hero
  ├─ HowDmdWorks
  ├─ ProductExamples
  ├─ ExistingWork
  ├─ CommercialExplanation
  └─ DiscoveryCTA
```

Interaktivni discovery ide na posebnu rutu.

### 5.2 Current project intake is too small for new product

Trenutni request flow šalje praktično:

```json
{
  "title": "...",
  "description": "..."
}
```

To je dobar legacy/manual request fallback, ali nije novi DMD entry.

**Decision:** `ProjectRequest` se više ne kreira na prvom submit-u novog flow-a. Pre njega postoji `DiscoverySession`. ProjectRequest nastaje tek kada korisnik sačuva/pošalje dovoljno definisan rezultat ili se registruje.

### 5.3 Project progress is currently simplistic

Dashboard računa progress kao:

```text
completed tasks / total tasks
```

To nije dovoljno za evidence-driven lifecycle.

Budući progress mora razlikovati:

```text
planned
ready
in progress
blocked
implemented
verified
accepted
```

Legacy `status` može ostati radi kompatibilnosti, a novi `ProjectProgressProjection` računa client-safe status iz task state + evidence policy-ja.

### 5.4 Project detail is already rich — extend, do not replace

`app/dashboard/projects/[id]/page.js` već ima:

- project status;
- proposals;
- proposal deep links;
- milestone timeline;
- milestone chat;
- admin milestone/proposal edit flow;
- notification handling.

Novi project workspace treba postepeno da doda:

```text
Overview
Work plan
Tickets / Decisions
Inputs & onboarding
Proposals
Engineering status
AI assistant
```

bez rušenja postojećih deep-linkova.

---

## 6. Backend findings

### 6.1 The catch-all API has reached its architectural limit

`app/api/[[...path]]/route.js` je istorijski centralni backend. Communication Hub je već morao da uvede `route-match.mjs` zato što long if-chain postaje rizičan.

To je signal da **novi DMD engine API ne sme nastaviti istu šemu**.

Ne treba odmah migrirati sve stare endpoint-e. Umesto toga:

```text
legacy endpoints
→ ostaju u catch-all-u

new DMD expansion endpoints
→ dedicated Next route handlers
→ thin transport layer
→ application services
→ domain engines
```

### 6.2 Pure domain module pattern already exists

Dobri postojeći uzori:

- `lib/chat-domain.mjs`;
- `lib/project-proposal-domain.mjs`;
- serializers;
- `lib/project-access.js`.

Novi engines treba da nastave taj princip, ali organizovanije po bounded context-u.

### 6.3 Audit enum is currently too narrow

`ProjectAuditLog` je prvenstveno razvijen za member/chat događaje.

Treba proširiti auditing koncept za:

- AI command proposal;
- AI command applied/rejected;
- verified business state;
- route decision;
- design selection;
- scope delta decision;
- onboarding requirement satisfied;
- GitHub evidence ingested;
- automatic project status projection;
- manual override sa razlogom.

Poželjno je kasnije preći sa jednog uskog enum-a na versioned event catalog.

---

## 7. Security / reliability findings to close before AI write access

### P0-A — JWT secret must fail closed

`lib/auth.js` trenutno ima fallback vrednost za `JWT_SECRET`.

Production extension mora da odbije start kada obavezni secret nije postavljen. Nema default production secret-a.

### P0-B — Browser token storage needs a hardening plan

Access token se trenutno čuva u `localStorage`. To povećava blast radius XSS-a.

Ne mora blokirati ceo projekat migracijom auth sistema, ali pre nego što DMD počne da obrađuje privatne business informacije, DB exporte i integration setup, treba definisati jedan od puteva:

1. short-lived access token samo u memory + httpOnly refresh cookie; ili
2. cookie/BFF session sa CSRF zaštitom.

### P0-C — Production CORS must be explicit

Authenticated/AI endpoints ne treba da koriste wildcard production CORS. Uvesti explicit allowed-origin policy.

### P0-D — Private assets cannot follow the old public-URL assumption

Javne portfolio slike mogu ostati javne.

Ali sledeći asset-i moraju imati private delivery policy:

- DB export;
- credentials/onboarding documents;
- contracts;
- client-only design assets;
- internal repo reports;
- private source screenshots.

### P0-E — AI provider keys never go to browser

"AI radi na frontu" znači interaktivni frontend, ne browser-to-provider API.

Browser:

```text
UI → DMD API
```

Server/workflow:

```text
DMD API → provider adapter → model API
```

---

## 8. Pricing finding

Current landing has hardcoded tiers in `HomeClient.js`.

Since final pricing depends on:

- provider token cost;
- design-generation cost;
- storage;
- workflow/job cost;
- human/premium design work;
- product infrastructure;
- DMD engineering commitment;

pricing should **not** be revised before usage metering exists.

Target:

```text
PlanDefinition
UsageLedger
CostBasisSnapshot
CommercialRecommendation
```

Landing reads a catalog/config, not hardcoded `PRICING_TIERS`.

Until new plans are decided, current prices are legacy presentation data, not architecture.

---

## 9. Preserve / refactor / replace matrix

### Preserve

- ProjectRequest as formal submitted request;
- ProjectProposal lifecycle;
- ClientProject;
- milestone/task linkage;
- ProjectItem;
- ChatChannel/ChatMessage;
- project access policy;
- notification infrastructure;
- React Query patterns;
- integration test environment;
- current dark DMD visual language.

### Refactor incrementally

- `HomeClient.js` → landing sections;
- `app/dashboard/page.js` → smaller dashboard surfaces;
- `app/dashboard/projects/[id]/page.js` → project workspace panels/routes;
- catch-all API → legacy adapter + dedicated new APIs;
- project progress → derived projection;
- audit logging → broader event catalog;
- auth/CORS/private asset policy.

### New domains

- DiscoverySession;
- VerifiedBusinessState;
- CapabilityModel;
- ProductDefinition/ProductRouteDecision;
- SolutionBlueprint;
- DesignStrategy/DesignJob/DesignCandidate;
- ApprovedDesignRevision;
- CommercialConfiguration + usage metering;
- OnboardingRequirement;
- ProvisioningPlan/Run/ProductInstanceReference;
- AgentRun/AI command proposals;
- ChangeAssessment;
- ProjectEvidence/EngineeringProjection;
- GitHub integration mapping;
- WorkOrder/Handoff contract.

---

## 10. Audit verdict

The current DMD application is a **good project-management nucleus**, not yet the new DMD operating system.

The correct extension strategy is:

> Preserve project/commercial/chat foundations, modularize new backend work, add a dedicated discovery/design client flow, and make repository evidence drive project execution truth.

Do not rebuild what already works. Do not put the new system into `HomeClient.js` or the giant catch-all API. Do not allow AI to mutate current models directly.

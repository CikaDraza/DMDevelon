# DMD Platform Expansion — Discovery, Product Routing & Design Engine & Client Flow

**Status:** Architecture / implementation roadmap  
**Date:** 2026-09-09  
**Foundation:** `DMD_DESIGN_ENGINE_PRINCIPLES.md`

---

## 1. Purpose

Ovaj dokument definiše sledeću veliku ekspanziju DMDevelon platforme.

Cilj nije da DMD postane još jedan AI website builder, već operativni sistem koji:

1. razume šta klijent stvarno želi da postigne;
2. prevodi neprecizan poslovni jezik u verifikovano poslovno stanje;
3. izvodi capability model;
4. pronalazi odgovarajući postojeći proizvod ili odlučuje da je potreban custom proizvod;
5. generiše solution blueprint i design strategiju;
6. prikazuje klijentu više validnih design kandidata;
7. povezuje izbor sa komercijalnim modelom i provisioning planom;
8. kreira product instance;
9. otvara i vodi DMD engineering projekat;
10. održava istinito stanje projekta iz dokaza nastalih tokom stvarnog razvoja.

DMD treba da skrati put od:

> „Mislim da mi treba sajt/platforma/aplikacija.“

do:

> „Ovo je poslovni problem koji rešavamo, ovo su capability-ji koji su potrebni, ovo je odgovarajući proizvod, ovo je dizajn, ovo je cena i ovo je plan isporuke.“

---

## 2. Core DMD model

DMD ima tri glavna intelligence domena:

```text
                 DMD
                  │
     ┌────────────┼────────────┐
     │            │            │
 Business      Product       Project
Intelligence  Intelligence  Intelligence
     │            │            │
 discovery      routing       proposals
 understanding blueprint      milestones
 requirements  design         tasks
               provision      progress
                              communication
```

### 2.1 Business Intelligence

Odgovara na pitanje:

> Šta ovaj biznis stvarno radi, kome služi, koji problem rešava i šta digitalni proizvod mora da omogući?

Glavne odgovornosti:

- guided discovery;
- extraction strukturisanih činjenica;
- razumevanje audience, offer, operations, trust, conversion i constraints;
- completeness/confidence;
- verifikovano business state stanje;
- razdvajanje želja, ideja i produkcionih zahteva.

### 2.2 Product Intelligence

Odgovara na pitanje:

> Koji proizvod i koja konfiguracija najbolje rešavaju verifikovani poslovni problem?

Glavne odgovornosti:

- Capability Model;
- Product Catalog;
- Product Fit / Routing;
- Solution Blueprint;
- Design Strategy;
- Design Engine orchestration;
- Design Candidates;
- Client Selection;
- Commercial Model;
- Provisioning Plan;
- Product Instance lifecycle.

### 2.3 Project Intelligence

Odgovara na pitanje:

> Šta je dogovoreno, šta je urađeno, šta je trenutno stanje i šta sledeće treba uraditi?

Glavne odgovornosti:

- proposals i scope;
- milestones;
- tasks;
- progress;
- change requests;
- client communication;
- onboarding dependencies;
- project truth;
- AI-assisted drafting i project operations;
- evidence-driven update projekta.

---

## 3. Canonical DMD lifecycle

```text
DMDevelon Entry
      ↓
Guided Business Discovery
      ↓
Verified Business State
      ↓
Capability Model
      ↓
Product Fit / Routing
      ↓
Solution Blueprint
      ↓
Design Strategy
      ↓
Design Engine
      ↓
Design Candidates
      ↓
Client Selection
      ↓
Commercial Model
      ↓
Provisioning Plan
      ↓
Product Instance
      ↓
DMD Engineering Project
      ↓
Project Intelligence
      ↓
Continuous Product + Engineering Lifecycle
```

Ovaj tok je canonical. Pojedini product route može preskočiti neke komercijalne ili engineering korake, ali ne sme preskočiti razumevanje biznisa i product fit odluku.

---

## 4. Architectural invariants

### 4.1 AI ne odlučuje sistemsko stanje

Canonical pravilo iz Design Engine foundation-a ostaje:

> **AI interprets. The system decides. The engine executes.**

AI:

- sluša;
- postavlja pitanje kada postoji razlog;
- prevodi prirodan jezik u strukturisane činjenice;
- klasifikuje;
- predlaže;
- sažima;
- draftuje.

AI ne sme samostalno:

- odobriti business state;
- proglasiti product fit;
- promeniti accepted scope;
- menjati subscription entitlement;
- mutirati canonical project state bez autorizovane komande;
- proglasiti task/milestone završenim bez dokaza ili eksplicitne akcije.

### 4.2 Korisnik opisuje nameru, ne arhitekturu

Klijent ne mora da zna razliku između:

- website;
- CRM;
- booking engine;
- marketplace;
- CMS;
- membership platform;
- learning platform;
- business OS.

DMD treba da razume šta korisnik želi da se dogodi i da to prevede u odgovarajući capability i product model.

IT nazivi mogu postojati kao shortcut za tehničke korisnike, freelancere i partnere, ali ne smeju biti preduslov za dobar rezultat.

### 4.3 Capability pre product route-a

DMD ne rutira direktno:

```text
client phrase → product
```

nego:

```text
verified business state
→ capability model
→ product fit
→ route decision
```

### 4.4 Existing product business model is invariant

Marysoll i P.DC se ne deformišu po jednom klijentu.

Klijentov zahtev se klasifikuje kao:

- `native`;
- `configurable`;
- `product_extension`;
- `incompatible/custom_required`.

Design i brand mogu biti individualni, ali core business model proizvoda ostaje stabilan.

### 4.5 Proposal, Product Subscription i Engineering Plan nisu ista stvar

Tri odvojena komercijalna objekta:

1. **Project Proposal** — kupuje dogovoreni scope/fazu;
2. **Product Subscription** — kupuje capability-je proizvoda;
3. **DMD Engineering Plan** — kupuje kontinuirani engineering capacity/support.

Njihovi lifecycle-i i entitlement pravila ne smeju biti spojeni u jedan model.

### 4.6 Project truth mora imati dokaz

Project state ne postaje istinit zato što je AI to zaključio.

Validni izvori dokaza uključuju:

- commit / PR;
- build/test rezultat;
- task completion event;
- phase/milestone event;
- dokumentaciju u repozitorijumu;
- structured output Claude/Codex rada;
- prihvaćenu klijentsku odluku;
- eksplicitnu admin akciju.

Tok:

```text
engineering evidence
      ↓
knowledge ingestion
      ↓
AI parsing / interpretation
      ↓
validated project command
      ↓
Project Engine
      ↓
canonical project state
      ↓
frontend
```

### 4.7 Connected products ostaju vlasnici svog domena

DMD orkestrira.

Marysoll, P.DC i budući proizvodi ostaju vlasnici:

- svojih business rules;
- feature/capability enforcement-a;
- tenant/product instance stanja;
- svojih operativnih podataka.

DMD ne kopira njihove domene u jedan god-model.

---

## 5. Product families — početni scope

### 5.1 Marysoll

Primary family:

> Service Business / Booking / Client Operations / Growth OS

Primeri capability-ja:

- public/private availability;
- booking;
- cenovnik;
- fixed/from/on-request pricing;
- service packages;
- clients/CRM;
- loyalty;
- marketing;
- analytics;
- business hours;
- staff/resource scheduling.

Klijent može imati potpuno drugačiji brand i presentation layer, ali poslovni model ispod ostaje Marysoll.

### 5.2 P.DC

P.DC se ne ograničava na mental health.

Radna šira kategorija:

> Expert / Knowledge / Learning Network Platform

Mogući verticals:

- terapeuti i klijenti;
- konsultanti i korisnici;
- predavači i učenici;
- 1:1 learning;
- creator/blog publishing;
- video/content membership;
- premium magazine/subscription;
- expert discovery;
- intake + matching;
- B2C i B2B knowledge/support platforme.

### 5.3 Custom Platform

Koristi se kada:

- postojeći product family ne podržava ključni business model;
- zahtev bi deformisao postojeći proizvod;
- potrebni capability-ji nisu generički product extension;
- proizvod zahteva zaseban architecture/runtime model.

`custom` nije template. To je poseban product route.

---

## 6. Target state objects

Minimalni novi domain objects koje arhitektura treba da uvede:

```text
DiscoverySession
VerifiedBusinessState
CapabilityModel
ProductDefinition
ProductRouteDecision
SolutionBlueprint
DesignStrategy
DesignCandidate
ApprovedDesignRevision
CommercialConfiguration
ProvisioningPlan
ProductInstanceReference
ProjectEvidence
ProjectKnowledgeRecord
ProjectStateCommand
OnboardingRequirement
```

Postojeći objekti koji ostaju važni:

```text
ProjectRequest
ProjectProposal
ClientProject
Milestone
Task
ProjectMessage
Notification
```

Ne praviti paralelne `BusinessProject`, `DesignProject`, `AIProject` agregate ako nisu potrebni.

---

## 7. Milestone roadmap

### M0 — Architecture Baseline & Contracts

**Cilj:** Zaključati invariants, domain boundaries, naming i verzionisane ugovore.

Ishodi:

- canonical lifecycle;
- Business/Product/Project Intelligence boundaries;
- command vs event vs evidence pravila;
- source-of-truth matrix;
- versioning policy;
- migration/backward compatibility plan.

Zavisnosti: postojeći DMD i `DMD_DESIGN_ENGINE_PRINCIPLES.md`.

---

### M1 — DMDevelon Entry & Discovery Session

**Cilj:** Uvesti novi ulaz koji ne tera korisnika da zna IT terminologiju.

Ishodi:

- project/product intent entry;
- basic intake;
- optional product-type shortcuts;
- `DiscoverySession`;
- attachments/links;
- guest-to-account continuation;
- resumable discovery.

---

### M2 — Guided Business Discovery

**Cilj:** Pretvoriti razgovor u strukturisani business state.

Ishodi:

- adaptive question engine;
- field completeness;
- ambiguity detection;
- follow-up questions;
- extraction;
- verified vs inferred facts;
- production requirement vs idea classification.

---

### M3 — Verified Business State & Capability Model

**Cilj:** Napraviti stabilnu granicu između onoga što je klijent rekao i product routinga.

Ishodi:

- business state schema;
- validation gate;
- confidence/completeness;
- capability derivation;
- hard vs optional capabilities;
- constraints;
- explicit unresolved items.

---

### M4 — Product Catalog & Routing Engine

**Cilj:** Deterministički odabrati Marysoll, P.DC ili Custom.

Ishodi:

- product registry;
- capability contracts;
- constraints;
- fit algorithm;
- `native/configurable/product_extension/custom_required`;
- auditable route decision;
- product version compatibility.

---

### M5 — Solution Blueprint

**Cilj:** Definisati šta se konkretno gradi za ovog klijenta.

Ishodi:

- selected product;
- included capabilities;
- excluded capabilities;
- data model needs;
- user roles;
- flows;
- integrations;
- content/brand requirements;
- conversion model;
- solution risks;
- extension requests.

---

### M6 — Design Strategy & Design Candidates

**Cilj:** Povezati Solution Blueprint sa postojećim Design Engine principima.

Ishodi:

- UX pattern selection;
- design grammar selection;
- design-system source material;
- brand configuration;
- multiple valid candidates;
- candidate validation;
- candidate preview.

---

### M7 — Client Selection & Revision Flow

**Cilj:** Omogućiti klijentu da bira i precizira dizajn bez narušavanja product modela.

Ishodi:

- candidate comparison;
- select;
- request refinement;
- immutable revision history;
- selected design revision;
- explicit client approval.

---

### M8 — Commercial Model

**Cilj:** Razdvojiti product subscription, engineering plan i proposal scope.

Ishodi:

- commercial configuration;
- plan recommendation;
- product subscription mapping;
- engineering plan mapping;
- master proposal generation;
- upgrade/extension rules;
- accepted commercial snapshot.

---

### M9 — Provisioning Plan & Onboarding Requirements

**Cilj:** Pre provisioning-a tačno znati šta je potrebno i ne blokirati development zbog zaboravljenih inputa.

Ishodi:

- provisioning plan;
- required client inputs;
- integration requirements;
- dependency graph;
- notifications;
- import/migration plan;
- plan-before-apply validation.

---

### M10 — Product Instance Provisioning

**Cilj:** Kreirati stvarni Marysoll/P.DC/custom instance kroz adaptere.

Ishodi:

- `MarysollProvisioner`;
- `PdcProvisioner`;
- `CustomPlatformProvisioner`;
- idempotency;
- verification;
- reconciliation;
- active product instance reference.

---

### M11 — DMD Project Intelligence

**Cilj:** Automatizovati project administration bez gubitka autoriteta sistema.

Ishodi:

- scope/proposal drafting;
- milestone/task drafting;
- client Q&A iz verified state-a;
- change impact;
- requirement/idea classification;
- project commands;
- approval rules;
- cross-product project context.

---

### M12 — Evidence, Knowledge & Continuous Lifecycle

**Cilj:** Project state automatski pratiti iz stvarnog engineering rada.

Ishodi:

- GitHub ingestion;
- docs ingestion;
- Claude/Codex structured engineering reports;
- build/test evidence;
- knowledge base;
- parser;
- evidence-to-command engine;
- frontend progress update;
- reconciliation;
- continuous product + engineering lifecycle.

---

## 8. Milestone dependency chain

```text
M0
 ↓
M1 → M2 → M3
           ↓
           M4 → M5 → M6 → M7
                       ↓
                       M8 → M9 → M10
                                      ↓
                                      M11 → M12
```

M11 može delimično početi pre M10 koristeći postojeće `ProjectRequest`, `ProjectProposal` i `ClientProject` objekte, ali puna integracija dolazi tek kada Product Intelligence ima stabilne reference.

---

## 9. Implementation principles

### 9.1 Vertical slices pre širokih engine-a

Svaki milestone treba da dokaže jedan end-to-end flow.

Primer prvog velikog vertical slice-a:

```text
Entry
→ DiscoverySession
→ Guided Discovery
→ VerifiedBusinessState
→ CapabilityModel
→ ProductRouteDecision
→ SolutionBlueprint
```

Tek zatim stvarna Design Candidate generacija.

### 9.2 Backward compatibility

Postojeći DMD projekti ne smeju prestati da rade.

Novi modeli treba da dozvole:

- legacy project bez DiscoverySession-a;
- legacy proposal;
- legacy milestone;
- naknadno povezivanje sa novim intelligence slojem.

### 9.3 Version everything that affects a decision

Čuvati verziju:

- business state schema;
- capability rules;
- product definition;
- routing rules;
- solution blueprint;
- design strategy;
- design candidate;
- commercial config;
- provisioning plan.

### 9.4 Audit decisions, not hidden reasoning

Ne čuvati privatni AI chain-of-thought.

Čuvati:

- normalized inputs;
- extracted facts;
- rule result;
- confidence/completeness;
- selected product;
- reasons/rule IDs;
- actor;
- timestamp;
- source references.

---

## 10. Acceptance criteria for the platform expansion

DMD Platform Expansion nije završen dok se ne može dokazati sledeći scenario:

1. novi klijent dolazi bez IT znanja;
2. kaže šta pokušava da uradi;
3. sistem vodi discovery bez ponavljanja poznatih pitanja;
4. kritične činjenice ostaju unresolved dok nisu jasne;
5. dobija se Verified Business State;
6. capability model se izvodi deterministički;
7. sistem bira Marysoll/P.DC/Custom sa objašnjivim route resultom;
8. Solution Blueprint prikazuje šta se gradi;
9. Design Engine generiše više kandidata unutar dozvoljenih product granica;
10. klijent bira ili traži refinement;
11. commercial model jasno odvaja subscription, engineering i proposal;
12. onboarding sistem traži samo nedostajuće podatke;
13. provisioning je planiran, validiran i idempotentan;
14. product instance nastaje i može se verifikovati;
15. DMD engineering project nastavlja iz istog konteksta;
16. Project Intelligence zna accepted scope, milestones, tasks i client discussion;
17. GitHub/docs/Claude/Codex/build evidence ažurira project truth kroz autorizovan engine;
18. frontend prikazuje isto canonical stanje koje bi prikazivao da je admin ručno unosio podatke.

---

## 11. Documentation map

Ovaj master dokument se razrađuje kroz:

- `DMD_BUSINESS_INTELLIGENCE_DISCOVERY.md`
- `DMD_PRODUCT_INTELLIGENCE_ROUTING_BLUEPRINT.md`
- `DMD_DESIGN_ENGINE_CLIENT_FLOW.md`
- `DMD_COMMERCIAL_PROVISIONING.md`
- `DMD_PROJECT_INTELLIGENCE.md`
- `DMD_EVIDENCE_KNOWLEDGE_INTEGRATIONS.md`
- `DMD_IMPLEMENTATION_MILESTONES_TASKS.md`

Foundation koji ostaje važeći:

- `DMD_DESIGN_ENGINE_PRINCIPLES.md`

Postojeći proposal/project rad ne zamenjuje se, već se proširuje.

---

## 12. Definition of success

DMD je uspešan kada klijent može da dođe sa nepreciznom poslovnom idejom, a sistem bez prebacivanja tehničke odgovornosti na njega može da:

- razume biznis;
- identifikuje šta je stvarno potrebno;
- prepozna postojeći proizvod;
- spreči deformisanje core product modela;
- pokaže relevantan dizajn;
- pripremi komercijalni i provisioning plan;
- vodi development;
- komunicira sa klijentom;
- održava istinito stanje projekta iz dokaza stvarnog rada.

To je cilj DMD platforme.

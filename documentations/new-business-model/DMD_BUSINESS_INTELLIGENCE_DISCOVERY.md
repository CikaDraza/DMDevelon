# DMD Business Intelligence — Guided Discovery & Verified Business State

**Parent:** `DMD_PLATFORM_EXPANSION_MASTER_PLAN.md`  
**Foundation:** `DMD_DESIGN_ENGINE_PRINCIPLES.md`  
**Primary milestones:** M1, M2, M3

---

## 1. Purpose

Business Intelligence je prvi intelligence domen DMD-a.

Njegov posao nije da pita klijenta „koju aplikaciju želi“, već da razume:

- šta biznis radi;
- ko su korisnici/kupci;
- šta kupuju ili pokušavaju da postignu;
- kako izgleda realan workflow;
- šta gradi poverenje;
- kako dolazi do conversion-a;
- koje operacije postoje iza javnog interfejsa;
- šta je obavezno, a šta je samo ideja;
- koje spoljne sisteme i podatke klijent već ima.

Rezultat nije chat transcript.

Rezultat je `VerifiedBusinessState`.

---

## 2. Entry model

Početni ulaz treba da bude jednostavan.

Mogući inputi:

- „Želim sajt“;
- „Treba mi platforma“;
- „Hoću CRM“;
- „Treba mi booking“;
- „Nisam siguran“;
- tehnički shortcut iz product/application cards;
- slobodan opis;
- link ka postojećem sajtu/profilu;
- slike/reference;
- postojeća dokumentacija.

Cards pomažu korisniku, ali ne predstavljaju route decision.

---

## 3. DiscoverySession

Predloženi domain object:

```text
DiscoverySession {
  id
  actorRef?
  organizationRef?
  status
  entryIntent
  rawInputs[]
  attachments[]
  sourceLinks[]
  conversationRef

  businessStateDraft
  unresolvedItems[]
  extractedFacts[]
  inferredFacts[]
  rejectedInferences[]

  completeness
  confidence

  createdAt
  updatedAt
  convertedAt?
}
```

Predloženi lifecycle:

```text
started
→ in_discovery
→ awaiting_client
→ ready_for_verification
→ verified
→ converted

            ↘ abandoned
            ↘ expired
```

Session mora biti resumable.

---

## 4. Business state schema

Početni canonical sections:

```text
business
audience
offer
services_or_products
methodology_or_process
conversion
trust
content
operations
roles
data
integrations
brand
growth_goals
constraints
commercial_context
```

Svako polje ili grupa treba da razlikuje:

- `unknown`;
- `inferred`;
- `client_stated`;
- `verified`;
- `conflicted`;
- `not_applicable`.

Primer:

```json
{
  "conversion.primary": {
    "value": "consultation_request",
    "status": "verified",
    "sourceRefs": ["conversation:msg_42"]
  }
}
```

---

## 5. AI behavior

AI može:

- prepoznati da je odgovor već dat;
- izvući više činjenica iz jednog odgovora;
- postaviti sledeće najkorisnije pitanje;
- dati primer kada korisnik ne razume pitanje;
- preformulisati non-IT odgovor u canonical field;
- označiti kontradikciju;
- predložiti interpretaciju korisniku.

AI ne sme:

- proglasiti `verified` samo zato što je interpretacija verovatna;
- izmišljati nedostajuće business činjenice;
- popunjavati kritične capability inpute bez izvora;
- tretirati ideju kao accepted production requirement.

---

## 6. Intent-sensitive listening

AI sloj ne treba stalno da interveniše.

Princip:

> Sluša kada treba i deluje kada postoji namera ili nedostatak koji blokira sledeću odluku.

Primeri namere:

- klijent odgovara na discovery pitanje;
- klijent ispravlja prethodnu činjenicu;
- klijent kaže „ovo mora da postoji“;
- klijent kaže „ovo je samo ideja“;
- klijent pita „šta još treba od mene“.

Sistem treba da izbegava nepotrebno ispitivanje.

---

## 7. Requirement classification

Svaka relevantna poruka može sadržati:

```text
production_requirement
future_idea
question
preference
constraint
bug_report
change_request
business_fact
asset_or_input
```

Ovo je posebno važno kasnije u Project Intelligence-u, jer veliki deo klijentske komunikacije predstavlja ideje, a ne dogovorenu produkciju.

Primer:

> „Bilo bi lepo kasnije da korisnici imaju forum.“

ne sme automatski postati:

```text
required_capability = community_forum
```

nego:

```text
future_idea = community_forum
```

---

## 8. Completeness / Understanding Gate

Business Intelligence mora imati eksplicitni gate.

Primer:

```text
primary_audience       complete
primary_offer          complete
conversion_goal        complete
operations             partial
existing_data          unknown
compliance_constraint  not_applicable
```

Gate pravila treba da budu product-category aware.

Nije svaki podatak kritičan za svaki business model.

Primer:

- booking business zahteva availability/operation podatke;
- publishing business zahteva content/access/revenue podatke;
- marketplace zahteva najmanje dve actor strane i matching/discovery model.

---

## 9. Verification

`VerifiedBusinessState` nastaje kada:

1. kritična polja prolaze completeness pravila;
2. konflikti su rešeni ili eksplicitno zabeleženi;
3. inferred facts nisu predstavljeni kao client-stated;
4. unresolved non-blocking items ostaju vidljivi;
5. state dobija verziju.

Predlog:

```text
VerifiedBusinessState {
  id
  discoverySessionId
  version
  schemaVersion
  facts
  unresolvedItems
  completenessReport
  verifiedAt
  verifiedBy
}
```

`verifiedBy` može označavati sistemski gate/actor, ne AI autoritet.

---

## 10. Migration / existing business data discovery

Discovery mora rano otkriti:

- postoji li postojeći sistem;
- postoji li DB;
- format podataka;
- ownership/access;
- export mogućnost;
- približna količina;
- privacy/sensitivity;
- obavezni historical records;
- potreba za migration-om.

Ne treba odmah tražiti sve credentials.

Prvo se formira `DataMigrationNeed`, a detaljni zahtev ide u provisioning/onboarding fazi.

---

## 11. Client UX

Klijent treba da ima osećaj razgovora, ne enterprise questionnaire-a.

Frontend može prikazivati:

- razgovor;
- „Razumeli smo“ summary;
- nedostajuće ključne stvari;
- ispravku činjenice;
- progress po oblastima;
- upload/reference akcije.

Ne treba mu prikazivati interne termine poput `trust_dependency`, osim u expert/technical modu.

---

## 12. API / command concept

Predložene operacije:

```text
startDiscovery
addDiscoveryInput
recordClientFact
recordReference
requestClarification
resolveConflict
markNotApplicable
verifyBusinessState
convertDiscoveryToProjectRequest
```

AI ne poziva DB update direktno; poziva validirane application commands.

---

## 13. Tasks

### BI-1 — Entry contract

- definisati entry intent schema;
- cards kao hints, ne final route;
- free-text entry;
- links/attachments;
- guest continuation.

### BI-2 — DiscoverySession persistence

- model;
- lifecycle;
- ownership;
- expiry;
- resume;
- audit metadata.

### BI-3 — Business state schema v1

- sections;
- field statuses;
- source refs;
- conflict support;
- schema version.

### BI-4 — Adaptive question policy

- next-question selection;
- no-repeat logic;
- clarification;
- examples;
- stop conditions.

### BI-5 — Requirement classification

- production vs idea;
- preference vs constraint;
- question/change request;
- correction handling.

### BI-6 — Understanding Gate

- required-field profiles;
- completeness;
- blocking vs non-blocking unknowns;
- verification command.

### BI-7 — Conversion

- `DiscoverySession → ProjectRequest`;
- preserve source refs;
- preserve verified state reference;
- backward compatibility.

---

## 14. Acceptance criteria

Business Intelligence je spreman kada:

1. korisnik može da uđe sa „treba mi sajt“;
2. DMD ne prihvata to kao architecture decision;
3. discovery razume stvarni workflow;
4. ne ponavlja već odgovorena pitanja;
5. razlikuje činjenicu od pretpostavke;
6. razlikuje ideju od production requirement-a;
7. nedostajuće kritične informacije blokiraju verification, ne generišu se;
8. VerifiedBusinessState ima source references i verziju;
9. state može biti input Capability Engine-u;
10. legacy DMD request flow ostaje funkcionalan.

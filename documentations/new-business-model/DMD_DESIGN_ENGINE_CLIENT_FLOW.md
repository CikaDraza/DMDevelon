# DMD Product Intelligence — Design Strategy, Design Engine & Client Selection

**Parent:** `DMD_PLATFORM_EXPANSION_MASTER_PLAN.md`  
**Foundation:** `DMD_DESIGN_ENGINE_PRINCIPLES.md`  
**Primary milestones:** M6, M7

---

## 1. Purpose

Ovaj dokument povezuje postojeći DMD Design Engine foundation sa novim Product Intelligence tokom.

Design Engine ne dobija raw prompt klijenta.

Canonical input:

```text
Verified Business State
      +
Capability Model
      +
Product Route Decision
      +
Solution Blueprint
      ↓
Design Strategy
      ↓
Design Engine
      ↓
Design Candidates
```

---

## 2. Design boundary

Design ne sme menjati:

- Marysoll booking semantics;
- P.DC actor/matching semantics;
- pricing authority;
- subscription entitlement;
- access-control model;
- provisioning topology;
- accepted capability model.

Design može menjati:

- information hierarchy unutar dozvoljene UX grammar;
- layout;
- theme expression;
- color;
- typography;
- photography;
- motion;
- content presentation;
- density;
- CTA visual treatment;
- responsive composition.

---

## 3. Design Strategy

Predloženi object:

```ts
DesignStrategy {
  id
  solutionBlueprintId
  version

  uxPattern
  informationHierarchy[]
  conversionPriority
  trustPriority

  designGrammarRefs[]
  designSystemRefs[]
  allowedPrimitives
  prohibitedPatterns[]

  brandConfiguration
  responsivePolicy
  accessibilityPolicy

  candidateCount
}
```

System bira UX obrazac na osnovu structured business/product state-a.

AI može pomoći u:

- copy/brand interpretation;
- visual tone mapping;
- image strategy;
- content strategy.

---

## 4. Design source material

Postojeći DMD reference systems mogu biti source material:

- Marysoll;
- Mobile-First Admin;
- Psihointegritet;
- P.DC/Sanja variation;
- English Tutor;
- Lash Room Y2K;
- budući validirani sistemi.

Cilj nije kopiranje template-a, već izvlačenje:

- primitives;
- grammar;
- composition rules;
- brand expression patterns.

---

## 5. Design Candidate

```ts
DesignCandidate {
  id
  designStrategyId
  revision
  status

  candidateKey
  rationaleSummary

  primitiveConfig
  grammarConfig
  brandConfig
  layoutPlan
  contentPlan

  previewRef
  validationReport
  generatedAt
}
```

Candidate status:

```text
draft
→ validated
→ presented
→ selected

       ↘ rejected
       ↘ superseded
```

---

## 6. Candidate validation

Pre prikaza klijentu kandidat mora proći:

- required sections/flows;
- capability/UI consistency;
- responsive rules;
- accessibility baseline;
- product constraints;
- conversion hierarchy;
- no fabricated business facts;
- no unsupported feature representation.

Ako candidate vizuelno prikazuje feature koji product nema, candidate je nevalidan.

---

## 7. Client Selection flow

Predloženi tok:

```text
Candidate A
Candidate B
Candidate C
      ↓
compare / preview
      ↓
select
OR
request refinement
      ↓
new candidate revision
      ↓
explicit approval
```

Klijent bira dizajn, ne core business architecture.

---

## 8. Refinement classification

Klijent feedback se mora klasifikovati.

### Design refinement

Primer:

> „Hoću tamniju hero sekciju i manje fotografije.“

Ide nazad Design Engine-u.

### Content refinement

Primer:

> „Ovu metodologiju želim pre usluga.“

Može uticati na content hierarchy ako UX rules dozvoljavaju.

### Business requirement change

Primer:

> „Hoću da se sada registruju i drugi saloni kod mene.“

To nije design refinement.

Vraća se u:

```text
Business/Product change evaluation
→ CapabilityModel revision
→ Product routing impact
```

Ova granica sprečava da se business-model promena sakrije u dizajnerskom feedback-u.

---

## 9. ClientDesignSelection

```ts
ClientDesignSelection {
  id
  candidateId
  candidateRevision
  selectedBy
  selectedAt
  status

  clientNotes?
  approvalSnapshot
}
```

Selected revision treba da bude stabilan input Commercial/Provisioning sloju.

---

## 10. Preview architecture

Preview mora biti odvojen od live product instance-a.

Mogući nivo zrelosti:

1. static structured preview;
2. interactive route preview;
3. sandbox instance;
4. provisioned staging product.

Ne treba svaki candidate odmah provisionovati kao pun tenant/product.

---

## 11. Tasks

### DE-1 — Design Strategy contract

- connect Blueprint;
- UX pattern;
- grammar;
- primitives;
- brand config;
- policies.

### DE-2 — Candidate schema

- revision;
- preview;
- validation report;
- lifecycle.

### DE-3 — Candidate generator orchestration

- deterministic inputs;
- AI role;
- no business invention;
- design-system constraints.

### DE-4 — Validation gate

- capability consistency;
- accessibility;
- responsive;
- fabricated content checks;
- prohibited patterns.

### DE-5 — Client candidate UI

- compare;
- preview;
- notes;
- selection;
- mobile UX.

### DE-6 — Refinement routing

- design vs content vs business-change;
- return to correct domain;
- preserve history.

### DE-7 — Approved design snapshot

- immutable selected revision;
- references to Blueprint/Strategy versions.

---

## 12. Acceptance criteria

1. Design Engine ne može da radi bez validnog SolutionBlueprint-a.
2. Kandidat ne može da prikaže capability koji product nema.
3. Marysoll/P.DC business rules ostaju netaknuti.
4. Klijent vidi najmanje jedan validan candidate preview.
5. Refinement ne može prikriveno promeniti product model.
6. Selected design je versioned snapshot.
7. Commercial/Provisioning mogu referencirati tačno odobrenu design revision.

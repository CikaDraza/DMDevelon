# DMD Product Intelligence — Capability Model, Product Routing & Solution Blueprint

**Status:** ACTIVE
**Authority:** canonical
**Owner domain:** Product Intelligence
**Supersedes:** —
**Superseded by:** —

**Parent:** `documentations/dmd/product/DMD_PLATFORM_EXPANSION_MASTER_PLAN.md`
**Primary milestones:** M3, M4, M5

---

## 1. Purpose

Product Intelligence prevodi verifikovano poslovno stanje u product odluku.

Njegova osnovna pitanja su:

1. Koje capability-je biznis zahteva?
2. Koji postojeći DMD product family ih prirodno poseduje?
3. Da li su zahtevi native, configurable, product extension ili incompatible?
4. Šta se konkretno gradi za ovog klijenta?

Product Intelligence ne dizajnira ekran. On priprema stabilan `SolutionBlueprint` koji Design Engine može bezbedno da koristi.

---

## 2. Capability Model

Capability Model je obavezna granica između Business Intelligence i Product Routing.

```text
Verified Business State
        ↓
Capability Derivation
        ↓
Capability Model
        ↓
Product Fit
```

Predlog:

```text
CapabilityModel {
  id
  businessStateId
  version

  required[]
  optional[]
  future[]
  prohibited[]
  constraints[]

  roleModel
  workflowNeeds
  dataNeeds
  integrationNeeds
}
```

Capability nije UI komponenta.

Primeri:

```text
booking.public_availability
booking.private_slots
pricing.fixed
pricing.from
pricing.on_request
services.packages
crm.client_history
matching.intake
matching.provider_recommendation
content.blog
content.video
membership.paid_access
publishing.issue
education.one_to_one
```

---

## 3. Product Definition contract

Svaki DMD product family objavljuje canonical contract.

```text
ProductDefinition {
  key
  version
  name
  family

  businessModels[]
  capabilities[]
  configurableCapabilities[]
  extensionPolicy

  constraints[]
  incompatiblePatterns[]

  designPolicyRef
  provisioningAdapterKey
  subscriptionCatalogRef
}
```

Product Definition nije marketing opis. To je izvršni routing contract.

---

## 4. Initial Product Catalog

### 4.1 Marysoll

Family:

```text
service_business_os
booking_business
client_operations
growth
```

Native examples:

- public/private availability;
- appointment booking;
- service catalog;
- business hours;
- staff/resources;
- pricing variants;
- client records;
- packages;
- loyalty;
- notifications;
- marketing;
- analytics.

Invariant:

> Zahtev klijenta ne menja Marysoll business model. Zahtev se mapira na postojeći capability ili ocenjuje kao product extension/custom.

### 4.2 P.DC

Family:

```text
expert_network
knowledge_platform
learning_network
creator_membership
```

Native/target examples:

- provider/creator registration;
- learner/client registration;
- profiles;
- expert discovery;
- intake;
- matching;
- 1:1 learning/support;
- blog;
- video;
- premium content;
- subscription access;
- magazine/issues;
- B2B membership/knowledge surfaces.

P.DC treba da ostane širi od mental-health vertical-a.

### 4.3 Custom

Custom route se bira kada:

- ključni business model ne pripada Marysoll/P.DC;
- required capability je protiv product constraint-a;
- capability set bi zahtevao tenant-specific fork core modela;
- extension nema generalnu product vrednost.

---

## 5. Fit classes

Svaki required capability dobija fit:

```text
native
configurable
product_extension
unsupported
conflict
```

Ukupni route može biti:

```text
native
configurable
product_extension
custom_required
```

### `native`

Postoji bez dodatnog product razvoja.

### `configurable`

Postoji u product modelu, ali zahteva tenant/org konfiguraciju.

### `product_extension`

Nedostaje implementacija, ali capability ima smisla kao opšta sposobnost product family-ja.

### `custom_required`

Zahtev menja prirodu proizvoda ili nema smisla kao shared capability.

---

## 6. Routing Engine

AI može da predloži business classification, ali Route Engine donosi odluku iz canonical podataka i verzionisanih pravila.

Predlog rezultata:

```text
ProductRouteDecision {
  id
  businessStateId
  capabilityModelId

  selectedProductKey
  selectedProductVersion
  fit

  matchedCapabilities[]
  configurableCapabilities[]
  extensionCapabilities[]
  unsupportedCapabilities[]
  blockers[]

  ruleSetVersion
  decisionReasons[]
  decidedAt
}
```

`decisionReasons` čuva razumljive rule rezultate, ne privatni AI reasoning.

---

## 7. Example — Marysoll

Klijent kaže:

> „Želim da se vidi kada sam slobodna, ali neke termine želim samo ja da vidim. Hoću da menjam radno vreme i cenu. Za neke usluge cena kreće od određenog iznosa.“

Capability model:

```text
booking.public_availability
booking.private_slots
business_hours.manage
pricing.fixed
pricing.from
service_catalog.manage
```

Route:

```text
product = marysoll
fit = native/configurable
```

Design može biti potpuno custom brand izraz.

Business logic ostaje Marysoll.

---

## 8. Example — P.DC

Klijent kaže:

> „Kod mene se registruju stručnjaci, korisnik popuni upitnik i sistem mu predloži ko mu najviše odgovara. Stručnjaci nemaju zasebne biznise.“

Capability model:

```text
identity.provider
identity.client
profiles.provider
intake.structured
matching.provider_recommendation
discovery.provider
request_or_booking
content.authority
```

To nije prezentacioni sajt.

Route treba da prepozna P.DC expert-network model.

---

## 9. Solution Blueprint

Route kaže *koji proizvod*. Blueprint kaže *šta konkretno gradimo*.

Predlog:

```text
SolutionBlueprint {
  id
  routeDecisionId
  version

  product
  businessModel
  actors[]
  capabilitiesIncluded[]
  capabilitiesExcluded[]
  extensionRequests[]

  primaryFlows[]
  dataRequirements[]
  integrations[]
  migrationNeeds[]

  conversionModel
  trustModel
  contentModel
  operationalModel

  designInputs
  commercialInputs
  provisioningInputs

  risks[]
  unresolvedItems[]
}
```

Blueprint postaje zajednički input za:

- Design Strategy;
- Design Engine;
- Commercial Model;
- Provisioning;
- Project Proposal drafting;
- Project Intelligence.

---

## 10. Product extension governance

`product_extension` ne sme automatski postati feature.

Potrebna je product decision:

1. Da li capability pripada product family-ju?
2. Da li ga mogu koristiti drugi tenanti/organizacije?
3. Da li se može implementirati bez narušavanja existing rules?
4. Da li entitlement/subscription model može da ga podrži?
5. Da li postoji migration/backward compatibility plan?

Ako odgovor nije da — route ide ka custom.

---

## 11. Product catalog versioning

Route decision mora biti reproduktivan.

Zato se čuvaju:

- ProductDefinition version;
- capability catalog version;
- routing rules version;
- business state version.

Promena catalog-a kasnije ne sme retroaktivno promeniti istorijsku odluku.

---

## 12. Tasks

### PI-1 — Capability registry v1

- naming convention;
- namespaces;
- metadata;
- dependencies;
- conflicts.

### PI-2 — Marysoll product contract

- business model;
- capabilities;
- configuration;
- constraints;
- extension policy.

### PI-3 — P.DC product contract

- expert/knowledge/learning models;
- role patterns;
- content/membership;
- matching/discovery;
- constraints.

### PI-4 — Fit evaluator

- per-capability fit;
- blockers;
- score only kao pomoć, ne jedini autoritet;
- deterministic route.

### PI-5 — ProductRouteDecision persistence

- immutable decision revision;
- reasons;
- versions;
- actor/system metadata.

### PI-6 — SolutionBlueprint v1

- schema;
- generator/orchestrator;
- validation;
- unresolved items;
- versioning.

### PI-7 — Extension governance

- classify extension;
- approve/reject route;
- convert to product roadmap item or custom scope.

---

## 13. Acceptance criteria

Product Intelligence je spreman kada:

1. isti Verified Business State daje reproduktivan route sa istim rule versions;
2. AI ne može direktno postaviti selected product;
3. Marysoll zahtev koji je samo brand/config ne pravi fork;
4. P.DC prepoznaje expert/learning/knowledge network use case;
5. incompatible requirement ne deformiše postojeći product family;
6. capability fit je vidljiv i auditabilan;
7. SolutionBlueprint je dovoljan input Design/Commercial/Provisioning slojevima;
8. route decision čuva product/catalog/rule verzije.

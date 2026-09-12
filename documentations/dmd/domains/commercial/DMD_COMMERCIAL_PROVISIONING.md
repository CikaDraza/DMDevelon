# DMD Product Intelligence — Commercial Model, Onboarding & Provisioning

**Status:** ACTIVE
**Authority:** canonical
**Owner domain:** Commercial
**Supersedes:** —
**Superseded by:** —

**Parent:** `documentations/dmd/product/DMD_PLATFORM_EXPANSION_MASTER_PLAN.md`
**Primary milestones:** M8, M9, M10

---

## 1. Purpose

Commercial i Provisioning sloj pretvaraju odobreni solution/design u stvaran poslovni odnos i product instance.

Najvažnije pravilo:

> Proposal, Product Subscription i DMD Engineering Plan su odvojeni objekti.

---

## 2. Commercial objects

### 2.1 Project Proposal

Kupuje:

- dogovoreni scope;
- konkretnu fazu;
- milestone plan;
- cenu i timeline te faze.

Povezan sa DMD engineering project-om.

Accepted proposal ostaje immutable snapshot.

### 2.2 Product Subscription

Kupuje:

- product capability-je;
- usage limits;
- plan entitlement;
- tenant/org access;
- billing lifecycle.

Vezan za Product Instance.

### 2.3 DMD Engineering Plan

Kupuje:

- kontinuirani development capacity;
- maintenance;
- product changes;
- support;
- prioritet/SLA ako se uvede;
- određeni nivo engineering angažmana.

Ne određuje product feature entitlement.

---

## 3. CommercialConfiguration

```text
CommercialConfiguration {
  id
  solutionBlueprintId
  selectedDesignId

  productPlanRef?
  engineeringPlanRef?
  proposalDraftRef?

  oneTimeItems[]
  recurringItems[]
  externalCosts[]

  trialPolicy?
  discountPolicy?
  commercialNotes[]

  version
}
```

---

## 4. Commercial route types

### SaaS-native

Primer:

```text
Discovery
→ Marysoll native fit
→ Product Subscription
→ Provisioning
```

Engineering proposal može biti opcion.

### Managed product

```text
Discovery
→ Product fit
→ Product Subscription
+ DMD Engineering Plan
→ Provisioning
```

### Custom project

```text
Discovery
→ Custom required
→ Master Proposal
→ Engineering project
→ Provisioning/deployment
```

### Product extension

Može imati:

- proposal za development extension-a;
- product subscription nakon isporuke;
- eventualni engineering plan.

---

## 5. OnboardingRequirement

Onboarding ne treba da bude statična duga lista.

Requirement nastaje kada ga Solution/Provisioning plan zaista zahteva.

```text
OnboardingRequirement {
  id
  projectId
  productInstanceRef?

  key
  category
  title
  instructions

  status
  requiredForStage
  blocking

  requestedAt?
  receivedAt?
  verifiedAt?

  sourceRef?
  secureSecretRef?
}
```

Lifecycle:

```text
identified
→ requested
→ received
→ verifying
→ verified

      ↘ rejected
      ↘ not_applicable
```

---

## 6. Typical onboarding categories

### Business identity

- legal/business name;
- public brand name;
- phone;
- public email;
- address/location;
- logo;
- social profiles.

### Domain

- existing domain;
- registrar;
- DNS access strategy;
- new domain need;
- custom domain mapping.

### Email

- Zoho;
- Resend;
- sender domain;
- inbox addresses;
- DNS verification.

### Identity/Auth

- Clerk;
- Google auth;
- role/admin list;
- required user accounts.

### Data

- existing DB;
- export;
- CSV/JSON;
- Mongo/Postgres/MySQL etc.;
- ownership;
- migration scope;
- mapping;
- cleanup.

### Hosting / runtime

- Railway;
- Vercel;
- MongoDB;
- storage;
- Cloudinary;
- secrets.

### External channels

- Instagram;
- Google;
- calendar;
- maps;
- analytics;
- other providers.

---

## 7. Non-blocking onboarding principle

Sistem ne sme tražiti sve odjednom ako nije potrebno.

Primer:

```text
Design može da napreduje bez DNS-a.
Data migration mapping može da napreduje bez finalnog domain cutover-a.
Provisioning production sender-a ne može bez DNS verifikacije.
```

Svaki requirement zato ima:

- stage;
- dependency;
- blocking flag.

Klijent dobija konkretan zahtev kada je relevantan.

---

## 8. AI onboarding assistant

AI može klijentu objasniti:

- šta nam treba;
- zašto;
- kako da pronađe podatak;
- koji format je prihvatljiv;
- da li može da pošalje export umesto credentials-a.

AI ne sme tražiti ili prikazivati tajne kroz nezaštićen chat ako postoji secure secret flow.

---

## 9. Data migration

Postojeći podaci treba da se konvertuju u target product schema kroz kontrolisan workflow.

```text
source discovery
→ export
→ source profiling
→ mapping plan
→ dry run
→ validation
→ import
→ reconciliation
→ cutover
```

Obavezno razdvojiti:

- source DB facts;
- mapping rules;
- migration code;
- target product canonical schema.

Ne menjati target schema samo zato što source DB ima loš model.

---

## 10. ProvisioningPlan

```text
ProvisioningPlan {
  id
  solutionBlueprintId
  commercialConfigId

  productKey
  productVersion
  adapterKey

  prerequisites[]
  onboardingRequirements[]
  migrationPlanRef?

  resourcesToCreate[]
  resourcesToConfigure[]
  verificationSteps[]
  rollbackOrReconciliationPolicy

  status
  version
}
```

Lifecycle:

```text
draft
→ awaiting_inputs
→ ready
→ provisioning
→ verifying
→ active

        ↘ failed
        ↘ reconciliation_required
```

---

## 11. Plan before apply

Pre spoljne mutacije Provisioning Engine mora moći da pokaže:

- šta će kreirati;
- gde;
- šta će promeniti;
- šta nedostaje;
- koji external account je potreban.

To smanjuje provisioning greške i neželjene resurse.

---

## 12. Provisioning adapters

Contract:

```text
ProvisioningAdapter {
  plan()
  validate()
  provision()
  verify()
  reconcile()
}
```

Initial implementations:

```text
MarysollProvisioner
PdcProvisioner
CustomPlatformProvisioner
```

DMD zna adapter contract, ali ne preuzima unutrašnju poslovnu logiku proizvoda.

---

## 13. ProductInstanceReference

DMD čuva referencu, ne kopiju product domena.

```text
ProductInstanceReference {
  id
  productKey
  productVersion

  externalInstanceId
  organizationOrTenantRef?
  environmentRefs

  subscriptionRef?
  provisioningPlanId
  status
}
```

---

## 14. Idempotency and reconciliation

Provisioning mora biti idempotentan.

Ponovljeni zahtev ne sme napraviti:

- drugi tenant;
- drugi organization;
- dupli domain mapping;
- duple credentials;
- dupli subscription.

Ako external mutation delimično uspe:

```text
failed
→ reconciliation_required
```

ne lažno `active`.

---

## 15. Tasks

### CP-1 — Commercial object boundaries

- Proposal;
- Product Subscription reference;
- Engineering Plan;
- rules.

### CP-2 — CommercialConfiguration

- schema;
- versioning;
- snapshots;
- external cost treatment.

### CP-3 — Onboarding requirements engine

- requirement registry;
- dependencies;
- stages;
- notifications;
- secure input path.

### CP-4 — Data migration workflow

- source profiling;
- mapping;
- dry-run;
- validation;
- reconciliation.

### CP-5 — ProvisioningPlan

- resources;
- prerequisites;
- validation;
- lifecycle.

### CP-6 — Adapter contract

- Marysoll;
- P.DC;
- Custom.

### CP-7 — Idempotency/reconciliation

- idempotency keys;
- external references;
- retry rules;
- reconcile commands.

### CP-8 — Product instance verification

- health;
- environment;
- domain;
- auth;
- subscription;
- required capability checks.

---

## 16. Acceptance criteria

1. Proposal i subscription nisu isti model.
2. Engineering plan ne određuje product entitlement.
3. Onboarding traži samo relevantne inpute.
4. Klijent vidi šta još nedostaje.
5. Secret input ne prolazi nebezbednim običnim chat tokom.
6. Existing DB može da prođe dry-run migration.
7. Provisioning ima plan pre apply.
8. Retry ne pravi dupli product instance.
9. Delimičan failure ulazi u reconciliation.
10. DMD čuva external instance reference umesto kopiranja product domena.

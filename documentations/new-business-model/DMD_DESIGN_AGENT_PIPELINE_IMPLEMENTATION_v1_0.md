# DMD — Design Agent Pipeline Implementation v1.0

**Datum:** 2026-09-09  
**Status:** canonical implementation architecture  
**Domen:** DMD Design Intelligence / Design Delivery  
**Primena:** Marysoll, P.DC i Custom projekti  
**Naslanja se na:** DMD Business Intelligence, Product Intelligence, Product Capability manifests, Solution Blueprint i P.DC/Marysoll design systems  
**Ne definiše:** pricing model, payment provider, final project delivery workflow posle accepted proposal-a

---

# 0. Svrha dokumenta

Ovaj dokument definiše implementacioni pipeline kojim DMD pretvara jezik klijenta i proverene poslovne zahteve u validiran dizajn koji može da se prikaže klijentu, koriguje, odobri i zatim implementira u stvarni proizvod.

Pipeline mora da podrži dva nivoa dizajna:

1. **Instant AI Design** — automatska izrada preko programatskog AI provider-a, namenjena brzom lead-to-design iskustvu.
2. **Supervised / Advanced Design** — kurirani handoff operatoru i eksternom design alatu kao što je Claude Design, nakon čega Claude Code/Codex implementira rezultat u stvarnoj arhitekturi proizvoda.

Oba nivoa moraju da dele isti canonical input, ista product ograničenja, ista pravila i isti output contract.

Glavni princip:

> **AI interpretira dizajn. Sistem određuje dozvoljenu funkcionalnost. Product manifest ograničava mogućnosti. Design system daje vizuelnu gramatiku. Code agent implementira rezultat u stvarne komponente i engine-e.**

---

# 1. Kanonski pipeline

```text
CLIENT LANGUAGE
      ↓
DiscoverySession
      ↓
Business Intelligence
      ↓
Verified Business State
      ↓
Product Intelligence
      ↓
Capability Model
      ↓
Product Route
Marysoll / P.DC / Custom
      ↓
Solution Blueprint
      ↓
Design Intelligence
      │
      ├── Design Intake
      ├── Existing Website Analysis
      ├── Visual References
      ├── Client Assets + Semantic Descriptions
      ├── Design System Selection
      └── Versioned Design Rules
      ↓
Design Strategy
      ↓
Design Job
      ↓
Curated Design Handoff
      ↓
Claude Design / AI Design Agent
      ↓
Visual Artifact
      ↓
Design Artifact Normalizer
      ↓
Compatibility Validator
      ↓
Implementation Classification
      ↓
Claude Code / Codex
      ↓
Real Product Components
      ↓
Backend + DB + Frontend
      ↓
Tests
      ↓
Build
      ↓
Vercel Preview
      ↓
Client Review Mode
      │
      ├── Replace assets
      ├── Content corrections
      ├── Visual revision request
      └── Functional request → scope analysis
      ↓
Approved Design Revision
      ↓
Project Proposal
      ↓
Payment
      ↓
WorkOrder
```

## 1.1 Kritični invariant

Design pipeline **nikada ne počinje od sirovog chat razgovora** kao glavnog inputa za design executor.

Sirov razgovor je evidence/source material. Pre dizajna mora proći kroz:

```text
raw conversation
      ↓
structured extraction
      ↓
verified state
      ↓
product reasoning
      ↓
blueprint
      ↓
design strategy
      ↓
curated handoff
```

Claude Design, Anthropic API, OpenAI API ili drugi design executor dobijaju samo kurirani kontekst dovoljan da razumeju projekat i dizajn, bez nepotrebnog poslovnog i tehničkog šuma.

Svi `text` shape blokovi u ovom dokumentu koriste jezički neutralnu contract notaciju, nisu JavaScript/TypeScript source. `?` označava opciono polje, a navedeni tipovi opisuju očekivanu vrednost.

---

# 2. Discovery i identity boundary

## 2.1 DiscoverySession

`DiscoverySession` je root pre registracije i nakon registracije ostaje istorijski kontekst projekta.

Predlog:

```text
DiscoverySession {
  id: string;
  ownerUserId: string | null;
  anonymousSessionHash: string | null;

  status:
    | "active"
    | "design_ready"
    | "claimed"
    | "converted"
    | "expired";

  conversationThreadId: string;
  verifiedBusinessStateId: string | null;
  capabilityModelId: string | null;
  productRouteDecisionId: string | null;
  solutionBlueprintId: string | null;
  activeDesignStrategyId: string | null;

  createdAt: string;
  expiresAt: string | null;
}
```

## 2.2 Anonymous vs registered flow

### Instant Design

Klijent može da prođe discovery i dobije prvi instant design bez naloga.

```text
anonymous session
      ↓
discovery
      ↓
instant design
      ↓
preview
      ↓
client likes direction
      ↓
registration
      ↓
claimSession(userId)
```

Prilikom registracije ne sme ponovo unositi podatke. Session, poslovno stanje, website audit, design intent, assets, strategy i design candidates prelaze na registrovanog korisnika.

### Supervised / Advanced Design

Registracija je obavezna pre nego što `DesignJob` pređe u operator queue jer rezultat neće biti trenutan.

```text
Design Strategy ready
      ↓
Advanced Design selected
      ↓
registration required
      ↓
claim session
      ↓
DesignJob(awaiting_operator)
```

---

# 3. Design Intake UX

Design Intake ne sme da bude generički formular tipa „izaberite boju i font“.

Prvo mora da prikupi **značenje, cilj i preferencije**, zatim konkretne reference i assets.

## 3.1 Obavezni conceptual inputs

Klijent treba da dobije jednostavna pitanja koja se kasnije strukturiraju u `DesignIntent`:

- naziv projekta / brenda;
- kratak opis šta organizacija, proizvod ili usluga predstavlja;
- šta sajt/app treba da postigne;
- kome je namenjen;
- kakav utisak treba da ostavi;
- šta korisnik nikako ne želi;
- da li već postoji sajt;
- da li postoje sajtovi koji mu se vizuelno dopadaju;
- postojeći logo, fotografije i drugi assets;
- boje ili postojeća kolor šema ako postoji;
- prioritet mobile/desktop iskustva;
- željeni nivo motion-a;
- specijalni vizuelni zahtevi.

## 3.2 Existing website input

Poseban UX blok:

```text
Da li već imate sajt?

[ URL postojećeg sajta ]
[ Dodaj screenshot / referentnu sliku ]
[ Kratka napomena šta želite da zadržimo ili promenimo ]
```

URL postojećeg sajta nije isto što i design reference URL.

`existing_website` se analizira kao trenutno business/UX stanje.

`reference_website` se koristi kao vizuelna ili interakciona inspiracija.

## 3.3 Reference website input

Za svaki URL reference:

```text
URL
Šta vam se ovde dopada?
Šta vam se ne dopada?
Na šta da posebno obratimo pažnju?
```

Ako klijent ne zna odgovor, može izabrati jednostavne opcije:

- tipografija;
- raspored;
- slike;
- boje;
- animacije;
- premium osećaj;
- jednostavnost;
- nešto drugo.

## 3.4 Upload assets sa uređaja

Upload slika mora da bude first-class deo Design Intake UX-a.

Za svaki upload sistem mora da traži najmanje:

1. **šta slika predstavlja**;
2. **gde bi klijent želeo da se koristi**, ako zna.

Primer UX-a:

```text
[ Upload image ]

Šta predstavlja ova slika?
> Sanja, profesionalni portret za početnu stranicu.

Kako želite da je koristimo?
( ) Logo
( ) Hero
( ) O meni / profil
( ) Usluga
( ) Galerija
( ) Pozadina / dekoracija
( ) Primer dizajna
( ) Nisam siguran
```

Opis mora biti obavezan za client-upload asset. Role može biti `unsure` ako klijent nije siguran.

---

# 4. Asset mora da ima značenje

Slika nije samo URL. Slika je semantički design asset.

DB ne skladišti image binaries. Cloudinary čuva fajl i delivery. DMD čuva značenje, poreklo, namenu i vezu sa design procesom.

## 4.1 DesignAsset

Kanonski početni shape:

```text
DesignAsset {
  id: string;
  discoverySessionId: string;
  designJobId?: string;

  cloudinaryPublicId: string;
  deliveryType: string;
  width: number;
  height: number;
  mimeType: string;

  source:
    | "client_upload"
    | "existing_website"
    | "reference_website"
    | "designer"
    | "generated";

  role:
    | "logo"
    | "hero"
    | "portrait"
    | "service"
    | "gallery"
    | "background"
    | "decorative"
    | "reference"
    | "unsure";

  title: string;
  description: string;

  intendedPlacement?: string;
  personName?: string;
  altText?: string;

  createdAt: string;
}
```

## 4.2 Invariant

Za `client_upload`:

```text
description != empty
```

Za svaki asset koji se koristi u finalnom dizajnu:

```text
role != unsure
```

Ako je klijent uneo `unsure`, Design Intelligence ili operator mora da ga klasifikuje pre finalnog binding-a.

## 4.3 Storage boundary

```text
DB zna:
- šta je slika
- čemu služi
- ko ju je dostavio
- gde se nalazi
- koji DesignJob je koristi
- u kom design slotu je vezana

Cloudinary zna:
- fajl
- format
- transformations
- delivery
- dimensions
```

DB ne sme da postane blob storage.

## 4.4 Security

Ako asset nije namenjen javnoj objavi, handoff ne sme da koristi trajni javni URL. Koristiti secure/signed delivery ili vremenski ograničen access koji odgovara integraciji.

---

# 5. Design Media Slots

Dizajn ne treba direktno da zavisi od konkretnog image URL-a.

Koristi se semantički slot:

```text
Hero component
      ↓
mediaSlot: home.hero.primary
      ↓
AssetBinding
      ↓
DesignAsset
```

## 5.1 MediaSlot

```text
DesignMediaSlot {
  id: string; // home.hero.primary
  designCandidateId: string;
  pageId: string;
  sectionId: string;

  role: one of DesignAsset.role values;
  required: boolean;
  editableByClient: boolean;

  preferredAspectRatio?: string;
  preferredSubject?: string;
  description: string;
}
```

Primer:

```yaml
id: home.hero.primary
role: hero
required: true
editableByClient: true
preferredAspectRatio: "4:5"
preferredSubject: "founder portrait"
description: >
  Primary founder image displayed beside the main value proposition.
```

## 5.2 AssetBinding

```text
DesignAssetBinding {
  id: string;
  mediaSlotId: string;
  designAssetId: string;
  revisionId: string;
  createdAt: string;
}
```

Prednost:

- asset se menja bez regeneracije dizajna;
- istorija ostaje jasna;
- code layer ne zavisi od Cloudinary URL-a hardkodovanog u komponenti;
- isti dizajn može dobiti drugi set slika.

---

# 6. Existing Website Analyzer

Ako postoji prethodni sajt:

```text
URL
 ↓
Website Analyzer
 ↓
structure
CTA map
conversion paths
content hierarchy
mobile problems
SEO structure
visual language
technical problems
```

Ali design executor **ne dobija kompletan raw audit**.

## 6.1 Dva nivoa analize

```text
RawWebsiteAnalysis
      ↓
DesignRelevantWebsiteAnalysis
```

Raw analiza može sadržati detaljne tehničke rezultate za DMD internu dijagnostiku.

Design relevant projection treba da sadrži samo ono što menja dizajn ili konverziju:

```yaml
existing_site_findings:
  preserve:
    - strong founder photography
    - recognizable brand accent

  improve:
    - weak content hierarchy
    - unclear primary CTA
    - oversized mobile hero
    - difficult service comparison

  business_conflicts:
    - business wants fewer phone calls
    - most current conversion points lead to phone or DM

  seo_relevant:
    - weak service intent in page titles/headings
    - inconsistent heading hierarchy
```

### Invariant

Claude Design-u i instant AI agentu ne treba 150 Lighthouse detalja da bi dizajnirali Hero.

Tehnički audit ostaje dostupan drugim engine-ima, ali Design Handoff dobija samo relevantan projection.

---

# 7. Design Strategy

`DesignStrategy` je versioned canonical DB aggregate. Nije jedan AI odgovor i ne sme se implicitno menjati nakon što je Design Job pokrenut.

## 7.1 Shape

```text
DesignStrategy {
  id: string;
  discoverySessionId: string;
  blueprintId: string;

  version: number;
  status:
    | "draft"
    | "validated"
    | "strategy_ready"
    | "locked_for_design"
    | "superseded";

  projectName: string;
  projectDescription: string;
  businessGoal: string;
  designGoal: string;

  audience: string[];
  desiredOutcomes: string[];

  conversionStrategy: object;
  ctaStrategy: object;
  contentHierarchy: object;
  pageArchitecture: object;
  seoStrategy: object;

  visualDirection: object;
  brandDirection: object;
  typographyDirection: object;
  spacingDirection: object;
  imageryDirection: object;

  responsiveStrategy: object;
  accessibilityPolicy: object;
  motionPolicy: object;

  requiredCapabilities: string[];
  allowedCapabilities: string[];
  forbiddenCapabilities: string[];

  preferredBlocks: string[];
  preferredComponents: string[];

  designSystemRef: {
    id: string;
    version: number;
  };

  ruleRefs: map of rule key to version number;

  designIntentId: string;
  websiteAnalysisId?: string;

  capabilityManifestVersion: string;
  generatedFrom: string[];

  createdAt: string;
  lockedAt?: string;
}
```

## 7.2 Obavezna human-readable polja

Design Strategy ne sme da bude samo tehnički JSON.

Mora da ima najmanje:

- **Naziv projekta**;
- **Opis šta projekat predstavlja**;
- **Business goal — šta klijent želi da postigne**;
- **Design goal — kako dizajn treba da pomogne tom cilju**;
- audience;
- desired outcomes;
- visual direction;
- conversion direction.

Primer:

```yaml
project:
  name: "Sanja Neuer"
  description: >
    Digitalni prostor za Sanjin profesionalni rad sa klijentima.
    Sajt treba da predstavi njen način rada, omogući ljudima da
    razumeju kome je podrška namenjena, pošalju strukturisan intake
    i zakažu konsultaciju.

business_goal: >
  Pretvoriti postojeće interesovanje u strukturisan klijentski tok
  bez oslanjanja na ručne poruke i improvizovano dogovaranje.

design_goal: >
  Izgraditi ozbiljan, topao i premium profesionalni identitet,
  bez kliničkog izgleda i bez generičkog coaching dizajna.
```

Design executor mora da razume **šta pravi i zašto**, a ne samo koje komponente treba da nacrta.

---

# 8. Orkestracija Design Strategy-ja

Jedan model ne treba da dobije prompt „napravi design strategy“ i slobodno odlučuje.

Predložena orkestracija:

```text
Verified Business State
Solution Blueprint
Capability Model
Product Manifest
Design Intent
Website Analysis
Client Assets
Visual References
      │
      ├── UX / funnel analysis
      ├── CTA strategy
      ├── content architecture
      ├── SEO strategy
      ├── mobile strategy
      ├── brand / visual direction
      └── product compatibility reasoning
                     ↓
              DesignStrategyDraft
                     ↓
               Validation Engine
                     ↓
                DesignStrategy
```

## 8.1 Priority order

Kada se zahtevi sukobe, red prioriteta je:

```text
1. Product capability constraints
2. Accepted / active Solution Blueprint
3. Business and conversion goal
4. UX / accessibility / security rules
5. Client design intent
6. Visual references
7. AI artistic interpretation
```

Vizuelna želja ne daje dozvolu za novu funkcionalnost.

---

# 9. Versioned Design Rules

Pravila moraju biti verzionisana i pinovana u DesignStrategy/DesignJob.

Početni families:

```text
DMD_DESIGN_RULES_vN
PDC_DESIGN_GRAMMAR_vN
MARYSOLL_DESIGN_GRAMMAR_vN
MOBILE_FIRST_RULES_vN
CTA_STRATEGY_RULES_vN
ACCESSIBILITY_RULES_vN
SEO_PAGE_STRUCTURE_vN
```

Primer pinovanja:

```yaml
designSystem:
  id: DS_SOFT_PROFESSIONAL
  version: 4

rules:
  DMD_DESIGN_RULES: 3
  PDC_DESIGN_GRAMMAR: 2
  MOBILE_FIRST_RULES: 2
  CTA_STRATEGY_RULES: 1
  ACCESSIBILITY_RULES: 1
  SEO_PAGE_STRUCTURE: 2
```

Ove reference moraju ostati vezane za:

- `DesignStrategy`;
- `DesignJob`;
- `DesignCandidate`;
- `ApprovedDesignRevision`;
- finalni `WorkOrder`.

Time je svaki dizajn reproducibilan prema tada važećoj design gramatici.

---

# 10. Versioned Design Systems

Design system nije samo skup boja i fontova.

Design system predstavlja proverenu vizuelnu gramatiku sa jasno definisanim karakterom i implementacionim primitivama.

## 10.1 Sadržaj design systema

Svaki design system može da sadrži:

- design tokens;
- typography rules;
- spacing rhythm;
- grids;
- radius/shadow policy;
- color behavior;
- image treatment;
- section rhythm;
- motion language;
- navigation patterns;
- CTA treatment;
- card grammar;
- decorative grammar;
- responsive behavior;
- component variants;
- reference examples;
- intended industries/profiles;
- profiles for koje nije preporučen.

## 10.2 Primer

```yaml
id: DS_Y2K_URBAN
version: 2

intent:
  - expressive
  - youthful
  - fashion-led

visual_language:
  - stickers
  - cutout imagery
  - graffiti accents
  - layered cards
  - high contrast typography

motion:
  level: expressive

recommended_for:
  - creator
  - beauty
  - youth_fashion

avoid_for:
  - legal
  - healthcare_formal
  - corporate_b2b
```

Klijentov feedback može da promeni design-system route bez menjanja product route-a.

Primer:

```text
"lep je dizajn, ali želim stikere, grafite, srca i lutke"
      ↓
Design Intent / Design System revision
      ↓
P.DC/Marysoll product route ostaje isti
```

---

# 11. Component Registry

AI design agent treba prvenstveno da komponuje poznate, proverene primitive umesto da izmišlja novi UI sistem za svaki lead.

Primer machine-readable component entry:

```yaml
component: hero.split-image
version: 3

products:
  - pdc
  - marysoll

allowedProps:
  - title
  - eyebrow
  - body
  - image
  - primaryAction
  - secondaryAction

capabilityBindings:
  primaryAction:
    - booking.start
    - intake.start
    - contact.start

responsive:
  mobile: supported
  tablet: supported
  desktop: supported

motion:
  - none
  - reveal
  - stagger
```

## 11.1 New component policy

Ako dizajn zahteva pattern koji ne postoji:

```text
existing component?
      ↓ no
is it reusable/generalizable?
      ↓ yes
candidate design-system extension
      ↓
implementation review
```

Ne praviti tenant-specific hack ako pattern može da postane generička komponenta.

---

# 12. Curated Design Handoff Package

Design Handoff Package je **immutable snapshot canonical DB stanja** potrebnog za jedan design execution attempt.

Nije novi source of truth.

## 12.1 Human + machine layers

Handoff ima dva pogleda istog konteksta.

### Human-readable

```text
DESIGN_BRIEF.md
DESIGN_STRATEGY.md
PRODUCT_CONTEXT.md
DESIGN_RULES.md
```

### Machine-readable

```text
machine/
  blueprint.json
  design-strategy.json
  design-intent.json
  capabilities.yaml
  component-registry.json
  website-analysis.json

assets.json
references.json
```

## 12.2 DESIGN_BRIEF.md

Treba da bude kratak, kontekstualan i veoma čitljiv design brief, tipično 2–5 stranica, ne kopija kompletne discovery konverzacije.

Mora da objasni:

- naziv i opis projekta;
- šta business predstavlja;
- šta želi da postigne;
- kome je namenjen;
- ključni UX problem;
- conversion strategiju;
- ključne stranice;
- visual direction;
- selected design system;
- šta klijent voli/ne voli;
- product capabilities;
- zabranjene capability-je;
- relevantne assets i njihove opise;
- reference URL-ove;
- posebne constraints.

## 12.3 Asset references

`assets.json` sadrži semantičke reference, ne binarne fajlove.

Primer:

```json
{
  "id": "asset_781",
  "role": "hero",
  "title": "Sanja professional portrait",
  "description": "Founder portrait intended for the homepage hero.",
  "url": "<secure-cloudinary-delivery-url>",
  "intendedPlacement": "home.hero.primary"
}
```

---

# 13. Design executor prompt contract

Provider adapter može menjati syntax prompta, ali semantički contract mora ostati isti.

Osnovni priority brief:

```text
You are designing a client-facing product surface.

First understand the business and intended user outcome described
in DESIGN_BRIEF.

Then follow the supplied Design Strategy.

The Product Capability Contract is authoritative.
Do not invent product behavior or capabilities.

The Component Registry describes existing reusable implementation
patterns. Prefer those where they support the design.

You may introduce a new visual pattern when justified, but must not
change product semantics.

Design Rules are mandatory.

Use supplied assets and visual references according to their
annotations.

Your output should prioritize:
1. business outcome
2. user clarity
3. conversion strategy
4. product compatibility
5. accessibility
6. visual quality
7. implementation feasibility
```

Provider-specific prompt može dodati format instrukcije, ali ne menja ove prioritete.

---

# 14. Dve execution trake

Obe koriste isti `DesignStrategy` i kreiraju isti `DesignCandidate` contract.

```text
                    DesignStrategy
                           ↓
                       DesignJob
                           │
               ┌───────────┴────────────┐
               │                        │
         INSTANT DESIGN           SUPERVISED DESIGN
               │                        │
      Anthropic/OpenAI API        Claude Design
               │                        │
         minutes / live           operator handoff
               │                        │
         instant preview          Claude Code/Codex
               │                        │
               └───────────┬────────────┘
                           ↓
                    DesignCandidate
                           ↓
                     Client Review
```

---

# 15. DesignJob aggregate

```text
DesignJob {
  id: string;

  discoverySessionId: string;
  userId?: string;

  strategyId: string;
  strategyVersion: number;

  productRoute: "marysoll" | "pdc" | "custom";
  productManifestVersion: string;

  mode: "instant" | "supervised";

  executor:
    | "anthropic_api"
    | "openai_api"
    | "claude_design"
    | "human";

  status:
    | "created"
    | "generating"
    | "awaiting_operator"
    | "designing"
    | "awaiting_implementation"
    | "normalizing"
    | "validating"
    | "implementing"
    | "building"
    | "preview_ready"
    | "client_review"
    | "revision_requested"
    | "approved"
    | "failed"
    | "superseded";

  handoffPackageVersion?: number;

  previewUrl?: string;
  previewCommitSha?: string;

  selectedCandidateId?: string;
  approvedRevisionId?: string;

  createdAt: string;
  updatedAt: string;
}
```

---

# 16. Instant Design lane

Instant lane je conversion i discovery accelerator.

## 16.1 Cilj

Klijent u kratkom vremenu treba da dobije dovoljno dobar, realan pravac da može da kaže:

> "Ovo liči na ono što mi treba i razumeli ste moj business."

Instant lane ne mora da pravi production source code.

## 16.2 Preferred output

Dugoročno preferirati:

```text
AI Provider
      ↓
DesignSpec / ComponentGraph
      ↓
DMD Design Renderer
      ↓
Preview
```

Umesto arbitrary HTML-a kada product component registry može da renderuje isti rezultat deterministički.

## 16.3 Prototype fallback

Za eksperimentisanje ili custom slučajeve dozvoljen je sandboxed:

```text
HTML + CSS + JS
```

ali takav artifact je samo design prototype.

Nije production source.

## 16.4 Motion

Design strategy treba da izražava **motion intent**, ne obaveznu biblioteku:

```yaml
motion:
  level: expressive
  effects:
    - hero_stagger
    - section_reveal
    - card_hover
    - image_parallax
```

Ako produkcijski stack koristi React/Next.js + Motion/Framer Motion, code agent mapira intent na stvarne primitives.

---

# 17. Supervised / Advanced Design lane

Ovaj lane koristi human/operator step kada je potreban viši kreativni kvalitet ili specifičan design language.

## 17.1 Operator queue

Kada Design Job pređe u:

```text
awaiting_operator
```

emituje se:

```text
design.operator_handoff_required
```

Notification Engine šalje:

- email operatoru/adminu;
- push operatoru/adminu.

Klijent ne dobija internu tehničku notifikaciju.

Client UI prikazuje neutralan status:

```text
Dizajn je u pripremi.
```

## 17.2 Operator UX

Admin/Superadmin Design Job ekran treba da prikazuje:

```text
DES-0042
Client / project
Product route
Design system + version
Rules versions

Strategy        ✓
Capabilities    ✓
Assets          ✓
Website audit   ✓
Content         ✓

[ Open Human Design Brief ]
[ Download / Copy Handoff ]
[ Mark Design Started ]
[ Request Client Input ]
```

---

# 18. Human Design Assistance

Operator assistance nije ad-hoc proces. To je formalni workflow event.

```text
design.human_assistance_required
```

Primer reasons:

```text
missing_critical_assets
ambiguous_design_direction
custom_visual_language
reference_analysis_required
designer_handoff_required
asset_sourcing_required
design_validation_failed
```

Primer:

```text
DES-0042 · Human assistance required

Reason:
Client requested a Y2K / graffiti visual language,
but no suitable decorative assets were supplied.

Needed:
• sticker/graffiti references
• decorative assets
• confirm hero direction
```

Human intervencija ne menja automatski canonical business state. Sve izmene koje utiču na strategy moraju postati nova `DesignStrategy` verzija ili eksplicitna operator annotation.

---

# 19. Visual Artifact

Visual Artifact može doći iz:

- instant AI provider-a;
- Claude Design-a;
- drugog budućeg design tool-a;
- human dizajnera.

Ne možemo zahtevati da svaki eksterni designer vraća identičan JSON/YAML format.

Zato artifact ne ide direktno u implementaciju.

---

# 20. Design Artifact Normalizer

```text
Visual Artifact
      +
canonical DesignStrategy
      +
Solution Blueprint
      +
Product Manifest
      +
Component Registry
      ↓
Design Artifact Normalizer
      ↓
NormalizedDesignArtifact
```

Normalizer može koristiti Claude/Codex ili drugi code-capable model, ali samo za **implementacionu klasifikaciju**.

## 20.1 Normalizer odgovornosti

Proverava/rekonstruiše:

- page IDs;
- section IDs;
- component mappings;
- media slots;
- asset bindings;
- capability bindings;
- CTA bindings;
- responsive intent;
- motion intent;
- design system/version;
- required new generic components.

Primer:

```yaml
section:
  id: home.hero
  visualArtifactRef: "hero-01"
  componentTarget: hero.editorial
  mediaSlot: home.hero.primary
  primaryCtaBinding: intake.start
  motionIntent: reveal
```

## 20.2 Invariant

Ako Claude Design ne vrati JSON/YAML, to nije razlog da se izgubi dizajn.

Normalizer rekonstruše machine representation na osnovu:

```text
visual artifact
+ canonical strategy
+ blueprint
+ registry
+ product capabilities
```

Ali Normalizer ne sme da izmišlja novu business capability.

---

# 21. Compatibility Validator

Pre implementacije:

```text
NormalizedDesignArtifact
      ↓
Compatibility Validator
```

Validator proverava najmanje:

- svaki funkcionalni CTA mapira na declared capability;
- nema forbidden capability-ja;
- page/section architecture nije u konfliktu sa Blueprint-om;
- asset slots postoje i imaju validan asset role;
- required accessibility baseline je ispoštovan;
- responsive intent postoji;
- design system/rule versions su validni;
- novi component candidate nije tenant-only duplication postojećeg pattern-a.

Ako Claude Design nacrta payment flow, a Blueprint nema payment capability:

```text
Design Compatibility Failure
```

Ne:

```text
"Claude ga je nacrtao, napravi payment engine."
```

---

# 22. Implementation Classification

Claude/Codex u ovoj fazi smeju da klasifikuju samo način implementacije.

Dozvoljeno:

```text
visual hero
→ existing hero.editorial

booking button
→ PDC BookingTrigger

new reusable decorative section
→ candidate design-system extension
```

Nije dozvoljeno:

```text
new visual checkout
→ create payment engine
```

Ako dizajn implicira nedeklarisanu funkciju, pipeline se vraća na capability/scope decision.

---

# 23. Claude Code / Codex handoff

Code agent dobija:

1. originalni canonical DMD handoff;
2. normalized visual artifact;
3. compatibility validation result;
4. repository implementation instructions;
5. target product manifest/version;
6. target design system/version.

Njegov zadatak je:

> implementirati odobreni vizuelni rezultat koristeći stvarnu arhitekturu proizvoda.

Primer:

Visual artifact:

```html
<button>Book now</button>
```

Real implementation:

```jsx
<BookingTrigger
  serviceId={serviceId}
  intakeContext={intakeContext}
/>
```

Code agent povezuje UI sa pravim backend/frontend engine-ima. Ne kopira prototype business logic.

---

# 24. Git / build / evidence boundary

Implementacija treba da nosi machine-readable vezu sa design job-om.

Primer commit trailer:

```text
Design-Job: DES-0042
Design-Strategy: DS-0018-v3
```

ili repo evidence fajl:

```json
{
  "designJobId": "DES-0042",
  "strategyVersion": 3,
  "status": "implemented"
}
```

Tok:

```text
code + tests
      ↓
Git commit
      ↓
GitHub webhook
      ↓
ProjectEvidence
      ↓
DesignJob updater
      ↓
Vercel Preview
```

Client preview se ne objavljuje kao ready dok:

```text
build = passed
required tests = passed
preview deployment = available
```

---

# 25. Client Review Mode

Kada je preview spreman:

```text
DesignJob.status = preview_ready
```

Client dobija email/push/in-app obaveštenje:

> Vaš dizajn je spreman za pregled.

## 25.1 Review UI

Treba da podrži:

- mobile preview;
- desktop preview;
- full interactive preview;
- choose/accept design;
- request visual revision;
- content correction;
- replace image;
- upload new image;
- choose existing uploaded asset.

---

# 26. Inline Asset Replacement u preview-u

Svaka slika sa `editableByClient=true` u Review Mode-u dobija contextual overlay/control.

Primer:

```text
┌───────────────────────────────┐
│                               │
│          HERO IMAGE           │
│                               │
│   [ Replace image ]           │
│   [ Choose uploaded image ]   │
│                               │
└───────────────────────────────┘
```

Tok:

```text
client selects media slot
      ↓
upload new / choose existing
      ↓
Cloudinary upload if needed
      ↓
DesignAsset created/selected
      ↓
AssetBinding revision
      ↓
preview refresh
```

## 26.1 Critical invariant

Promena slike ne pokreće novi AI design generation ako:

- section structure ostaje ista;
- component ostaje isti;
- slot semantics ostaju iste;
- capability behavior se ne menja.

To je `asset_revision`, ne novi DesignJob.

---

# 27. Design revisions

`DesignCandidate` treba da ima revision history.

```text
DesignCandidate C2
      ↓
Revision 1
      ↓
replace hero asset
      ↓
Revision 2
```

Revision types:

```text
asset_revision
content_revision
visual_revision
structural_design_revision
functional_requirement
scope_change
product_pivot
```

## 27.1 Routing revisions

### Asset/content correction

```text
asset_revision / content_revision
      ↓
local patch
      ↓
no new AI design job required
```

### Visual revision

```text
visual_revision
      ↓
may reuse same DesignStrategy
      ↓
new candidate/revision
```

### Functional request

```text
functional_requirement
      ↓
Product Intelligence
      ↓
Capability Delta
      ↓
Blueprint update?
      ↓
Scope impact
```

Dizajn review nikada ne zaobilazi product/scope kontrolu.

---

# 28. ApprovedDesignRevision

Kada klijent prihvati dizajn:

```text
DesignStrategy v3
DesignCandidate C2
Revision 4
      ↓
ApprovedDesignRevision
```

`ApprovedDesignRevision` je immutable snapshot koji ulazi u proposal i kasnije WorkOrder.

Predlog:

```text
ApprovedDesignRevision {
  id: string;
  designJobId: string;
  designCandidateId: string;
  revisionNumber: number;

  designStrategyId: string;
  designStrategyVersion: number;
  designSystemId: string;
  designSystemVersion: number;
  ruleRefs: map of rule key to version number;

  previewUrl: string;
  previewCommitSha?: string;

  approvedByUserId: string;
  approvedAt: string;
}
```

---

# 29. Proposal / payment boundary

Tek nakon accepted design-a DMD ima dovoljno konkretan input za finalni proposal:

```text
Verified Business State
Capability Model
Product Route
Solution Blueprint
Approved Design Revision
Special Requirements
      ↓
Project Proposal
```

Proposal definiše:

- šta se pravi;
- product family;
- capability-je;
- custom extensions;
- milestones;
- task groups;
- cenu;
- rok/period ako se koristi;
- šta nije uključeno;
- subscription;
- external costs.

Klijent:

```text
Review Proposal
      ↓
Accept
      ↓
Pay
      ↓
ClientProject
      ↓
WorkOrder v1
```

Design approval nije isto što i project purchase.

---

# 30. Design candidate contract

Frontend ne treba da zna ko je napravio dizajn.

`DesignCandidate` je provider-neutral:

```text
DesignCandidate {
  id: string;
  designJobId: string;

  source:
    | "anthropic_api"
    | "openai_api"
    | "claude_design"
    | "human";

  status:
    | "draft"
    | "normalized"
    | "validated"
    | "preview_ready"
    | "selected"
    | "rejected";

  revisionNumber: number;
  normalizedArtifactId?: string;
  previewUrl?: string;

  createdAt: string;
}
```

Time je moguće zameniti provider bez izmene client UX-a ili poslovnog toka.

---

# 31. Provider Adapter boundary

Design execution mora biti adapter-based.

```text
DesignExecutorAdapter {
  createDesign(input: DesignExecutionInput) -> DesignExecutionResult
}
```

Primer adaptera:

```text
AnthropicDesignAdapter
OpenAIDesignAdapter
ManualClaudeDesignAdapter
HumanDesignerAdapter
```

Ako jednog dana postoji stabilan Claude Design API:

```text
ManualClaudeDesignAdapter
      ↓
ClaudeDesignApiAdapter
```

Ostatak sistema se ne menja.

---

# 32. Notification events

Minimalni events:

```text
design.strategy_ready
design.operator_handoff_required
design.human_assistance_required
design.generation_failed
design.normalization_failed
design.compatibility_failed
design.preview_ready
design.client_revision_requested
design.approved
```

## 32.1 Audience policy

### Operator/admin only

```text
design.operator_handoff_required
design.human_assistance_required
design.normalization_failed
design.compatibility_failed
```

### Client

```text
design.preview_ready
design.client_input_required
proposal.ready
```

Interni engine detalji se ne prikazuju klijentu.

---

# 33. Failure handling

## 33.1 Provider failure

Ne sme da izgubi DesignStrategy ili handoff.

```text
DesignJob
status = failed
failureStage = generation
retryable = true/false
```

Retry može koristiti isti locked strategy ili novi provider adapter.

## 33.2 Invalid design output

Ako visual output postoji, ali nema dovoljno strukture:

```text
Visual Artifact
      ↓
Normalizer retry
```

Ne ponavlja se design generation bez potrebe.

## 33.3 Capability violation

Ako artifact predlaže funkciju koju product nema:

```text
compatibility_failed
```

Operator može:

- vratiti dizajn na korekciju;
- ukloniti nevalidan element;
- pokrenuti Product Intelligence scope-change proces.

Ne implementira se automatski.

---

# 34. DB vs generated files

Source-of-truth pravilo:

## DB je authoritative za

- DiscoverySession;
- verified business state reference;
- capability route;
- Solution Blueprint reference;
- DesignIntent;
- DesignAsset metadata;
- DesignStrategy versions;
- DesignJob lifecycle;
- candidate/revision state;
- approval state;
- notifications/events.

## Cloudinary je authoritative za

- image/video binary;
- delivery;
- transformations;
- media metadata dobijen od provider-a.

## Handoff files su

- immutable execution snapshots;
- export/interop format;
- audit evidence;
- provider input.

Ne smeju postati drugi paralelni source of truth za DesignStrategy.

---

# 35. Security boundary

Minimalno:

- signed/direct Cloudinary upload; server ne prosleđuje velike binaries kroz app bez potrebe;
- upload MIME/type/size validation;
- strip/reject unsafe formats gde je potrebno;
- private/signed access za non-public assets;
- URL analyzer SSRF protection;
- block private IP ranges/internal services;
- prompt-injection isolation za tekst preuzet sa eksternih sajtova;
- external website content se tretira kao untrusted data, ne instructions;
- design executor nema DB write tool;
- executor ne može da aktivira capability;
- executor ne može da odobri proposal/payment;
- operator actions su audited;
- anonymous session token se čuva hashovan i rotira po claim-u.

---

# 36. Observability i cost tracking

Svaki AI stage treba da koristi postojeći/provider-neutral `AgentRun` koncept ili njegov ekvivalent.

Beležiti:

- agent role;
- provider;
- model;
- prompt/rules version refs;
- input object refs;
- output object refs;
- token usage;
- estimated/actual provider cost;
- latency;
- status;
- retry count;
- validation result.

Ne skladištiti private chain-of-thought.

Ovo će kasnije omogućiti da se uporedi kvalitet/cena:

```text
OpenAI design agent
vs
Anthropic design agent
vs
Claude Design supervised
```

na stvarnim DMD projektima.

---

# 37. Admin / Superadmin Design Diagnostics

Superadmin treba da vidi pipeline kao state machine, ne kao crnu kutiju.

Primer:

```text
DES-0042

Discovery              ✓
Business State          ✓
Product Route           P.DC
Blueprint               ✓
Design Strategy v3      ✓
Design System           DS_SOFT_PROFESSIONAL_v4
Handoff                 ✓
Executor                Claude Design
Normalization           ✓
Compatibility           ✓
Implementation          ✓
Build                    ✓
Preview                  Ready
Client Review            Waiting
```

Uz diagnostics:

- failed stage;
- validator errors;
- provider latency/cost;
- missing assets;
- unclassified assets;
- capability conflicts;
- preview deployment state;
- notification delivery state.

---

# 38. Minimal API/application commands

Precizna HTTP struktura zavisi od DMD repo arhitekture, ali application layer treba da ima komande približno:

```text
CreateDiscoverySession
ClaimDiscoverySession
SubmitDesignIntent
AddDesignAsset
UpdateDesignAssetSemantics
AnalyzeExistingWebsite
GenerateDesignStrategy
ValidateDesignStrategy
LockDesignStrategy
CreateDesignJob
BuildDesignHandoffPackage
StartInstantDesign
QueueSupervisedDesign
MarkHumanAssistanceRequired
AttachVisualArtifact
NormalizeDesignArtifact
ValidateDesignCompatibility
StartDesignImplementation
RecordDesignBuildEvidence
PublishDesignPreview
ReplaceDesignAssetBinding
SubmitDesignRevisionRequest
ApproveDesignRevision
GenerateProjectProposal
```

Komande, ne direktne mutable CRUD forme nad centralnim state machine-om.

---

# 39. Minimal events/outbox

```text
DiscoverySessionClaimed
DesignAssetAdded
DesignStrategyReady
DesignStrategyLocked
DesignJobCreated
DesignOperatorHandoffRequired
HumanDesignAssistanceRequired
VisualArtifactAttached
DesignArtifactNormalized
DesignCompatibilityPassed
DesignCompatibilityFailed
DesignImplementationStarted
DesignPreviewReady
DesignAssetReplaced
DesignRevisionRequested
DesignApproved
```

Durable side effects kao email/push/webhook idu preko outbox/event mehanizma, ne direktno iz transaction handler-a gde je moguće.

---

# 40. Implementation milestones

Ne implementirati ceo sistem odjednom.

## DMD-DES-0 — Contracts and persistence

- `DesignIntent`;
- `DesignAsset`;
- `DesignStrategy` versioning;
- `DesignJob`;
- `DesignCandidate`;
- `ApprovedDesignRevision`;
- rule/design-system refs;
- lifecycle constraints.

**Exit:** DB može reprezentovati ceo pipeline bez provider integracije.

## DMD-DES-1 — Design Intake + Cloudinary semantic assets

- Design Intake UX;
- existing website URL;
- reference website URLs;
- client uploads;
- mandatory description;
- semantic role;
- Cloudinary direct/signed upload;
- asset library.

**Exit:** klijent može da formira dovoljno dobar design input bez AI design execution-a.

## DMD-DES-2 — Website Analyzer projection

- URL validation;
- SSRF guard;
- raw analysis store/reference;
- design-relevant projection;
- CTA/content/mobile/visual findings.

**Exit:** Design Strategy dobija relevatnu analizu postojećeg sajta, bez raw audit dump-a.

## DMD-DES-3 — Design Strategy orchestration

- strategy sub-agents;
- validation;
- versioning;
- lock;
- human-readable summary;
- capability enforcement.

**Exit:** sistem može da napravi canonical `DesignStrategy` bez design provider-a.

## DMD-DES-4 — Versioned Rules + Design Systems + Component Registry

- rule registry;
- design-system manifests;
- component registry;
- version pinning;
- admin diagnostics.

**Exit:** executor dobija jasnu vizuelnu gramatiku i implementacione primitive.

## DMD-DES-5 — Handoff Builder

- Human Design Brief;
- machine package;
- asset/reference manifests;
- immutable snapshot/version;
- operator download/copy UX.

**Exit:** operator može da uzme jedan kompletan, kurirani package i prosledi ga Claude Design-u bez dodatnog objašnjavanja projekta.

## DMD-DES-6A — Instant Design MVP

- jedan API provider;
- provider adapter;
- structured DesignSpec ili sandbox prototype;
- candidate persistence;
- preview.

**Exit:** anonymous lead može dobiti instant candidate.

## DMD-DES-6B — Supervised Design MVP

- registration gate;
- operator queue;
- email/push;
- attach visual artifact;
- status controls.

**Exit:** advanced job može proći DMD → operator → Claude Design → DMD.

## DMD-DES-7 — Normalizer + Compatibility Validator

- artifact mapping;
- component mapping;
- media slots;
- capability validation;
- validation diagnostics.

**Exit:** design artifact ne može otići u implementation ako krši product contract.

## DMD-DES-8 — Claude Code/Codex implementation handoff

- code handoff package;
- commit/evidence metadata;
- GitHub webhook;
- build/preview status.

**Exit:** real implementation i Vercel preview su povezani sa DesignJob-om.

## DMD-DES-9 — Client Review + inline asset replacement

- review UI;
- mobile/desktop/full preview;
- media-slot overlays;
- upload/replace;
- asset revisions;
- content revisions.

**Exit:** klijent može sam da promeni sliku bez novog AI generation-a.

## DMD-DES-10 — Revision classifier + approval

- visual vs functional classification;
- scope-change routing;
- `ApprovedDesignRevision`;
- proposal handoff.

**Exit:** prihvaćen dizajn postaje immutable input u commercial/project workflow.

---

# 41. Test matrix

Minimalni testovi pre produkcije.

## Asset semantics

- client upload bez description-a odbijen;
- `unsure` može u intake, ali ne može u final binding bez klasifikacije;
- asset ne može da se veže za drugi session/job bez permission-a;
- Cloudinary binary nije snimljen u DB;
- signed/private asset se ne pretvara slučajno u public permanent URL.

## Design Strategy

- strategy version immutable nakon lock-a;
- nova relevantna izmena pravi novu version;
- forbidden capability ne može postati allowed kroz AI output;
- product manifest version je pinned.

## Handoff

- package je reproducibilan iz refs;
- locked package se ne menja kada DB dobije novu strategy version;
- asset description i role uvek ulaze u handoff;
- human brief sadrži naziv, opis, business goal i design goal.

## Provider

- provider timeout ne gubi DesignJob;
- retry ne pravi duplikat candidate-a bez idempotency key-a;
- switching provider zadržava isti locked DesignStrategy.

## Normalizer/validator

- artifact bez JSON može da se normalizuje;
- invented capability izaziva compatibility failure;
- unknown component ide u explicit candidate extension, ne silent fallback;
- CTA mora imati validan binding.

## Preview/revisions

- replace hero image pravi asset revision, ne novi DesignJob;
- image slot odbija neprikladan role kada je hard constrained;
- functional request se ne tretira kao visual revision;
- accepted revision je immutable.

## Identity

- anonymous instant session može da se claim-uje jednom;
- drugi account ne može da claim-uje isti session;
- supervised job ne startuje bez registered owner-a.

---

# 42. Acceptance invariants

Pipeline se smatra arhitektonski ispravnim tek kada važi sve sledeće:

1. Design executor nikada nije authority za product capabilities.
2. Design executor dobija kurirani context, ne raw discovery dump.
3. Design Strategy sadrži ljudski opis šta projekat predstavlja i šta želi da postigne.
4. Svaki client-upload asset ima značenje/description.
5. DB čuva asset semantiku, Cloudinary binary/delivery.
6. Design asset može da se zameni bez regeneracije celog dizajna.
7. Design systems i rules su versioned i pinned.
8. Existing website audit se projektuje na design-relevant findings.
9. Claude Design output ne mora imati savršen machine schema da bi bio upotrebljiv.
10. Normalizer može da rekonstruiše implementation mapu, ali ne može da izmisli business capability.
11. Compatibility Validator blokira nedozvoljenu funkcionalnost.
12. Claude Code/Codex mapiraju vizuelni rezultat na stvarne product components/engine-e.
13. Build/test evidence je potreban pre `preview_ready`.
14. Client review razlikuje asset/content/visual izmene od functional/scope promena.
15. Approved design je immutable pre Proposal-a.
16. Instant i supervised lane završavaju u istom `DesignCandidate`/review contractu.
17. Provider može da se zameni adapterom bez izmene core DMD workflow-a.

---

# 43. Non-goals za prvi implementation pass

Ne raditi odmah:

- potpuno autonomni production coding u cloudu;
- generički Figma importer za sve slučajeve;
- pixel-perfect visual diff kao hard gate za svaki design;
- automatsko generisanje novih product capabilities iz dizajna;
- kompleksan collaborative design editor;
- full CMS editor unutar DMD preview-a;
- arbitrary third-party scripts u instant prototype-u;
- višemodelsko glasanje samo radi glasanja;
- optimizaciju provider cena pre nego što imamo realne AgentRun podatke.

---

# 44. Završna arhitektonska definicija

DMD Design Intelligence nije „AI napravi sajt“ funkcija.

To je kontrolisan pipeline:

```text
business truth
      ↓
product truth
      ↓
design intent
      ↓
versioned strategy
      ↓
versioned rules + design system
      ↓
semantic assets
      ↓
provider-neutral design execution
      ↓
normalization
      ↓
product compatibility
      ↓
real implementation
      ↓
evidence-backed preview
      ↓
client-controlled revisions
      ↓
immutable design approval
```

Ključna podela odgovornosti ostaje:

> **Client language daje nameru. Business Intelligence daje značenje. Product Intelligence daje granice. Design Intelligence daje strategiju. Design system daje jezik. Designer agent daje vizuelno rešenje. Normalizer daje strukturu. Validator čuva product contract. Claude Code/Codex daju stvarnu implementaciju. Git/build daju dokaz. Klijent daje konačno odobrenje.**

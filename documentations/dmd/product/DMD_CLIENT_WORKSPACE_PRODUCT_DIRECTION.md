# DMD Client Workspace — Product Direction

**Status:** ACTIVE
**Authority:** canonical
**Owner domain:** DMD Product / Workspace
**Supersedes:** `documentations/archive/dmd/superseded-flows/DMD_CLIENT_DISCOVERY_DESIGN_LEAD_FLOW_V2.md`
**Superseded by:** —

**Date:** 2026-09-11
**Last reconciled:** 2026-09-12
**Implementation gate:** Starts only after `DMD-FND-4` is complete.
**Scope:** Client Experience, guided intake, design preview, product routing, commercial handoff and project continuation inside one persistent workspace.

---

## 1. Purpose

DMD is no longer developed as a portfolio-first website with additional AI features.

The portfolio, public projects and Milan Drazic / DMDevelon profile remain an important credibility layer, but they are no longer the primary product journey.

The primary DMD journey becomes:

```text
IDEA
  ↓
DISCOVERY
  ↓
DESIGN
  ↓
SOLUTION
  ↓
COMMERCIAL
  ↓
PROJECT
```

The client does **not** move through these stages as five disconnected products such as:

```text
intake page
→ design page
→ pricing page
→ dashboard
→ project page
```

Instead, the client remains inside **one continuous DMD Workspace** from the first idea through an active project.

The Workspace changes what it shows as the project matures, but the interaction model remains familiar and continuous.

---

## 2. Core product principle

DMD starts from the client's intent, not from technical terminology.

A client does not need to know whether they need:

- a website;
- booking software;
- a marketplace;
- a client portal;
- a CRM;
- a learning platform;
- an AI assistant;
- automation;
- SaaS;
- a custom application;
- or a larger private platform.

The client explains:

- what they want people to be able to do;
- what their business offers;
- how the work happens today;
- what is difficult or inefficient;
- what should happen after a visitor or customer shows interest;
- who needs access;
- what trust, conversion and operational requirements exist.

DMD then turns that intent into a structured digital-product decision.

Canonical principle:

> **Start with the idea, not the technical specification.**

---

## 3. Public conversion entry

The public website remains an introduction and credibility surface, but its primary CTA changes from portfolio browsing to starting a project.

Recommended Hero direction:

```text
I'm Milan Drazic
PR DMDevelon

I design and engineer booking, search and growth systems
for modern service businesses.

From marketplace search engines and appointment systems to
AI assistants and marketing automation. I build digital
infrastructure that helps local businesses grow.

[ Have an idea? Let's build it. ]
[ See my projects ]
```

`See my projects` remains secondary.

The main CTA opens the public DMD Workspace.

The lightbulb in the DMDevelon identity naturally reinforces the product message: idea → product → project.

---

## 4. Replace CodeReviewSection with the new product direction

The existing `CodeReviewSection` / `NEW EXTRA SERVICES` section should be replaced with a section whose purpose is to explain the new DMD journey.

Recommended section heading:

> **Start with the idea, not the technical specification**

Recommended content direction:

A client does not need to decide whether they need a website, booking system, marketplace, portal or custom application before talking to DMD.

They explain what their business does, what they want customers or staff to be able to do and what outcome they are trying to achieve.

DMD guides them through the important questions, builds an understanding of the business, proposes the digital-product structure, presents a real design direction, identifies whether an existing DMDevelon platform can be used and shows the commercial route before a full project is started.

If the client continues, the same Workspace becomes the place where they review development, receive previews, request changes, provide missing information and follow project progress.

Suggested CTA:

> **Start with your idea**

This section is product explanation, not a technical architecture description.

---

# 5. One Workspace throughout the lifecycle

The canonical client lifecycle is:

```text
IDEA
  ↓
DISCOVERY
  ↓
DESIGN
  ↓
SOLUTION
  ↓
COMMERCIAL
  ↓
PROJECT
```

The Workspace remains the client-facing projection throughout this lifecycle.

### IDEA

The user starts with free text and optional supporting material.

Example:

```text
I run a beauty salon and I want clients to stop booking through Instagram messages.
```

or:

```text
I want to build a platform where several therapists can work with clients and publish educational content.
```

No technical brief is required.

### DISCOVERY

DMD asks only useful questions needed to understand the business, audience, offer, workflow, trust requirements, conversion goal and constraints.

The client sees what DMD has understood and can correct it.

### DESIGN

The Workspace begins showing the visual result in the preview area while the conversation remains available.

The client does not leave the Workspace to enter a separate design product.

### SOLUTION

Once DMD understands the business, Product Intelligence determines the most appropriate route.

Examples:

- Marysoll foundation;
- P.DC foundation;
- existing DMD solution foundation;
- custom product;
- larger platform-engineering engagement.

The client does not select a platform before DMD understands the need.

### COMMERCIAL

The same Workspace presents the delivery model, included capabilities, custom work, one-time price, subscription where applicable, hosting/ownership options and next decision.

### PROJECT

After agreement, the same Workspace continues as the client project experience.

It now projects:

- current work;
- milestones;
- tasks;
- staging/preview;
- client dependencies;
- approvals;
- requested changes;
- conversations;
- project evidence;
- what is next.

---

# 6. Dashboard boundary

The existing authenticated Dashboard remains important, but it is **not** a replacement for the Workspace.

Its role is:

- authenticated navigation;
- account ownership;
- list of projects;
- notifications;
- high-level account/project status;
- entry into persistent client work.

A registered client may log in tomorrow, open Dashboard and see the project waiting for them.

Clicking the project returns them to the same Workspace at the correct lifecycle state.

Claimed pre-project Workspace work must also remain visible through this navigator. Registration/claim must not send a user with saved understanding, product direction, design or commercial-review state into the unrelated empty “You haven't requested any services yet” experience. This is the future `DMD-PROJECT-0` acceptance boundary; it does not make pre-project work a `ProjectRequest` or `ClientProject`.

Examples:

```text
Dashboard
→ unfinished Discovery
→ Workspace opens Discovery
```

```text
Dashboard
→ design ready
→ Workspace opens Design Preview
```

```text
Dashboard
→ commercial decision pending
→ Workspace opens Commercial state
```

```text
Dashboard
→ active project
→ Workspace opens Project mode
```

Canonical distinction:

> **Dashboard is the authenticated navigator and ownership surface. Workspace is where the work happens.**

---

# 7. Guest and registration boundary

A user should be able to experience substantial DMD value before creating an account.

The public/guest journey may include:

```text
idea
→ discovery
→ structured understanding
→ design direction
→ initial/homepage preview
→ solution direction
```

Registration becomes necessary when the user wants durable state or a commercial continuation.

Registration/claim is required for actions such as:

- save for later;
- continue tomorrow;
- paid preview unlock;
- supervised design work;
- commercial proposal;
- accepted project;
- ongoing project communication.

This aligns with the planned `guest → claim` lifecycle.

The user must not be forced to register merely to watch a generation spinner.

---

# 8. Workspace UX contract

## 8.1 Desktop

Primary desktop model:

```text
┌──────────────────────────────────────────────────────────────┐
│ DMD   ← Home        Project / Idea                Saved      │
├───────────────────────┬──────────────────────────────────────┤
│                       │ Preview / Solution / Project         │
│ Conversation          │                                      │
│                       │                                      │
│ AI response           │                                      │
│                       │              WORK AREA               │
│ Client response       │                                      │
│                       │                                      │
│ AI response           │                                      │
│                       │                                      │
│ ───────────────────   │                                      │
│ Design allowance      │ Desktop | Tablet | Mobile            │
│ ███████░░░            │                                      │
│                       │                                      │
│ [ message......... ]  │                                      │
└───────────────────────┴──────────────────────────────────────┘
```

The two sides are resizable.

The client may narrow or expand the preview without opening another tab.

Resize is a convenience, not the only responsive-preview mechanism.

## 8.2 Explicit viewport controls

The preview must also expose explicit viewport controls:

```text
Desktop | Tablet | Mobile
```

These are the authoritative responsive-preview modes.

## 8.3 Mobile

On a phone, the product should not attempt to preserve the two-column desktop layout.

Use a fast state switch:

```text
Chat | Preview
```

Switching must preserve conversation and preview state.

DMD may naturally provide a better full design experience on laptop/desktop, but mobile must remain usable.

## 8.4 Toolbar

DMD may adopt familiar editor/agent UI conventions for the preview toolbar rather than inventing novel controls.

Possible later toolbar capabilities include:

- Desktop / Tablet / Mobile;
- zoom;
- fullscreen preview;
- refresh/re-render where appropriate;
- version/history access;
- open preview in separate tab.

For MVP, keep the toolbar minimal.

Do **not** introduce Framer-style page-builder complexity such as arbitrary layers, drag/drop layout editing, generic design-property panels or free-form canvas authoring.

DMD is not a page builder.

---

## 8.5 Pending decisions, asynchronous work and blocked boundaries

The Workspace must treat waiting as a normal product state when the next authorized action depends on a team/client/system decision or on asynchronous work that has not completed yet.

The conversation does not automatically stop because one branch of work is waiting.

The Workspace should determine:

```text
what is waiting
what decision/result is required
what that decision blocks
what can continue independently
```

If useful work remains unblocked, the agent continues the conversation and those independent activities.

Example:

```text
pending:
team review of a non-standard product request

may continue:
business understanding
content clarification
asset collection
questions unrelated to the blocked request

may not continue:
the state transition whose authorization depends on that review
```

If all useful next actions depend on the pending decision, waiting is the correct product behavior.

The client must not be pushed through an invented answer merely to preserve conversational momentum.

### Decision-wait communication

A decision-wait state should be communicated clearly and naturally.

Example direction:

> Ovaj zahtev traži potvrdu tima pre nego što nastavimo sa tom promenom. Zahtev je sačuvan i prosleđen na pregled. Možemo u međuvremenu nastaviti sa delovima koji od te odluke ne zavise.

If no useful work can continue:

> Zahtev je sačuvan i tim ga pregledava. Ovaj sledeći korak zavisi od te odluke, pa ćemo nastaviti odavde čim bude potvrđena.

The exact client-facing copy may adapt to tone, lifecycle and context.

The product should be capable of showing useful state such as:

```text
Awaiting team decision
Requested: <time>
Blocks: <affected action>
Still available: <unblocked work>
```

Elapsed time may be shown when it helps the client or team understand the state.

Do not promise a response deadline unless a real configured service/process commitment exists.

### Asynchronous generation is not an error

The same principle applies when DMD has enough information but a higher-quality asynchronous process must finish before the next artifact is ready.

For example, after Design Intake is sufficient, the Workspace may communicate:

> Imamo dovoljno informacija. Sada pripremamo predlog dizajna na osnovu svega što smo definisali.

The client does not need to know which model, provider, internal agent or engineering tool performs that work.

DMD should prefer a controlled high-quality asynchronous result over generating a weaker immediate result only to appear synchronous.

### Failure remains distinct

The Workspace must distinguish:

```text
awaiting asynchronous result
awaiting authorized decision
temporary capacity limitation
technical failure
```

A pending decision or normal asynchronous job must not render as a generic server error.

Conversely, a genuine technical failure must enter the appropriate recovery/error path rather than being hidden behind a “team review” message.

### Notification continuity

When a decision belongs to the team or another authorized actor, the Workspace should create or project the corresponding actionable notification according to notification policy.

The client-facing conversation may continue independently while that decision is pending.

When the decision is resolved, the Workspace resumes from the preserved lifecycle/context state; the client must not be required to reconstruct or repeat the request.

---

# 9. Design MVP direction

MVP should produce **one strong design direction**, not three automatically generated alternatives.

Do not begin with:

- three websites;
- three palette choices;
- A/B variants;
- several visual concepts generated for every guest.

The user supplies information only they are expected to know, such as:

- an existing logo and brand assets;
- photos and source content/material;
- an existing website;
- reference sites/materials;
- business-grounded preferences;
- elements or colors that must remain;
- examples or directions they strongly want to avoid.

The design system derives the professional design decisions: CTA hierarchy, UX structure, responsive strategy, device prioritization, typography system, SEO/content architecture, funnel structure, interaction model, component structure and motion policy.

A color choice is evidence, not a complete design instruction.

A client may express preferences in any of these areas, but DMD must not turn professional design decisions into a required questionnaire.

Industry is also a signal, not a hardcoded rule.

Do not implement simplistic logic such as:

```text
therapist = green
dentist = blue
beauty = pink
```

The final design direction should consider:

```text
business
+ audience
+ trust requirement
+ conversion goal
+ brand
+ client preference
+ visual references
+ accessibility
+ product constraints
```

Palette generation may later use formal color relationships, tonal scales, contrast requirements and semantic color roles, but the exact algorithm is not locked by this document.

---

# 10. Preview economics

DMD must not expose provider tokens to clients.

The client does not need to understand:

```text
12,000 tokens
$1.82 inference cost
3 agent calls
```

They see a product concept such as:

```text
Design preview
███████░░░
```

or:

```text
Your free preview includes:
✓ business discovery
✓ product direction
✓ homepage design
✓ responsive preview
```

Internally, DMD may track real resource consumption such as:

- model calls;
- input/output tokens;
- design-provider operations;
- image operations;
- website analysis;
- agent-job duration;
- retries;
- external-provider cost.

These measurements are needed for economics and capacity control, not for client-facing UX.

---

# 11. Free preview and unlock model

The free experience must provide enough value for a serious prospect to determine whether DMD understands the business and can produce a useful solution.

The goal is not to give unlimited free design work.

The preferred model is:

```text
Discovery
→ complete understanding
→ complete Design Strategy / design direction
→ page/section structure
→ homepage rendered
```

For a small project, the full preview may fit inside the free allowance.

For a more expensive project, DMD may have enough structured information to know the full direction while showing only the initial rendered scope.

Example client message:

> Your design direction is ready. Unlock the remaining project preview and continue refining it.

If the full design was already rendered internally, DMD must not falsely state that the work still needs to be generated.

In that case the honest wording is:

> Your full draft is ready. Unlock the complete preview.

No artificial scarcity or misleading progress language should be used.

---

# 12. Preview Unlock Tiers

The AI agent may assess project complexity in structured form.

Example:

```text
pages: 5
majorSections: 12
booking: true
clientAccounts: true
admin: true
customWorkflow: moderate
designComplexity: moderate
```

The AI agent does **not** freely choose a price.

The system converts structured complexity and resource use into a deterministic preview tier.

Initial conceptual tiers:

```text
LIGHT
STANDARD
EXTENDED
```

Each tier will eventually map to an allowance and a defined price/budget.

Exact thresholds and prices are intentionally **not canonical yet**.

They must be calibrated from real provider costs, real user behavior and conversion results.

---

# 13. Unit economics and free-user budget

DMD cannot offer unlimited expensive AI/design execution to anonymous Internet traffic.

Initial economics should be evaluated at cohort level rather than pretending every user has identical cost.

Example model:

```text
10 free testers
× average acquisition compute cost

compared with

2 converted clients
× expected project/subscription revenue
```

The objective is to find the minimum useful free experience that produces sufficient trust and conversion without creating an unsustainable acquisition cost.

As real data appears, DMD may increase or decrease the free allowance.

---

# 14. Capacity and overload are product behavior

Public AI/design access must have capacity controls from the beginning.

Potential controls include:

- per-IP limits;
- per-guest-session limits;
- per-account limits;
- time-window limits;
- per-design-job limits;
- global concurrent-job capacity;
- provider-budget limits;
- queue priority.

Potential user classes may later include:

```text
anonymous
registered
paid preview
active client
```

with different priority and allowance.

If capacity is unavailable, DMD may legitimately return a controlled `429` state such as:

> Design capacity is currently full. Please try again shortly.

A temporary lack of free capacity is preferable to uncontrolled provider cost or unreliable processing.

---

# 15. Product selection comes after understanding

DMD must not begin by asking the user to choose:

```text
Marysoll
P.DC
Custom
Marketplace
Website
SaaS
```

The correct flow is:

```text
client intent
→ business understanding
→ verified need
→ capabilities
→ product fit
→ product route
```

Only after understanding is sufficient does DMD recommend a foundation or delivery model.

Examples:

### Existing product foundation

> Your business needs appointment booking, service presentation, client history and customer communication. These capabilities already exist in our beauty platform, so we can adapt the existing foundation rather than rebuild them from zero.

### Custom route

> Your workflow does not cleanly fit one existing DMDevelon platform. We can reuse selected infrastructure, but the product itself should be built around your specific workflow.

The client sees the recommendation and reasons without needing internal Product Intelligence terminology.

---

# 16. Commercial decision gate

Discovery and refinement must not continue indefinitely at unlimited provider cost after the system already has enough information for a viable first product.

Once enough information exists, the agent may clearly explain:

> We now have enough information to define a viable first version. Additional discussion at this stage is unlikely to improve the initial product significantly. The next useful step is to choose how you want the project delivered.

The Workspace then presents a guided commercial decision, for example:

- recommended solution;
- included capabilities;
- custom capabilities;
- one-time development cost;
- monthly platform/maintenance cost where applicable;
- expected delivery model;
- hosting option;
- ownership/license option;
- migration option where relevant.

The user may close the commercial modal and continue reviewing existing information or ask clarifying questions.

However, the system is not required to continue unlimited new design/analysis generation without a commercial decision.

Commercial pressure must remain clear and professional rather than manipulative.

---

# 17. Retention and cleanup

## 17.1 Anonymous Workspace

Anonymous Workspace state is temporary and may expire automatically.

## 17.2 Registered unpaid project

A registered user account should **not** be deleted merely because the user has been inactive.

Instead, temporary/unpaid project data may follow an inactivity lifecycle.

Initial direction:

```text
inactive project
→ day 30 reminder
→ 15-day decision window
→ day 45 cleanup if no action
```

The reminder should explain that the saved project will be removed unless the user continues, chooses a paid preservation/continuation route or deletes it themselves.

Exact timing remains configurable, but `30-day warning → 45-day cleanup` is the initial product direction.

## 17.3 What may be removed

Cleanup may include:

- messages;
- intake data;
- temporary requirements;
- private assets;
- client-specific preview state;
- temporary analysis;
- unpaid design-session state.

The account itself may remain.

---

# 18. De-identified Design Review Artifact

When an expired project is removed, DMD may retain a **de-identified Design Review Artifact** only if the retained data cannot identify or reconstruct the client/private project.

Potential retained information:

- industry class;
- design grammar;
- layout pattern;
- component combination;
- palette relationships;
- rule/validation failures;
- human design-review score;
- broad conversion-result class;
- reusable anonymous design-system lessons.

Do not retain merely for training/review purposes:

- client name;
- company name;
- email;
- uploaded private images;
- private documents;
- private business copy;
- credentials;
- private chat;
- confidential business data.

The artifact exists to improve DMD design rules and review quality without turning abandoned project data into an uncontrolled archive.

---

# 19. Demo Design Gallery — future low-cost path

A future acquisition route may allow the user to choose between:

```text
Start from your idea
```

and:

```text
Start from a proven design
```

A proven/demo design can significantly reduce generation cost.

The user selects a design, describes the business and DMD adapts the existing design structure through controlled composition:

```text
demo design
→ business understanding
→ capability mapping
→ section/block add/remove/reorder
→ content adaptation
→ branding/palette adaptation
→ product route
```

This is not a rigid template marketplace.

The selected design is a reusable design foundation that can be adapted through DMD's design and product rules.

This is a future capability and is not part of the first Workspace MVP.

---

# 20. Project Mode

After commercial acceptance, the Workspace continues instead of being replaced.

Project Mode should eventually support:

- current work;
- milestones;
- tasks;
- project progress;
- staging links;
- previews;
- design revisions;
- client inputs still required;
- decisions/approvals;
- change requests;
- onboarding;
- deployment/domain state;
- conversations;
- AI-assisted requests;
- engineering evidence.

The client-facing projection remains simple.

Example:

```text
Šta se sada radi
Dizajn početne stranice

Šta čekamo
Ništa od vas

Planirani sledeći korak
Preview za pregled

Šta ćete moći da uradite
Odobrite dizajn ili tražite izmene
```

The client does not need Git commits, internal agent names, architecture terminology or engine implementation details.

---

# 21. AI-assisted Project communication

During active development, the client may continue talking to DMD through the Workspace and project milestone conversations.

A client request such as:

```text
Želim da ova sekcija bude drugačija i da ovde dodamo još jednu uslugu.
```

should eventually flow through:

```text
client request
→ AI interpretation
→ structured intent
→ compare with accepted scope/current project state
→ impact classification
→ CTO/admin review where required
→ approved change
→ engineering handoff
→ implementation
→ tests/build
→ staging
→ evidence
→ client-facing update
```

Canonical invariant remains:

> **AI interprets. The system decides. The engine executes.**

AI does not directly rewrite accepted scope, pricing or canonical project truth.

---

# 22. Engineering participation and automation direction

DMD should progressively automate the existing supervised engineering workflow rather than pretending coding is fully autonomous from the beginning.

Target direction:

```text
client request
→ DMD interpretation
→ orchestration
→ approved structured work
→ approved engineering agent/tool
→ implementation
→ tests
→ build
→ staging
→ evidence
→ DMD Project Intelligence
```

Human participation remains where required for:

- architecture decisions;
- commercial decisions;
- risky changes;
- product-boundary decisions;
- QA/review;
- security/privacy;
- ambiguous client intent;
- failed automated verification.

Automation increases only after repeated manual/supervised flows become stable enough to formalize.

---

# 23. Parallel real-project dogfooding

The new Workspace and Project Intelligence should be validated against multiple real project shapes rather than one custom scenario.

Initial staging projects include:

### Petra / Psihointegritet

Useful for testing:

- larger service/knowledge platform;
- existing solution foundation adoption;
- content-heavy workflows;
- multiple actors;
- evolving requirements;
- long-running project state;
- substantial scope/change decisions.

### Sanja

Useful for testing:

- smaller professional/service business;
- ordinary tenant/client path;
- simpler product fit;
- content/design/product decisions with less platform complexity.

The same Workspace and Project Intelligence model should support both without project-name-specific logic.

If the product requires `if (psihointegritet)` or `if (sanja)` behavior in shared product rules, the abstraction should be reconsidered.

---

# 24. Development strategy after FND-4

DMD must not be developed as:

```text
months of frontend
→ months of backend
→ add AI later
→ connect everything later
```

The product should grow through vertical slices.

| Slice | Client receives | System behind it |
|---|---|---|
| `DMD-WORKSPACE-0` | Hero CTA → fullscreen Workspace | UI shell, responsive/resizable panes, fixture state |
| `DMD-WS-1` | anonymous conversation can persist/resume/claim | DiscoverySession, messages, guest ownership/resume/claim; no AI required |
| `DMD-OPS-0` | safe durable operational foundation | audit, jobs, retries, diagnostics; may progress independently after FND-4 |
| `DMD-AI-0` | conversation can begin real interpretation | AgentRun, schemas and provider-neutral adapter after both WS-1 and OPS-0 |
| `DMD-BI-1` | editable living understanding | facts, provenance, confidence, contradictions, no-repeat logic |
| `DMD-BI-2` | useful advisory brainstorming | recommendations, alternatives and trade-offs kept separate from facts |
| `DMD-BI-3` | explicit understanding confirmation | completeness, Understanding Gate, versioned VerifiedBusinessState |
| `DMD-PI-1 / PI-2 / BP-1` | recommended solution/product route | CapabilityModel, ProductRouteDecision, SolutionBlueprint |
| `DESIGN` (`DMD-DES-0 → DMD-DES-6`) | intake → strategy → generation/preview → review/revision → approval | canonical detailed TODO milestones ending in immutable ApprovedDesignRevision |
| `DMD-COM-0` and later Commercial slices | unlock, delivery choice, pricing/proposal | commercial configuration, proposal/acceptance/payment after approved design |
| `DMD-PROJECT-0` and Project Mode | claimed pre-project continuity and ongoing project experience | dashboard projection, formal handoff, WorkOrder, changes, previews, ProjectEvidence |
| `DMD-CONV-0` | shared assistance in Ask a question, group chat and DM | source-linked candidate actions through existing authorization/change control; intentionally last |

Legacy extraction may continue in parallel through `DMD-FND-5 → DMD-FND-8`.

The new client product should not wait for complete retirement of all legacy routes after the FND-4 architecture/security gate exists.

---

# 25. Pre-expansion gate

The following sequence remains mandatory before implementation of the new Workspace product begins:

```text
DMD-FND-1 COMPLETE
↓
DMD-FND-2 React 18 fresh baseline
↓
DMD-FND-2A React 19.2 isolated upgrade
↓
DMD-FND-3 complete-system inventory
↓
DMD-FND-4 architecture/security shell
======================================
DMD READY FOR PLATFORM EXPANSION
↓
DMD-WORKSPACE-0
```

Do not begin production implementation of `DMD-WORKSPACE-0` before this gate is complete.

Design discussion/prototyping may continue, but the implementation boundary remains explicit.

---

# 26. DMD-WORKSPACE-0 — first expansion slice

**Status:** NOT STARTED  
**Dependency:** `DMD-FND-4 COMPLETE`

## Goal

Create the first client-facing shell for the new DMD product without prematurely implementing Discovery, AI, payment or the Design Engine.

## Initial scope

- update primary Hero CTA;
- demote `See my projects` to secondary action;
- replace the current CodeReview/New Extra Services section with the new product explanation;
- add public Workspace route;
- provide fullscreen Workspace shell;
- desktop split layout;
- resizable left/right panes;
- mobile `Chat | Preview` switch;
- explicit Desktop / Tablet / Mobile viewport toolbar;
- fixture conversation;
- fixture business-understanding state where useful;
- fixture design preview;
- clear return-to-home navigation;
- visual guest state;
- preserve room for future allowance/unlock UI without implementing economics yet.

## Explicitly out of scope

Do not add in `DMD-WORKSPACE-0`:

- real AI provider calls;
- AgentRun infrastructure;
- DiscoverySession persistence;
- payment;
- Preview Unlock charging;
- Product Intelligence;
- Design Engine;
- real proposal generation;
- project automation;
- generic page-builder capabilities;
- multiple design variants;
- final color-generation algorithm.

The goal is to validate the Workspace interaction model before deeper systems populate it.

---

# 27. Decisions intentionally left open

The following are **not** canonical yet and should be decided through testing and implementation evidence:

- final Workspace product name;
- final Hero copy;
- exact toolbar controls;
- exact pane width defaults/minimums;
- exact free allowance;
- exact LIGHT/STANDARD/EXTENDED thresholds;
- exact unlock prices;
- exact provider/model routing;
- exact design-generation provider;
- exact number of allowed guest messages/jobs;
- exact global concurrency limits;
- final 30/45-day retention values if evidence suggests better thresholds;
- exact color-wheel/palette algorithm;
- multiple design variants;
- gallery/template commercial model;
- exact commercial modal layout;
- exact pricing presentation;
- final client-facing terminology for all lifecycle phases.

These decisions should be made from real staging use, provider costs, conversion data and client behavior rather than guessed in advance.

---

# 28. Final product direction

DMD should become:

> **One client workspace from the first idea to an active digital product and ongoing engineering project.**

It is not primarily:

- a portfolio;
- an AI website builder;
- a page builder;
- a generic chatbot;
- a design-only tool;
- a project-management dashboard.

Its value is the continuity between:

```text
understand the business
→ determine what should be built
→ design it
→ choose the correct product/delivery route
→ agree commercially
→ build it
→ verify it
→ continue improving it
```

The client sees one coherent experience.

Internally, DMD may use Business Intelligence, Product Intelligence, Design Engine, Commercial configuration, Project Intelligence, AI agents, orchestration, engines, repositories, provider adapters and engineering evidence.

Those internal systems exist to make the client journey reliable; they are not the journey itself.

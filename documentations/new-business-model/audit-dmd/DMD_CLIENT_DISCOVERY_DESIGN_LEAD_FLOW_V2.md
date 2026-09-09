# DMD Client Discovery, Product Recommendation & Design Lead Flow — V2

**Parent:** `DMD_PLATFORM_EXPANSION_MASTER_PLAN.md`  
**Related:** `DMD_BUSINESS_INTELLIGENCE_DISCOVERY.md`, `DMD_DESIGN_ENGINE_CLIENT_FLOW.md`

---

## 1. Product goal

The landing should stop asking a lead to choose a technical implementation before DMD understands the business.

Primary promise:

> Describe what you need in your own words. DMD will understand the business flow, tell you what kind of product solves it, show you a compatible design, and turn the approved result into a build plan.

The system must support both:

- non-technical business owners;
- technical buyers/freelancers who already know terms such as CRM, marketplace, booking, LMS or dashboard.

Technical labels are optional shortcuts, never requirements.

---

## 2. Landing changes

### New section: How DMD works

Suggested information hierarchy:

```text
Tell us how your business works
→ DMD identifies what users need to do
→ the system matches required capabilities to the right product
→ you see a design made for your business
→ you approve the solution and build plan
→ development and progress continue in the same workspace
```

### Primary CTA

Not:

> Buy Website

Better:

> Describe what you need

Secondary CTA:

> See how DMD finds the right solution

Both go to the dedicated discovery surface.

---

## 3. Dedicated lead route

Recommended route:

```text
/start
```

Do not place the full experience in a modal on `/`.

`/start` is a product workspace, not a contact form.

After a session exists:

```text
/start/[sessionId]
```

The raw ID alone must not grant access. Use an opaque/session access mechanism and secure httpOnly cookie. When a resume/share link is needed, use expiring one-time or revocable tokens.

---

## 4. Flow stages

### Stage A — Fast first input

Ask only enough to begin:

- project/business name optional;
- free-text: “What are you trying to improve or build?”;
- optional website/social/product links;
- optional screenshots/images;
- optional shortcut cards:
  - Booking / service business;
  - Marketplace / matching;
  - Education / membership;
  - CRM / internal workflow;
  - Content / subscription;
  - E-commerce;
  - I am not sure.

Cards are hypotheses, not route decisions.

### Stage B — Guided Business Discovery

Chat is the UI; structured state is the product.

The interface should show lightweight progress, for example:

```text
Business model       understood
Audience             understood
Main user action      needs clarification
Current workflow      understood
Integrations          partial
Brand/design          later
```

Do not expose internal schema jargon unless the user wants advanced mode.

### Stage C — “This is what you mean” checkpoint

Before routing/design:

> Based on what you described, this is how your business needs the digital system to work.

Show a concise, editable business-flow summary.

Client can:

- confirm;
- correct one fact;
- add missing information.

Only confirmed/high-confidence facts cross the Understanding Gate.

### Stage D — Capability Model

The user does not need to see the raw registry, but can see a human explanation:

```text
Your system needs:
✓ client self-service booking
✓ private admin availability
✓ service packages
✓ flexible prices
✓ client records
○ automated payments not required now
```

### Stage E — Product recommendation

Example:

> Your requirements fit the Marysoll service-business product natively. We will configure it around your services, working hours, private/public availability and brand. You do not need a separate booking plugin, CRM and website project.

or:

> Your requirement is a two-sided expert/learner network with matching and paid content. It fits the P.DC product family with an education configuration.

or:

> This changes the core operating model of our existing products, so DMD recommends a custom product rather than forcing it into Marysoll/P.DC.

The internal route remains `native/configurable/product_extension/custom_required`.

### Stage F — Solution Blueprint

The lead sees a non-technical solution summary:

- who uses the system;
- what each actor can do;
- primary journey;
- main screens;
- required integrations;
- data/import needs;
- current exclusions;
- unresolved decisions.

This is the bridge between “idea” and design.

### Stage G — Design generation

Design generation is a server-side job triggered from the interactive frontend.

The first design path should be fast and compatible:

```text
SolutionBlueprint
→ DesignStrategy
→ approved Design Grammar
→ block/component registry
→ Brand Configuration
→ AI DesignSpec proposal
→ deterministic validator
→ renderer
→ preview
```

### Stage H — Client selection

The client can:

- select candidate;
- compare candidates;
- request visual refinement;
- provide assets;
- say that the solution itself is wrong.

If feedback changes only design tokens/layout expression, stay in Design flow.

If feedback changes business workflow/capabilities, return to Product Intelligence.

### Stage I — Commercial/build acceptance

After design/solution confidence is high:

- create/register account if not already done;
- persist formal ProjectRequest;
- generate Master Proposal draft;
- calculate/recommend product + DMD engineering commercial model later;
- client accepts proposal explicitly;
- project/provisioning starts.

---

## 5. Existing website analysis

If the lead provides a site, DMD may analyse it before proposing strategy.

### Collect

- page structure;
- headings;
- CTAs;
- forms;
- navigation;
- public copy;
- metadata/SEO basics;
- screenshots/responsive surfaces;
- obvious conversion contradictions;
- accessibility/performance signals where available.

### Treat external site content as untrusted data

A public page may contain text designed to manipulate an agent.

The website analyser must receive it inside a strict **data boundary** and have no mutation tools.

It can output observations, never executable instructions.

### SSRF controls

A server-side URL analyser must:

- allow only HTTP/HTTPS;
- resolve and block localhost/private/link-local networks;
- cap redirects;
- cap body/download size;
- set timeouts;
- validate final resolved destination;
- isolate browser execution;
- never forward DMD cookies/secrets.

---

## 6. Blumen example — strategy before requested technology

Suppose Blumen says:

> We want cheaper AI phone/SMS/Instagram assistants because we have too many calls.

But the current site says on almost every CTA:

```text
Call us
Write to us on Instagram
Call for information
```

A good DMD flow should detect the contradiction:

```text
business goal = reduce synchronous/manual contacts
current CTA strategy = generate synchronous/manual contacts
```

The strategist should first ask:

- what callers usually ask;
- what can be self-served;
- what should happen on the website before contact;
- whether booking/catalog/availability/status can answer those questions;
- which calls actually require a human.

Possible result:

> The first solution is not an AI phone agent. The website needs to move repetitive intent into self-service flows and reserve calls for exceptions.

Only after that does DMD decide whether SMS/Instagram/voice automation is still required.

This is exactly why DMD is not prompt → site generation.

---

## 7. Design compatibility contract

AI must not generate arbitrary executable website code in the public lead session.

It outputs a structured `DesignSpec`.

Example shape:

```ts
DesignSpec {
  productFamily
  productVersion
  designSystemVersion
  pageType
  layoutPattern
  sections: [
    {
      blockKey
      variant
      purpose
      contentRefs
      capabilityRefs
      ctaRef
      layoutConfig
    }
  ]
  brandTokens
  motionProfile
  responsiveRules
}
```

Validator checks:

- every block exists;
- block is supported by routed product;
- required capability exists;
- invalid/unsafe layout combinations rejected;
- accessibility baseline;
- no fabricated business facts;
- CTA respects strategy;
- product business logic unchanged.

Then the renderer creates the preview.

---

## 8. Marysoll compatibility example

Client asks for:

- calendar;
- public free slots;
- private/admin slots;
- packages;
- exact/from/on-request pricing;
- working hours editing.

DMD maps that to Marysoll capabilities and generates a unique visual design.

It does **not** create a new calendar/booking business implementation for this tenant.

Design differences are allowed. Business-rule divergence is not.

---

## 9. P.DC product family expansion

P.DC should be modelled as a broader expert/knowledge network product family, not a therapy-only template.

Possible configurations:

### Expert matching

```text
providers ↔ intake/matching ↔ clients
```

### Language / 1:1 education

```text
teachers ↔ learner needs ↔ student matching/booking
```

### Creator / publishing

```text
creator/editorial team
→ public + subscriber content
→ reader membership
```

### B2B knowledge/support

```text
company members
→ curated experts/content/programs
→ organization entitlement
```

Domain-specific rules are configuration/capability packages. The core network/product invariant stays stable.

---

## 10. Premium design path

Two design service levels can exist later without changing architecture.

### Instant compatible design

- generated through DMD API agents;
- fast;
- structured;
- block/design-system constrained;
- metered by AgentRun/DesignJob.

### Premium design review / Claude Design handoff

Current research confirms Claude Design is an Anthropic beta product with design-system import and Claude Code handoff. DMD should treat it as an **optional human-supervised premium adapter**, not a core API dependency.

Flow:

```text
verified Blueprint + assets + DMD design-system package
→ PremiumDesignJob
→ operator exports/hands off to Claude Design
→ refined design/prototype
→ Claude Code/Codex handoff
→ implementation branch/commit
→ DMD evidence ingestion
```

If this costs additional usage/human time, expose it later as optional design credits or premium service. Do not hardcode price now.

---

## 11. UX for long-running work

Never keep a client staring at a blocked HTTP request.

Design job UI:

```text
Understanding your requirements
Building design strategy
Creating candidate
Validating platform compatibility
Preparing preview
```

Backend job state is authoritative. Frontend may stream status/event updates but cannot invent progress.

---

## 12. Abuse/cost gates for public discovery

Before account/payment:

- rate limit by session/IP/device risk;
- asset size limits;
- URL analysis quotas;
- capped discovery turns;
- one basic design candidate or limited preview;
- provider token budget per session;
- captcha/risk challenge only when needed;
- email verification before expensive repeated generations.

All provider usage must be recorded even while final pricing is undecided.

---

## 13. Acceptance criteria

1. A lead can explain a business without knowing technical terminology.
2. A technical lead can still use CRM/LMS/marketplace terms as shortcuts.
3. No design generation begins before Understanding Gate passes.
4. Product routing is capability-based and auditable.
5. Design candidates cannot bypass product/design-system constraints.
6. A visual change does not mutate product business logic.
7. A business-flow change returns to Product Intelligence.
8. Existing website analysis cannot execute instructions from analysed pages.
9. API keys never reach the browser.
10. A lead can proceed from discovery to formal ProjectRequest/Proposal without re-entering the same information.

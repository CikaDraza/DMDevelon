# DMD — Product Validation, Internal Dogfooding & Demand Intelligence Plan

**Status:** SUPPORTING
**Authority:** companion
**Owner domain:** Product Validation
**Supersedes:** —
**Superseded by:** —

**Document class:** Product/validation plan
**Purpose:** Define how DMD is validated against real project work, how existing product families are used as executable product knowledge, and how future customer demand becomes evidence for product and business decisions.

---

# 1. Purpose

DMD is not only a lead-generation, project-tracking or AI-assistant application.

Its long-term role is to connect:

```text
Client need
→ Business understanding
→ Product fit
→ Solution
→ Design
→ Commercial scope
→ WorkOrder
→ Implementation
→ Engineering evidence
→ Client-visible project state
→ Change requests
→ Product learning
```

The system must operate against real products and real project work.

It must never recommend capabilities or products that do not exist merely because they could theoretically be built.

At the same time, unsupported requests are valuable information. They should be retained as structured demand evidence rather than ending as discarded conversations.

This creates an additional future intelligence layer:

```text
Business Intelligence
Product Intelligence
Project Intelligence
        ↓
Demand Intelligence
        ↓
Business / Product Planning
```

---

# 2. Existing product portfolio as executable truth

DMD should reason from products that actually exist and from their published capabilities.

The current product portfolio includes several different product families.

## Marysoll

Marysoll is the specialized Beauty vertical.

It represents an existing SaaS product with capabilities such as booking, client management, loyalty, notifications, content, salon operations and related growth functionality.

Requests that strongly match the Beauty operating model should normally route toward Marysoll rather than being forced into a generic professional-services platform.

## P.DC — Professional Digital Center

P.DC is the primary extensible professional/service/knowledge-business platform.

It is intentionally broader than a therapy platform.

Psihointegritet is the founding mental-health implementation, but the product architecture must not assume:

```text
P.DC = therapist software
```

Instead, P.DC may support businesses centered around:

```text
professional
→ client
→ service / consultation
→ intake
→ booking / engagement
→ documents / content
→ communication
→ ongoing relationship
```

This allows P.DC to evolve toward consultants, educators, mentors, advisors and other service businesses when their required capabilities fit the product model.

## CMR Discovery Search Engine

CMR represents an existing search/discovery-oriented capability family.

If a client's problem maps to capabilities already implemented there, DMD can identify that existing technical/product foundation instead of proposing a completely new build.

## Spirit Tutor

Spirit Tutor provides an existing foundation for conversational tutoring and learning applications.

If a client requests:

* language learning;
* AI tutoring;
* guided conversational learning;
* adaptive educational assistance;

DMD may recognize that there is already reusable implementation knowledge and a product/code foundation from which a new solution can be developed.

It does not need to treat such a request as greenfield development.

---

# 3. Product truth rule

The Product Registry / Product Manifest represents what DMD can truthfully offer.

If a product does not exist, DMD must not present it as available.

For example, if a client asks today for:

```text
Magento redesign
+ checkout repair
+ payment integration
```

and DMD has no production-ready E-commerce platform, the system may determine that Magento work does not fit the current product portfolio.

It must not invent a DMD E-commerce product.

The result may instead be:

```text
unsupported by current product portfolio
→ evaluate custom work
→ evaluate reusable product extension opportunity
→ provide a valid alternative if one actually exists
```

In the future, if DMD gains an E-commerce ProductDefinition with compatible capabilities, the same business request can legitimately produce a different route:

```text
existing Magento
→ migration candidate
→ DMD E-commerce Platform
→ data migration
→ supported checkout/payment capabilities
→ requested extensions
```

The routing architecture does not need to change.

Only the available product knowledge changes.

---

# 4. No artificial dead ends

An unsupported implementation request should not automatically become:

```text
"We do not do this."
```

DMD should first determine what outcome the client actually wants.

A requested technology is often not the real business requirement.

For example:

```text
"Fix my Magento checkout."
```

may represent the underlying requirements:

```text
reduce checkout failures
improve payment reliability
improve conversion
simplify customer flow
support a required payment provider
```

Product Intelligence should evaluate those requirements independently from the implementation technology requested by the client.

The system can then distinguish:

```text
existing supported capability
configurable capability
reusable product extension
custom implementation
unsupported technology constraint
no currently valid route
```

If a simpler solution exists for both the client and DMD, it should be recommended.

If the client still wants the more complex implementation and DMD chooses to support it, complexity must become visible in scope, price, maintenance burden and deadline.

Technical possibility alone is not sufficient reason to accept work.

---

# 5. Commercial decision principle

A client request should be evaluated across several dimensions:

```text
client outcome
product fit
implementation complexity
reusability
maintenance burden
delivery risk
external dependencies
estimated development effort
commercial value
```

A more complex requested solution may remain possible, but it should not receive the same commercial treatment as a simpler solution using an existing product capability.

The system should help answer:

```text
Can we do it?
Should we do it?
Is there a simpler solution?
Does it improve one of our products?
Is this a one-client customization?
What changes in price?
What changes in deadline?
What new maintenance obligation does it create?
```

AI may interpret the request and propose classifications.

The deterministic system/engine owns product fit and workflow decisions.

Commercial approval remains an explicit system/admin decision.

---

# 6. P.DC as the primary DMD validation project

P.DC will be the primary platform through which the new DMD architecture is validated.

Instead of creating synthetic demonstration projects only for testing, DMD should be used internally as though DMD itself were a real client requesting work on P.DC.

This is deliberate product dogfooding.

P.DC development should therefore pass through the same lifecycle intended for external clients:

```text
Discovery
→ VerifiedBusinessState
→ CapabilityModel
→ ProductRouteDecision
→ SolutionBlueprint
→ DesignStrategy / Design work
→ ApprovedDesignRevision
→ CommercialConfiguration
→ Proposal
→ WorkOrder
→ implementation
→ tests/build
→ Git evidence
→ EngineeringProjection
→ client-visible project state
```

The objective is not to simulate a perfect sales conversation.

The objective is to force DMD to manage a real, continuously changing software project.

---

# 7. Internal P.DC project scenarios

P.DC gives DMD a realistic environment for exercising both ordinary delivery and changing requirements.

During development we should intentionally use DMD for cases such as:

```text
new feature request
existing feature redesign
scope expansion
scope reduction
architecture constraint
unexpected implementation difficulty
new dependency
deadline change
price change
client content/input dependency
design revision
implementation revision
bug discovered during testing
product extension candidate
unsupported request
alternative solution proposal
```

This creates evidence that Project Intelligence can track a real project rather than a static project plan.

---

# 8. Change-request lifecycle

A client does not need to understand the internal project structure before making a request.

The client may simply write naturally in the project communication channel.

Example:

```text
"I want users to upload several images,
have AI analyze them,
generate a report,
and notify the whole team."
```

AI interpretation may derive:

```text
multi-file media requirement
storage impact
AI vision requirement
new report artifact
team notification workflow
possible usage-cost increase
```

The system then compares that requirement against:

```text
current WorkOrder
current SolutionBlueprint
available product capabilities
current project state
```

The result may classify the request as:

```text
existing scope
small implementation change
product extension
large scope change
new commercial requirement
unsupported request
```

A material scope change should not silently become engineering work.

It should create a structured review for the administrator.

---

# 9. Admin review instead of raw-message escalation

When a client request requires human review, the administrator should not receive only:

```text
"Client sent a message."
```

The system should prepare useful structured context.

For example:

```text
Scope-impacting request detected

Requested outcome:
...

Affected capabilities:
...

Current WorkOrder impact:
...

Likely implementation class:
...

Dependencies:
...

Simpler supported alternative:
...

Potential product extension:
...

Commercial review required:
yes
```

The administrator can then validate or correct the interpretation.

Only after that should the approved requirement become implementation input.

---

# 10. Engineering handoff

Once a request is approved for implementation, DMD should produce a curated engineering/design handoff suitable for the actual implementation workflow.

Depending on the task, the handoff may be used with:

```text
Claude Design
Claude Code
Codex in VS Code
other approved implementation tooling
```

The coding/design agent receives the structured approved state, not an uncontrolled raw chat history.

The resulting implementation follows the normal engineering cycle:

```text
approved requirement
→ implementation
→ tests
→ build
→ commit
→ GitHub
→ evidence ingestion
→ ProjectEvidence
→ EngineeringProjection
→ client-visible update
```

DMD therefore does not rely on the coding agent telling the project system what happened.

Repository/build/test evidence provides the implementation truth.

---

# 11. Client feedback after implementation

When engineering evidence confirms an implementation state change, DMD may notify the client.

Examples include:

```text
requested change implemented
preview available
design ready for review
build failed
additional client input required
scope proposal ready
request rejected with alternative
milestone completed
```

A rejection should, where possible, contain a useful route rather than a generic refusal.

The alternative must still be truthful and based on products or delivery options that actually exist.

---

# 12. Staging data strategy

The staging environment should contain only the data necessary to exercise realistic product flows.

Initial migrated fixtures should include only essential baseline records such as:

```text
admin account
selected ordinary client accounts
public Services
public Projects
required CompanyProfile / public CMS state where needed
```

Production notification history should not be copied.

Production chat history should not be copied.

Production diagnostic/audit logs should not be copied.

These datasets would increase storage/noise while providing little validation value.

Instead, staging should generate its own history naturally.

This is useful because:

```text
Chat
Notifications
Audit / diagnostics
ProjectEvidence
EngineeringProjection
```

will then record activity produced by actual DMD testing.

The resulting records become evidence that the new workflows themselves work.

---

# 13. Notifications as generated workflow evidence

Notifications should be generated from real project events rather than migrated as historical fixtures.

Relevant future events include:

```text
project approved
proposal available
scope changed
price changed
deadline changed
design completed
client review required
large client request detected
admin review required
WorkOrder changed
engineering evidence received
preview ready
client input required
```

The same principle applies to diagnostic/audit records.

A staging audit trail that was generated by the staging system is much more valuable than a copied production audit trail.

---

# 14. Demand Intelligence

Once DMD is used by real clients, unsupported and extension requests become a valuable business dataset.

The system should eventually aggregate demand patterns across projects without treating every one-off request as a product roadmap item.

Potential signals include:

```text
requested capability
product family
industry/business model
number of independent clients requesting it
frequency over time
existing-product fit
estimated implementation complexity
estimated reusable percentage
custom-only percentage
proposal acceptance
price resistance
lost opportunity
delivered revenue
delivery cost
maintenance cost
support burden
```

Demand Intelligence must remain evidence-driven.

One unusual request should not automatically create a new platform.

Repeated commercially meaningful demand may justify investigation.

---

# 15. From demand evidence to business planning

Over time DMD may answer questions such as:

```text
What capabilities are clients repeatedly asking for?

Which requests currently cause us to reject otherwise good leads?

Which product extensions appear across several industries?

Which existing products receive the most extension demand?

Which custom projects could become reusable product capabilities?

Which potential new product family has enough demand to justify development?

What are clients willing to pay for?

Which requested capabilities produce recurring revenue rather than one-time work?

Which areas create too much maintenance for their commercial value?
```

At that point DMD becomes not only a system for executing projects but a source of evidence for deciding **what DMD should build next as a business**.

Conceptually:

```text
Client requests
→ structured demand records
→ capability clusters
→ commercial evidence
→ opportunity analysis
→ business case
→ product decision
→ ProductDefinition
→ Product Manifest
→ available to future Product Intelligence routing
```

A new platform therefore enters DMD because evidence justified its development, not because an AI model imagined that it might be useful.

---

# 16. Example future E-commerce decision

Suppose multiple qualified leads request:

```text
catalog migration
checkout
payment providers
orders
customer accounts
inventory
shipping
discounts
```

Initially these requests may route to:

```text
CUSTOM / UNSUPPORTED CURRENT PRODUCT PORTFOLIO
```

Demand Intelligence may later show:

```text
high request frequency
strong overlap between projects
high reusable capability percentage
high commercial value
acceptable maintenance model
recurring-revenue opportunity
```

That is the point at which DMD can support creating a business plan for an E-commerce product family.

Only after the product is actually designed, implemented and represented by a real ProductDefinition/Manifest should Product Intelligence begin recommending it.

---

# 17. Validation rule

Architecture and workflow decisions should not be considered permanently correct merely because they look correct in documentation.

The validation loop is:

```text
proposed architecture
→ implementation
→ staging use
→ real project use
→ evidence
→ observed problem
→ decision
→ documentation update
→ next implementation
```

Documentation describes the currently accepted system.

When staging/live evidence demonstrates that the design is insufficient, the decision should be revised explicitly and the documentation updated before later work depends on the new behavior.

This prevents:

```text
documentation says A
TODO says B
implementation assumes C
coding agent invents D
```

---

# 18. Validation statuses

Important product/architecture decisions can conceptually pass through:

```text
PROPOSED
The idea exists but has not yet been accepted.

CANONICAL
The decision is the current implementation contract.

VALIDATED
The implementation has been exercised through meaningful staging/live use
and evidence supports the decision.
```

A VALIDATED decision can still change later.

Validation means that it survived the current level of practical testing, not that it can never be revised.

---

# 19. Primary validation strategy

P.DC will carry the largest share of early end-to-end DMD validation because it is actively evolving and has a broad reusable professional-services model.

Marysoll provides a second, specialized product family with materially different business constraints.

CMR and Spirit Tutor provide additional existing foundations for future product-routing tests.

Together they allow Product Intelligence to demonstrate that DMD does not select products by superficial industry label.

It selects them from:

```text
business requirements
→ capabilities
→ product manifests
→ implementation fit
→ extension requirements
→ commercial route
```

That capability-driven routing is the foundation for adding future product families without redesigning DMD itself.

---

# 20. Long-term outcome

The long-term objective is a closed product-development loop:

```text
DMD discovers client needs
        ↓
DMD routes toward existing products
        ↓
DMD manages delivery and changes
        ↓
engineering evidence updates DMD
        ↓
DMD records unsupported/repeated demand
        ↓
Demand Intelligence identifies opportunities
        ↓
business planning determines what should be built
        ↓
new/revised product capabilities enter Product Registry
        ↓
DMD can serve more future client needs
```

This makes customer work itself one of the inputs into product strategy.

The system should therefore improve not only its ability to deliver projects, but also its ability to determine **which products and capabilities are economically worth developing next**.

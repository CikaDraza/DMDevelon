# DMD — Technology Licensing & Client Rights

**Status:** Commercial / Legal Architecture  
**Purpose:** Define the client-rights models that may apply to DMDevelon products, custom software and platform-engineering engagements.

> This document defines DMD product/commercial policy and classification. Final contract language, enforceability and jurisdiction-specific intellectual-property terms should be reviewed by qualified legal counsel before use in a binding agreement.

## 1. Core principle

DMD must separate two questions:

```text
WHAT ARE WE BUILDING?
→ Productized Delivery
→ Custom Product Development
→ Platform Engineering

WHAT RIGHTS IS THE CLIENT BUYING?
→ SaaS Use
→ Custom Use License
→ Technology License
→ Exclusive License
→ IP Assignment / Full Buyout
```

These are independent dimensions.

A technically large project does not automatically transfer intellectual property.

A client may receive source code without owning all intellectual property contained in the delivered system.

A client may own its data, branding and custom business content while DMDevelon retains ownership of reusable engines, shared architecture and pre-existing technology.

The contract must define the boundary explicitly.

## 2. Rights classification

Recommended internal DMD rights classifications:

```text
SAAS_USE
CUSTOM_USE_LICENSE
TECHNOLOGY_LICENSE
EXCLUSIVE_LICENSE
IP_ASSIGNMENT
```

These classifications represent progressively broader rights and progressively greater commercial/legal consequences.

They should not be inferred only from project size or price.

## 3. SAAS_USE

The client purchases the right to use an existing DMDevelon software product under the applicable subscription or service terms.

Typical examples:

```text
Marysoll subscription
P.DC subscription
future DMD-hosted SaaS products
```

Typical client rights:

```text
use the hosted product
configure supported settings
use agreed product capabilities
store and process their permitted business data
receive agreed support and updates
```

DMDevelon typically retains:

```text
source code
product architecture
reusable components
engines
automation systems
AI orchestration
shared infrastructure
general-purpose improvements
product roadmap
```

## 4. CUSTOM_USE_LICENSE

A Custom Use License applies when DMDevelon develops a dedicated or materially customized software product for the client, while retaining ownership of pre-existing and reusable technology.

The client receives broad rights to use the delivered application for the agreed business purpose.

Depending on the contract, the client may also receive repository or source-code access necessary to maintain the custom application.

Source delivery does not automatically equal IP transfer.

Typical structure:

```text
CLIENT-SPECIFIC LAYER
- client branding
- client content
- custom business rules
- dedicated workflows
- client-specific configuration
- custom integrations
- client-specific UI

DMDEVELON CORE / REUSABLE LAYER
- pre-existing libraries
- reusable engines
- orchestration
- generic automation
- shared components
- infrastructure patterns
- generic AI workflows
- know-how
```

The agreement should define which parts belong to which category.

## 5. TECHNOLOGY_LICENSE

A Technology License applies when the client receives explicit rights to use a defined part of DMDevelon reusable or core technology beyond ordinary use of the delivered application.

Examples may include:

```text
reusable engine
automation framework
orchestration system
AI workflow system
shared platform module
platform architecture package
Product Intelligence capability
Project Intelligence capability
```

Technology Licensing is not automatic in Platform Engineering.

It must be an explicit commercial/legal decision.

A Technology License should define, where relevant:

```text
what technology is licensed
permitted business use
internal use vs commercial resale
number of organizations / deployments
territory
duration
number of users or instances
modification rights
source-code access
hosting rights
sublicensing rights
white-label rights
redistribution rights
support obligations
update rights
termination conditions
```

The price should reflect the breadth of the granted rights.

## 6. EXCLUSIVE_LICENSE

An Exclusive License grants the client defined exclusivity over specified technology, market usage, territory, industry, customer segment or time period.

Exclusivity should never be assumed to mean “everything forever.” It must define the exact boundary.

Possible forms include:

```text
industry exclusivity
territorial exclusivity
customer-segment exclusivity
competitor restriction
time-limited exclusivity
exclusive commercial license to a defined module
```

Exclusive rights reduce DMDevelon's ability to monetize or reuse technology elsewhere.

Therefore pricing must account for:

```text
lost licensing opportunities
lost product opportunities
market restriction
duration of exclusivity
territorial scope
competitor scope
future maintenance obligation
legal exposure
```

Exclusivity requires human and legal review.

## 7. IP_ASSIGNMENT / FULL BUYOUT

IP Assignment is the strongest rights model.

Specified intellectual-property rights are transferred to the client according to the agreement.

Depending on the scope of the assignment, DMDevelon may lose the right to commercially reuse, license, distribute or further develop the transferred technology.

This is fundamentally different from delivering software or licensing it.

A full buyout must not be priced only as:

```text
engineering hours × hourly rate
```

The commercial value should consider:

```text
engineering cost
IP value
future reuse value
lost future revenue
lost licensing revenue
lost product opportunity
exclusivity premium
transition burden
documentation burden
legal risk
support/knowledge-transfer obligations
```

The agreement should explicitly distinguish:

```text
Background IP / Pre-existing IP
Foreground IP / Newly created client-specific IP
Third-party components
Open-source components
Client-owned materials
```

## 8. Source code is not the same as ownership

DMD must not treat these statements as equivalent:

```text
"The client receives the source code."

"The client owns all intellectual property."
```

They are different.

A client may receive repository access and the right to maintain the delivered system while DMDevelon retains ownership of reusable components contained within it.

Source access, license scope and ownership are separate contract dimensions.

## 9. Client-owned assets

The agreement should normally distinguish client-owned materials such as:

```text
brand identity
logos
client-created content
client business data
client customer data
client-owned documentation
client-provided media
client-provided trademarks
```

from DMDevelon technology.

Client ownership of these assets does not imply ownership of the software platform that stores or presents them.

## 10. Pre-existing DMDevelon technology

Unless explicitly transferred, the following should normally remain DMDevelon IP:

```text
reusable engines
shared libraries
generic components
platform architecture
workflow orchestration
automation systems
Product Intelligence
Project Intelligence
generic AI workflows
development tooling
deployment patterns
security patterns
diagnostic systems
generic integration adapters
methods and know-how
improvements not unique to the client's confidential business logic
```

This boundary protects the ability to continue developing Marysoll, P.DC, DMD and future products.

## 11. Custom development and reusable improvements

A custom engagement may produce improvements useful beyond the individual client.

The agreement should determine whether such improvements:

```text
remain DMDevelon reusable technology
belong exclusively to the client
are jointly usable
are subject to a license-back
```

This becomes especially important when a client funds development of a capability that can become part of a broader DMDevelon product.

DMD must flag such cases for commercial/legal review before work begins.

## 12. Resale and white-label rights

If the client plans to resell, sublicense or white-label the delivered system, DMD should not treat it as ordinary internal use.

Relevant questions include:

```text
Will the client sell access to third parties?
Will the client operate the platform for its own customers?
Will the client sublicense the technology?
Will the client white-label it?
Will the client create derivative commercial products?
Will the client operate multiple instances for unrelated businesses?
```

A positive answer may require a Technology License, Platform Engineering agreement, revenue-share model, commercial redistribution license, or IP Assignment depending on the arrangement.

## 13. DMD agent behavior

AI agents may identify rights-related intent.

Examples:

```text
"We want to own everything."
"Can we get the source code?"
"Can we sell this to our customers?"
"Will you build the same thing for our competitors?"
"Can we host it ourselves?"
"Can our developers continue development?"
"Can we use your engine in another product?"
```

The agent may explain the available models at a high level.

It must not automatically promise:

```text
ownership
exclusive rights
perpetual rights
sublicensing
redistribution
territorial exclusivity
IP assignment
```

Such requests require human commercial/legal review.

## 14. Client-facing explanation

### Ordinary SaaS

> You are purchasing access to the product and its capabilities. The platform itself remains our technology.

### Custom Product

> We can build a dedicated product for your business and define broad usage and maintenance rights. Our pre-existing reusable technology remains separate unless we explicitly agree otherwise.

### Technology License

> If you also need rights to use part of our underlying technology outside the delivered application, we can structure a separate technology license.

### Exclusive rights

> Exclusivity is possible in defined cases, but its scope, duration and market impact must be agreed separately.

### Full ownership / buyout

> If you require transfer of the relevant intellectual-property rights so the technology becomes yours rather than licensed to you, that is a separate acquisition/buyout structure with a materially different price.

## 15. Commercial hierarchy

A useful conceptual hierarchy is:

```text
USE
↓
CUSTOM USE
↓
LICENSE
↓
EXCLUSIVE LICENSE
↓
ASSIGNMENT / BUYOUT
```

The broader the rights, the greater the commercial value and legal responsibility.

The engineering effort may stay identical while the transaction price changes substantially because the asset rights being transferred are different.

## 16. Relationship with delivery class

DMD should model delivery and rights independently.

Examples:

```text
PRODUCTIZED DELIVERY + SAAS_USE
Marysoll subscription

CUSTOM PRODUCT + CUSTOM_USE_LICENSE
Dedicated client application using DMDevelon reusable components

PLATFORM_ENGINEERING + CUSTOM_USE_LICENSE
Large private platform, but DMDevelon retains core platform technology

PLATFORM_ENGINEERING + TECHNOLOGY_LICENSE
Private platform plus licensed reusable DMDevelon technology

PLATFORM_ENGINEERING + EXCLUSIVE_LICENSE
Private platform plus agreed exclusivity

PLATFORM_ENGINEERING + IP_ASSIGNMENT
Full or partial technology acquisition / buyout
```

This prevents accidental transfer of valuable rights merely because the implementation project is large.

## 17. Pricing rule

Rights affect price independently from development cost.

A commercial model may conceptually consider:

```text
TOTAL COMMERCIAL VALUE =
engineering effort
+ delivery risk
+ infrastructure
+ support
+ maintenance
+ IP exposure
+ reuse restriction
+ exclusivity
+ future revenue sacrificed
+ legal/transition obligations
```

DMD should never imply that a full IP buyout is simply the ordinary project fee with a small surcharge.

## 18. Human/legal review gates

Mandatory human review should be triggered by requests involving:

```text
source-code ownership
technology licensing
commercial redistribution
white-label rights
sublicensing
exclusive rights
competitor restrictions
territorial restrictions
perpetual licenses
IP assignment
full buyout
joint ownership
license-back rights
```

The commercial agreement should not become binding until the rights model is explicitly confirmed.

## 19. Documentation and evidence

For significant licensing or assignment agreements, DMD should eventually track:

```text
delivery classification
rights classification
licensed technology
excluded/background IP
source-code access
hosting rights
resale rights
sublicensing rights
exclusivity
territory
term
maintenance/support
commercial approval
legal approval
signed agreement
effective date
```

These are commercial/legal records, not implementation truth.

Repository evidence can show what was delivered, but the contract determines what rights were transferred.

## 20. Core invariant

```text
CODE DELIVERY ≠ IP TRANSFER

PLATFORM ENGINEERING ≠ TECHNOLOGY LICENSE

TECHNOLOGY LICENSE ≠ EXCLUSIVE LICENSE

EXCLUSIVE LICENSE ≠ IP ASSIGNMENT
```

Each step changes the economic and legal relationship.

DMD must treat those distinctions as explicit decisions rather than assumptions.

## 21. Summary

DMD separates technical delivery from intellectual-property rights.

Recommended rights models:

```text
SAAS_USE
CUSTOM_USE_LICENSE
TECHNOLOGY_LICENSE
EXCLUSIVE_LICENSE
IP_ASSIGNMENT
```

The client may buy access, a custom-use right, a technology license, exclusivity, or ownership.

Those options have fundamentally different prices, risks and legal obligations.

DMDevelon core technology remains protected unless a contract explicitly grants broader rights.

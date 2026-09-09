# DMD Expansion — Security, Reliability & AI Safety Gates

**Purpose:** Define the gates that must exist before AI agents can analyse external content or propose state-changing project actions.

---

## 1. Threat model

The new DMD surface will process:

- anonymous/public lead prompts;
- public websites;
- uploaded images/documents;
- private business descriptions;
- project chat;
- GitHub code/documentation;
- integration metadata;
- DB exports;
- outputs from several AI providers.

Therefore the attack surface is materially larger than the current portfolio/project app.

---

## 2. AI agency rule

Agents receive the **minimum tool set** required for their role.

Examples:

### Website analyzer

Can:

- read a safe website snapshot;
- return structured observations.

Cannot:

- write project state;
- read other clients;
- read credentials;
- send messages;
- call arbitrary URLs.

### Project Q&A

Can:

- read authorized project projection;
- propose a classification/action.

Cannot:

- accept proposal;
- change budget;
- delete data;
- modify permissions.

### Command gateway

Not an LLM. It is deterministic authorization/policy code.

---

## 3. Prompt injection boundary

Treat every retrieved external artifact as untrusted content.

Never concatenate:

```text
system instructions + arbitrary webpage/repo text
```

without explicit data boundaries and tool restrictions.

External text cannot override:

- system policies;
- user/project authorization;
- product invariants;
- allowed tools;
- output schema.

RAG does not itself solve prompt injection.

---

## 4. Human/system approvals

High-impact actions require independent mediation.

Examples:

- send proposal;
- accept proposal;
- change price/timeline;
- add a new paid phase;
- change project membership;
- connect privileged integration;
- delete/cancel accepted work;
- production provisioning;
- import/overwrite data.

Agent may draft. Engine/policy + authorized actor applies.

---

## 5. Auth/environment hardening

Before launch of AI/private discovery:

- `JWT_SECRET` mandatory; fail startup if absent;
- validate all required env at startup;
- explicit production origin allowlist;
- rate limits for auth/discovery/AI/upload;
- CSP appropriate to frontend/providers;
- access-token storage hardening plan;
- session invalidation tests;
- no provider API keys in browser/client bundles.

---

## 6. Secret/integration handling

Do not collect via normal chat:

- passwords;
- API keys;
- DB connection strings;
- OAuth refresh tokens;
- service account JSON;
- private keys.

Use dedicated secure connection flow and store a reference to a secret vault/provider connection.

DMD DB stores:

```text
connectionId
provider
owner/project
scopes
status
verifiedAt
```

not secret plaintext inside chat/message/project documents.

---

## 7. Private files

Classify uploads:

```text
public_brand_asset
client_shared
internal_engineering
credential_sensitive
private_data_export
```

`private_data_export` and `credential_sensitive` never use a permanent public CDN URL.

Use private object storage/signed delivery and retention policy.

---

## 8. AI output handling

Provider output is untrusted until validated.

Pipeline:

```text
provider response
→ parse
→ schema validate
→ domain validate
→ authorization/policy
→ escape/sanitize for output surface
```

Never execute generated HTML/JS/shell/SQL from public lead agents.

---

## 9. Web analysis controls

- SSRF prevention;
- safe browser sandbox;
- no DMD cookies;
- file/content limits;
- redirect limits;
- network allow/deny policy;
- robots/legal policy where applicable;
- malware/file-type checks for downloads.

---

## 10. GitHub webhook controls

- GitHub App installation allowlist;
- signature validation;
- delivery ID idempotency;
- event type allowlist;
- repository stable-ID match;
- enqueue before heavy work;
- raw payload retention bounded/secured;
- no trust in commit message alone.

---

## 11. Workflow reliability

Every background workflow must define:

```text
idempotency key
retryable errors
non-retryable errors
max attempts
timeout
compensation/reconciliation path
```

Use DLQ/review state for exhausted jobs.

---

## 12. AI cost/abuse controls

- per-session token budget;
- per-agent max turns;
- design generation quota;
- URL analysis quota;
- asset count/size limits;
- provider rate limit handling;
- usage ledger;
- account/email verification before repeated expensive jobs;
- global emergency disable per agent/provider.

---

## 13. Data minimization

An agent gets only the context needed for its task.

Examples:

- CTA strategist does not need DB credentials;
- design composer does not need proposal budget unless design tier requires it;
- client Q&A does not need internal security findings;
- external premium design tool gets curated assets/blueprint, not complete DMD DB.

---

## 14. Auditability

Record:

- actor;
- agent key/model/provider;
- policy/rule version;
- aggregate/version read;
- command proposed;
- approval/rejection;
- command applied;
- evidence refs;
- result/error class.

Do not store private chain-of-thought.

---

## 15. Production gates

### Gate A — AI read only

Discovery/extraction/analysis, no mutations.

### Gate B — AI proposes low-risk commands

Human/admin applies.

### Gate C — policy auto-applies narrow low-risk commands

Only after audit data proves reliability.

### Gate D — provisioning automation

Only after idempotency/reconciliation and permission review.

Do not skip directly to autonomous write access.

---

## 16. Acceptance criteria

1. External website text cannot call DMD write tools.
2. No AI provider key exists client-side.
3. Missing critical env stops deployment/startup.
4. Duplicate webhooks/jobs are idempotent.
5. Private DB exports cannot be retrieved by public permanent URL.
6. Agent cannot change authorization/commercial state without downstream policy.
7. Every state-changing AI-originated action is auditable.

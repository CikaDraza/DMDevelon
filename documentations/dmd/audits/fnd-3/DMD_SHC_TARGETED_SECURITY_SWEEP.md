# DMD SHC Targeted Same-Pattern Security Sweep

**Status:** AUDIT EVIDENCE — COMPLETE
**Authority:** evidence-only
**Owner domain:** Foundation / Security
**Supersedes:** —
**Superseded by:** —

**Date:** 2026-09-12
**Baseline:** `staging` / `origin/staging` at `9d09d0a`; SHC-1 implementation `5e18d24`; `main` / `origin/main` at `25fa70a`
**Scope:** read-only same-pattern inspection of mutation branches in `app/api/[[...path]]/route.js`

---

## 1. Purpose and boundary

This is the bounded sweep required after SHC-1. It is not DMD-FND-3B and does not broaden FND-3 into a security refactor.

The review looked only for the agreed authorization-defect family:

```text
mutation before authentication
conditional authentication
PUT/PATCH authentication attached only to a privileged field
updateOne/findByIdAndUpdate/save without actor/resource authorization
browser userId/ownerId treated as authority
DELETE without resource ownership
authenticated endpoint without resource-level authorization
```

No runtime code, schema, endpoint, auth framework or test was changed by this sweep.

---

## 2. Method

The catch-all `POST`, `PUT`, `DELETE` and `PATCH` handlers were reviewed branch by branch. Mutation calls (`create`, `save`, `updateOne`, `findOneAndUpdate`, `findByIdAndUpdate`, `deleteOne`, `deleteMany` and `findByIdAndDelete`) were reconciled against authentication, actor authority, resource lookup and branch ordering.

Direct browser identity inputs and raw request bodies passed to Mongo/Mongoose mutations received a second pass. A local query-construction check, without a database write, confirmed that Mongoose preserves this payload as an update operator:

```json
{"$set":{"isAdmin":true}}
```

The sweep is source evidence. It does not claim staging deployment verification.

Current SHC-1 regression baseline was re-run against the local Mongo test replica set: `npm run test:api` passed 13 files and **245/245** tests. Expected stderr represents asserted negative authorization, validation and provider-failure paths.

---

## 3. Result

One additional actively exploitable Critical defect in the agreed pattern family was found: **SHC-2**.

No other active High/Critical instance of this same mutation/authorization pattern was found in the reviewed catch-all branches.

| Pattern | Result |
|---|---|
| Mutation before authentication | No additional active High/Critical finding |
| Conditional authentication | SHC-1 pattern removed by `5e18d24`; no second conditional gate found |
| Privileged field protected only by a shallow body check | **SHC-2 found** |
| Raw update/save without actor/resource authorization | Admin-only raw editors remain FND-4 hardening input; **SHC-2 is exploitable by an ordinary account** |
| Browser `userId` / `ownerId` used as authority | ID-bound self route verifies token actor equals target; no cross-account IDOR found in this pass |
| DELETE without ownership/authority | No additional active High/Critical finding |
| Authenticated endpoint without resource-level authorization | **SHC-2 field-level authorization bypass found** |

---

## 4. SHC-2 — Self-service admin privilege escalation through Mongo update operators

```text
SECURITY HOTFIX CANDIDATE
severity: critical
source:   targeted same-pattern sweep after SHC-1
status:   FIXED — LOCALLY VERIFIED, AWAITING PUSH/STAGING DEPLOY
endpoint: PUT /api/users/:id
affected: staging and main source baselines reviewed above
```

### Evidence

The route correctly requires authentication and permits an ordinary user to target only their own ID:

- `app/api/[[...path]]/route.js:5414-5424` on `staging`;
- `app/api/[[...path]]/route.js:5409-5419` on `main`.

However, privileged-field filtering examines only the top-level body property:

```js
if (body.isAdmin !== undefined && !user.isAdmin) {
  delete body.isAdmin;
}
```

The complete body is then passed to `User.findByIdAndUpdate(id, body)`.

An authenticated non-admin updating their own ID can therefore send:

```json
{"$set":{"isAdmin":true}}
```

`body.isAdmin` is `undefined`, so the guard does not remove the nested operator field. Mongoose preserves `$set.isAdmin` as an update operation. The stored user is promoted to admin.

The privilege is effective on subsequent requests without trusting a browser-supplied role: `lib/auth.js:55-67` reloads the user document from MongoDB and returns its current `isAdmin` value to endpoint authorization checks.

### Classification

This is not merely missing validation or a future actor-resolved-route improvement. A normal authenticated account can cross the global admin authorization boundary on active source. It therefore qualifies as Critical under the existing SHC governance exception.

### Required hotfix boundary

SHC-2 should remain a separate owner-authorized hotfix. Its minimum contract should be:

```text
authenticate
→ authorize actor against target
→ construct a server-owned allowlist of mutable fields
→ hash/normalize allowed values where required
→ mutation
```

The request body must never be passed directly as a Mongo update document. Regression coverage must include direct and operator-shaped privilege/provenance payloads.

The owner subsequently authorized this bounded implementation. Local fix and verification evidence is recorded in `documentations/dmd/audits/fnd-3/DMD_SHC_2_VERIFICATION.md`; it does not select the eventual FND-4 actor-resolved endpoint design.

---

## 5. Non-SHC observations retained for later reconciliation

- Several admin-only legacy editors still pass broad request bodies into Mongoose updates. They require allowlists and validation during their owning migration slices, but this sweep found no ordinary/anonymous actor path through their admin gates.
- The ID-bound self-profile route remains architectural debt already assigned to FND-4. SHC-2 can close the active privilege escalation without extracting or redesigning the endpoint.
- SHC-1 deployment was not verified by this local source sweep. Git history proves its implementation is contained in `staging` and `origin/staging`; environment/deployment evidence remains a separate gate.

---

## 6. Execution consequence

The sweep is complete. SHC-2 is closed: staging deployment `dpl_5dVsNgBKCvXoK3KsSdyNVsw3zEhN` passed the authenticated mutation smoke, and main-specific revision `1982f40` is live through Ready production deployment `dpl_GHFD1fh2mZa9DtviAuLphYmjrpM1`. The bounded production smoke passed without production-secret export or data mutation.

```text
SHC-1 implementation/merge
→ targeted same-pattern sweep
→ SHC-2 hotfix/local verification
→ staging deploy/smoke
→ minimal equivalent main fix and production smoke
→ DMD-FND-3B unblocked
```

DMD-FND-3B remains `NOT STARTED` until its audit begins; it is now the next authorized FND-3 work.

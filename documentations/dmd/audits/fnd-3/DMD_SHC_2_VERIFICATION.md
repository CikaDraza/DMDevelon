# DMD SHC-2 Verification Evidence

**Status:** AUDIT EVIDENCE — LOCAL VERIFICATION COMPLETE
**Authority:** evidence-only
**Owner domain:** Foundation / Security
**Supersedes:** —
**Superseded by:** —

**Date:** 2026-09-12
**Vulnerable revision:** `65af19c`
**Fixed revision:** `f2a6aa0`
**Branch:** `hotfix/shc-2-user-update-boundary`
**Endpoint:** `PUT /api/users/:id`

---

## 1. Implemented boundary

SHC-2 closes only the proven mass-assignment/Mongo-operator injection defect:

```text
authenticated actor
→ self OR admin authorization
→ recursive unsafe-key rejection
→ load target/current state required by existing rules
→ construct an explicit actor-specific allowlist
→ derive security-owned fields on the server
→ {$set: update}
→ runValidators: true
```

Allowed fields are:

```text
SELF:  name, image, email, password
ADMIN: name, image, email, password, isAdmin
```

All other fields are absent from the constructed update. Any key beginning with `$` or containing `.` is rejected recursively, including inside nested objects and arrays.

Existing behavior intentionally preserved by this hotfix:

- self-or-admin authorization against the URL target ID;
- active-project email-change guard;
- password hashing and server-derived `sessionVersion` increment in the same atomic user update;
- admin password reset;
- admin role promotion/demotion, including self-demotion.

No endpoint extraction, frontend contract change, central auth framework, email-verification redesign or password-lifecycle redesign was included.

---

## 2. Regression verification

Focused contract:

```bash
npx vitest run tests/integration/user-update-authz.test.mjs tests/integration/auth-user-shape.test.mjs --project chat-api
```

Result: **2 files, 13/13 tests passed** — 12 SHC-2 cases plus the existing auth user-shape contract.

Full verification:

```text
npm run test:api   → 14 files, 257/257 passed
npm run typecheck  → passed
npm test           → 9/9 passed
npm run test:ui    → 8 files, 55/55 passed
npm run build      → passed, Next.js 16.2.10 production build
```

Expected stderr in the API runs represents asserted authorization, validation and simulated provider-failure paths.

The first sandboxed build attempt failed because Turbopack was denied permission to create a helper process/local port. The identical build command passed outside that sandbox restriction; this was an environment limitation, not a source/build failure.

---

## 3. Negative control

The exact fixed test file was run against the exact vulnerable revision in a temporary detached worktree:

```text
vulnerable SHA: 65af19c
test:           tests/integration/user-update-authz.test.mjs
command:        npx vitest run tests/integration/user-update-authz.test.mjs --project chat-api
result:         4 failed, 8 passed (12 total)
```

Expected failures on the vulnerable revision:

1. top-level `$set.isAdmin` returned `200` instead of `400` and exercised the privilege-escalation path;
2. nested unsafe operator/path payload returned `200` instead of `400`;
3. caller-controlled `sessionVersion: 999` persisted instead of remaining server-owned;
4. invalid allowed-field type surfaced as `500` instead of the hotfix contract's `400`.

The same 12 tests pass on fixed revision `f2a6aa0`. The regression suite therefore distinguishes the vulnerable and repaired implementations.

---

## 4. Deferred FND-3B findings

### AUTH-EMAIL-1

Current account-email mutation does not:

- require the current password;
- clear `emailVerified`;
- clear `verifiedAt`;
- require verification of the replacement address;
- normalize through an `emailNormalized` field;
- invalidate existing sessions.

An admin may also replace another user's email through this endpoint, subject to the existing active-project guard. Current evidence does not show `emailVerified` authorizing a critical server operation, so this is not classified as SHC-3 before the DMD-FND-3B impact analysis.

### AUTH-PASSWORD-1

Self password change requires a valid session but not knowledge of the current password. An admin may reset another user's password through the same endpoint.

DMD-FND-3B must assess current-password requirements, a dedicated admin reset operation, audit requirements and re-authentication/recovery consequences. SHC-2 preserves the current API/frontend contract and the existing session invalidation behavior.

For the 3B inventory, record the endpoint using separate authority dimensions:

```text
authentication_source: bearer token
actor_identity_source: authenticated User
target_resource_source: URL path :id
authorization_basis: self-id OR actor.isAdmin
client_supplied_authority_fields before SHC-2: isAdmin + raw Mongo update body
client_supplied_authority_fields after SHC-2: none
```

---

## 5. Release gate

Local implementation and verification are complete. Deployment is not claimed by this artifact.

The approved staging-first sequence remains:

```text
push hotfix branch
→ deploy to staging
→ account/profile/admin-role smoke
→ immediately promote to main
→ production smoke
→ resume DMD-FND-3B
```

If evidence of active exploitation appears, incident handling may replace staging-first with an explicitly authorized production-first response.

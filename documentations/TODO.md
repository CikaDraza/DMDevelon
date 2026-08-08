# TODO — Project Communication Hub

Prateći dokument uz [PROJECT_CHAT_PLAN.md](./PROJECT_CHAT_PLAN.md) (v2).
Ovde se označava šta je urađeno, a šta nije.

Legenda: `[ ]` nije urađeno · `[x]` urađeno · `[~]` u toku · `[-]` odloženo / preskočeno uz obrazloženje

Status: **Faza 1 u toku — sekcije 1–12 kod-kompletne, plus 12b/12c/12d/12e i 12f (isporuka notifikacija, chat scroll, pin i optimizacija). Sledeća: Sekcija 13 (finalna verifikacija/regresija) — traži dva browsera i dozvolu za pisanje u pravu bazu.**
Poslednje ažuriranje: 2026-08-08 · **365 testova, sve prolazi**: `npm test` 163 (čiste funkcije, `node --test`) + `npm run test:api` 180 (integracioni, pravi route handleri protiv jednokratne Mongo replike) + `npm run test:ui` 22 (jsdom, chat komponente + zvono). `npm run build` prolazi; `npx tsc --noEmit` čist; `pyright` čist. Sekcije 4, 5, 6 i 10 uživo testirane protiv produkcione baze sa jednorazno kreiranim, potom obrisanim test podacima (uz izričitu dozvolu pre svakog destruktivnog koraka)

v3 dopuna ugrađena pre Sekcije 4: **cross-cutting invarijante I1–I10** (sekcija 3A, razrada u planu 4A) i **životni ciklus projekta / preživljavanje istorije** (plan 5A). Modeli su već usklađeni sa I5 i I10 — `dmKey`, `ProjectMember.name/email`, `ChatRead.clearedAt`, `ClientProject.ownerAccountDeletedAt`.

Sekcija 4: `GET /client-projects[/:id]` scoping+serializer, milestone chat otvoren za članove, `/api/upload` gate, i tri `project-requests` 401→404 ispravke — sve implementirano i verifikovano uživo protiv produkcione baze (admin/owner/stranac, isključivo read-only pozivi + jedan upload bez fajla). Nula regresije potvrđeno na realnim podacima, ne samo unit testovima. Detalji i otkriveno neslaganje dokumentacije (nepostojeća `/api/project-proposals` ruta) u sekciji 4 i 4b niže.

Sekcija 5: kompletan invitations/membership API (7 endpointa), transakcioni accept (I2), `app/invite/page.js`, register-kroz-poziv. **Uživo test od 35 provera** pronašao i potvrdio ispravku pravog bug-a u Mongoose `.create()` pozivu unutar transakcije (detalji ispod).

Sekcija 6: kompletan Chat API (11 endpointa: liste, detalj, poruke, pin, read/clear, DM, edit/delete). **Uživo test od 49 provera, sve prošlo bez ijedne ispravke** — prva sekcija u ovom projektu gde uživo test nije otkrio nijedan bug, verovatno zahvaljujući disciplini uspostavljenoj u prethodnim sekcijama (array-oblik `.create()` pod transakcijom, eksplicitno odsustvo ključa umesto `undefined`).

---

## 0. Dokumentacija

- [x] `documentations/PROJECT_CHAT_PLAN.md` — plan izrade (v1)
- [x] `documentations/TODO.md` — ova lista (v1)
- [x] v2 bezbednosna dopuna oba dokumenta: matrica rola, odvojeni Invitation/Member, allowlist serializeri, audit log, prošireni E2E napadi
- [-] Kratak rezime zatečenog toka pre početka implementacije — **već postoji**, to je Sekcija 2 plana („Zatečeno stanje — tri nepovezana toka poruka", badge sistem, nepostojeći invite flow), napisana pre prve linije koda. Pisanje drugog rezimea istog nalaza bio bi duplikat.
- [x] v3 dopuna: cross-cutting invarijante I1–I10 (plan sekcija 4A) + životni ciklus i preživljavanje istorije (plan sekcija 5A)

---

## 1. Modeli

- [x] `models/ProjectInvitation.js` — poziv kao zaseban entitet
  - [x] `emailNormalized` (literal `trim().toLowerCase()`), `intendedRole`, `personalMessage`
  - [x] **`tokenHash` = sha256(raw)** — sirovi token nikad u bazi
  - [x] `status: pending|accepted|expired|revoked`, `expiresAt` (+7d), `acceptedAt`, `acceptedByUserId`
  - [x] indeksi: unique `(tokenHash)`, unique partial `(projectId, emailNormalized)` za `pending`, `(projectId, status)`
- [x] `models/ProjectMember.js` — samo trajno članstvo (nastaje TEK po prihvatanju)
  - [x] `userId` required, `role: collaborator|viewer|client_lead|project_admin`, `status: active|suspended|removed`, `roleLabel`
  - [x] **`name` + `email` denormalizovani** (I10) — bez njih obrisan nalog daje prazan red u listi učesnika
  - [x] indeksi: unique `(projectId, userId)`, `(userId, status)`
  - [x] `removed` je soft — red ostaje zbog audita
- [x] `models/ProjectAuditLog.js` — eventType enum (invitation.\*, member.\*), `metadata`, indeks `(projectId, createdAt: -1)`
- [x] `models/ChatChannel.js` — `kind: group|dm|system`, `systemKey`, `postingPolicy`, `memberUserIds`, `archivedAt`
  - [x] unique partial `(projectId)` za `kind: 'group'` — jedan grupni kanal po projektu i kad dva zahteva istovremeno pokušaju lazy kreiranje. Ključ je samo `projectId` jer bi indeks sa istim `{projectId, kind}` obrascem a drugim opcijama MongoDB odbio kao `IndexOptionsConflict`
  - [x] **`dmKey` + unique partial `(projectId, dmKey)`** (I5) — `memberUserIds` niz ne može da iznudi jedinstvenost para; bez ovoga dva paralelna zahteva otvaraju dva DM-a za iste dve osobe
- [x] `models/ChatMessage.js` — `flag`, `kind`, `replyToPreview`, `mentions`, `pinned`, `convertedTo[]`, soft delete
  - [x] attachment sub-šema sa **`visibility: project_shared|client_only|internal_team`** (v2)
  - [x] indeksi: `(channelId, createdAt: -1)`, `(channelId, pinned)`, `(projectId, flag)`, `(channelId, mentions)`
- [x] `models/ChatRead.js` — unique `(channelId, userId)` + `clearedAt` (per-user „očisti razgovor", bez nove kolekcije)
- [x] `models/ProjectItem.js` — `kind`, `ref` ("D-041"), `status`, `severity`, `confirmedBy[]`; indeksi `(projectId, kind, status)`, `(sourceMessageId)`, unique `(projectId, kind, ref)`
- [x] `models/Notification.js` — polje `channelId` + indeks `(userId, channelId)`
- [x] `models/ProjectMessage.js` — `authorRole` enum + `'member'` (jedina izmena)
- [x] `models/ClientProject.js` — `ownerAccountDeletedAt` (aditivno, default `null`) — jedini okidač za read-only zatvaranje projekta
- [x] `lib/chat-domain.mjs` — `restrictForClosedProject` + `dmKeyFor`, sa testovima
- [x] Svi novi modeli poštuju konvenciju: `_id` UUID string, `{ timestamps: true, _id: false }`, bez `ref`/`populate`
- [x] Sve šeme se učitavaju pod Mongoose bez upozorenja (provereno kroz privremeni loader)

---

## 2. Čisti moduli i testovi

- [x] `lib/chat-domain.mjs`
  - [x] **`ROLE_PERMISSIONS` preset po roli — tačno po matrici iz plana (sekcija 6)**
  - [x] `PERMISSION_KEYS` + `permissionsForRole` + `hasPermission`; test čuva da nijedan preset ne odluta od skupa ključeva
  - [x] konstante `MESSAGE_FLAGS`, `CHANNEL_KINDS`, `PROJECT_ITEM_KINDS`, `CONVERT_TARGETS`, `MEMBER_ROLES`, `INVITATION_STATUSES`, `ATTACHMENT_VISIBILITIES`, `CHAT_LIMITS`
  - [x] `normalizeEmail` (literal, bez plus-address transformacija) + `maskEmail` (fiksna širina maske — ne odaje dužinu adrese)
  - [x] `canPostToChannel` (+ `admin_only` i arhiviran kanal), `canModerateMessage`, `canInviteToProject`, `canManageMembers`, `canConvertMessage`
  - [x] `parseMentions` — najduže ime prvo, granica reči, `@` unutar mejl adrese se ignoriše
  - [x] `buildReplyPreview`, `sanitizeChatMessagePayload`, `nextItemRef`, `displayRoleLabel`
  - [x] dodat `messagesModerate` i `leaveProject` u permission ključeve — da `canModerateMessage` i „Leave project" ne proveravaju ime role
- [x] `lib/project-serializers.mjs` — **allowlist, nikad blocklist/delete**
  - [x] `serializeProjectForMember` / `serializeMilestoneForMember` / `serializeTaskForMember`
  - [x] `serializeProjectForAccess` — pun dokument **samo** owner i admin; sve ostale role idu kroz allowlist (client_lead dobija finance serializer eksplicitno u Fazi 2, ne nasleđivanjem)
  - [x] `serializeMemberPublic({ includeEmail })` — email samo owner/adminu
  - [x] `serializeInvitationPreview` + `serializeInvitationForManager` — bez `tokenHash`
- [x] `lib/route-match.mjs` — mini matcher za nove grane (`:param` pattern, prazan segment nikad ne prolazi)
- [x] `tests/chat-domain.test.mjs`
- [x] `tests/project-serializers.test.mjs` — **assertuje ODSUSTVO ključa, ne null** (`!('proposalId' in out)`)
- [x] `tests/route-match.test.mjs`
- [x] `npm test` prolazi zeleno, uključujući postojeće proposal testove (tačan broj je u status zaglavlju ovog dokumenta — namerno se ne ponavlja po sekcijama, jer raste sa svakim korakom)

---

## 3. Centralna autorizacija

- [x] `lib/chat-domain.mjs` — dodata čista `resolveRoleFromFacts({ isAdmin, isOwner, membership })`: admin → owner → aktivna membership → null. `removed`/`suspended` i nepoznata `membership.role` vrednost isto padaju na `null` (nerazlikovo od stranca). Testirano bez baze.
- [x] `lib/project-access.js`
  - [x] `resolveProjectAccess(user, project)` → `{ role, permissions, membership }` — DB ljuska tanka, sama odluka delegirana `resolveRoleFromFacts`
  - [x] `requireProjectPermission(user, project, permission)` — **bez odnosa (ili nepostojeći `project`) → `ProjectNotFoundError` 404, član bez dozvole → `ProjectForbiddenError` 403**; obe greške nose `.status`/`.statusCode` pa ih postojeći `errorResponse()` obrađuje bez izmena
  - [x] Ručno provereno (bez žive baze, admin/owner/null-project putanje) da rezolucija radi ispravno pre nego što bilo koji endpoint počne da je zove
- [x] `canAccessClientEntity` u `lib/project-proposal-domain.mjs` **ostao netaknut** — `resolveProjectAccess` ga poziva, ne duplira
- [x] Helper sloj u `route.js`: `requireAuthenticatedUser` (baca `apiError("Unauthorized", 401)`, hvata ga postojeći try/catch), `forbiddenResponse`, `notFoundResponse` — dodati odmah uz `canAccessClientProject`/`canAccessRequest`/`apiError`
- [-] Matcher tabele po verb-u (`matchRoute` + prazan niz ruta ožičen u svaki verb handler) — **namerno odloženo**: prazna tabela ožičena u sve handlere je runtime trošak na svaki zahtev bez ijednog ponašanja dok ne postoji makar jedna prava ruta. `lib/route-match.mjs` je gotov i testiran (sekcija 2); prva tabela se pravi zajedno sa prvim pravim `chat/*` ili `invitations/*` handlerom u sekciji 5/6, ne pre toga.
- [ ] Nove grane grupisane redosledom: auth/invitations → membership → member mgmt → project reads → chat → milestone chat → attachments → proposal/finance (primenjuje se od sekcije 4 nadalje)
- [ ] Postojeće nedosledne 401/403 provere u starim granama (npr. `!canAccessClientProject` nekad 401 "Unauthorized", nekad 403 "Forbidden" za isti slučaj) — **nisu dirane u ovoj sekciji**; ispravljaju se usput kad se ta konkretna grana rewire-uje u sekciji 4, ne kao samostalan refaktor

---

## 3A. Cross-cutting invarijante

Pravila koja važe kroz sve preostale sekcije. Puna razrada: [PROJECT_CHAT_PLAN.md](./PROJECT_CHAT_PLAN.md) sekcija 4A. Najveći rizik nije da je plan pogrešan, nego da se neka od ovih invarijanti primeni **nedosledno** kroz ~18 endpointa — zato se čekiraju ovde, a ne unutar svake sekcije ponaosob.

- [ ] **I1 Child-resource autorizacija** — `projectId` iz učitanog resursa, nikad iz URL/body. Primenjeno u: 4, 6, 12
- [x] **I2 Atomičnost accept-a** — `acceptInvitationForUser` u route.js: membership + invitation status u jednoj `session.withTransaction`, **membership prvi** (redosled deo koda, ne samo komentara); bez fallback grane (transaction-not-supported → čist 503, isti obrazac kao postojeći phase-archive kod); audit + sistemska poruka post-commit, best-effort. **Uživo potvrđeno pod pravom konkurencijom**: dva paralelna accept poziva istim tokenom → tačno jedno `ProjectMember` (test F, Sekcija 5)
- [x] **I3 Sudar sa postojećim nalogom** — register-kroz-poziv za mejl koji već ima nalog → 400, nijedan duplikat naloga. **Uživo potvrđeno** (test C)
- [~] **I4 Token hygiene** — delimično: raw token se nigde ne loguje (potvrđeno) · cookie briše se i na uspeh i na neuspeh (mismatch/revoked/expired) — **uživo potvrđeno**, `Set-Cookie` sa `Max-Age=0` na 403 · `history.replaceState` posle uspešnog preview-a u `app/invite/page.js`. **Nije urađeno**: `Referrer-Policy: no-referrer` u `next.config.js`; rate limit na slanje poziva. Ostaju kao otvorena stavka, ne blokiraju Sekciju 6
- [x] **I5 Konkurentnost kroz indeks** — grupni kanal: `getOrCreateGroupChannel` sa duplicate-key fallback na postojeći (Sekcija 5, unapred za Sekciju 6). DM par i `ProjectItem.ref` retry ostaju za Sekcije 6/12
- [ ] **I6 Fan-out iz aktivnog članstva** — uklonjen/suspendovan član ne dobija ništa; DM pravila posle uklanjanja. Sekcija 10
- [ ] **I7 Javni prilozi** — prihvaćen rezidualni rizik + **helper tekst uz attach dugme** (ne samo u `.md`). Sekcija 8
- [x] **I8 Polling budžet** — 4s samo aktivan kanal, pauza na `document.hidden`, jedan `messages` query po ekranu, cursor paginacija limit 50, debounce na search. Zatvoreno u Sekciji 11 (debounce je bio jedini stvarno nedostajući deo; ostalo već strukturno zadovoljeno od Sekcije 7/8)
- [ ] **I9 Feature flag** — samo **UI ulaz** (Chat stavka u navigaciji), rute se ne flaguju. Sekcija 9
- [x] **I10 Istorija preživljava hard delete** — identitet denormalizovan pri upisu. Modeli već usklađeni (vidi sekciju 1); ponašanje pri brisanju naloga ide u sekciju 4

---

## 4. Postojeći endpointi — member-aware

**Pravilo za celu sekciju — resource-first autorizacija.** `projectId` se izvodi iz **učitanog resursa**, nikad iz URL-a ili body-ja. Resurs se učita prvi, projekat se izvede iz njega, pa se tek onda zove `requireProjectPermission` nad tim projektom. Kada URL nosi i roditelja i dete, `:projectId` služi samo za učitavanje, a pripadnost deteta roditelju se **potvrđuje** pre provere prava — nepodudaranje je **404, ne 403** (403 bi potvrdio da resurs postoji). Detaljno u [PROJECT_CHAT_PLAN.md](./PROJECT_CHAT_PLAN.md) sekcija 7.

- [x] **Preduslov, urađeno pre bilo kog endpointa ispod:** `resolveProjectAccess` ožičen kroz `restrictForClosedProject` ([lib/project-access.js](../lib/project-access.js)) — poslednji korak u rezoluciji, posle koraka 1–4. Namerno **pre**, ne posle, glavnih bullet-a ove sekcije: svaki endpoint koji zove `requireProjectPermission` nasleđuje zatvaranje projekta od prvog dana, umesto da se dodaje naknadno po završenim endpointima. Integraciono provereno (owner na zatvorenom → `chatWrite: false`, `projectRead: true`; admin na zatvorenom → nepromenjen).

- [x] `GET /api/client-projects` — scoping proširen na aktivno članstvo (`ProjectMember.find({userId, status:'active'})` dodaje `_id: {$in: ...}` u `$or`); owner/admin i dalje dobijaju sirov dokument (`canAccessClientEntity` kratko-spaja pre ijednog `resolveProjectAccess` poziva — nula dodatnih upita za postojeće korisnike); projekat dostupan samo preko članstva ide kroz `serializeProjectForMember`
- [x] `GET /api/client-projects/:id` — isti princip; `serializeProjectForAccess` bira projekciju
- [x] **Ispravka nad TODO tekstom:** ne postoji standalone `GET /api/project-proposals*` ruta — proposali su uvek ugnežđeni pod `client-projects/:id/proposals[/:proposalId]`. Gate je `requireProjectPermission(user, project, "proposalsRead")` pozvan **direktno** za tu granu (ne posle opšteg `projectRead`) — tako član sa `projectRead` ali bez `proposalsRead` dobija 403 (ima odnos prema projektu, nema prema ponudi), dok neko bez ikakvog odnosa dobija 404 pre nego što se `proposalsRead` uopšte ispita
- [x] `GET/POST /api/client-projects/:id/messages` (milestone chat) — otvoren za članove kroz `requireProjectPermission(..., "milestoneRead"|"milestoneComment")`; member whitelist `{message, question}` (bez `change_request` — taj tok ostaje između klijenta i operatora)
  - [x] `milestone.projectId === project._id` je **već bilo tačno by construction** — milestone se traži unutar `project.milestones` niza već učitanog, permission-proverenog projekta, nikad iz posebne kolekcije po klijentskom ID-ju. Nema šta da se dodaje, samo potvrđeno i upisano kao napomena u kodu
  - [x] `authorName`/notify tekst popravljeni da ne koriste `project.clientName` za autora koji nije vlasnik (bio bi pogrešno pripisan)
- [x] `POST /api/upload` — projectId grana dozvoljena članu sa `filesUpload`; `visibility` na attachment-u je `ChatMessage` schema default (Sekcija 6), `/api/upload` ga ne dodaje — ispravljeno razumevanje u odnosu na prvobitni tekst ove stavke
  - [x] `projectId` iz body-ja se koristi samo za učitavanje projekta, prava se proveravaju nad učitanim dokumentom
- [x] `project-requests/*` — **bez novog pristupa članovima** (i dalje isključivo owner/admin), ali tri `canAccessRequest` grane ispravljene sa 401→404 (detalj/read, POST sub-actions, upload requestId grana) — „nema odnosa" mora biti 404 svuda, ne samo na client-projects
- [x] List endpointi ne vraćaju ni metapodatke o ponudama (`hasProposal`, `proposalCount`…) — provereno gredom: takvo polje ne postoji nigde u kodu, ništa nije trebalo uklanjati
- [x] Usput ispravljene nedosledne 401/403/404 u svim granama koje su rewire-ovane ovom sekcijom (client-projects detail/list/messages, upload, project-requests × 3)

### 4-lifecycle — brisanje naloga i zatvaranje projekta (I10, plan sekcija 5A)

`resolveProjectAccess` je već ožičen na vrhu ove sekcije — ovde ostaje samo strana koja **postavlja** `ownerAccountDeletedAt`, nezavisno je od read-side bullet-a iznad i ne blokira ih.

- [x] `DELETE /api/users/:id` — pri brisanju naloga:
  - [x] postavi `ownerAccountDeletedAt` na svim `ClientProject` tog klijenta (po `clientUserId` **i** `clientEmail`)
  - [x] prebaci njegove `ProjectMember` redove u `status: 'removed'` (red ostaje — `name`/`email` nose istoriju)
  - [x] audit `member.removed` za svaki
  - [x] postojeći 409 guard za projekat u toku **ostaje nedirnut** — verifikovano uživo, i dalje blokira
  - [x] **Brisanje naloga + zatvaranje projekata + uklanjanje članstava su jedna transakcija** (`session.withTransaction`, isti obrazac kao postojeći phase-archive kod) — primenjeno I2 rezonovanje (atomičnost) na brisanje naloga, ne samo na invitation accept; audit insert je post-commit, best-effort, `.catch()` ne poništava već izvršeno brisanje
- [x] Član koji zadrži nalog vidi projekat u My Projects i posle zatvaranja — read-only, sa istorijom chata
- [x] Provereno da članstvo **ne ograničava sopstveni nalog** — `resolveProjectAccess` je po projektu, ne po nalogu; `ownedProjectQuery` i `ProjectMember` cleanup su nezavisne grane iste transakcije, pa se ispravno primenjuju ZAJEDNO na osobu koja je i vlasnik svog projekta i collaborator na tuđem

**Verifikovano uživo, sa jednorazno kreiranim test nalozima/projektom/članstvom (kreirano → testirano → obrisano, baza vraćena na tačno prethodno stanje, `users`/`clientprojects` count nepromenjen posle):**

1. Projekat u statusu `in_progress` (aktivan) → DELETE vlasnika i dalje **409** — guard netaknut
2. Projekat prebačen na `completed` → DELETE vlasnika → **200**, nalog stvarno obrisan, `ownerAccountDeletedAt` postavljen, `status` polja projekta netaknuta
3. **Prva prava end-to-end potvrda member pristupa sa pravim `ProjectMember` redom** (ranije dostupno samo kroz fixtures/unit testove): surviving collaborator vidi zatvoreni projekat u `GET /client-projects` listi (bez `clientEmail` ključa) i u detalju (potpuna allowlist projekcija, 200) — `resolveProjectAccess` → `restrictForClosedProject` → `serializeProjectForAccess` lanac radi ispravno sa realnim DB upitom, ne samo sa fabrikovanim objektima
4. DELETE collaborator naloga → **200**, `ProjectMember.status` → `removed`, `name`/`email` sačuvani, tačno jedan `ProjectAuditLog` red (`member.removed`, `reason: account_deleted`, ispravan actor/target)

### 4b. E2E odmah po Sekciji 4 — ne čekati kraj Faze 1

Sekcija 4 je jedina koja menja endpointe koje živi klijenti već koriste i jedina koja otvara projekat nekome ko nije vlasnik. Od merge-a je curenje moguće, pa se ovi testovi pokreću **odmah**, sa ručno ubačenim `ProjectMember` redom i dva tokena — ne traže ni chat, ni invite flow, ni UI.

**Napomena o alatu:** SEC 1, 2, 7, 8, 10 (owner), 11, 13-analog su ispod verifikovani **uživo protiv realne DB-je** (`npm run dev`, real admin/owner/stranger JWT za postojeće naloge, isključivo GET/read pozivi + jedan POST /upload bez fajla). Nijedan test nije upisao niti izmenio podatak. Za pravi `ProjectMember` red (collaborator success-path) nema dovoljno osnova da se piše u živu bazu bez izričite dozvole — taj deo ostaje na `tests/project-serializers.test.mjs` (key-absence, već zeleno) dok Sekcija 5 ne napravi invite/accept da se test uradi kroz pravi tok.

- [x] SEC 1 — `GET /api/client-projects` kao stranac: sopstvena lista ne sadrži tuđ projekat (verifikovano uživo, real user)
- [x] SEC 2 — `GET /api/client-projects/:id` kao owner/admin: **identičan** skup ključeva kao pre izmene (verifikovano uživo — svi originalni ključevi prisutni: `clientEmail, requestId, archivedProposalIds, events, milestones[].proposalId/revision/changeHistory`, ...)
- [ ] SEC 3/4 — `GET /api/client-projects/:id/proposals[/:proposalId]` kao collaborator → **403** (ispravljena putanja; kod postoji i logika je testirana na `resolveProjectAccess` nivou, ali sam poziv čeka pravi `ProjectMember` red iz Sekcije 5 da se izvede uživo)
- [ ] SEC 5 — `PUT/PATCH` proposal/milestone mutacije → i dalje netaknuto (`canPerformClientProposalAction`), verifikovano uživo da stranac i dalje biva odbijen (401, nepromenjeno — te grane namerno nisu rewire-ovane ovom sekcijom)
- [-] SEC 6 — duplikat SEC 5, sažeto gore
- [x] SEC 7 — `GET /api/project-requests/:id` postojećeg (tuđeg) zahteva kao stranac → **404** (verifikovano uživo, real request id — pre izmene bio 401)
- [x] SEC 8 — nečlan: `GET /api/client-projects/:tuđiId` → **404** (verifikovano uživo, real project id)
- [x] SEC 10-analog — treći korisnik na `POST /upload` sa tuđim `projectId` (i sa realnim fajlom) → **404**, bez ijednog Cloudinary upload-a (verifikovano uživo)
- [x] SEC 11 — **owner regresija: odgovor identičan kao pre izmena** — verifikovano uživo za `GET /client-projects/:id` (isti skup ključeva) i za milestone chat GET (200, nepromenjeno)
- [ ] SEC 13 — `.../proposals/:idIzProjektaB` sa `?projectId=A` — nije primenjivo u ovom obliku: proposal ruta je uvek `client-projects/:id/proposals/:proposalId`, projectId dolazi iz URL-a roditelja, ne iz query-ja. Stvarni resource-first rizik ovde je collaborator-only slučaj iz SEC 3/4, pokriven istim mehanizmom
- [ ] SEC 14 — `POST /api/client-projects/:A/messages` sa `milestoneId` iz projekta B — kod je **bezbedan by construction** (`project.milestones.find()` ne može pogoditi tuđi milestone), ali test sa dva realna projekta i pravim payload-om nije izveden uživo (nizak prioritet — logika je strukturno neprobojna, ne zavisi od podataka)

---

## 5. Invitations & membership API

- [x] `lib/chat-domain.mjs` dopune: `ChatStateError` (409, state-conflict — revoked/accepted/expired, odvojeno od 403 permission i 400 validation) · `generateInviteToken`/`hashInviteToken` (sha256, jedna imenovana funkcija na oba mesta da kreacija i lookup ne mogu da se raziđu) · `INVITABLE_ROLES` (`collaborator`,`viewer` — Faza 1 UI ne nudi `client_lead`/`project_admin`) · `sanitizeInvitationPayload` · `resolveInvitationAction` (čista odluka: active→already_member, pending→pending_exists, removed/ništa→create) · `assertInvitationAcceptable` (status/rok pre identiteta — mrtav poziv se ne koristi za probing prave adrese). 19 novih testova.
- [x] `models/ProjectInvitation.js` — dodato `roleLabel` polje (nedostajalo je; plan ga je pominjao u payload-u ali model ga nije imao). `serializeInvitationForManager`/`serializeInvitationPreview` popravljeni da koriste `displayRoleLabel(intendedRole, roleLabel)` umesto samo default naziva role.
- [x] `serializeInvitationPreview` dobio `status` polje — stranica može da prikaže "revoked"/"already used" umesto generičke greške; `expiresAt` ostaje da klijent sam proveri istek.
- [x] `POST /api/client-projects/:id/invitations` — permission `membersInvite`; aktivan član → 409; pending → 409 (vraća `invitationId` za resend/revoke); removed → ne blokira (reaktivacija se dešava na accept, ne ovde); guard da vlasnik ne može pozvati sopstveni mejl
- [x] `GET /api/invitations/preview?token=` — samo `serializeInvitationPreview` + HttpOnly `dmdevelon_invite` cookie (1h); bez auth-a
- [x] `POST /api/invitations/accept` — **idempotentan kroz transakciju** (I2); email match obavezan; mismatch → 403 sa maskiranom adresom; state-conflict (revoked/accepted/expired) → 409
- [x] `POST /api/client-projects/:id/invitations/:invId/resend` — novi tokenHash + rok; samo za `pending`
- [x] `DELETE /api/client-projects/:id/invitations/:invId` — revoke; samo za `pending`
- [x] `GET /api/client-projects/:id/members` — aktivni članovi (live `User` podaci preko `serializeMemberPublic`, sa fallback na denormalizovano ime/mejl) + pending pozivi (samo za `membersInvite`); email samo owner/adminu
- [x] `PATCH /api/client-projects/:id/members/:memberId` — `membersManage`; role ograničena na `INVITABLE_ROLES`; audit samo kad se rola stvarno menja
- [x] `DELETE /api/client-projects/:id/members/:memberId` — `removed`
- [x] `POST /api/client-projects/:id/leave` — collaborator/viewer/project_admin; owner i admin nemaju `leaveProject` dozvolu (nema member red da se napusti)
- [x] `POST /api/auth/register` + `inviteToken` — server koristi `invitation.emailNormalized` (ignoriše body email), `emailVerified: true`, `verifyToken` se ne generiše, odmah accept kroz istu `acceptInvitationForUser` funkciju koju koristi i `/invitations/accept`
- [x] `hooks/useAuth.js` — `register(name, email, password, extra={})` proširen dodatnim opcionim parametrom (backward-compatible, jedini postojeći pozivalac šalje tačno 3 argumenta) da bi mogao da nosi `inviteToken`
- [x] Audit log upis za svaki događaj: created / resent / revoked / accepted / role_changed / removed / left — svi post-commit, best-effort, `.catch()` ne ruši glavni zahtev
- [x] `emailTemplates.projectInvite` — ko poziva, projekat, prava, lična poruka, dugme + tekstualni link + rok; `recipientEmail` (stvarna adresa u mejlu) namerno odvojen od `maskedEmail` (masked verzija za preview stranicu) — različita polja, različita svrha
- [x] `app/invite/page.js` — preview → registracija (email polje `disabled`, prikazuje samo maskiranu adresu) ILI prijava na istoj stranici (toggle); već prijavljen → automatski accept; mismatch → ponuda "sign out and use a different account"

**Deljena logika (nova, korišćena i od accept i od register-kroz-poziv):**

- `acceptInvitationForUser(invitation, project, user)` u route.js — jedna transakcija (membership create/reactivate + invitation status flip, redosled membership-pa-status po I2), post-commit audit + sistemska poruka
- `getOrCreateGroupChannel(project)` / `postSystemMessage(channel, body)` — mali, samostalan deo Sekcije 6 povučen unapred jer accept treba da upiše "`<Name>` joined the group"; Sekcija 6 ponovo koristi iste funkcije, ne pravi svoje

**Uživo test (35 provera, jednorazni test podaci kreirani→testirani→obrisani, uz izričitu dozvolu):**
create/duplicate/revoke/resend/permission-boundary (11) · preview + register-kroz-poziv sa punim lancem provera (invitation accepted, ProjectMember, audit, chat kanal, sistemska poruka) (9) · I3 duplicate-account guard + accept preko postojećeg naloga (4) · email mismatch bez otkrivanja prave adrese (1) · istekao poziv (2) · **konkurentnost — dva paralelna accept poziva istim tokenom, tačno jedno članstvo** (2) · member management: patch/leave/owner-ne-može/remove (5). Sve 35 prošlo, baza vraćena na tačno prethodno stanje.

**Pravi bug pronađen i ispravljen tokom uživo testa:** `ProjectMember.create({...}, { session })` — Mongoose tretira single-object + options kao DVA dokumenta za upis (options objekat kao drugi dokument!) kad prvi argument nije niz, ne kao "dokument + opcije". Ispravljeno na `ProjectMember.create([{...}], { session })`. Bez uživo testa ovo bi prošlo sintaksnu proveru i sve postojeće unit testove neotkriveno — pure funkcije ne dodiruju bazu, a ovo je čisto Mongoose API ponašanje.

---

## 6. Chat API

- [x] `lib/chat-domain.mjs` dopune: `canViewAttachment(role, visibility)` (project_shared→svi, client_only→owner+admin, internal_team→samo admin) · `escapeRegExp` (search input nikad ide sirov u `$regex`). 8 novih testova.
- [x] `lib/chat-serializers.mjs` (novi fajl) — `serializeChatMessageForAccess` (attachment filtriranje po `canViewAttachment`, soft-deleted poruka zadržava `convertedTo`/`flag`/`pinned` ali redaguje `body`/`attachments` za SVAKOG gledaoca), `serializeChannelSummary`, `serializeChannelDetail`, `serializeChannelMember`. 16 novih testova — uključujući isti „ključ mora biti odsutan, ne `undefined`" bug koji smo uhvatili u Sekciji 4, ovog puta na `memberUserIds` (prisutan samo za `kind: 'dm'`).
- [x] `GET  /api/chat/channels` — unread + lastMessage; grupni kanal se **lazy kreira ovde** za svaki projekat kom korisnik ima pristup (owner/admin/member); **DM filtriran po `memberUserIds` već u listi** — projekat kome je pristup u međuvremenu izgubljen tiho isključuje i njegove DM-ove iz liste
- [x] `GET  /api/chat/channels/:id` — meta + roster (`loadChannelRoster`: owner + aktivni `ProjectMember`; globalni admin namerno nije mention/roster kandidat u Fazi 1)
- [x] `GET  /api/chat/channels/:id/messages?before=&limit=50&flag=&q=` — `limit` ograničen na [1,100]; `q` prolazi kroz `escapeRegExp`; `flag=pinned` je poseban alias za `pinned:true`, ne pravi flag vrednost
- [x] `GET  /api/chat/channels/:id/pinned`
- [x] `POST /api/chat/channels/:id/messages` — `chatWrite`; DM dodatno `memberUserIds` (kroz `loadChannelWithAccess`); slanje **implicitno označava kanal pročitanim za pošiljaoca** — niko ne vidi sopstvenu poruku kao nepročitanu
- [x] `POST /api/chat/channels/:id/read` — opcioni `messageId`, inače "sada"
- [x] `POST /api/chat/dm` — `{ projectId, userId }` (plan je pominjao samo `{userId}`, ali `dmKey` je unique po `(projectId, dmKey)` — ispravljeno u dokumentaciji); get-or-create preko `dmKeyFor` u `getOrCreateDmChannel`, **duplicate key → učitaj postojeći** (I5), ne „proveri pa kreiraj"; cilj mora već biti pravi učesnik ISTOG projekta (owner/admin/member) — ne može se DM-ovati proizvoljan stranac pogađanjem `userId`-ja
- [x] `POST /api/chat/channels/:id/clear` — postavlja `ChatRead.{lastReadAt,clearedAt}` za **tog** korisnika na "sada"; poruke ostaju svima ostalima; nova poruka POSLE clear-a se ispravno ponovo broji kao nepročitana (`readCutoff` = max(lastReadAt, clearedAt))
- [x] Čitanje poruka poštuje `clearedAt` pozivaoca — i u listi poruka i u pinned listi i u lastMessage prikazu
- [x] `POST /api/chat/messages/:id/pin` — `{ pinned }`
- [x] `PATCH /api/chat/messages/:id` — edit, **samo autor** (bez admin override-a, za razliku od delete-a), `editedAt`; obrisana poruka se ne može editovati (409)
- [x] `DELETE /api/chat/messages/:id` — soft delete, autor ili admin (`canModerateMessage`) — druga (ne-autor, ne-admin) osoba dobija 403
- [x] Lazy kreiranje `group` kanala — u `GET /chat/channels` (deljena `getOrCreateGroupChannel` funkcija, ista koja je već korišćena u Sekciji 5 za sistemsku poruku pri accept-u)
- [x] Validacija: `sanitizeChatMessagePayload` (već testiran u Sekciji 2) pokriva `cleanString` max 10000, flag enum, reply iz istog kanala, mentions ∩ članstvo, `admin_only` → 403 (kroz `canPostToChannel` unutar njega)
- [x] Sve grane kroz `requireProjectPermission` (preko `loadChannelWithAccess`/`loadMessageWithAccess` deljenih helpera); svi odgovori sa `getCorsHeaders()`

**Uživo test (49 provera, jednorazni test podaci — 5 naloga, 1 projekat, 3 članstva — kreirani→testirani→obrisani):** lazy kreiranje kanala + izolacija od stranca (4) · detalj + roster + 404 za stranca (4) · slanje + tačan unread (nepročitano samo za tuđe poruke) + read (7) · viewer read-only (2) · flag filter + pretraga + regex metakarakteri u pretrazi ne ruše upit (4) · pin (2) · reply sa denormalizovanim preview-om (2) · @mention razrešen na pravi userId (1) · **filtriranje priloga po vidljivosti za tri različite role u ISTOJ poruci** (4) · edit samo autor + delete autor-ili-admin, treće lice ne može ni jedno ni drugo (6) · **DM: get-or-create vraća isti kanal, cilj mora biti pravi učesnik projekta, treći član ne vidi DM ni u listi ni direktno ni ne može da pošalje u njega** (7) · clear je per-user i nova poruka posle clear-a se ispravno broji (5) · stranac ne može ništa (1). Sve 49 prošlo **bez ijedne ispravke koda** — prva sekcija gde uživo test nije otkrio bug.

---

## 7. Frontend — hookovi

- [x] `hooks/useProjectChat.js`
  - [x] `useChatChannels()` — 15s; dodatno `startDirectMessage` mutacija (`POST /chat/dm`) — nije bila eksplicitno u TODO listi, ali endpoint iz Sekcije 6 mora nekako biti dostupan iz UI-ja
  - [x] `useChatMessages(channelId, { flag, q })` — `useInfiniteQuery` (prva upotreba u ovom kodbejzu; TanStack Query v5 zahteva eksplicitni `initialPageParam`), 4s, `staleTime: 0`, `refetchOnMount: 'always'`. Stranice stižu najnovije-prvo (`before` kursor traži starije); `messages` izlaz je jedan hronološki niz (`pages.reverse().flat()`)
  - [x] mutacije: `sendMessage`, `editMessage`, `deleteMessage`, `togglePin`, `markRead`, `uploadAttachment` — plus `clearConversation` (isti razlog kao `startDirectMessage`: endpoint postoji od Sekcije 6, mora biti dostupan)
  - [x] **`convertMessage` namerno NIJE dodat** — `POST /chat/messages/:id/convert` ne postoji do Sekcije 12; hook za nepostojeću rutu bi bio mrtav kod
  - [x] `useChatPinned(channelId)` — mala zasebna funkcija u istom fajlu za `GET /chat/channels/:id/pinned` (PinnedBar iz Sekcije 11 treba nešto gotovo)
- [x] `hooks/useProjectMembers.js` — `members`, `invitations`, `invite`, `resendInvitation`, `revokeInvitation`, `updateMember`, `removeMember`, `leaveProject`; `leaveProject` dodatno invalidira `client-projects` i `chat-channels` (napuštanje projekta mora da ga skloni i sa liste kanala)

**Verifikacija:** `npm test` (130/130, nepromenjeno — hookovi nisu pure funkcije pa nisu node:test-abilni). Sintaksno provereno (`node --check`). Uživo: privremena test stranica (van `app/`, izbrisana posle) montirala sva četiri hook-a kroz pravi dev server — stranica se kompajlira i renderuje bez greške, početno SSR stanje (`loading: true`, `count: 0`) je razumno. Otkriven usput: Next.js App Router tretira foldere sa `_` prefiksom kao privatne (isključene iz rutiranja) — prvi pokušaj (`app/__hooktest`) je pao na 404 iz drugog razloga, ne iz mog koda. Dublja provera (da li se stvarni fetch posle hidratacije zaista okida) čeka Sekciju 8, gde ovi hookovi prvi put dobijaju pravu, interaktivnu komponentu da ih koristi u browseru.

---

## 8. Frontend — komponente

- [x] `components/chat/ProjectChat.jsx` — shell, dve kolone (`ChannelSidebar` + glavni panel), `viewerRole` prop (`"client"`|`"admin"`, samo utiče na bubble poravnanje/moderaciju klijentski — server ostaje jedini autoritet); prati prvi kanal iz liste čim stigne, resetuje `replyTo` na promenu kanala, prazno/loading stanje pre nego što ijedan kanal postoji
- [x] `components/chat/ChannelSidebar.jsx` — tri sekcije: Channels (grupni kanali + numerički unread bedž), Members (roster aktivnog kanala, klik-za-DM, self isključen), Direct (postojeći DM-ovi, labela = ime DRUGOG učesnika izvedeno iz rostera). **Numerički unread bedž** (ne samo tačka kao drugde u aplikaciji) — svesna odluka, chat generiše više poruka nego ostala mesta pa je broj korisniji signal
- [x] `components/chat/ChatHeader.jsx` — ime/ikonica kanala (Hash za group, MessageCircle za DM) + Select filter (All/Pinned/po flagu) + Input pretraga
- [x] `components/chat/PinnedBar.jsx` — collapsible, `null` kad nema pinovanih; koristi `useChatPinned`
- [x] `components/chat/MessageList.jsx` — `useChatMessages(channelId, {flag, q: search})` direktno; scroll-to-bottom samo na novu poruku (ne na prepend), `scrollTop < 80` okida `loadMoreHistory()` uz očuvanje scroll pozicije preko `scrollHeight` delte; `markRead` na svaku promenu `messages.length`
- [x] `components/chat/MessageBubble.jsx` — sistemska poruka kao razdelnik, korisnička kao bubble (isMine boja/poravnanje po `MilestoneChat.jsx` konvenciji); `FLAG_META` mapa boja/ikonica/labela tačno po planu; reply citat, pinned/edited indikator, inline edit, prilozi (image/pdf), soft-deleted placeholder; dropdown Reply/Pin/Edit(samo autor)/Delete(autor ili `canModerate`) — **namerno bez „Convert to…"** (Sekcija 12)
- [x] `components/chat/MessageComposer.jsx`
  - [x] auto-grow textarea (max 200px); **Enter = novi red (podrazumevano, netaknuto), Ctrl+Enter/Cmd+Enter = pošalji**
  - [x] Send dugme, attach (Paperclip, `uploadAttachment` mutacija sa validacijom tipa/veličine), flag picker (dropdown), `@` mention autocomplete (regex na poziciju kursora, filtrira `useProjectMembers(projectId).members`)
  - [x] **Deljeni query key sa `MessageList`** — `flag`/`search` prosleđeni kroz prop samo da bi `useChatMessages(channelId, {flag, q})` u oba mesta rešio na ISTI React Query cache/polling ciklus, umesto dva nezavisna pollinga za isti kanal
- [-] `components/chat/ConvertMessageDialog.jsx` — **namerno odloženo za Sekciju 12**: `POST /chat/messages/:id/convert` ne postoji dok Sekcija 12 ne implementira `ProjectItem`/convert logiku; dijalog bez cilja bi bio mrtav kod. `MessageBubble`-ov dropdown eksplicitno nema „Convert to…" stavku iz istog razloga
- [x] `components/chat/InviteMemberDialog.jsx` — email (required) + rola Select (**samo Collaborator/Viewer** — `client_lead`/`project_admin` rezervisani za Fazu 2, isto kao i u planu) + roleLabel (opciono) + lična poruka (opciono)
- [x] `components/chat/TeamPanel.jsx` — aktivni članovi (ime, roleLabel, email ako prisutan, „(you)" sufiks, Leave za sebe / Remove za druge) + pending pozivi (email, rola, ko je pozvao, Resend/Revoke ikonice) + „Invite team member" dugme koje otvara `InviteMemberDialog`; destruktivne akcije (remove/leave) idu kroz `window.confirm()`
  - [x] `onOpenTeamPanel` dostupan iz `ChannelSidebar`-a **za oba `viewerRole`**, ne samo za admina — originalni zahtev eksplicitno traži da i klijent može da pozove saradnika sa svog dashboard-a, a `membersInvite` dozvolu ionako drže owner/admin/client_lead na nivou servera, ne globalni admin flag
- [x] Globalni admin se ne prikazuje kao „superadmin" — `roleLabel`/`displayRoleLabel` iz Sekcije 2 već rešava poslovnu etiketu, komponente ovde je samo renderuju
- [x] Boje/ikonice/labele flagova tačno po mapi iz plana (`FLAG_META` u `MessageBubble.jsx`, `FILTER_OPTIONS` u `ChatHeader.jsx`)
- [x] Refaktor: `readAsDataURL` → `lib/utils.js` (dodata jednom, uklonjena duplirana lokalna definicija sa 3 mesta: `hooks/useAuth.js`, `components/dashboard/MilestoneChat.jsx`, `components/dashboard/RequestConversation.jsx` — sve tri sada importuju iz `@/lib/utils`)

**Verifikacija:** `npm test` i dalje 130/130 (nepromenjeno — nijedna pure funkcija nije dirana u ovoj sekciji). Sintaksno provereno svih 9 novih/izmenjenih `.jsx` fajlova (`.jsx`→privremeni `.js` kopija trik, isti kao u Sekciji 7, jer `node --check` ne prepoznaje `.jsx` ekstenziju direktno). Uživo mount test: privremena ruta `app/chattestxyz/page.js` (van postojeće strukture, izbrisana posle) je renderovala `<ProjectChat viewerRole="client" />` kroz pravi dev server — `curl` na `/chattestxyz` vraća **200**, marker `CHAT_MOUNT_OK` prisutan u HTML-u, `ProjectChat` ispravno prikazuje loading spinner (bez auth tokena u ovom curl testu `useChatChannels` ostaje u loading stanju, što je očekivano ponašanje, ne greška) — nema Next.js error overlay-a, `providers/QueryProvider.js` iz root layout-a već pokriva sve nove hookove bez dodatnog provider wiring-a. Ruta potom obrisana i potvrđena kao 404.

---

## 9. Integracija u dashboard

- [x] `app/dashboard/page.js` — `DASHBOARD_TABS` → `["services", "testimonials", "chat"]`
- [x] Nav dugme **Chat** sa ikonicom (`MessagesSquare`, različita od `MessageSquare` koju već koristi Testimonials), odmah posle Testimonials + unread tačka (`totalUnreadChat = chatChannels.reduce(...unreadCount)` preko `useChatChannels()`, deli isti `['chat-channels']` query ključ sa `ProjectChat`-om iznutra — nema duplog pollinga)
  - [x] Tačka se namerno **ne prikazuje dok je Chat tab aktivan** (odstupanje od plana koji je pominjao samo „unread tačku" bez tog detalja) — na aktivnom dugmetu je pozadina već `bg-[#FFB633]`, ista boja kao tačka, pa bi bila nevidljiva; a i nema smisla da govori „imaš nepročitano" na tabu koji upravo gledaš
- [x] `{activeTab === "chat" && <ProjectChat viewerRole="client" />}`
- [x] **Invite team member** dugme na kartici projekta (u „Projects & history" listi, pored „View progress", sa `e.stopPropagation()`) — otvara `TeamPanel` sa `projectId={project._id}`; dugme na `pendingRequests` karticama namerno izostavljeno (zahtev još nije pravi `ClientProject`, nema `projectId` niti chat kanal dok ne bude odobren)
- [x] `app/admin/page.js` — tab `chat` u `menuItems` (odmah posle „Client Projects", ikonica `MessagesSquare`), `ADMIN_TABS`, `renderContent()` → `<ProjectChat viewerRole="admin" />`. Admin nema poseban project-picker — `ChannelSidebar`-ova „Channels" lista (jedan grupni kanal po projektu kom admin ima pristup) služi kao picker, isto kao za klijenta, samo duža lista

**Verifikacija:** `npm test` nepromenjeno 130/130. Sintaksno provereno `node --check` direktno na oba fajla (`dashboard/page.js`, `admin/page.js` — oba su već `.js`, nije trebao `.jsx`→`.js` kopija trik iz Sekcije 8). Uživo: `curl` na `/dashboard` i `/admin` na pravom dev serveru → oba **200**, telo sadrži samo „Loading…" (očekivano — oba `useEffect`-based auth gate-a počinju sa `loading:true` bez prave sesije u ovom testu), bez `Application error`/error-overlay markera. Ovo je isti nivo provere kao Sekcije 7/8: budući da su i `ProjectChat`, `TeamPanel`, `useChatChannels` i nove ikonice statički importovani na vrhu oba fajla, Next.js/Turbopack kompajlira ceo modul-graf pri prvom zahtevu bez obzira da li JSX grana koja ih koristi trenutno renderuje — čist 200 bez overlay-a znači da se ceo lanac importa (uključujući sve `components/chat/*` iz Sekcije 8) uspešno razrešio i kompajlirao. **Puna interaktivna provera (klik na Chat tab, slanje poruke, otvaranje Invite dijaloga u pravom browseru sa pravim nalogom) nije urađena** — zahteva pravu ulogovanu sesiju, što prevazilazi compile-time proveru korišćenu do sada; ostaje kao otvorena stavka za ručnu proveru pre produkcije, van obima automatskih testova ovog projekta.

---

## 10. Notifikacije i email

- [x] `POST /api/notifications/read` — podržava `{ channelId }` samostalno (novi `else if` grana **pre** postojeće `entityId` grane, tako da postojeći pozivaoci koji nikad ne šalju `channelId` ostaju netaknuti), plus `{ entityId, channelId }` zajedno ako je pozivalac zna oboje
- [x] `lib/notify.js` — `"chat_message"` dodat u `DIGEST_TYPES`; `"chat_mention"` **nije** → mejl odmah preko postojeće `if (email && !DIGEST_TYPES.has(type))` grane, bez izmene te logike
  - [x] `notifyUser()` dobio novi `channelId` parametar, upisuje se na `Notification` dokument (polje je već postojalo od Sekcije 1, samo ga `notifyUser` do sada nije punio)
  - [x] **Ispravka nad tekstom plana:** `DIGEST_TYPES` u `lib/notify.js` kontroliše samo _inline vs. odloženo_ slanje u `notifyUser()`; sam digest cron (`runEmailDigest()` u `route.js`) ima **svoju odvojenu, hardkodiranu** `type: {$in: [...]}` listu koja se nigde ne referiše na `DIGEST_TYPES` — dodavanje `"chat_message"` samo u `lib/notify.js` ne bi bilo dovoljno, cron petlja nikad ne bi pokupila red iz baze. Ažurirano na oba mesta
- [x] `hooks/useNotifications.js` — invalidacija `['chat-messages']` dodata pored postojeće `['project-messages']` (svaki put kad 30s notifikacioni poll sleti)
  - [-] **`unreadChannelIds`/`unreadByChannel` namerno NISU dodati** — za razliku od milestone chata i proposal-a (koji nemaju sopstveni read-tracking, pa je `Notification` zapis JEDINI signal za "nepročitano"), chat već ima namenski, precizniji `ChatRead` sistem (Sekcija 6) koji `GET /chat/channels` pretvara u tačan `unreadCount` po kanalu — `useChatChannels()` (Sekcija 8/9) to već koristi za bedž u `ChannelSidebar`-u i tačku na Chat tabu. Dodavanje paralelnog notification-based brojanja bilo bi samo netačnija senka onoga što već postoji, sa rizikom da se dva sistema razminu (npr. push stigne, notifikacija ostane "nepročitana" iako je poruka odavno viđena na drugom uređaju kroz ChatRead)
- [x] `components/NotificationBell.jsx` — kategorija `"Chat"` dodata u `CATEGORY_ORDER.client` i `.admin`; `categoryOf()` proverava `n.channelId` **PRE** `entityType`-baziranih provera (chat notifikacije nose `entityType: "project"` radi ponovne upotrebe postojeće project-link/email infrastrukture, pa bi bez ove provere redom bile pogrešno svrstane u "Projects"/"My Projects")
- [x] Web push radi za chat poruke i mentions — **besplatno**, bez ijedne nove linije koda: `notifyUser()` već bezuslovno zove `sendPushToUser()` za svaki tip notifikacije (osim ako je korisnik isključio push), pa čim se `notifyUser` pozove sa `type: "chat_message"`/`"chat_mention"` push jednostavno radi
- [x] **Fan-out logika (I6)** u `POST /api/chat/channels/:id/messages` (zamenjen prethodni „Section 10's job, not built here" komentar):
  - Grupni kanal: svi iz `roster`-a (owner + aktivni članovi) osim autora, plus svi globalni admini osim autora — **ali ne oba uvek**: ako je autor sam admin, admin-leg (`notifyAdmins`) se preskače, isto kao postojeća asimetrija u milestone chatu (admin-ova poruka ne obaveštava ostale admine, samo klijenta/članove)
  - DM kanal: samo „drugi učesnik"; link zavisi od toga da li je taj učesnik globalni admin (`/admin?tab=chat&channel=`) ili ne (`/dashboard?tab=chat&channel=`) — proveren jednim `User.findById(...).select("isAdmin")`, jedini slučaj gde je ta provera uopšte potrebna (grupni roster nikad ne sadrži globalne admine, `loadChannelRoster` ih namerno isključuje)
  - Mention (`chat_mention` tip, ime u naslovu) vs obična poruka (`chat_message`) — mentions mogu pogoditi samo roster (owner/member), nikad globalnog admina (isti razlog kao gore), pa je admin-leg uvek `chat_message`
- [x] **Deep-link `?channel=<channelId>`** (nije bilo eksplicitno u planu, ali neophodno da linkovi iz notifikacija/mejlova/push-a uopšte imaju svrhu): `ProjectChat` prima novi opcioni `initialChannelId` prop — bira taj kanal kao podrazumevani SAMO dok ništa nije ručno izabrano (efekat se ne aktivira ponovo na svaki 15s poll kanala, pa ne otima izbor koji je korisnik već napravio); `app/dashboard/page.js` i `app/admin/page.js` čitaju `searchParams.get("channel")` i prosleđuju ga
- [x] **Admin sidebar unread tačka za Chat** (mala dopuna otkrivena dok se zaokruživala priča o nepročitanom — Sekcija 9 je ovo dodala klijentskom dashboard-u, ali ne i admin sidebar-u): `AdminPageInner` sad računa `totalUnreadChat` preko `useChatChannels()` (deli isti `['chat-channels']` ključ, bez dodatnog pollinga) i prosleđuje ga u `AdminSidebar`, ista logika kao klijentska strana (tačka se ne prikazuje dok je Chat tab aktivan)

**Uživo test (28 provera, 4 jednorazna naloga — owner/member/admin/stranger — + 1 projekat + 1 članstvo, kreirani→testirani→obrisani):** register (4) · lazy kanal vidljiv članu, nevidljiv strancu (3) · slanje poruke sa @mention (2) · fan-out: owner dobija `chat_mention`, admin dobija `chat_message`, autor i stranac ne dobijaju ništa (5) · digest query filter zaista pokupi `chat_message` red, `chat_mention` zaista nije u tom skupu (2) · `POST /notifications/read` sa `{channelId}` označi TAČNO tog korisnika kao pročitanog, ne dira tuđe redove za isti kanal (3) · baseline brojevi svih 7 dotaknutih kolekcija vraćeni na prethodno stanje (7). **Nije pušten pravi cron digest endpoint** (`GET/POST /api/cron/email-digest`) — taj posao šalje mejlove SVIM korisnicima sa bilo kojim čekajućim digest-notifikacijama u celom sistemu, ne samo test podacima, pa bi to bio neprihvatljivo širok domašaj za jednorazni test; umesto toga, direktno je upoređen isti upit (`type: {$in: [...]}, emailedAt: null, read: false`) koji `runEmailDigest()` koristi, dokazujući da bi red zaista bio pokupljen bez stvarnog slanja mejla bilo kome.

**Otkriveno tokom testa (nije bug u proizvodnom kodu, nego u prvoj verziji test skripte):** `notifyAdmins()` je ispravno obavestio i STVARNOG, postojećeg admin naloga u produkcionoj bazi (ne samo jednorazni test-admin nalog) — to je tačno očekivano ponašanje (fan-out mora da pogodi SVE admine, ne samo one iz test seta). Prvi prolaz čišćenja je filtrirao `Notification` brisanje po `userId: {$in: testUserIds}}`, pa je taj jedan real-admin red preživeo prvi cleanup (baza je posle prvog prolaza imala 49 umesto originalnih 48 `notifications`). Ispravljeno brisanjem po `channelId` samostalno (bez `userId` filtera) — baza vraćena na tačnih 48. Zapisano kao podsetnik za buduće live testove ovog tipa: čišćenje notifikacija posle bilo kog testa koji uključuje `notifyAdmins()` mora ići po `channelId`/`entityId`, nikad po unapred poznatom skupu test-user-id-jeva, jer fan-out namerno i ispravno dohvata i naloge van tog skupa.

---

## 11. Pin, filteri, pretraga

- [x] `PinnedBar` collapsible ispod header-a — već gotovo u Sekciji 8, bez izmena
- [x] Filter: All / Request / Task / Idea / Problem / Incident / Decision / Pinned — već gotovo (Sekcija 6 backend `flag=pinned` alias + Sekcija 8 `ChatHeader` `FILTER_OPTIONS`), bez izmena
- [x] Pretraga po tekstu unutar kanala — već gotovo (Sekcija 6 `escapeRegExp` + Sekcija 8 search input), **plus nova dopuna ove sekcije:** debounce (I8) — videti dole
- [x] Pin / unpin iz dropdown menija (permission `pin`) — **pravi nedostatak pronađen i ispravljen ovde**, videti dole

**Stvarni nedostatak pronađen pri proveri ove sekcije:** `MessageBubble`-ov dropdown je do sada UVEK prikazivao Pin/Unpin stavku, bez obzira na dozvolu — server je ispravno vraćao 403 (`loadMessageWithAccess(id, user, "pin")` je već postojao od Sekcije 6), ali UI to nije znao unapred. Uzrok: `viewerRole` prop ("client"/"admin") opisuje **u kom dashboard-u** je komponenta montirana, ne stvarnu ulogu korisnika NA TOM projektu — `owner`, `collaborator` i `viewer` svi stižu kroz isti klijentski dashboard sa `viewerRole="client"`, a samo `viewer` rola nema `pin` dozvolu (matrica u `lib/chat-domain.mjs`). `canModerate` je slučajno ispravan (`viewerRole === "admin"` se poklapa sa `messagesModerate` jer JEDINO globalni admin ima tu dozvolu, a admin panel je i inače zaključan samo za njih), ali `pin` dozvolu ima skoro svaka rola OSIM viewer-a, pa isti trik ne radi.

Ispravka — server sad izlaže stvarnu, već izračunatu dozvolu umesto da frontend nagađa:

- [x] `lib/chat-serializers.mjs` — `serializeChannelSummary` dobija `canPin`/`canWrite` polja (`Boolean(accessObj?.permissions?.pin)` / `.chatWrite`) — `accessObj` je već postojao na ovom pozivnom mestu (`GET /chat/channels`) od Sekcije 6/9 (koristio se za `unreadCount`/`lastMessage` filtriranje priloga), samo se dosad nije čitalo van toga
- [x] `tests/chat-serializers.test.mjs` — 2 nova testa (`canPin`/`canWrite` prate stvarnu dozvolu, ne kind kanala; default `false` bez bacanja greške kad `accessObj` nedostaje)
- [x] `components/chat/ProjectChat.jsx` → `MessageList.jsx` → `MessageBubble.jsx` — `canPin` prosleđen kroz sve tri komponente; Pin/Unpin stavka u dropdown-u sad uslovna na `canPin`
- [-] `canWrite` izložen u serializeru ali **namerno još NIJE ožičen u `MessageComposer`-u** (kompozitor bi trebalo da se onemogući/sakrije za viewer rolu) — ovo je srodan, ali odvojen nedostatak od onoga što ova sekcija konkretno traži (pin), zastavljen za sledeći „fino podešavanje" prolaz, ne rešen ovde da se ne širi domašaj van doslovnog Section 11 zahteva

**I8 dopuna (Polling budžet, sekcija 3A) zatvorena ovde, jer joj je „Pretraga" iz ove sekcije prirodno mesto:**

- [x] **debounce na search** — `ChatHeader.jsx` dobija lokalni `draft` state (trenutačan UI feedback) + 400ms debounce pre nego što `onSearchChange` stvarno promeni `search` state u `ProjectChat`-u (koji hrani `useChatMessages`-ov query ključ). Bez ovoga je svaki pritisnut taster pravio nov HTTP poziv i nov React Query cache unos
- Preostala 4 pod-stavke I8 (4s samo aktivan kanal, pauza na `document.hidden`, jedan `messages` query po ekranu, cursor paginacija limit 50) su bila **već zadovoljena strukturno** još od Sekcije 7/8, samo formalno neoznačena: aktivan-kanal-only i jedan-query-po-ekranu su posledica `MessageList`/`MessageComposer` deljenog query ključa (Sekcija 8); pauza-na-`document.hidden` je React Query v5 podrazumevano ponašanje (`refetchIntervalInBackground` je `false` po difoltu, nije trebalo ništa dodavati); cursor paginacija je iz Sekcije 6/7. **I8 se sad može označiti kao gotov u sekciji 3A.**

**Verifikacija:** `npm test` → 132/132 (2 nova testa). Sintaksno provereno (`node --check` na sva 4 dotaknuta `.jsx` fajla + `lib/chat-serializers.mjs`). **Nije rađen nov live DB test za ovu sekciju** — namerna odluka, ne propust: tačno ovaj pozivni put (`resolveProjectAccess` → `accessObj` → `serializeChannelSummary`) je već uživo proveren u Sekciji 6-ovom testu od 49 provera (za `unreadCount`/`lastMessage`), a `permissions.pin`/`.chatWrite` su već garantovano prava bulova vrednost kroz postojeće `tests/chat-domain.test.mjs` provere matrice. Nova promena je čisto dodavanje dva polja na već uživo dokazan tok podataka, pokriveno sopstvenim jediničnim testovima — dodatni pun round-trip test (novi jednorazni nalozi, čišćenje, itd.) bi bio nesrazmeran za ovu veličinu izmene. Ako se ipak želi, može se dodati.

---

## 12. Konverzije — „Pretvori u…"

- [x] `POST /api/chat/messages/:id/convert` — `convertToFormal` (owner/admin) vs `convertToItem` (i collaborator); permission provera i unutar `sanitizeConvertPayload` (defense-in-depth, isti obrazac kao `sanitizeChatMessagePayload`/`canPostToChannel`)
- [x] Cilj **zahtev** → `ProjectRequest` + `sourceMessageId` + novo `sourceProjectId` polje (nije bilo u planu, ali neophodno — request treba da zna iz kog postojećeg projekta potiče; namerno odvojeno od `linkedClientProjectId`, koje ima suprotno značenje — projekat u koji se zahtev PRETVORIO posle odobrenja)
- [x] Cilj **zadatak** → task u milestone-u (`milestone.tasks.push`, isti resource-first lookup obrazac kao postojeća milestone chat grana)
- [x] Cilj **komentar na milestone** → `ProjectMessage` (`messageType: "message"`, autor je onaj ko konvertuje — owner ili admin, nikad `change_request`)
- [x] Cilj **item** → `ProjectItem` (idea/problem/incident/decision); `decision` dobija odmah `confirmedBy: [{konvertujuci korisnik}]` i `decidedAt` — konvertovanje poruke označene kao "decision" u formalnu Odluku JESTE čin potvrde, ne prazna stavka
- [x] `ref` sekvenca po `(projectId, kind)` → `D-041`, retry na duplikat (I5), **lastRef se traži po `createdAt: -1`, ne `ref: -1`** — leksikografsko sortiranje refova bi se pokvarilo posle 999 stavki iste vrste u istom projektu ("D-1000" ide pre "D-999")
- [x] `convertedTo[]` na izvornoj poruci + UI oznaka „Converted to…" sa ref/target linkom (`MessageBubble.jsx`)
- [x] `GET /api/project-items` (filter `kind`/`status`, permission `projectRead`) + `ProjectItemsPanel.jsx` lista u UI, otvara se iz `ChatHeader`
- [x] „Save as decision" beleži `confirmedBy[]` i `decidedAt` — videti gore
- [x] `canConvertToItem`/`canConvertToFormal` izloženi na `serializeChannelSummary` (ista logika kao `canPin` iz Sekcije 11) — frontend ne nagađa dozvolu iz `viewerRole`

**Verifikacija:** `npm test` → 141/141 u trenutku implementacije (7 novih `sanitizeConvertPayload` testova + 2 nova `serializeProjectItem` testa). Sintaksno provereno svih izmenjenih/novih fajlova. Uživo mount test kroz privremenu rutu na pravom dev serveru (200, marker prisutan, bez greške). **Live DB test za sâm convert endpoint namerno NIJE urađen od strane asistenta** — korisnik je eksplicitno rekao da će prvo sam testirati konverziju uživo pre nego što se zatraži poseban uživo test.

---

## 12c. Odlučivanje o item-ima (traženo posle korisnikovog uživo testa Convert-a)

Korisnik je konvertovao Ideju u Odluku kao član i pitao: „kako superadmin da odobri, ili samo da doda u milestone?" Odgovor je bio da **ništa od toga nije postojalo** — `ProjectItem` je imao `status`/`confirmedBy[]`/`decidedAt` u modelu, ali nijedan endpoint ih nije pisao posle kreiranja. Korisnik je izabrao: odobravanje + co-sign + prebacivanje u task, sa odobravanjem **samo za admina**.

- [x] `lib/chat-domain.mjs` — nov permission ključ `itemsApprove`. Dodat samo u `PERMISSION_KEYS`; pošto `admin` preset uzima sve ključeve konstrukcijom (`PERMISSION_KEYS.filter(k => k !== "leaveProject")`), a svi ostali preseti su eksplicitne liste, ključ je **operator-only bez ijedne provere imena role**. Postojeći „preset drift" test to automatski čuva
- [x] `PROJECT_ITEM_STATUSES` konstanta + `sanitizeProjectItemUpdate(input, accessObj)` — čista, testirana. **Potvrda je spojena sa promenom statusa**, nije zaseban poziv: operator koji prihvata odluku TIME i potpisuje; razdvajanje bi dozvolilo stanje „accepted" bez ičijeg imena, a upravo to ime je dokazna vrednost zbog koje Odluka i postoji. 3 nova testa
- [x] `PATCH /api/project-items/:id` — permission `itemsApprove`; resource-first (projekat se izvodi iz učitanog item-a, nikad iz poziva); `accepted` dodaje potpisnika u `confirmedBy[]` (idempotentno — isti korisnik se ne potpisuje dvaput) i postavlja `decidedAt`
- [x] `POST /api/project-items/:id/task` — permission `convertToFormal` (owner+admin, isto kao konverzija poruke u task: oba prave obavezu); pravi task u izabranom milestone-u i upisuje `item.milestoneId` kao vezu ka nastalom radu (postojeće polje, bez novog)
- [x] `serializeChannelSummary` dobija `canApproveItems` (isti server-sourced obrazac kao `canPin`/`canConvert*`)
- [x] `hooks/useProjectItems.js` — `decideItem` + `promoteToTask` mutacije; `promoteToTask` invalidira i `client-projects` (milestone je upravo dobio task)
- [x] `ProjectItemsPanel.jsx` — status bedž po item-u, Accept/Reject dugmad (samo uz `canApprove`), „Add to milestone…" select (samo uz `canPromote`, i samo dok item još nije prebačen)
- [-] **Nije uživo testirano** — testira korisnik

### 12c-2. Novi milestone / nova faza iz odobrene odluke

Korisnik je tražio još dva dugmeta („add milestone" i „add task") i opisao tri slučaja: task u postojeći milestone, novi milestone, i nova faza. **Pre implementacije provereno kako faze zaista rade** — nalaz je bitan i menja šta je uopšte moguće:

- **Faza NIJE samostalan entitet — faza JESTE proposal.** Lanac: `POST .../proposals` (`kind: "phase"`, `phaseNumber = max(2, last+1)`, `status: "draft"`) → admin šalje → **klijent prihvata** → `reconcileProposalMilestones` materijalizuje milestone-ove te faze sa `proposalId`-jem. Brisanje faze je `$pull: { milestones: { proposalId } }` — **milestone-ove poseduje njihov proposal**
- Zato „dodaj novu fazu" ne može biti obično dugme: bez proposal-a nema šta da drži fazu, a klijent ništa nije prihvatio. Taj tok prihvatanja je i razlog zašto proposals uopšte postoje

Korisnikove odluke posle tog objašnjenja: novi milestone **ulazi u postojeću fazu** (bira se koja), a „nova faza" **pravi draft proposal** koji se dalje šalje normalnim tokom.

- [x] `POST /api/project-items/:id/milestone` — `{ proposalId, title? }`; permission `convertToFormal`. Faza je **obavezna**, ne opciona (milestone bez `proposalId` ne bi pripadao nijednoj fazi i nikad se ne bi obrisao sa njom). Proposal se traži scope-ovan na TAJ projekat (resource-first) i mora biti `accepted` — inače 409. Novi milestone nasleđuje `phaseNumber`/`phaseLabel`, dobija item kao svoj prvi task, i upisuje se `events` zapis
- [x] `POST /api/project-items/:id/phase` — pravi **draft** phase proposal sa `title`/`scope`/`milestonePlan` popunjenim iz item-a, kroz isti `normalizeProposalFields` + `phaseNumber` obrazac kao postojeći endpoint. Namerno staje na draft-u; klijent ga i dalje mora prihvatiti. Permission `itemsApprove` (operator-only konstrukcijom, poklapa se sa postojećim pravilom da proposal crta samo admin, bez druge provere po imenu role)
- [x] `useProjectItems` — `createMilestone` + `createPhaseDraft`; prvi invalidira i `client-projects`, drugi `project-proposals`
- [x] `ProjectItemsPanel` — tri kontrole po item-u: „Add task to milestone…", „New milestone in phase…" i „New phase (draft)". **Lista faza se izvodi iz već učitanih milestone-ova** (distinct `proposalId`), bez drugog zahteva ka `/proposals`: milestone postoji samo ako je njegova faza prihvaćena, pa su ti `proposalId`-jevi tačno žive faze u koje se sme dodati
- [-] **Nije uživo testirano** — testira korisnik. Poseban oprez pri probi: `New phase (draft)` piše pravi `ProjectProposal` u bazu (u `draft` statusu, klijentu nevidljiv dok se ne pošalje)

---

## 12b. UX ispravke posle uživo testiranja (van redosleda sekcija)

Korisnik je uživo testirao Sekcije 8–11 u pravom browseru i vratio konkretnu listu nedostataka i UX poboljšanja. Ovo nije bilo u planu — ubačeno je između Sekcije 12 i 13 jer je korisnik eksplicitno tražio da se prvo završe manje ispravke, pa dva veća stavke (mobilni layout, prisustvo), pre nego što se nastavi dalje.

**Manje ispravke:**

- [x] `ChannelSidebar.jsx` — dugme za dodavanje člana: `Settings`/gear ikonica → `Plus` sa zlatnom (`#FFB633`) ivicom, "+ Add" umesto samo ikonice
- [x] `PinnedBar.jsx` — flag bedž (boja/ikonica/labela) po pinovanoj poruci, ista `FLAG_META` mapa kao `MessageBubble` (eksportovana odatle, ne duplirana)
- [x] Filter po tipu priloga — `ChatHeader`-ov POSTOJEĆI dropdown dobija dve nove opcije ("Images"/"Documents") sa `attachment:` prefiksom u vrednosti; `useChatMessages` prevodi u novi `attachmentType` (image|pdf) query parametar (odvojen od `flag`, GET `/chat/channels/:id/messages` handler)
- [x] `AttachmentPreview.jsx` (nova komponenta) — klik na sliku/dokument otvara modal (slika inline, PDF kroz iframe/browser viewer) umesto novog Cloudinary taba; „⋯" meni ima Download koji fetch-uje kao blob i čuva pod pravim imenom (obično `download` atribut ne radi pouzdano cross-origin)
- [x] Reply — klik na citat sad radi smooth-scroll do izvorne poruke (`data-message-id` + `querySelector`, isti obrazac kao postojeći `card-${id}` scroll-to u dashboard/page.js) sa privremenim gold ring highlight-om (1.5s); plutajuće „↓ Back to reply" dugme vraća na polaznu poruku. **Poznato ograničenje:** ako izvorna poruka nije još učitana (starija istorija), klik ne radi ništa — nije dodato auto-učitavanje istorije radi ograničenja obima ove izmene
- [x] I8 debounce na search (već zabeleženo u Sekciji 11)

**Veliki item A — mobilni responsive layout:**

- [x] Ispod `md:` breakpoint-a prikazuje se TAČNO jedna kolona odjednom (sidebar ILI razgovor), puna širina; na `md:` i više obe kolone kao pre (side-by-side)
- [x] Klik na kanal/DM prebacuje na razgovor (`mobileView` state u `ProjectChat.jsx`); `ChatHeader` dobija `onBack` dugme (`ChevronLeft`, `md:hidden`) koje vraća na listu kanala
- [x] `ChatHeader`-ov red kontrola (filter/search/items dugme) sad `flex-wrap` sa užim `w-*` na mobilnom (`w-28`→`w-40` search, `w-[110px]`→`w-[130px]` filter) — bez ovoga bi red kontrola i dalje prelivao na uskom ekranu čak i posle sidebar/chat toggle-a
- [-] Fina vizuelna polura (razmaci, veličine fontova na baš uskim telefonima) ostaje na korisniku da proveri uživo — nemam pristup pravom mobilnom browseru za vizuelnu proveru, samo compile/mount

**Veliki item B — prisustvo (online/offline) + owner/admin pojedinačno u DM listi:**

- [x] `models/User.js` — novo `lastActiveAt` polje
- [x] `lib/chat-domain.mjs` — `isUserOnline(lastActiveAt, now)` (čista, testirana funkcija) + `PRESENCE_ONLINE_THRESHOLD_MS = 45_000` (3× postojeći 15s `chat/channels` poll interval, da ostavi marže za mrežni jitter/pozadinski tab bez da lažno pokazuje offline)
- [x] **Heartbeat bez novog endpointa** — `GET /api/chat/channels` (već se poll-uje na 15s dok je chat otvoren) sad usput (fire-and-forget, ne blokira odgovor) upisuje pozivaočev `lastActiveAt`
- [x] `GET /client-projects/:id/members` prošireno: pored postojećih aktivnih `ProjectMember` redova, sad vraća i **vlasnika projekta** i **svakog globalnog admina pojedinačno** (sintetički `_id: "owner:<userId>"`/`"admin:<userId>"` redovi kroz isti `serializeMemberPublic`, sad sa `isOnline` poljem) — odluka: svaki admin nalog posebno u listi, ne jedan zajednički "Support" identitet (korisnikov izričit izbor)
- [x] `TeamPanel.jsx` — Remove/Leave dugmad sakrivena za `role === "owner"`/`"admin"` redove (nisu pravi, uklonjivi `ProjectMember` redovi; klik bi tiho ništa ne uradio na serveru bez ove ispravke) + zeleno/sivo prisustvo tačka po redu
- [x] `ChannelSidebar.jsx` — `PresenceDot` pored svakog Members reda i svakog Direct/DM reda (za DM, izvedeno unakrsnom pretragom `memberUserIds` protiv već učitanog roster-a, isti obrazac kao postojeći `dmLabel`)
- [-] **Nije uživo testirano od strane asistenta** — korisnik je eksplicitno rekao da će sam testirati u browseru
- [x] **BUG uveden ovom izmenom, pronašao korisnik uživo, ispravljen:** roster nije imao dedupe po `userId`. Ista osoba koja je istovremeno globalni admin I aktivan `ProjectMember` (korisnikov slučaj: `drazic.milan@gmail.com` je admin, pa prihvatio i poziv kao collaborator) pojavljivala se **dva puta** u listi. Posledice: React duplicate-key upozorenje (`key={m.userId}`), i — vidljivi simptom koji je korisnik prijavio — oba reda vode na **isti DM kanal**, jer je `dmKey` po PARU korisnika; izgledalo je kao da je poruka „stigla u pogrešan chat", a u stvari nikad nisu ni postojala dva razgovora. Ispravka: `Map` po `userId` sa precedencijom **admin → owner → membership**, tj. isti redosled kojim `resolveRoleFromFacts` razrešava prava (osoba se prikazuje kao ono što zaista JESTE na tom projektu), što je usput i redosled prikaza koji plan traži („admin na vrhu, pa vlasnik, pa ostali")
- [-] **Poznata posledica dedupe-a:** ako je globalni admin ujedno i pravi `ProjectMember`, njegov red sad nosi admin identitet (`_id: "admin:…"`), pa `TeamPanel` na njemu ne nudi Remove — njegovo stvarno članstvo se ne može ukloniti kroz UI. Prihvaćeno za sada: admin ionako ima pun pristup projektu bez članstva, pa uklanjanje reda ne bi ništa oduzelo

**Dev/prod — invite/verify/reset linkovi na localhost tokom razvoja:**

- [x] `resolveAppUrl(request)` (novo, u `route.js`) — u produkciji uvek konfigurisani `APP_URL` (poverenje request Host header-u u produkciji bilo bi rizik od spoofing-a); van produkcije, koristi PRAVI origin dolaznog zahteva (`new URL(request.url)`) umesto `NEXT_PUBLIC_APP_URL`, koji je i tokom lokalnog razvoja tipično već postavljen na produkcioni domen (`dmdevelon.website`) — bez ove izmene, svaki verifikacioni/reset/invite mejl poslat sa `localhost:3003` vodio je na produkciju, gde taj token ne postoji
- [x] **Dopuna posle prve uživo probe korisnika:** prvi mejl je stigao sa linkom na `http://0.0.0.0:3003/...` — `0.0.0.0` je adresa na koju dev server SLUŠA (`next dev --hostname 0.0.0.0`), ne adresa na koju bilo ko može da se poveže. Dodato: `UNROUTABLE_HOSTS` skup (`0.0.0.0`, `[::]`, `localhost`, `127.0.0.1`) + `detectLanIPv4()` (Node `os.networkInterfaces()`, prva ne-interna IPv4 adresa) — kad je host zahteva iz tog skupa, `resolveAppUrl` ga zamenjuje pravom LAN IP adresom mašine (npr. `192.168.1.108`), zadržavajući port. Ovo pokriva i slučaj kad je pošiljalac na `localhost`, ne samo `0.0.0.0` — ni `localhost` ne bi radio za drugi uređaj na mreži
- [x] Primenjeno na svih 5 mesta gde se generiše link koji korisnik odmah klika: verifikacija (2×), reset lozinke (1×), invite (2×)
- [x] **Uživo provereno** kroz privremenu debug granu (`GET /api/debug/resolve-app-url`, dodata pa odmah uklonjena posle provere) na pravom dev serveru: zahtev sa `Host: localhost:3003`, `Host: 0.0.0.0:3003` i direktno na `192.168.1.108:3003` — sva tri slučaja ispravno razrešena na `http://192.168.1.108:3003`. Debug grana uklonjena, potvrđeno 404 posle
- [-] **Namerno NIJE dirano:** `runEmailDigest()`-ov `APP_URL` (cron posao, ne interaktivan tok koji se testira klikom) i `lib/notify.js`-ov sopstveni `APP_URL` (koristi se za bell/push notifikacije kroz `notifyUser`, koji nema pristup `request` objektu — protezanje kroz ~15+ pozivnih mesta bilo bi nesrazmerno veći refaktor od onoga što je zaista traženo, „ceo proces" = invite/verify/reset tok, ne svaka notifikaciona email veza)

**Dev-server: HMR websocket preko LAN IP-a (`allowedDevOrigins`):**

- [x] Korisnik je prijavio `Firefox can't establish a connection to the server at ws://192.168.1.108:3003/_next/webpack-hmr`. **Nije problem porta** (predlog `next dev -p 8080` ne bi pomogao — blokada je po HOSTNAME-u, ne po portu, pa bi `192.168.1.108:8080` udario u isto ograničenje). Od Next.js 15.2 dev server blokira HMR/asset zahteve sa svakog origin-a osim `localhost`. Rešenje: `allowedDevOrigins: ["192.168.1.108"]` u `next.config.js` (dev-only opcija, ignoriše se u produkcionom build-u). **Zahteva restart dev servera** — `next.config.js` se čita samo pri startu. Ako se LAN IP promeni (DHCP), vrednost treba ažurirati

**PRAVI BUG pronađen korisnikovim uživo testom — invite stranica odbijala validan poziv:**

- [x] Simptom: mejl stigao ispravno sa `http://192.168.1.108:3003/invite?token=…`, ali stranica prikaže „Invalid invitation link — This link is missing its token or does not match any invitation", a URL u adresnoj traci je `…/invite` **bez tokena**. Server-side je poziv bio potpuno ispravan (`GET /api/invitations/preview?token=…` → `status: "pending"`, nije istekao) — greška je bila čisto klijentska
- [x] **Uzrok:** `app/invite/page.js` je čitao `const token = searchParams.get("token")` i posle uspešnog preview-a zvao `window.history.replaceState(null, "", "/invite")` radi token higijene (I4). Moj komentar uz taj poziv je tvrdio da „ručni history poziv ne utiče na Next-ov searchParams snapshot" — **to je bilo netačno**. Potvrđeno u izvoru instalirane verzije (`node_modules/next/dist/client/components/app-router.js:268`): App Router **patch-uje** `window.history.replaceState` i uz komentar „Ensures usePathname and useSearchParams hold the newly provided url" dispatch-uje `ACTION_RESTORE`. Lanac: preview uspe → `previewState: "ready"` → replaceState skine token iz URL-a → `useSearchParams()` se re-emituje bez tokena → `token` postane `null` → efekat sa `[token]` dependency-jem se ponovo izvrši → `setPreviewState("not_found")` → poruka o nevalidnom pozivu
- [x] **Ispravka:** token se sad drži u komponentnom stanju (`useState(() => searchParams.get("token"))`), nezavisno od URL-a; dodat efekat koji token SAMO usvaja, nikad ne briše (`if (fromUrl && fromUrl !== token) setToken(fromUrl)`) — tako kasnije pristigao token biva pokupljen, a čišćenje URL-a ga ne može oduzeti. Higijena (skidanje tokena iz adresne trake/istorije/referrer-a) je zadržana, komentar ispravljen da opisuje stvarno ponašanje
- [x] **POTVRĐENO ISPRAVNIM od strane korisnika** (uživo, pravi klik iz Gmail-a, preko LAN IP-a, posle restarta dev servera): mejl → klik na link → preview stranica sa ponudom „Create account / Sign in" → prijava postojećim nalogom → **korisnik je odmah u grupi**. Ceo lanac radi: kreiranje poziva → mejl sa LAN IP linkom → `GET /invitations/preview` → login → `POST /invitations/accept` → `ProjectMember` → grupni kanal
- Napomena o metodu: asistent ovo NIJE mogao sam da verifikuje (nema puppeteer/playwright u projektu; bug je čisto React-runtime ponašanje koje `curl` ne izvršava — preko `curl`-a se stranica vidi samo u „Loading invitation…" stanju). Asistent je proverio samo da se fajl kompajlira, da dev server servira stranicu bez greške i da je token i dalje `pending`; **pravu potvrdu dao je korisnikov klik**

**Verifikacija cele serije:** `npm test` → 144/144. Sintaksno provereno (`node --check`) na svih ~12 izmenjenih/novih fajlova. Uživo mount test kroz privremenu rutu na pravom dev serveru posle svakog većeg koraka (small fixes batch, mobilni layout) — 200, marker prisutan, bez greške. Live DB test za presence/roster promenu **namerno preskočen na korisnikov zahtev** — korisnik testira sam u browseru.

**Pouka (treći put u ovom projektu):** komentar koji tvrdi kako se framework ponaša mora biti proveren u izvoru/dokumentaciji, ne pretpostavljen. Prethodna dva slučaja: Mongoose `.create(doc, options)` (Sekcija 5) i `runEmailDigest()`-ova zasebna lista tipova nezavisna od `DIGEST_TYPES` (Sekcija 10). Sva tri su prošla sintaksnu proveru i sve unit testove — uhvatio ih je isključivo pravi, uživo test.

---

## 12d. Handoff, auto-osvežavanje i politika notifikacija

Posle korisnikovog uživo korišćenja: „handoff je konfuzan, ne zna se gde ide", „klijent potvrdi ali se ne ažurira bez refreša", „spamuje notifikacijama". Puni plan: `.claude/plans/` (v3).

**Ograničenje utvrđeno pre implementacije (nije pretpostavka):** `ProjectProposal` ima **unique indeks `{ projectId, phaseNumber }`** — jedna ponuda po fazi. Zato milestone ne može da se doda u već prihvaćenu fazu uz odobrenje; **svaki novi odobreni rad postaje nova faza**. Korisnik je to potvrdio kao odluku (bez migracije).

**Handoff:**

- [x] `POST /api/project-items/:id/handoff` — pravi **draft** phase ponudu iz item-a (`normalizeProposalFields`, `phaseNumber = max(2, last+1)`), upisuje `sourceItemId`/`sourceItemRef` na ponudu i `handoffProposalId` na item; guard 409 ako item već ima živ handoff
- [x] **UKLONJEN `POST /api/project-items/:id/milestone`** — upisivao je živ milestone **bez ikakvog odobrenja klijenta**, što je suprotno zahtevu da novi rad znači nove sate i cenu. Ovo je ispravka, ne nova funkcija
- [x] `POST .../proposals/:pid/withdraw` — `sent` → `draft`, dok klijent još nije odgovorio
- [x] `DELETE .../proposals/:pid` — samo `draft`/`rejected` (ništa nije materijalizovano); oslobađa `handoffProposalId` na item-u
- [x] `POST /api/project-items/:id/task` — nepromenjen: task u prihvaćen milestone je u dogovorenom obimu, primenjuje se odmah
- [x] `components/chat/HandoffDialog.jsx` — jedno „Hand off…" dugme umesto tri kontrole; cilj bira **task u postojeći milestone** (dropdown **grupisan po fazi**) ili **predloži novi rad**; dijalog objašnjava komercijalnu razliku
- [x] `ProjectItemsPanel` prikazuje ishod po item-u („Added to a milestone" / „Proposed as new work")
- [x] `components/admin/PendingWorkSection.jsx` — sve što čeka klijenta na vrhu kartice projekta: status rečima („Awaiting client · 2d"), poreklo (`D-001`), Edit/Send/Withdraw/Delete. Prihvaćene ponude se ne prikazuju (one su već u stablu)
- [x] **Admin stablo grupisano po fazama** — sortiranje `(phaseNumber, order)` + separator, preko postojećeg `getMilestonePhase()`. Ranije se sortiralo samo po `order`, a `order` je faza-lokalan (`baseOrder: 0`), pa su se **faze preplitale** — glavni izvor „ne zna se redosled"

**Auto-osvežavanje (bez websocket-a):**

- [x] `useNotifications` 30s poll sad invalidira i `['client-projects']`, `['project-proposals']`, `['project-items']` — mehanizam je već postojao, samo je pokrivao isključivo chat. Nijedan od ovih ključeva nema sopstveni polling, pa je ovo jedini cross-browser signal
- [x] `acceptProposal` upisuje `data.project` u keš (`setQueryData`) — nove milestone-ove vidiš odmah po kliku, ne tek posle refetch-a
- [x] Ispravljene bare-prefiks invalidacije u `useProjectItems`

**Notifikacije:**

- [x] `lib/notification-policy.mjs` (novo, čist + 10 testova) — `resolveDeliveryChannels`. `inApp` **uvek** `true`; konverzacijski tipovi se prigušuju ako je primalac online ili je isti kanal već slat unutar 1 h; akcioni tipovi (`chat_mention`, `project_proposal_*`, `request_created`) **nikad** — ponuda koja čeka odobrenje mora da stigne i na mejl
- [x] `Notification.pushedAt` — push se prigušuje nezavisno od mejla
- [x] Prisustvo: `GET /api/notifications` je **drugi heartbeat** (radi na svakoj prijavljenoj stranici, ne samo u chatu); prag `45s → 90s` (3× najsporiji poll koji ga hrani)
- [x] `runEmailDigest` poštuje istu politiku (preskače online primaoce i konverzacije unutar prozora) i **importuje `DIGEST_TYPES`** umesto druge hardkodirane liste — te dve liste su se već jednom razišle (Sekcija 10)
- [x] **Uklonjeno dupliranje:** admin koji je i član projekta dobijao je **dve** notifikacije za istu poruku (roster fan-out + `notifyAdmins`); sad se preskaču oni koji su već obavešteni
- [x] `useNotifications` šalje **toast za dolazne notifikacije** — do sada nije postojao nijedan; sa odbijenim/prigušenim push-om poruka je mogla da stigne bez ijednog vidljivog znaka. Dedupe je **modul-level**, jer je hook montiran na 7 mesta istovremeno i per-instance stanje bi dalo 7 toastova za istu poruku

**Bug uhvaćen uživo (ne `npm test`, ne `node --check`):** `models/Notification.js` je posle izmene imao vislicu `pushedAt: {…}, email` — validan JS (shorthand property), pa je prošao `node --check`, ali `ReferenceError: email is not defined` pri učitavanju modula **oborio je ceo API** (svi endpointi 500). Uhvaćeno jedino jer se posle izmena gađao živ endpoint. Isti obrazac kao Mongoose `.create()` (Sekcija 5) i razdvojene digest liste (Sekcija 10) — treći put da sintaksna provera i unit testovi propuste grešku koju uživo poziv otkrije odmah.

**Usput ispravljeno:** `DELETE` handler je imao hardkodiran `500` u catch bloku umesto `errorResponse` — što je ravnalo svaki namerni status (401/403/404/409) na 500. Pogađalo je i postojeću granu za opoziv poziva, ne samo nove rute.

**Vidljivost onoga što čeka (dodato posle korisnikove povratne informacije „klijenti neće odmah shvatiti šta da pogledaju u Proposals & phases"):**

- [x] `tailwind.config.js` — nov keyframe **`attention-glow`** (2s, pulsira SAMO `box-shadow`). Namerno **nije** korišćen ugrađeni `animate-pulse`: on menja `opacity` celog elementa, pa bi tekst koji treba pročitati treperio zajedno sa ivicom
- [x] Klijentska strana (`app/dashboard/projects/[id]/page.js`): ponuda u statusu `sent` dobija zlatnu ivicu + `animate-attention-glow`, bedž **„Needs your approval"** pored postojećeg status pill-a (status opisuje šta smo MI uradili, ovaj kaže šta KLIJENT treba da uradi), i brojač u zaglavlju sekcije („1 proposal is waiting for your approval")
- [x] Puls prestaje čim klijent otvori ponudu (`reviewedProposalIds`) i tada se skida i iz zvona (`markRead` sa `proposalId`); **zlatna ivica ostaje** dok god ponuda stvarno čeka odluku. Na sledećoj poseti puls se vraća ako i dalje nije odlučeno — nerešena ponuda košta, pa je to namerno
- [x] Admin strana (`PendingWorkSection`): pulsiraju samo redovi gde je **potez na operateru** (`draft`, `changes_requested`, `rejected`); `sent` je parkiran kod klijenta i ostaje miran — da puls ne izgubi značenje

**Potpuno brisanje i povratak iz arhive (traženo posle testiranja — test podaci se nisu mogli ukloniti):**

- [x] `DELETE .../proposals/:pid` prošireno sa `archived` (bilo samo `draft`/`rejected`). Time **svaki status ima pun put do potpunog uklanjanja**: `sent` → withdraw → delete · `accepted` → „Delete phase" (arhivira i vraća milestone-ove iz plana) → delete · `draft`/`rejected`/`archived` → delete odmah
- [x] Brisanje čisti i tragove: `$pull` iz `project.archivedProposalIds` (tombstone postoji samo da spreči da accept-replay ponovo materijalizuje fazu — kad ponude više nema, nema šta da se replay-uje) i `handoffProposalId` na izvornom chat item-u
- [x] Odbrambena provera: ako ijedan milestone još uvek pokazuje na tu ponudu (polovično odrađena arhiva) → **409**, da brisanje ne ostavi milestone-ove bez porekla
- [x] UI dugme **„Delete forever"** za `draft`/`rejected`/`archived`, odvojeno od postojećeg „Delete phase" (koji je i dalje meko arhiviranje). Traži da se **otkuca ime faze** — isti nivo potvrde koji `DeletePhaseDialog` traži za mnogo blažu akciju
- [x] **BUG prijavljen uživo i ispravljen:** prva verzija je koristila `window.prompt`. Brisanje `rejected` je radilo, ali `archived` posle toga „ne otvara modal" — jer posle prvog nativnog dijaloga browser ponudi _„spreči ovu stranicu da pravi još dijaloga"_, i od tada `prompt()` **vraća `null` bez prikazivanja**. Kod je `null` tretirao kao „otkazano" i tiho izlazio, pa je dugme delovalo pokvareno. Zamenjeno pravim dijalogom `components/admin/DeleteProposalForeverDialog.jsx` (Radix, kao i ostatak aplikacije), sa objašnjenjem po statusu zašto je brisanje bezbedno. Pouka: nativni `prompt`/`confirm` nisu pouzdani za ponovljene destruktivne radnje — aplikacija ionako svuda koristi Radix dijaloge
- [x] **„Restore as draft"** za `archived` — arhivirana ponuda sad nudi `Create revision` (pod tim imenom) i `Add milestone`, što je ranije imala samo `rejected`/`accepted`. Stari plan se vraća kao nov draft i ide ponovo kroz send/approve

**Brisanje prihvaćene faze — operatorski override (promena politike, potvrdio korisnik):**

- [x] Zatečeno stanje bio je **ćorsokak**: `preparePhaseArchive` je bezuslovno odbijao arhiviranje ako je bilo šta u fazi započeto, dugme je bilo `disabled`, pa prihvaćena faza sa započetim radom **nikad** nije mogla da se ukloni — ni meko ni tvrdo. Dokumentacija to nije rešavala; `DeletePhaseDialog` je izričito pisao da server odbija takvo brisanje. Dakle: promena politike, ne nedostajuće dugme
- [x] `preparePhaseArchive(..., { force })` — override **samo** nad započetim radom. Master proposal (`MASTER_PROPOSAL_IMMUTABLE`) i ne-`accepted` statusi (`PHASE_NOT_ACCEPTED`) ostaju odbijeni i sa `force: true`; 4 nova testa to zaključavaju
- [x] Endpoint traži **drugu potvrdnu frazu** `"DELETE STARTED WORK"` pored postojeće `"DELETE"`, plus obavezan razlog
- [x] Razlog se čuva sa prefiksom `[Force-deleted over N started milestone(s)]` u `archiveReason`, i ide u `project_proposal_archived` događaj — arhivirani red je jedini preostali trag, pa mora da kaže i šta je odbačeno
- [x] UI: dugme više nije `disabled` kad je rad započet, nego menja tekst u **„Force delete phase"**; dijalog tada prikazuje crveno upozorenje, traži frazu, i menja tekst čekboksa (ranije je tvrdio „has not started", što bi u force režimu bila neistina)
- [x] **Master proposal (faza 1) ostaje nedodirljiv** — svesna odluka korisnika: to je ceo dogovoreni obim projekta, ispravlja se kroz `Create revision`
- [-] Nije uživo testirano nad pravom bazom — korisnik čisti svoje test podatke sam

**Verifikacija:** `npm test` → **161** (14 novih ukupno u ovoj rundi). Sintaksno provereno sve izmenjeno. Uživo: `/admin` i `/dashboard` se kompajliraju; `POST /project-items/:id/handoff`, `.../withdraw`, `DELETE .../proposals/:pid` vraćaju 401 (ruta postoji, auth radi), uklonjeni `.../milestone` vraća 404, postojeće `DELETE /api/services/x` i dalje 401 (bez regresije). Tailwind je pokupio novi keyframe bez restarta — potvrđeno čitanjem servirane CSS datoteke (`@keyframes attention-glow` + `.animate-attention-glow` prisutni).

- [-] **Puni uživo tok nije testiran** (dva browsera, admin+klijent, send → accept → auto-refresh; throttle; toast) — traži pisanje u pravu bazu i izričitu dozvolu

---

## 12e. Fino podešavanje chata (korisnik testira sam u dev modu)

- [x] Pinovana poruka je anchor — klik skače na tu poruku u threadu, sa istim highlight-om koji već koristi „reply" citat. Ako poruka još nije učitana u istoriji, javi toast umesto tihog ne-reagovanja
- [x] Pinovana poruka sa flagom ima i malo **Convert** dugme desno — konverzija bez traženja poruke u threadu. Ako je već konvertovana, umesto dugmeta stoji njen `ref`
- [x] Obrisana poruka se sada **automatski skida sa pinova** (`pinned:false` pri brisanju), a `GET /pinned` dodatno filtrira `deletedAt: null` da pokrije i ranije obrisane-a-pinovane redove
- [x] Mobilni header: naslov u prvom redu punom širinom, kontrole (flag / search / Decisions & items) u drugom; search uzima preostalu širinu, dugmad `auto`. Od `md:` naviše ostaje jedan red
- [x] Preview slike: `⋯` više ne stoji ispod ugrađenog `X` dugmeta dijaloga (`pr-12`) — ranije je na dodir uvek pobeđivalo zatvaranje
- [x] Dokumenti se **odmah preuzimaju** umesto preview-a (PDF u `iframe`-u je na mobilnom prikazivao ikonicu oštećenog fajla); zajednički `downloadFileToDevice` u `lib/utils.js` (fetch → blob, jer `<a download>` ne radi cross-origin)
- [x] Mobilni composer: `⋮` meni (otvara se nagore) sa **Attach** i **Flag** podmenijem umesto dva zasebna dugmeta — tekstualno polje i Send dobijaju širinu. Desktop zadržava zasebna dugmad
- [x] `items-center` poravnanje u headeru i composeru
- [x] Admin panel header — `overflow-hidden` + `gap-2 lg:gap-4` + `hidden sm:inline` na `Welcome, {name}` + `shrink-0` na kritičnim elementima — sprečava horizontalni scroll na mobilnom
- [x] Mobilni composer textarea: `rows={3}` na mobilnom, `rows={1}` na desktopu — `useEffect` sa `matchMedia("(max-width: 767px)")`
- [x] Mobilni Flag submenu (`DropdownMenuSubContent`): `side="top" align="end"` — meni ide ka gore od Flag dugmeta, donja ivica poravnata
- [x] Hydration mismatch warning (`cz-shortcut-listen="true"`) — **nije bug u kodu**: ColorZilla browser ekstenzija ubacuje atribut na `<body>` pre nego što React hidrira. `suppressHydrationWarning` na `<html>` i `<body>` u `app/layout.js`

Sintaksno provereno; `npm test` 161/161. **Uživo nije testirano — korisnik testira u dev modu.**

- [x] Proxy download endpoint `GET /api/download` + prošireni tipovi fajlova (PDF/DOC/DOCX/TXT) + download slika na uređaj putem proxy-ja — **potvrdio korisnik**: slike rade kroz proxy, PDF/DOC/DOCX/TXT koriste Cloudinary Admin API signed URL fallback (`cloudinary.utils.private_download_url`) jer "Restricted media types" blokira `image/upload` za ne-slikovne formate. Upload endpoint proširen da prihvata DOC/DOCX/TXT i koristi `uploadRawToCloudinary` (`resource_type: "raw"`) za sve ne-slikovne fajlove — novi fajlovi dobijaju `/raw/upload` putanju koja nije blokirana
- [x] Mobilni tri tačkice (`⋮`) pored poruka — `md:opacity-0 md:group-hover:opacity-100` umesto `opacity-0 group-hover:opacity-100`, tako da su na mobilnom uvek vidljive a na desktopu se i dalje pojavljuju na hover
- [-] Chat workspace visina — zamenjen `h-[calc(100vh-220px)]` u `ProjectChat.jsx` sa `h-full`; roditeljski kontejneri (`app/admin/page.js`, `app/dashboard/page.js`) sada koriste `h-dvh flex flex-col` + `shrink-0` na headeru + `flex-1 min-h-0` na `<main>`/content oblasti tako da chat prirodno ispuni sav raspoloživ prostor. Dashboard koristi uslovne klase (`activeTab === "chat" ? flex-1 min-h-0 : container mx-auto`) da ne polomi izgled ostalih tabova. **Potvrdio korisnik — radi**
- [x] Klikabilni linkovi u chatu — `MessageBubble.jsx` parsira URL-ove u telu poruke (`autolink` regex), renderuje ih kao `<a target="_blank" rel="noopener noreferrer">` sa bojom `rgb(0, 69, 156)` i underline. **BUG ispravljen 2026-07-29:** `renderBodyWithLinks` je vraćao sirov tekst kad je cela poruka samo URL (`parts.length <= 1 ? text : parts` ne razlikuje `[plainText]` od `[<a>]`); ispravljeno na `last > 0 ? parts : text` gde `last` napreduje samo kad je URL zaista pronađen
- [x] Chat na zasebnoj stranici `/dashboard/chat` — izmešten iz taba u `app/dashboard/page.js` na svoju stranicu (novi `app/dashboard/chat/page.js`) sa `h-dvh flex flex-col` layoutom i back dugmetom u headeru, identičan obrazac kao admin stranica. Rešava problem gde je Danger Zone sekcija (brisanje naloga) završavala preklopljena ispod chat kontejnera pune visine. Navigacija sad koristi `<Link href="/dashboard/chat">` umesto `onClick` tab switcher-a; `totalUnreadChat` tačka ostaje na linku
- [x] DM lista u sidebar-u filtrirana po `rosterProjectId` — **BUG ispravljen 2026-07-29:** adminu su se u Direct sekciji prikazivali DM-ovi iz SVIH projekata, a `members` roster je scope-ovan na jedan projekat, pa DM-ovi iz drugih projekata nisu mogli da razreše ime partnera (prikazivalo se "Direct message"). `dmChannels` sada filter dodaje `(!rosterProjectId || c.projectId === rosterProjectId)` — prikazuju se samo DM-ovi koji pripadaju trenutno aktivnom projektu

---

## 12f. Isporuka notifikacija, chat scroll i optimizacija (2026-08-08)

Korisnikov izveštaj: „notifikacije i push kao PWA rade povremeno", „mejlovi za novi Proposal i izmene moraju raditi precizno", „scroll to bottom pri ulasku i pri slanju", „pinovana poruka da se učita i skroluje", „unpin ikonica u Pinned panelu", „klik na notifikaciju da vodi do akcije", plus provera pre-renderinga i nepotrebnih učitavanja u chatu.

### Test infrastruktura — popravljena PRE svega ostalog

- [x] **`fileParallelism: false` u `vitest.workspace.mjs` nije radilo.** To je root-only opcija; unutar `defineWorkspace` projekta se prihvata i **tiho ignoriše**. Posledica: svih 7 integracionih fajlova je radilo paralelno nad **istom** bazom, a `resetDb()` u jednom fajlu je brisao fixtures drugog → **143 lažna 401/404/E11000 pada** koji svi prolaze kad se fajl pusti sam. Rešeno novim root `vitest.config.mjs` (`workspace` + `fileParallelism`)
- [x] `harness.mjs` `MODELS` proširen na **sve** kolekcije koje suite ume da PIŠE (`ProjectRequest`, `ProjectMessage`, `ProjectProposal`, `ProjectAuditLog`, `PushSubscription`) — konverzija pravi zahteve i poruke, pa je jedan test brojao šest tuđih `ProjectRequest` redova
- [x] `subscribeToPush(user)` i `runDigestSweep()` helperi; `CRON_SECRET` u test env-u (digest ruta je bearer-gated)
- [x] `tests/ui/setup.js` (nije postojao, a `chat-ui` projekat ga je referencirao) + `esbuild: { jsx: "automatic" }` — bez toga svaki render puca na `React is not defined`, jer projekat nigde nema `jsx` compiler opciju
- [x] Skripte: `test:api`, `test:ui`, `test:all`, `typecheck`

### Push i mejl — četiri prava bug-a

- [x] **Push se nije čekao.** `notifyUser` je zvao `sendPushToUser(...).then(...)` bez `await`. Na serverless runtime-u instanca sme da se zamrzne čim odgovor ode, pa push u letu jednostavno nikad nije završen — **najverovatniji uzrok „radi povremeno"**. Sad je `await`-ovan
- [x] **`pushedAt` se upisivao i kad nijedan uređaj nije primio poruku.** `sendPushToUser` sad vraća `{ sent, failed, pruned, skipped }`, a stamp ide samo uz `sent > 0`. Ranije je istekla pretplata izgledala kao uspešna isporuka i **gušila sledećih sat vremena pravih push-eva**
- [x] **Throttle je čitao oba vremena sa JEDNOG dokumenta.** Uzimao je najskoriji red koji ima `emailedAt` ILI `pushedAt` i sa njega čitao oba polja — red koji je push-ovan a nije mejlovan prijavljivao je „nikad mejlovano". Sad dva nezavisna, scope-ovana upita
- [x] **`resolveClientUserId` je bio case-sensitive.** `User.email` se upisuje kako ga klijent otkuca, `ClientProject.clientEmail` kako ga operator otkuca — jedno veliko slovo i ponuda nije stizala ni u zvono ni na mejl, **bez ijednog traga u logu**. Dodat case-insensitive fallback; `notifyUser` sad i loguje kad primalac ne postoji umesto da tiho izađe
- [x] `runEmailDigest`: per-user throttle sužen na `DIGEST_TYPES` — ranije je **bilo koji** inline mejl (npr. „Proposal ready") držao digest poruka sat vremena; i `emailedAt` se sad upisuje **tek posle uspešnog slanja**, pa ispad mejl provajdera više ne „pojede" batch
- [x] `lib/push.js`: truncate body na 300 znakova (push servisi odbijaju prevelik payload), `tag` po razgovoru
- [x] `public/sw.js`: `notificationclick` bira tab koji je **već na cilju** (fokus bez re-navigacije), inače fokusira pa navigira — oba `await`-ovana unutar `waitUntil`; ranije `navigate()` nije bio čekan pa je klik znao da samo fokusira staru stranicu

### Notifikacija vodi do akcije

- [x] Chat notifikacije nose i **poruku**, ne samo kanal: `?channel=…&m=<messageId>`; `ProjectChat` prima `initialMessageId`, čisti filtere i skroluje do te poruke (učitavajući stariju istoriju ako treba)
- [x] `initialMessageId` se **latch-uje u state**, ne čita iz props-a uživo — URL sync efekat prepisuje adresu na `?channel=…` i oduzeo bi `m` pre nego što se pročita (isti obrazac kao `useSearchParams` bug na invite stranici, 12b)
- [x] `/dashboard?tab=chat` legacy redirect prosleđuje i `m`
- [x] `NotificationBell`: `fallbackLinkFor(n, variant)` — red bez `link`-a više nije mrtav klik; preskače se samo navigacija na **identičan** URL (isti kanal na istoj stranici), dok promena query-ja i dalje ide kroz `router.push`
- [x] `/dashboard/chat` dobio **`NotificationBell` i `PushManager`** — bila je jedina autentifikovana stranica bez oba, a to je stranica na kojoj se najduže sedi (bez zvona nema ni „Enable push notifications" ponude, bez `PushManager`-a se pretplata ne osvežava)

### Chat scroll i pin

- [x] Ulazak u kanal uvek sleti na **poslednju poruku** — dupli `rAF` + `ResizeObserver` na omotaču sadržaja, pa slika koja se učita posle prvog paint-a ne ostavi pogled na pola threada
- [x] **Slanje poruke uvek skroluje dole**, i kad je korisnik pre toga skrolovao gore: `MessageComposer` javlja `onSent`, plus pravilo „poslednja poruka je moja → prati je" (pokriva i slanje sa drugog uređaja). Tuđa poruka dok čitaš istoriju i dalje daje „New messages" pilulu umesto trzaja
- [x] Reset scroll stanja i na promenu **filtera/pretrage**, ne samo kanala (svaki je zaseban query — zaseban thread); `prevLengthRef` se sad takođe resetuje
- [x] Klik na pinovanu poruku **stranica po stranicu učitava istoriju** dok je ne nađe (do 20 stranica), i čeka da se prva stranica uopšte razreši pre nego što zaključi da poruke nema — ranije je deep-link uvek završavao na toastu
- [x] Skok **čisti aktivni filter/pretragu** — sa filterom „Problem" ciljna poruka nije ni u upitu, pa bi pretraga istorije došla do kraja i ništa ne našla
- [x] `pendingJumpRef` (računat u renderu) sprečava trku između „prvi paint → skroluj dole" i „skoči na poruku", pošto čišćenje filtera menja query ključ i broji se kao svež thread
- [x] **Unpin ikonica skroz desno** u `PinnedBar`-u, uslovljena serverskim `canPin`-om
- [x] `['chat-pinned']` dodat u invalidaciju `useNotifications` poll-a — tuđ pin se sad pojavi bez refreša (pinned lista nema sopstveni polling)

### Pre-render, re-render, nepotrebna učitavanja

- [x] **Prefetch prve stranice svakog kanala** (`usePrefetchChannelMessages`, max 12, jednom po kanalu po sesiji) — prvi klik na bilo koji kanal se sad iscrta iz keša umesto „Loading…"
- [x] `staleTime: 3000` + `refetchOnMount: true` umesto `staleTime: 0` + `'always'` — prefetch-ovan kanal se prikazuje odmah; budžet svežine je nepromenjen (4s poll + invalidacija iz notifikacionog poll-a), nestao je samo prazan frejm
- [x] `messages` niz **memoizovan** na identitet `pages` — nepromenjen 4s poll više ne pravi nov niz i ne re-renderuje svaku poruku
- [x] `MessageBubble` u `React.memo`, sa **stabilnim** handler identitetima iz `MessageList`-a (`onJumpToReply` prima izvorni id kao drugi argument umesto da se zatvara po redu — inače memo ne radi ništa)
- [x] `ProjectChat`: `activeChannel` kroz `useMemo`, svi handleri kroz `useCallback`, URL sync čuvan ref-om da `router.replace` ne okida sam sebe
- [x] `markRead` vezan za **id poslednje poruke**, ne na `messages.length` — svaki prepend istorije je ranije slao dva upisa i dve invalidacije za thread u kom se ništa novo nije desilo; dodat `visibilitychange` listener da povratak u tab ipak označi pročitano
- [x] **Filter i pretraga se resetuju pri promeni kanala** — zaostao filter iz prethodnog kanala je najverovatnije objašnjenje za „poruke se ne učitaju": kanal je izgledao prazan jer se gledala filtrirana projekcija

### Novi testovi

- [x] `tests/integration/notification-delivery.test.mjs` (12) — ceo lanac isporuke: proposal sent/changes-requested notifikacija i mejl, mejl i kad je klijent online, case-insensitive pronalaženje klijenta, push završen **pre** povratka odgovora, `pushedAt` NIJE upisan bez uređaja, `tag` po razgovoru, nezavisni email/push throttle, digest (inline mejl ne blokira, throttle po primaocu, batch preživi pad provajdera)
- [x] `tests/ui/message-list.test.jsx` (6) — sleti na poslednju poruku, sleti i iz keša, prati sopstvenu poruku dole i kad si skrolovao gore, pilula za tuđu, `scrollRequest` iz composera, skok učitava istoriju unazad
- [x] `tests/ui/pinned-bar.test.jsx` (4) — unpin po redu i šta zove, sakriven bez `canPin`, klik traži skok
- [x] `tests/ui/notification-bell.test.jsx` (8) — klik navigira na poruku, označava ceo kanal pročitanim, fallback link, bez duplog history unosa za istu stranicu, drugi kanal na istoj stranici JESTE navigacija
- [x] `chat-notifications.test.mjs` ažuriran na novi ugovor linka i na pravu push pretplatu (stub sad broji stvarne `PushSubscription` redove umesto da uvek vraća `sent: 1` — inače bi sakrio baš bug koji čuva)

### Health check

- [x] `npm run build` — prolazi (Next 16.2.10, 14 stranica)
- [x] `npx tsc --noEmit` — čist. Dodat `tsconfig.json` (`allowJs`, `checkJs: false`) i `typescript` u devDependencies; TypeScript ranije nije bio ni instaliran, pa `npx tsc` nije mogao da se pokrene
  - [-] `checkJs: true` namerno **nije** uključen: daje **~1374** nalaza kroz ceo kodbejz (uglavnom React Query mutation generici koji se izvode kao `void` i Radix `forwardRef` prop inference) — to je zaseban posao, ne nalaz ove runde. Jedini pravi nalaz u dodirnutim fajlovima (prefetch poziv bez `flag`/`q`) je ispravljen default vrednostima
- [x] `pyright backend_test.py tests/__init__.py` — 0 errors, 0 warnings
- [-] **Uživo u browseru nije testirano od strane asistenta** — scroll i push traže pravi uređaj/sesiju; ostaje na korisniku

---

## 12g. Druga runda posle korisnikovog testiranja (2026-08-08)

Prijava: „ne dobijam push na telefonu", „scroll opet ne radi — otvori poruke na pola prepiski", „textarea na mobilnom ide ispod ekrana preko 6 redova".

### Scroll — prava trka, ne podešavanje

Prethodna runda je i dalje koristila **one-shot** flag (`isInitialLoadRef`). Lanac koji ga obara:

1. prvi paint troši flag i **zakazuje** scroll za sledeći frejm;
2. u toj rupi stigne scroll event sa `scrollTop` još uvek 0;
3. `scrollTop < 80` + `hasMoreHistory` se čita kao „korisnik je skrolovao gore po istoriju" → učita se prethodna stranica;
4. restore vraća poziciju **starog vrha** — sredinu prepiske — a flag je već potrošen, pa ništa ne vraća dole.

Grizlo je samo kanale sa punom prvom stranicom (50+ poruka), zato je izgledalo povremeno.

- [x] Model promenjen sa „skroluj dole jednom" na **„drži se dna dok korisnik ne kaže drugačije"** (`stickToBottomRef`)
- [x] **Istorija se ne učitava dok se pogled nije slegao na dno** (`settledRef`) — `scrollTop` je legitimno 0 par frejmova pri otvaranju
- [x] **Samo scroll koji je korisnik napravio** gasi praćenje (`programmaticUntilRef`). Smooth scroll emituje evente i posle poziva; instant ne dobija prozor uopšte, da korisnik koji odmah po otvaranju skroluje gore ne bi bio ignorisan
- [x] Restore posle prepend-a koristi **stvarni prethodni `scrollTop`**, ne 0 — ranije je pogled odlutao naviše sa svakom stranicom

### Layout — textarea nije rastao naopako, cela kolona je prelivala

- [x] `ProjectChat` je imao **`min-h-[500px]`**. Sa otvorenom tastaturom na telefonu vidljiva visina padne na ~350px, pa je kutija bila viša od ekrana → composer na njenom dnu ispod preloma, a rast textarea izgleda kao širenje **nadole van ekrana**. Sad `min-h-0 md:min-h-[500px]`
- [x] `MessageList` `min-h-[200px]` → `min-h-0`; unutrašnja kolona dobila `min-h-0` — bez toga thread ne može da ustupi mesto composeru
- [x] `viewport.interactiveWidget = "resizes-content"` — bez toga Chrome na Androidu ne smanjuje `dvh` kad se tastatura otvori, nego samo gurne stranicu naviše
- [x] Mobilni cap rasta 200px → **120px**, početni `rows` 3 → 2 (200px na telefonu je pojelo ceo razgovor); `items-center` → `items-end` u redu composera
- [x] `py-8` → `py-3` na telefonu na `/dashboard/chat`

### Push — presence je bio po NALOGU, a push je po UREĐAJU

Uzrok „ne dobijam push na telefonu": `resolveDeliveryChannels` je gasio push čim je nalog bio „online". Otvoren dashboard na laptopu = **telefon ćuti sat vremena** — baš uređaj zbog kog push i postoji.

- [x] Uvedena razlika: `recipientOnline` (nalog aktivan bilo gde) vs **`recipientViewingConversation`** (pročitao BAŠ ovaj kanal unutar prozora, iz postojećeg `ChatRead.lastReadAt` — bez novog state-a)
  - čita razgovor → nema ni mejla ni push-a
  - aktivan negde drugde → **nema mejla** (zvono na laptopu to pokriva), **push ide**, i dalje ograničen throttle-om na jedan po razgovoru na sat
  - offline → oba, po throttle-u
- [x] **Rotacija VAPID ključa se sad sama leči.** Pretplata u browseru je trajno vezana za `applicationServerKey` sa kojim je napravljena; posle rotacije `getSubscription()` je i dalje vraća, red u bazi i dalje postoji, ali push servis odbija **svaki** send sa 403 — simptom je tačno „radilo pa jednog dana prestalo", bez ijedne greške bilo gde. `usePush.ensureSubscribed` sad poredi ključ na pretplati sa aktuelnim i, ako se razlikuju, radi `unsubscribe()` pa novu pretplatu; `lib/push.js` tretira 401/403 kao mrtvu pretplatu (uz `console.warn`) umesto da je večno pokušava. **Provereno da rotacija NIJE potrebna** za trenutne ključeve: par u `.env.local` je validan (javni == `NEXT_PUBLIC_` kopija, 65B nekompresovana P-256 tačka, 32B privatni, `web-push` gradi ispravan `Authorization` header)
- [x] `POST /api/push/test` + dugme **„Send a test push to this device"** u zvonu — „push ne radi" ima najmanje pet različitih uzroka (nema VAPID ključeva · nijedna pretplata · istekla pretplata · politika isporuke · OS blokira) i nijedan se ne vidi spolja. Endpoint zaobilazi politiku namerno: to je provera ožičenja, ne notifikacija. Vraća `sent/failed/pruned`, broj pretplata, host i user-agent po uređaju — **nikad pun endpoint URL**, jer je njegova putanja bearer kredencijal za taj browser

### Zašto push, install banner i settings switch ne rade na telefonu — jedan uzrok

Korisnik: „kad instaliram app na telefon kaže ne mogu da uključim push · switch u Settings se sam vrati na off · nema više install banner-a". Sva tri imaju **isti** uzrok, koji aplikacija nigde nije pominjala.

**Service Worker, `PushManager` i `Notification` postoje samo u secure context-u** — https, ili izuzetak za `localhost`/`127.0.0.1`. Plain-http LAN adresa (`http://192.168.1.x:3003`, tačno kako se ovaj dev server otvara sa telefona, vidi 12b) **nije** secure context, pa browser te API-je uopšte ne definiše. Otud:

- `usePush.supported` → `false` → switch u Settings je `disabled` i `checked={pushOn && push.supported}` ga crta kao **off**
- `beforeinstallprompt` se nikad ne okine (traži isti secure context + registrovan SW) → **nema install banner-a**
- poruka koju je korisnik video bila je „Not supported on this device/browser" — što šalje čoveka da traži problem na telefonu, a problem je adresa na kojoj je otvorio aplikaciju

- [x] `usePush` vraća `unavailableReason` + `unavailableMessage` — `insecure-origin` · `missing-key` (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` nedostaje u buildu) · `unsupported-browser` · `ios-needs-install` · `blocked`. Redosled je od najkonkretnijeg: prvi tačan razlog je onaj koji stvarno treba popraviti
- [x] `blocked` **ne** obara `supported` — to je stanje dozvole, ne sposobnosti uređaja; UI sad može da objasni umesto da tvrdi da telefon ne ume
- [x] Settings prikazuje konkretan razlog i u opisu i u toastu kad switch odbije da se uključi
- [x] `PWAInstallBanner`: novi `insecure` režim koji kaže zašto instalacija nije moguća, umesto uputstva koje ne može da uspe
- [x] **Odbacivanje banner-a više nije trajno** — bio je `localStorage` flag bez isteka, pa je „nema banner-a" imalo dva nerazlučiva uzroka (ne može da se prikaže / dodirnuo si × pre par nedelja). Sad je datirano, 30 dana; stara `"1"` vrednost se migrira na „prikaži ponovo"
- [x] **BUG u prethodnoj rundi, moj:** dugme „Send a test push to this device" bilo je uslovljeno sa `isSubscribed`, pa je jedina kontrola koja objašnjava zašto push ne radi **bila sakrivena svima kojima push ne radi**. Sad je uvek prisutno; bez pretplate menja tekst u „Why can't I get notifications?" i prijavljuje razlog sa klijentske strane pre nego što uopšte pozove server

### „Permission odobren, pa ipak Couldn't enable push" (Android Chrome, produkcija)

Sledeća prijava: na deployovanom https sajtu, sa sva četiri VAPID vara na Vercelu, Android prikaže sistemski prompt, korisnik potvrdi — i **onda** aplikacija kaže „Couldn't enable push notification". Dakle pada **posle** dozvole, a `subscribe()` je celu grešku gutao u `console.error` i vraćao `false`. Dve runde nagađanja su bile posledica toga; ovo je zatvoreno tako što aplikacija sad **prijavljuje pravu grešku**.

- [x] `subscribe()` prati **fazu** (`permission` → `service-worker` → `subscribe` → `save`) i pamti `{ stage, name, message }`; `lastErrorMessage` je rečenica tipa „Push service: AbortError — Registration failed - push service error". Svaka od tih faza pada iz nepovezanih razloga (browser · push servis/FCM · naš server) i traži drugu ispravku
- [x] Greška se prikazuje u toastu (12s) **i trajno** u Settings ispod prekidača — toast nestane pre nego što se stigne pročitati ili slikati
- [x] **`InvalidStateError` se sad sam leči.** Klasično Android Chrome odbijanje: push servis još drži pretplatu za tu registraciju pod **drugim** ključem, a `getSubscription()` je ne prijavljuje. Bez toga je uključivanje push-a na tom uređaju **trajno nemoguće**, bez ijednog načina da korisnik to očisti. Sad: `unsubscribe()` postojeće pa jedan ponovni pokušaj
- [x] Provera poklapanja VAPID ključa dodata i u `subscribe()` (ranije samo u `ensureSubscribed`) — ponovna upotreba pretplate vezane za stari ključ je gore od nijedne: „uspešno" uključivanje koje ne isporučuje ništa
- [x] `next.config.js` CSP: `worker-src 'self'` i `manifest-src 'self'` napisani eksplicitno. Oba su i ranije prolazila kroz fallback na `default-src 'self'`, ali PWA stoji i pada na njima, a implicitna dozvola se lako slomi prvim stezanjem `default-src`
- [x] **Trajno mesto za „Install on your phone" u Settings** — banner je odbaciv, a Chrome-ov sopstveni prompt ima svoja pravila prigušivanja; između to dvoje je sasvim moguće ostati bez ijednog puta do instalacije, što se korisniku i desilo. Tekst se menja po platformi i po tome da li je adresa secure

### Ishod — potvrđeno uživo od strane korisnika ✓

Pravi uzrok cele serije „push ne radi na telefonu" bio je **zastareo keš u Chrome-u**: telefon je držao stariji deployovan build. Otvaranje svežeg Vercel deploy-a bez zastarelog keša → **radi na sva tri uređaja**.

Redosled koji je korisnik prošao, i koji je tačno ono za šta je dijagnostika napravljena:

1. „Enable push notifications" → sistemski prompt → dozvolio
2. **„Send a test push to this device"** → javio da je push **ugašen u Settings** za taj nalog (`pushEnabledOnAccount: false`) — podatak koji se ranije nije video nigde
3. uključio u Settings → push radi
4. install banner se pojavio (datirano odbacivanje iz ove runde ga je vratilo)

Napomena za ubuduće: `public/sw.js` **ne kešira** ništa (`skipWaiting` + `clients.claim`), pa se sam osvežava; zastarelost je bila u Chrome-ovom HTTP kešu instalirane aplikacije, ne u service worker-u. Pri testiranju PWA izmena na telefonu vredi otvoriti svež deploy (ili hard-reload), inače se debug-uje stari kod.

**Sve stavke iz 12g su potvrđene uživo osim chat scroll-a i textarea layout-a** (korisnik nije eksplicitno potvrdio; ostaju za proveru).

### Testovi

- [x] `tests/ui/notification-bell.test.jsx` +2: dijagnostika je ponuđena i kad push NE radi; postaje pravi test tek kad je uređaj pretplaćen
- [x] `tests/ui/message-list.test.jsx` +2: istorija se NE učitava pre nego što se pogled slegao (regresija sredine prepiske); smooth follow-scroll ne broji svoje evente kao korisnikov scroll
- [x] `tests/notification-policy.test.mjs` +2 / izmenjen 1: čitanje razgovora gasi oba kanala; online negde drugde gasi mejl ali **ne** push; push i tada poštuje throttle
- [x] `tests/integration/chat-notifications.test.mjs`: „online negde drugde i dalje dobija push na telefon", „star read receipt ne znači da čita sada"
- [x] `tests/integration/notification-delivery.test.mjs` +2: `push/test` izveštaj sa i bez uređaja, i 401 za anonimnog

**Verifikacija:** 163 (`npm test`) + 202 (`vitest`: 180 API + 22 UI) = **365 testova, sve prolazi**. `npm run build` prolazi, `npx tsc --noEmit` čist, `pyright` čist. Scroll i push na pravom telefonu ostaju na korisniku — dugme „Send a test push to this device" je tu baš zato.

---

## 13. Verifikacija

### Testovi i pokretanje

- [ ] `npm test` zeleno
- [ ] `npm run dev` bez grešaka (port 3003)

### E2E bezbednost — direktni API pozivi collaborator tokenom (ne UI!)

SEC 1–8, 11, 13, 14 se prvi put pokreću **odmah po Sekciji 4** (vidi 4b), a ovde se ponavljaju kao regresija na kraju Faze 1.

- [ ] SEC 1 — `GET /api/client-projects` 200; `jq`: **ključevi ne postoje** (`proposalId`, `changeHistory`, `clientEmail`, `requestId`, `archivedProposalIds`) — odsustvo ključa, ne null
- [ ] SEC 2 — `GET /api/client-projects/:id` 200 + ista provera ključeva
- [ ] SEC 3 — `GET /api/project-proposals?projectId=X` → **403**
- [ ] SEC 4 — `GET /api/project-proposals/:poznatiId` (projekat gde JE član) → **403**
- [ ] SEC 5 — `POST/PUT/PATCH/DELETE` proposal → **403**
- [ ] SEC 6 — `PUT .../milestones/:mid`, `PATCH .../milestone/*` → **403**
- [ ] SEC 7 — `GET /api/project-requests/:id` istog projekta → **404**
- [ ] SEC 8 — nečlan: `GET /api/client-projects/:tuđiId` → **404**
- [ ] SEC 9 — treći korisnik ne vidi tuđ DM u `GET /api/chat/channels` (prvi put po Sekciji 6)
- [ ] SEC 11 — owner regresija: odgovor identičan kao pre izmena
- [ ] SEC 13 — `GET /api/project-proposals/:idIzProjektaB` sa `?projectId=A` → **404** (resource-first)
- [ ] SEC 14 — `POST /api/client-projects/:A/messages` sa `milestoneId` iz projekta B → **404**
- [ ] SEC 15 — `POST /api/chat/channels/:kanalIzB/messages` kao član samo projekta A → **404** (po Sekciji 6)
- [ ] SEC 16 — `POST /api/chat/messages/:id/convert` gde poruka pripada projektu B → **404** (po Sekciji 12)

### E2E funkcionalnost

- [ ] F 1 — lazy kanal + prva poruka
- [ ] F 2 — poruka ≤4s kod klijenta; unread nestaje po otvaranju
- [x] F 3 — invite mejl (ko, projekat, prava, adresa, rok) — **potvrdio korisnik uživo**: mejl sadrži ko poziva („Gordana invited you…"), projekat („Spiritualized Language Tutor"), rolu („as a Consultant, Expert"), ličnu poruku, dugme + tekstualni link, adresu na koju glasi i rok („expires on August 4, 2026")
- [x] F 4a — **postojeći nalog**: preview → „Sign in" → prijava → odmah član grupe. **Potvrdio korisnik uživo** (posle ispravke `useSearchParams`/`replaceState` bug-a, sekcija 12b)
- [ ] F 4b — **novi nalog**: registracija sa zaključanim mejlom → odmah član + My Projects. Još nije prošlo uživo — korisnik je testirao putanju sa postojećim nalogom; registraciona grana (`register` + `inviteToken`) je uživo testirana samo sintetički u Sekciji 5 (test C/D), ne pravim klikom kroz UI
- [ ] F 5 — **dupli klik na Accept ne pravi duplo članstvo**
- [ ] F 6 — resend (stari token mrtav) + revoke
- [ ] F 7 — leave project → `removed` + audit
- [ ] F 8 — reply, mention (mejl odmah), upload, edit, delete
- [ ] F 9 — pin + PinnedBar + filter + pretraga
- [ ] F 10 — convert to request (`sourceMessageId`) + oznaka na poruci
- [ ] F 11 — save as decision (`D-001`, `confirmedBy`)
- [ ] F 12 — regresija milestone chata + member komentar (`authorRole: 'member'`)
- [ ] F 13 — audit log: created → resent → accepted → role_changed → removed/left

---

## Parkirane dopune — razrešeno

Sve stavke sa ove liste su razrešene i prebačene u **sekciju 3A** kao invarijante I1–I10, sa punom razradom u [PROJECT_CHAT_PLAN.md](./PROJECT_CHAT_PLAN.md) sekcija 4A. Ostavljeno kao trag odluka:

| Dopuna                                  | Ishod                                                                                                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic invitation accept                | → **I2**. Transakcija (Atlas ima replica set, presedan već postoji u kodu), **bez fallback grane**; dodato pravilo redosleda: membership pre invitation statusa |
| Postojeći nalog vs invite registracija  | → **I3**. Uz konstataciju da suspendovan/obrisan nalog **ne postoji kao stanje** (`User` nema `status`, brisanje je hard delete)                                |
| Token hygiene i rate limiting           | → **I4**. Rate limit premešten sa preview/accept na **slanje poziva** — 32 nasumična bajta se ne probijaju, spam mejlova jeste realan vektor                    |
| DM concurrency i `ProjectItem` sekvence | → **I5**. `dmKey` dodat u model odmah (izbegnuta migracija); za `ref` izabran **retry**, `ProjectSequence` model odbačen                                        |
| Notification fan-out                    | → **I6**                                                                                                                                                        |
| Polling budget                          | → **I8**                                                                                                                                                        |
| Feature flag                            | → **I9**. Prihvaćen, ali **sužen na UI ulaz**; rute se ne flaguju                                                                                               |
| Javni Cloudinary URL                    | → **I7**. Prihvaćen rezidualni rizik + obavezan helper tekst u UI-ju, ne samo u dokumentaciji                                                                   |
| _(novo, nije bilo na listi)_            | → **I10** i plan 5A. Preživljavanje istorije posle hard delete-a naloga                                                                                         |

---

## Faza 2 — kasnije, ne u ovoj isporuci

- [ ] Sistemski kanali: `Announcements` (`admin_only`), `Ideas`, `Development`, `Design & Content`
- [ ] `Incidents` kanal — auto-feed iz `ProjectItem`
- [ ] `Milestone Activity` kanal — auto-feed iz `ClientProject.events`
- [ ] **Privatni storage + signed URL za SVE priloge** (novi chat + retrofit postojećih); AV sken, sanitizacija imena, zabrana izvršnih fajlova
- [ ] `client_lead` / `project_admin` u UI + transfer vlasništva pri napuštanju
- [ ] Task assignee + `taskUpdateOwn`
- [ ] Interna finansijska polja iza `internalFinanceRead` (marža, trošak, kalkulacija)
- [ ] Thread-ovi (odgovori u pod-niz)
- [ ] Typing indikator i presence
- [ ] Arhiviranje kanala, moderacija
- [ ] AI rezimei: dnevni/nedeljni, nove odluke, otvorena pitanja, nepotvrđeni predlozi, poruke za taskove
- [ ] Globalna pretraga po projektu, članu, datumu, milestone-u i tipu odluke
- [ ] Migracija milestone chata (`ProjectMessage`) pod isti model kanala
- [ ] Razbijanje `route.js` na module
- [ ] Razmotriti SSE ako polling na 4s postane usko grlo

---

## 14. SEO — tehnički (2026-08-08)

Povod: analiza od „Google SEO Optimizations Studio" + mejl iz Search Console-a („Blocked by robots.txt").

### Šta je zaista bilo pokvareno (izmereno, ne pretpostavljeno)

`curl` na produkciju je pokazao uzrok Search Console greške, i on nije bio u sadržaju robots.txt-a — **robots.txt uopšte nije postojao**:

```
GET https://dmdevelon.website/robots.txt
  status=200 · content-type: text/html · x-matched-path: /[...slug]
GET https://dmdevelon.website/sitemap.xml
  status=200 · content-type: text/html · x-matched-path: /[...slug]
```

Catch-all ruta `app/[...slug]` je hvatala oba i odgovarala HTML dokumentom CMS stranice. Google je tražio robots.txt, dobio HTML sa statusom 200, i prijavio sajt kao blokiran. Sitemap-a nije bilo uopšte.

Drugi nalaz: `HomeClient` je imao **jedan zajednički loading gate** za pet klijentskih upita — dok bilo koji traje, cela stranica vraća `<Loader/>` („Processing…"). Na serveru nijedan od njih nema podatke, pa je serviran HTML sadržao **nula** tekstualnog sadržaja: bez heroja, usluga, projekata, kontakta. Analiza je bila u pravu za simptom; uzrok je bio ovaj gate, ne „SPA arhitektura" kao takva — Next je već renderovao na serveru, gate ga je poništavao.

### Urađeno

- [x] `app/robots.js` — pravi robots.txt (`text/plain`), disallow za `/api/ /admin /dashboard /invite /verify-email /reset-password`, plus `Sitemap:` i `Host:`. File-convention ruta se poklapa **pre** catch-all-a, pa je to ceo popravak
- [x] `app/sitemap.js` — sitemap iz baze (CMS stranice bez `seo.noIndex` + Portfolio projekti), `revalidate 3600`; pad baze degradira na „samo početna", nikad na 500
- [x] `lib/site-url.js` — jedno mesto za apsolutni origin. `app/page.js` je ranije interpolirao `process.env.NEXT_PUBLIC_APP_URL` direktno i pravio `undefined/` kad var nedostaje
- [x] **Uklonjen blokirajući preloader.** Svaka sekcija se sad renderuje odmah; `projects`/`testimonials` već imaju `[]` default, svi `profile` pristupi su optional-chained
- [x] **Početna čita bazu direktno** umesto `fetch()` na sopstveni `/api/services`. Taj round trip je bio čist trošak (dodatni mrežni hop + druga serverless invokacija za podatke koje proces već ume da upita), padao je pri buildu, i **terao stranicu da bude dinamička**. Sad je `○` sa `revalidate: 300` — prerenderovan, keširan HTML
- [x] Metadata: `alternates.canonical` (stari top-level `canonical` u `layout.js` **nije** deo Metadata API-ja i nije emitovao ništa), `metadataBase`, `openGraph.images` (staro `ogImage` polje nije validno pa je tiho ispadalo — svaki share je bio bez slike), `twitter` card
- [x] `lib/seo.js` fallback opis: „Web Development" → stvarni opis usluge sa cenom. Fallback je ono što se indeksira onog dana kad neko isprazni polje u CMS-u
- [x] Nova **About + finansiranje** sekcija između heroja i Services (`#about`, dodata i u nav): kako se radi (zahtev → ponuda → faze), i sufinansiranje sa pretplatama $49 / $149 / $299 / $549

**Rezultat na prerenderovanom HTML-u:** 22 KB (samo meta) → **120 KB sa stvarnim sadržajem**; „Processing" se više ne pojavljuje.

### Ostaje korisniku (sadržaj i off-page, ne kod)

- [ ] Search Console: posle deploy-a `robots.txt` → Validate Fix, i submit `sitemap.xml`
- [ ] SEO title/description po stranici kroz CMS (kod sad ima solidan fallback, ali fallback nije strategija)
- [ ] Namenske landing stranice po usluzi — CMS ih već podržava (`/[...slug]`), treba tekst
- [ ] Case studies (npr. Marysoll) — najjači E-E-A-T signal za B2B i prirodan izvor linkova
- [ ] Blog / vodiči za vlasnike salona
- [ ] „Powered by DMDevelon" u footeru klijentskih platformi

---

## 15. Paddle i pretplate — dogovoreno, nije započeto

Sledeći posao. Ovde stoji samo ono što je **odlučeno**, da se ne izgubi između sesija; pun plan se piše pre prve linije koda.

### Zahtev

`ProjectProposal` danas nosi **ručno unetu cenu koja se ne naplaćuje automatski**. Pored nje treba da nosi i **odgovarajući plan pretplate**: Website $49 · WebApp $149 · Workspace $299 · Growth $549 mesečno (isti skup je u `PRICING_TIERS`, `components/pages/HomeClient.js`). Pretplata kreće **mesec dana posle prihvatanja** ponude.

Poslovni razlog: model je sufinansiranje — nema velike fakture unapred, izgradnja se plaća kroz pretplatu — pa je ponuda mesto gde se komercijalna odluka donosi i prirodno mesto da se plan zapiše.

### Pravilo koje sve ostalo mora da poštuje

> **Jedan projekat — jedna pretplata.** Nikad jedna po milestone-u ili po fazi.

Dodavanje milestone-a ili faze **pomera postojeću pretplatu na viši (ili isti) tier — nikad ne pravi drugu**. Naplata prati ukupan obim projekta, ne zbir naplata po fazama. Iz toga sledi da „tier za projekat" i „tier upisan na prihvaćenoj ponudi" moraju završiti kao **ista vrednost**, ne dve koje mogu da se raziđu.

### Otvorena pitanja — rešiti PRE implementacije

- [ ] **Da li tier ikad ide naniže?** Pravilo iznad pokriva samo put nagore. Šta se dešava kad se faza arhivira, force-obriše ili se obim smanji?
- [ ] **Koji događaj je okidač naplate?** `accept` je očigledan kandidat, ali životni ciklus već ima `withdraw` i `archive` **posle** prihvatanja (sekcija 12d), pa i ti slučajevi traže odgovor.
- [ ] **Gde tier autoritativno živi?** Polje na projektu koje ponuda samo *predlaže*, ili izvedeno iz poslednje prihvaćene ponude. Šta god se izabere, ono drugo mora biti **čitanje** toga, nikad drugi izvor istine.

### Zatečeno stanje koje ograničava dizajn

**Faza *jeste* ponuda** — `kind: "phase"`, uz unique indeks `{projectId, phaseNumber}` (sekcija 12d). Svaki novi prihvaćen obim kreira **novi** `ProjectProposal` red. Zato „pretplata po projektu" ne može naivno da se izvede iz jedne ponude; to je tačka na kojoj se dizajn lomi ako se ne odluči unapred.

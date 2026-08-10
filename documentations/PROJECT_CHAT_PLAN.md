# Plan izrade — DMDevelon Project Communication Hub (v2)

Radi na postojećoj DMDevelon aplikaciji. Nemoj praviti novi projekat, paralelnu aplikaciju niti izolovani demo. Implementiraj funkcionalnost u postojećem sistemu, uz očuvanje postojećih korisnika, podataka, autorizacije, notifikacija, milestone chat-a i vizuelnog identiteta.

Prateći dokument: [TODO.md](./TODO.md) — čekirana lista svih koraka, tamo se označava šta je urađeno.

> **v2 dopuna (2026-07-27):** plan je proširen bezbednosnom analizom. Ključne izmene u odnosu na v1:
> odvojeni `ProjectInvitation` i `ProjectMember` entiteti · sha256 hash invite tokena · role preseti
> umesto boolean flagova · **allowlist serializeri** umesto brisanja polja · centralna
> `requireProjectPermission` politika · audit log · helper sloj + route matcher pre dodavanja
> endpointa · milestone chat otvoren za collaborator-a · list endpointi ne smeju otkriti ni
> postojanje ponude. Detalji u sekcijama 6–9 i 13.
>
> **v3 dopuna (2026-07-28):** deset cross-cutting invarijanti (I1–I10, sekcija 4A) — atomičnost
> prihvatanja poziva, resource-first autorizacija, token hygiene, konkurentnost preko DB indeksa,
> fan-out iz aktivnog članstva, polling budžet, feature flag sužen na UI ulaz — i životni ciklus
> projekta posle hard-delete-a naloga (sekcija 5A): `ownerAccountDeletedAt` gasi pisanje na
> projektu čiji je vlasnik obrisao nalog, dok istorija (chat, milestone, audit, Portfolio) ostaje
> čitljiva svima koji su učestvovali. `restrictForClosedProject` (`lib/chat-domain.mjs`) je ožičen
> u `resolveProjectAccess` (sekcija 7), pa svaki endpoint to nasleđuje bez ijedne dodatne provere.

---

## 1. Poslovni cilj

U aplikaciji treba da postoji **projektna chat grupa**, ali **ne kao zamena** za milestone komentare, zahteve, probleme i incidente.

> Chat je komunikacioni sloj. Formalne odluke i zadaci ostaju u strukturisanim modulima.

Za svaki projekat postoji jedan zajednički kanal, npr. `Psihointegritet — Projektna grupa`. Klijent u njega poziva vlasnika projekta, članove svog tima, dizajnera, developere, konsultante i druge zainteresovane osobe. Pored imena i mejla mogu sami upisati status/ulogu u timu (opciono polje). Pored glavne grupe postoje i direktne poruke između članova.

### Najvažnije produktno pravilo

**Chat nije mesto konačne evidencije.** Kada se u razgovoru donese odluka, ona mora dobiti formalni status:

```
Milan: Booking ostaje request-first i terapeut ručno potvrđuje termin.
Anja: Potvrđujem.

  → [Sačuvaj kao odluku]

Odluka D-041
Booking koristi request-first tok sa ručnom potvrdom terapeuta.
Povezano sa: originalnim porukama · milestone-om · osobama koje su potvrdile · datumom.
```

Ako korisnici pričaju u chatu a niko ne pretvara odluke u zapise, važne stvari ostaju zakopane u razgovoru. Zato su **flagovi**, **pin** i **„Pretvori u…"** deo prve faze, ne kasniji dodatak.

### Najvažniji bezbednosni acceptance kriterijum (v2)

> Pozvani saradnik potpuno legitimno dobija **200** za projekat i istovremeno **403** za svaki
> proposal i finansijski endpoint povezan sa tim istim projektom.
> To je eksplicitna bezbednosna odluka, ne slučajna posledica UI-ja.

Problem nije `member can access project`, nego pogrešna pretpostavka `member can access every resource linked to project`. Samo članstvo u projektu **nije** dovoljan uslov za pristup finansijama, ponudama, internim procenama i administrativnim podacima.

Politika statusa: korisnik **bez ikakvog odnosa** sa projektom → **404** (ne otkriva postojanje resursa); **član bez konkretne dozvole** → **403**.

Pristup projektu ne proizlazi iz posedovanja linka, već iz kombinacije: validan poziv + verifikovan email identitet + aktivno `ProjectMember` članstvo.

---

## 2. Prvo analiziraj postojeći sistem

Pre izmene koda pregledaj najmanje sledeće fajlove:

- `models/ProjectMessage.js`, `models/ProjectRequest.js`, `models/ClientProject.js`, `models/Notification.js`, `models/User.js`, `models/ContactMessage.js`
- `app/api/[[...path]]/route.js` (ceo backend je u ovom fajlu)
- `lib/project-proposal-domain.mjs`, `lib/notify.js`, `lib/auth.js`, `lib/cloudinary.js`, `lib/email.js`, `lib/email-templates.js`
- `hooks/useClientProjects.js`, `hooks/useNotifications.js`, `hooks/useAuth.js`
- `components/dashboard/MilestoneChat.jsx`, `components/dashboard/RequestConversation.jsx`
- `components/NotificationBell.jsx`
- `app/dashboard/page.js`, `app/admin/page.js`
- `app/verify-email/page.js`, `app/reset-password/page.js` (uzorak za invite stranicu)

### Zatečeno stanje — tri nepovezana toka poruka

| Gde | Model | Ograničenje |
|---|---|---|
| Milestone chat | `models/ProjectMessage.js` — zasebna kolekcija | `milestoneId` je **required** → nema razgovora na nivou projekta |
| Request thread | `ProjectRequest.messages[]` — embedded niz | samo `message` / `system`, bez flagova |
| Admin „Messages" | `models/ContactMessage.js` | kontakt forma sa jednim reply poljem, nije chat |

Posledice koje plan rešava:

- Projekat ima tačno **jednog** učesnika sa klijentske strane (`clientUserId` / `clientEmail`) plus sve admine. Ne postoji tabela članstva.
- Ne postoji invite flow — `grep -rn "invite"` po `app/ components/ lib/ hooks/ models/` nema rezultata.
- Ne postoji real-time sloj. Sve je React Query polling: `project-messages` 15s, `notifications` 30s, plus web-push (VAPID) i batch email digest kroz Vercel cron na 15min.
- Uloge su binarne: `User.isAdmin` boolean. Nema project-level rola ni permission sistema.

### Badge sistem koji već postoji i koji nasleđujemo vizuelno

`components/dashboard/MilestoneChat.jsx:143-160` — pilula iznad tela poruke vođena sa `m.messageType`:

| Tip | Boja | Ikonica |
|---|---|---|
| `question` | `bg-blue-600` | `HelpCircle` |
| `change_request` | `bg-red-600` | `RefreshCw` |
| `change_agreed` | `bg-green-600` | `CheckCircle2` |

Novi chat koristi **isti vizuelni jezik**, ali svoje polje `flag` sa širim skupom vrednosti.

### Ako se stvarno stanje razlikuje

Prilagodi plan stvarnom kodu. Pre implementacije napiši kratak rezime pronađenog toka, zatim implementiraj. Nemoj se zaustaviti samo na planu.

---

## 3. Potvrđene odluke

1. **Faza 1** = projektna grupa + direktne poruke, sa reply / mentions / attachments / unread / pin / flagovi / filter u headeru / „Pretvori u…". Sistemski kanali su Faza 2, ali se model od starta pravi tako da ih primi **bez migracije**.
2. **Pozvani član tima** dobija chat + **autorizovanu projekciju projekta** u svom My Projects: naziv, opis, plan, timeline, milestones, taskovi, članovi tima, projektni i milestone chat. **Ne vidi**: cene, ponude, popuste, komercijalne uslove, interne procene, istoriju pregovora, billing, interne napomene — ni njihovo postojanje.
3. **Role preseti umesto ad-hok flagova** (v2): `collaborator` i `viewer` u Fazi 1; `client_lead` i `project_admin` rezervisani u enumu ali ih UI još ne nudi. Permissions se izvode iz role kroz centralnu politiku — bez proizvoljnih permission setova za početak.
4. **Konverzije** → jedan `ProjectItem` model (`kind: idea | problem | incident | decision`). Zahtev ide u postojeći `ProjectRequest`, zadatak u postojeći milestone `task`, komentar u postojeći `ProjectMessage`.
5. **Real-time** → brzi polling (4s aktivan kanal / 15s pozadina) + postojeći web push i notification bell. Bez nove infrastrukture, bez third-party servisa.
6. **Prilozi (v2)**: `visibility` polje + pristup izveden iz članstva kanala; URL ostaje javni Cloudinary kao u ostatku aplikacije. Privatni storage + kratkotrajni signed URL = Faza 2, za sve priloge odjednom.

   **Prihvaćen rizik — javni Cloudinary URL.** Ko već ima prilog može taj link da prosledi bilo kome van DMDevelon-a; to nije sporno i ne pokušavamo da sprečimo. Granica koju platforma čuva je druga: ko na DMDevelon-u nema pravo učešća (npr. `viewer`, ili neko ko projekat samo prati) **ne dobija pristup chatu — ni grupnom ni u Proposals & phases** — pa ni URL-ove priloga iz njega. Zaštita je na sloju „ko uopšte vidi poruku", ne na sloju „koliko je URL pogodljiv". Zato ovo nije blocker za Fazu 1; signed URL u Fazi 2 rešava preostali slučaj procurelog linka, ne ovaj.
7. **Invite za novog korisnika (v2)**: registraciona forma ima **zaključano email polje** na adresu iz poziva. Posedovanje tokena (stigao baš u to sanduče) + poklapanje adrese = dokaz vlasništva mejla → nalog odmah `emailVerified: true`, poziv prihvaćen bez drugog verifikacionog mejla. Napad „registruj tuđ mejl preko linka" je nemoguć jer se druga adresa ne može upisati.

### Šta se izričito NE dira

`components/dashboard/MilestoneChat.jsx` i tok `change_request` → `change_agreed` sa `sourceMessageId` audit vezom ostaju kakvi jesu. Novi chat je **dodatni** sloj, ne zamena.

Jedina izmena na `models/ProjectMessage.js` (v2): `authorRole` enum se proširuje `['admin','client']` → `['admin','client','member']`, jer matrica daje collaborator-u pravo na milestone komentar.

---

## 4. Arhitektonska pravila

Sve iz postojećeg koda — ne uvodimo nove konvencije.

**Modeli** (`models/*.js`):
```js
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const XSchema = new mongoose.Schema(
  { _id: { type: String, default: () => uuidv4() }, /* … */ },
  { timestamps: true, _id: false }
);

export default mongoose.models.X || mongoose.model('X', XSchema);
```
Svi `_id` su UUID stringovi. **Nema `ref` / `populate`** — sve reference su plain `String`. Indeksi inline preko `Schema.index(...)`.

**API** — svi endpointi idu u `app/api/[[...path]]/route.js`. Svaki verb handler počinje sa `await connectDB()`. Svaki `NextResponse.json(...)` **mora** nositi `{ headers: getCorsHeaders() }`. Greške kroz `apiError(message, status)` / `errorResponse(error, label)`. Validacija stringova kroz `cleanString(value, field, max, { required })`.

**v2:** pre dodavanja novih grana uvodi se helper sloj i mini route matcher (sekcija 8) — nove grane ne smeju ručno ponavljati auth/permission/serializaciju.

**Domenska logika** — čista, bez DB, u `lib/chat-domain.mjs` i `lib/project-serializers.mjs` po uzoru na `lib/project-proposal-domain.mjs`, sa `node --test` testovima u `tests/`.

**Frontend** — React Query hook u `hooks/`, `getAuthHeaders()` iz `useAuth`, `toast` iz `react-hot-toast`, shadcn primitive iz `components/ui/`, `cn` iz `lib/utils.js`.

**Upload** — postojeći `POST /api/upload` sa `{ file: <dataURI>, name, projectId, kind: 'chat' }` → Cloudinary `portfolio/clients/<slug>/chat`. Ne pravi novi upload endpoint.

**Stil** — Tailwind sa literalnim bojama: pozadina `#0f0f10`, panel `#1a1a1b`, brand `#FFB633`, ivice `border-white/10`, muted tekst `text-gray-400`. Ikonice `lucide-react`.

**Jezik UI-ja** — aplikacija je celom površinom na engleskom. Novi chat prati to: **UI stringovi na engleskom**, dokumentacija na srpskom.

---

## 4A. Cross-cutting invarijante

Devet pravila koja važe **kroz sve sekcije**. Stoje ovde, uz arhitektonska pravila, a ne pri kraju dokumenta — ko implementira Sekciju 6 pročitaće sekcije 1–9 i neće skrolovati na kraj pre toga.

Najveći rizik u ovom poslu nije da je plan pogrešan, nego da se neka od ovih invarijanti primeni **nedosledno** kroz ~18 endpointa.

### I1 — Child-resource autorizacija

`projectId` se izvodi iz **učitanog resursa**, nikad iz URL-a ili body-ja. Puna razrada i primeri u sekciji 7.

### I2 — Atomičnost prihvatanja poziva

Deployment je Atlas (replica set), transakcije rade, i **već se koriste** u ovoj aplikaciji — [route.js:1532](../app/api/[[...path]]/route.js) koristi `session.withTransaction` za phase archive. Zato:

- membership + invitation status su **jedan atomic commit** u transakciji;
- **bez fallback grane** za deployment bez transakcija. Grana koja se nikad ne izvršava u produkciji je netestiran kod koji će biti pogrešan tačno onda kad zatreba;
- audit log, sistemska poruka i lazy kreiranje kanala su **post-commit side effect-i**, idempotentni, sa retry-em. Njihov neuspeh ne poništava već prihvaćeno članstvo.

**Redosled unutar transakcije je deo ugovora: prvo članstvo, pa status poziva.** `withTransaction` retry-uje callback na transient greškama, pa callback mora biti idempotentan sam po sebi; a ako transakcija ikad otpadne, redosled odlučuje koji je otkaz benigno:

| Redosled | Delimičan otkaz | Ishod |
|---|---|---|
| membership → invitation | član postoji, poziv `pending` | **korisnik ima pristup**, retry počisti poziv |
| invitation → membership | poziv `accepted`, člana nema | **token mrtav, pristupa nema** — traži admina |

### I3 — Sudar sa postojećim nalogom

Invite registracija **nikada** ne kreira drugi `User` sa postojećim normalizovanim mejlom. Postojeći nalog ide kroz prijavu ili reset lozinke.

Napomena o zatečenom stanju: `User` **nema** `status`, `deletedAt` ni `active` polje, a brisanje naloga je **hard delete** (`User.findByIdAndDelete`). Nalog dakle binarno postoji ili ne postoji — pravilo „poziv ne reaktivira suspendovan nalog" opisuje stanje koje ne postoji i namerno se ne piše. Posledice hard delete-a pokriva I10.

### I4 — Token hygiene

- `Referrer-Policy: no-referrer` na `/invite` — dodaje se u postojeći `headers()` blok u `next.config.js` (trenutno ga nema);
- raw token se **ne loguje**;
- token se uklanja iz URL-a kroz `history.replaceState` posle uspešnog preview-a;
- cookie se briše posle accept-a, isteka i revoke greške.

**Rate limit ide na slanje poziva, ne na preview/accept.** Token je 32 nasumična bajta; probijanje kroz preview traži ~2²⁵⁵ zahteva — limit tamo brani od napada koji ne postoji. Vektor koji je jeftin i realan je drugi: slanje poziva kao spam mašina na tuđe adrese, sa DMDevelon-a, na tuđ Resend račun. Izvodljivo bez nove infrastrukture — brojanje `ProjectInvitation` po `invitedByUserId` u prozoru vremena. (U aplikaciji trenutno **nema nikakav** rate limiting, pa je ovo prvi; utoliko više vredi staviti ga gde nešto zaista brani.)

Analytics ne postoji u aplikaciji, pa stavka „analytics ne sme beležiti invite URL" nema predmet.

### I5 — Konkurentnost se rešava indeksom, ne aplikacijom

Tri mesta, tri DB-level garancije:

| Šta | Garancija | Ponašanje pri sudaru |
|---|---|---|
| Grupni kanal | unique partial `(projectId)` za `kind:'group'` | uhvati duplicate key → učitaj postojeći |
| DM par | unique partial `(projectId, dmKey)`, `dmKey = [a,b].sort().join(':')` | isto |
| `ProjectItem.ref` | unique `(projectId, kind, ref)` | **retry**, ograničen broj pokušaja |

`memberUserIds` niz ne može da iznudi jedinstvenost para — otud kanonski `dmKey`.

Za `ref` biramo **retry, ne `ProjectSequence` model sa `$inc`**: brojač uvodi dokument po `(projekat, kind)` i drugi režim otkaza (brojač odluta od stvarnosti), a kontencija je realno nula — dva čoveka koji u istoj milisekundi pretvaraju poruku u odluku na istom projektu nije profil opterećenja.

### I6 — Fan-out iz trenutno aktivnog članstva

Primaoci notifikacija se računaju iz **trenutnog aktivnog članstva**, ne iz istorijskog spiska kanala ni starih `Notification` zapisa. Suspendovan ili uklonjen član ne dobija in-app notifikaciju, push, email digest ni mention mejl.

Za DM oba učesnika moraju i dalje imati aktivan pristup projektu. Posle uklanjanja člana: uklonjeni više ne čita DM · drugi aktivni učesnik zadržava istoriju · kanal se **ne briše** · nove poruke ka uklonjenom nisu dozvoljene.

### I7 — Javni prilozi: prihvaćen rezidualni rizik

`visibility` štiti **API listing** — sprečava da neovlašćeni korisnik URL dobije kroz aplikaciju. Ne opoziva URL koji je neko ranije kopirao; to nije storage-level zaštita.

Odluka: prihvaćeno za Fazu 1. Ko nema pravo učešća ne dobija pristup chatu ni u grupi ni u Proposals & phases, pa ni URL-ovima iz njega. Prosleđivanje linka od strane nekoga ko prilog legitimno ima nije napad koji sprečavamo.

**Uz to ide operativno ograničenje:** u Fazi 1 se u chat ne postavljaju ugovori, fakture, identifikacioni dokumenti, lozinke, API ključevi ni drugi poverljivi fajlovi. Pravilo zapisano samo u `.md` fajlu ne štiti nikoga — ide **jedan red helper teksta uz attach dugme** u composeru. Inače je to dokumentacija koja pokriva nas, a ne korisnika.

### I8 — Polling budžet — implementirano, zatvoreno u Sekciji 11 ✓

- **4s samo za trenutno otvoren kanal**; `channels` lista 15s — zadovoljeno strukturno: `MessageList`/`MessageComposer` postoje samo dok je taj kanal aktivno prikazan, React Query gasi `refetchInterval` čim komponenta koja ga koristi nestane
- polling pauziran kad je `document.hidden === true` ili korisnik nije autentifikovan — **besplatno**, TanStack Query v5 podrazumevano (`refetchIntervalInBackground: false`) radi tačno ovo bez ijedne linije koda
- **samo jedan aktivan `messages` query po ekranu** — `MessageList` i `MessageComposer` namerno pozivaju `useChatMessages(channelId, {flag, q})` sa identičnim argumentima (Sekcija 8) da dele isti query ključ umesto dva paralelna pollinga
- obavezna cursor paginacija, `limit 50` — iz Sekcije 6/7, nepromenjeno
- search ima debounce (400ms, `ChatHeader.jsx`, Sekcija 11) — **jedini deo koji je stvarno nedostajao**; minimalna dužina (`q.trim().length >= 2`) već postojala od Sekcije 6 na serveru
- mera broja zahteva/vremena Mongo upita pre SSE odluke — odloženo, SSE je Faza 2 stavka, nema potrebe meriti pre nego što se ta odluka uopšte razmatra

Pauziranje na `hidden` **ne košta ništa u svežini**: `refetchOnWindowFocus: true` je već globalno uključen u `providers/QueryProvider.js`, pa povratak u tab ionako okida refetch.

### I9 — Rollout iza feature flag-a

Jedan env flag, bez feature-flag servisa. **Obim je namerno sužen na UI ulaz** — `Chat` stavku u navigaciji klijenta i admina.

Rute se **ne** flaguju: to udvostručuje test matricu (svaki SEC test u oba stanja) za malu dobit, jer su rute ionako permission-gated i nedostižne iz UI-ja dok ulaz ne postoji.

Sekcija 4 flag ne traži — bez ijednog `ProjectMember` reda ona je u produkciji no-op, a jedini realan rizik (scoping upit i serializer na putanji koju vlasnik već koristi) hvata SEC 11 owner regresija.

### I10 — Istorija preživljava brisanje naloga

Nalozi se hard-brišu, a projekat mora ostati čitljiva istorija — operatoru, i ostalim učesnicima. Zato **identitet mora biti denormalizovan u trenutku upisa**, nikad rešavan kroz `userId` u trenutku čitanja.

Zatečeno stanje je već dobro na većini mesta:

| Već preživljava | Kako |
|---|---|
| Javni `Project` (Portfolio) | samostalna kopija, **nula referenci na korisnika** |
| `ClientProject` | `clientName`, `clientEmail`, `clientSlug` |
| `ChatMessage` | `authorName` |
| `ProjectItem` | `createdByName` |
| `ProjectAuditLog` | `actorName`, `targetEmail` |
| `ProjectInvitation` | `invitedByName` |

Jedina rupa bio je `ProjectMember` — nije imao ni ime ni mejl, pa bi obrisan član u listi učesnika bio prazan red. Dodati `name` i `email`, popunjeni pri prihvatanju poziva.

Puna razrada životnog ciklusa u sekciji 5A.

---

## 5. Data model — 7 novih modela + 4 izmene

### `models/ProjectInvitation.js` (novo — poziv je odvojen entitet, v2)

Poziv postoji nezavisno od korisničkog naloga — u trenutku slanja korisnik možda još nema nalog.

```js
_id, projectId,
emailNormalized: String,         // email.trim().toLowerCase(); literal poređenje,
                                 // BEZ plus-address ili provider transformacija
invitedByUserId, invitedByName,
intendedRole: 'collaborator' | 'viewer' | 'client_lead' | 'project_admin',
roleLabel: String,               // v2.1 dopuna — nedostajalo u prvom nacrtu iako je
                                 // payload odmah pominjao roleLabel?; kopira se na
                                 // ProjectMember.roleLabel pri prihvatanju
tokenHash: String,               // sha256(rawToken) — sirovi token NIKAD u bazi;
                                 // u mejl ide rawToken = randomBytes(32).toString('base64url')
status: 'pending' | 'accepted' | 'expired' | 'revoked',
expiresAt,                       // +7 dana
acceptedAt, acceptedByUserId,
personalMessage: String          // opciona lična poruka u pozivu
```

Indeksi: unique `(tokenHash)` · unique partial `(projectId, emailNormalized)` gde je `status: 'pending'` — **nema više aktivnih poziva za isti projekat i email** · `(projectId, status)`.

### `models/ProjectMember.js` (novo — samo trajno članstvo, v2)

Nastaje **tek po prihvatanju** poziva. Nikad se ne briše fizički — audit istorija.

```js
_id, projectId,
userId: String (required),
name, email,                     // denormalizovano pri prihvatanju — vidi I10
role: 'collaborator' | 'viewer' | 'client_lead' | 'project_admin',
status: 'active' | 'suspended' | 'removed',
roleLabel: String,               // slobodan prikazni tekst: "Designer", "CTO" — opciono
invitedByUserId, joinedAt
```

Indeksi: unique `(projectId, userId)` · `(userId, status)`.

`name` i `email` nisu udvajanje `User` dokumenta nego uslov da istorija preživi: nalozi se hard-brišu, pa bez njih lista učesnika završenog projekta prikazuje prazne redove za svakoga ko je u međuvremenu zatvorio nalog. `roleLabel` je i dalje samo prikaz — autorizacija ide isključivo kroz `role`.

Vlasnik projekta (klijent po `clientUserId`/`clientEmail`) i globalni admin **nemaju** ProjectMember red — za njih postojeći `canAccessClientEntity` ostaje autoritet. Isti korisnik može biti vlasnik svog projekta i collaborator na tuđem.

### `models/ProjectAuditLog.js` (novo, v2)

```js
_id, projectId,
actorUserId, actorName, targetUserId, targetEmail,
eventType: 'invitation.created' | 'invitation.resent' | 'invitation.revoked'
         | 'invitation.accepted' | 'member.added' | 'member.role_changed'
         | 'member.suspended' | 'member.removed' | 'member.left',
metadata: Mixed
```

Indeks: `(projectId, createdAt: -1)`. Vidljiv samo adminu. Odgovara na: ko je pozvao, ko je menjao prava, kada je dobio pristup, ko ga je uklonio, da li je imao pristup u trenutku incidenta.

### `models/ChatChannel.js` (novo)

```js
_id,
projectId,                       // null rezervisano za buduće globalne DM-ove
kind: 'group' | 'dm' | 'system',
name,
systemKey: null | 'announcements' | 'ideas' | 'development'
         | 'design' | 'incidents' | 'milestone_activity',
memberUserIds: [String],         // samo za dm; group/system računa članstvo iz ProjectMember
dmKey: String,                   // [a,b].sort().join(':') — kanonski identitet DM para
postingPolicy: 'all' | 'admin_only',
archivedAt, createdByUserId
```

Indeksi: `(projectId, kind)` · `(kind, memberUserIds)` · unique partial `(projectId)` za `kind:'group'` · unique partial `(projectId, systemKey)` · unique partial `(projectId, dmKey)`.

Faza 1 kreira **jedan** `group` kanal po projektu, `name: "<Project title> — Project Group"`, lazy.

Jedinstvenost i grupnog kanala i DM para iznuđuje **baza**, ne aplikacija (I5). Unique indeks za grupni kanal je na `projectId` samom — indeks sa istim `{projectId, kind}` obrascem a drugim opcijama MongoDB odbija kao `IndexOptionsConflict`.

### `models/ChatMessage.js` (novo)

```js
_id, channelId, projectId,
authorUserId, authorName,
authorRole: 'admin' | 'client' | 'member',
body,
attachments: [{
  url, type: 'image' | 'pdf', name,
  visibility: 'project_shared' | 'client_only' | 'internal_team',   // v2; default 'project_shared'
}],
flag: 'none' | 'request' | 'task' | 'idea' | 'problem' | 'incident' | 'decision',
kind: 'user' | 'system',
replyToMessageId,
replyToPreview: { authorName, body, messageId },       // denormalizovano — nema populate
mentions: [String],
pinned, pinnedAt, pinnedByUserId,
convertedTo: [{ target, targetId, targetType, kind, createdAt, byUserId, byName }],
editedAt, deletedAt, deletedByUserId
```

Indeksi: `(channelId, createdAt: -1)` · `(channelId, pinned)` · `(projectId, flag)` · `(channelId, mentions)`.

Brisanje je **soft**. Pristup prilogu se izvodi iz pristupa poruci/kanalu — prilog iz DM-a ne sme biti dostupan nikome van tog DM-a kroz bilo koji list endpoint. Signed URL isporuka = Faza 2.

### `models/ChatRead.js` (novo)

```js
_id, channelId, userId, lastReadAt, lastReadMessageId, clearedAt
```

Unique `(channelId, userId)`. Nosi **tačan** unread count po kanalu. `Notification` ostaje za zvono, push i email digest.

`clearedAt` nosi „očisti ovaj razgovor kod mene": poruke starije od tog trenutka se ne prikazuju **tom korisniku**, dok ostali učesnici i operatorova istorija ostaju netaknuti. Zato je čišćenje watermark ovde, a ne brisanje na `ChatMessage`.

### `models/ProjectItem.js` (novo)

```js
_id, projectId,
kind: 'idea' | 'problem' | 'incident' | 'decision',
ref: String,                     // "D-041", "I-007" — sekvenca po (projectId, kind)
title, body,
status: 'open' | 'in_review' | 'accepted' | 'rejected' | 'resolved' | 'closed',
severity: 'low' | 'medium' | 'high' | 'critical',
sourceChannelId, sourceMessageId,
milestoneId,
confirmedBy: [{ userId, name, at }],
createdByUserId, createdByName, decidedAt
```

Indeksi: `(projectId, kind, status)` · `(sourceMessageId)`.
Prefiksi: `D-` decision · `I-` incident · `P-` problem · `ID-` idea.

### Izmene postojećih modela

- `models/Notification.js` — dodati `channelId: { type: String, default: '' }` + indeks `(userId, channelId)`
- `models/ProjectMessage.js` — `authorRole` enum + `'member'` (jedina izmena)
- `models/ClientProject.js` — dodati `ownerAccountDeletedAt: { type: Date, default: null }`; postavlja se pri brisanju vlasnikovog naloga i jedini je okidač za read-only zatvaranje projekta (vidi 5A). Aditivno polje sa default vrednošću — bez migracije i bez uticaja na postojeće dokumente.

Napomena uz `ChatChannel` i `ChatRead` iz istog seta izmena: `dmKey` nosi jedinstvenost DM para (I5), a `ChatRead.clearedAt` per-user čišćenje razgovora (5A).

---

## 5A. Životni ciklus projekta i preživljavanje istorije

Projekat ne nestaje kad se ljudi raziđu. Ovo je ugovor o tome šta ostaje i kome.

> **✓ Implementirano i uživo verifikovano (4-lifecycle, 2026-07-28).** `DELETE /api/users/:id` sada u jednoj MongoDB transakciji: briše nalog, postavlja `ownerAccountDeletedAt` na sve projekte koje je posedovao, i prebacuje sve njegove `ProjectMember` redove u `removed` — isti obrazac transakcije kao postojeći phase-archive kod (I2 primenjen i na brisanje naloga, ne samo na invitation accept). Audit upis je post-commit, best-effort.
>
> Test: kreirana su dva jednorazna naloga (vlasnik + collaborator), jedan jednorazan projekat i jedno članstvo, isključivo za ovu proveru — pozvan stvaran `DELETE` uživo, rezultat proveren direktno u bazi, pa sve obrisano. Baza vraćena na tačno prethodno stanje (`users`/`clientprojects` count nepromenjen). Potvrđeno: 409 guard i dalje blokira aktivan projekat; posle prevođenja u `completed` brisanje prolazi i `ownerAccountDeletedAt` se postavlja; surviving collaborator vidi zatvoreni projekat read-only u listi i detalju (prva prava end-to-end provera `resolveProjectAccess` → `restrictForClosedProject` → `serializeProjectForAccess` lanca sa realnim `ProjectMember` redom, ne fabrikovanim objektom); brisanje collaborator naloga ostavlja `ProjectMember.status: 'removed'` sa sačuvanim `name`/`email` i tačno jedan `ProjectAuditLog` red.

### Zatečeni tok koji već radi

`DELETE /api/users/:id` **već blokira** brisanje naloga dok korisnik ima projekat koji nije u terminalnom statusu (`completed`, `cancelled`, `deleted`) — vraća 409 sa porukom da admin prvo mora da ga prerasporedi. Posle završetka projekta brisanje prolazi, a `ClientProject` ostaje sa `clientName`/`clientEmail`. Taj guard se **ne dira**.

`publishToHomepage` na `ClientProject` kreira **samostalan** `Project` dokument ([route.js:3040](../app/api/[[...path]]/route.js)) i pamti `linkedProjectId`. Kopija nema nijednu referencu na korisnika, pa javni prikaz na početnoj — sekcija **MY WORK → Projects**, „Explore my recent projects showcasing innovative solutions and creative designs" ([HomeClient.js:692](../components/pages/HomeClient.js)) — preživljava brisanje svih naloga bez ikakvog dodatnog rada.

### Šta se dešava kad vlasnik obriše nalog

Novo polje `ClientProject.ownerAccountDeletedAt`. Postavlja se u trenutku brisanja naloga za sve projekte tog klijenta.

Posledica, kroz `restrictForClosedProject` u `lib/chat-domain.mjs`:

> Projekat postaje **zatvoren i read-only za sve osim operatora.** Ostaju `projectRead`, `milestoneRead`, `taskRead`, `chatRead`, `membersRead`, `leaveProject`. Gasi se sve što piše, poziva ili obavezuje.

Razlog nije kazna nego činjenica: **nema više vlasnika koji bi mogao da pristane na išta** — da odobri izmenu, prihvati milestone ili odgovori na pitanje. Operator je izuzet: on i dalje administrira istorijski zapis i on je taj koji gotov rad objavljuje u Portfolio.

**Okidač je nestanak vlasnika, ne završetak projekta.** Isporučen projekat sa živim klijentom ostaje pun — pitanja posle isporuke su normalan rad, a ograničavanje bi bila regresija za klijente koji to danas rade. Zato `restrictForClosedProject` gleda `ownerAccountDeletedAt`, a ne `status`.

Flag, a ne izvođenje iz „User više ne postoji", da provera pristupa — uključujući **listu projekata** — nikad ne traži dodatni upit po projektu.

### Šta se dešava kad član obriše nalog

`ProjectMember` red **ostaje**, prelazi u `status: 'removed'`, uz `name` i `email` koji su upisani još pri prihvatanju poziva. Lista učesnika i dalje prikazuje ko je radio na projektu; audit lanac ostaje čitljiv. Upisuje se `member.removed` audit događaj.

Ako **svi** članovi i vlasnik obrišu naloge, operatoru ostaje: `ClientProject` sa milestone-ima i istorijom izmena, ceo chat (`ChatMessage.authorName`), `ProjectItem` odluke i incidenti, audit log, i objavljen `Project` u Portfolio sekciji.

### Član koji zadrži nalog

Vidi projekat na kojem je bio kolaborator ili viewer u svom **My Projects**, read-only, sa istorijom chata — i posle završetka projekta i posle brisanja vlasnikovog naloga.

**Članstvo ni na koji način ne ograničava njegov sopstveni nalog.** Pozvani saradnik je običan korisnik DMDevelon-a: može da pokrene svoj projekat, pošalje zahtev, ima svoje projekte gde je vlasnik. Isti čovek je vlasnik na svom projektu i collaborator na tuđem — `resolveProjectAccess` se računa **po projektu**, ne po nalogu, pa to izlazi samo po sebi. Nikakva provera ne sme da veže „on je član nekog projekta" za ograničenje negde drugde.

### Brisanje sopstvenog chata

„Svako za sebe može da obriše i očisti chat" — to je **per-user** radnja, ne globalno brisanje poruka.

Nosi ga `ChatRead.clearedAt` (model već postoji po `(channelId, userId)`, pa nema nove kolekcije): poruke starije od tog trenutka se ne prikazuju **tom korisniku**. Ostali učesnici i operatorova istorija su netaknuti. Brisanje pojedinačne poruke za sve i dalje ide preko soft delete-a na `ChatMessage` i traži `messagesModerate` ili autorstvo.

### Testimonials i Portfolio

`Testimonial` i javni `Project` su odvojene kolekcije bez zavisnosti od `ClientProject`, pa operatoru ostaju bez dodatnog rada. Ovo je **konstatacija zatečenog stanja**, ne zadatak Faze 1 — u TODO ne ulazi ništa po ovom pitanju osim provere pri regresiji.

---

## 6. Role i permission matrica (v2 — zaključati pre implementacije)

| Resurs | Viewer | Collaborator | Client lead* | Owner (klijent) | Admin (global) |
|---|---|---|---|---|---|
| Project summary / timeline / milestones | Da | Da | Da | Da | Da |
| Tasks (read) | Da | Da | Da | Da | Da |
| Tasks (update) | Ne | Ne (Faza 2: own) | Ne | Ne | Da |
| Project chat read | Da | Da | Da | Da | Da |
| Project chat write | Ne | Da | Da | Da | Da |
| Milestone chat read | Da | Da | Da | Da | Da |
| Milestone chat comment | Ne | Da | Da | Da | Da |
| Upload priloga | Ne | Da | Da | Da | Da |
| Delete svoje poruke/priloga | Ne | Da | Da | Da | Da |
| Delete tuđe poruke | Ne | Ne | Ne | Ne | Da |
| Members read (bez privatnih mejlova) | Da | Da | Da | Da | Da |
| Members invite | Ne | Ne | Da | Da | Da |
| Members manage (role / remove) | Ne | Ne | Ne | Da | Da |
| Proposal metadata (**i sâmo postojanje**) | Ne | Ne | Da | Da | Da |
| Proposal cene / request thread | Ne | Ne | Da | Da | Da |
| Interna kalkulacija / marža** | Ne | Ne | Ne | Ne | Da |
| Leave project | Da | Da | Ne (transfer) | Ne | — |
| Delete project | Ne | Ne | Ne | Ne | Da |

\* `client_lead` je rezervisan — enum postoji, UI ga ne nudi u Fazi 1.
\*\* `internalFinanceRead` je rezervisan permission ključ — aplikacija danas nema interna finansijska polja (proposal budget je klijentska cena); ključ postoji da buduće interno polje ne završi u klijentskoj projekciji podrazumevano. Time su razdvojeni `client_finance.read` (client_lead sme) i `internal_finance.read` (samo admin).

Napomene:

- Collaborator **može da napusti** projekat (Leave, ne Delete) — `status: 'removed'`, red ostaje zbog audita.
- Tasks update za collaborator-a čeka Fazu 2 jer taskovi danas nemaju assignee polje (`taskUpdateOwn` nema na šta da se veže).
- List endpointi ne smeju vraćati ni metapodatke tipa `proposalCount`, `hasProposal`, `latestProposalId`, `approvedAmount`, `lastNegotiatedAt` — čak i `{ "hasProposal": true }` je informativno curenje. Podrazumevano: saradnik **ne sme da zna da ponuda postoji**.

---

## 7. Centralna autorizacija i serializeri (v2)

### `lib/project-access.js` — jedna politika, ne provere po imenima rola

```js
export async function resolveProjectAccess(user, project)
// → { role: 'admin' | 'owner' | 'client_lead' | 'collaborator' | 'viewer' | null,
//     permissions: { ...ROLE_PERMISSIONS preset... },
//     membership: ProjectMember | null }
```

Redosled odlučivanja:

1. `user.isAdmin` → admin preset (sve dozvole)
2. `canAccessClientEntity(user, project)` → owner preset — **postojeća funkcija se ne menja**
3. `ProjectMember.findOne({ projectId, userId: user._id, status: 'active' })` → preset po `role`
4. ništa od navedenog → `role: null`
5. **`restrictForClosedProject(permissionsForRole(role), { role, project })`** — poslednji korak, uvek. Ako je `project.ownerAccountDeletedAt` postavljen i role nije `admin`, dozvole se maskiraju na `projectRead, milestoneRead, taskRead, chatRead, membersRead, leaveProject`; inače prolaze nepromenjene. Ovo je jedino mesto gde se ova provera radi — vidi I10/5A. Implementirano u `lib/project-access.js`, nezavisno od bilo kog Sekcija 9 endpointa.

```js
export async function requireProjectPermission(user, project, permission)
// role === null                    → apiError('Not found', 404)  — ne otkriva postojanje
// permissions[permission] !== true → apiError('Forbidden', 403)
// vraća access — dalje se koristi za izbor serializera
```

**Zabranjeno** u endpointu: `if (member.role !== 'client_admin') …` — uvek permission ključ, nikad ime role. Centralna politika kasnije može uzeti u obzir i suspenziju, arhiviran projekat, override dozvole — bez diranja endpointa.

### Resource-first autorizacija (obavezno pravilo)

`requireProjectPermission(user, project, …)` je tačna onoliko koliko je tačan `project` koji mu se prosledi. Zato se **projekat uvek izvodi iz učitanog resursa, nikad iz URL-a ili body-ja**.

```js
// ZABRANJENO — klijent bira i resurs i projekat protiv kojeg se proverava,
// pa može da priloži tuđi proposalId uz projekat na kojem JESTE član:
const project = await ClientProject.findById(params.projectId);
await requireProjectPermission(user, project, "proposalsRead");
const proposal = await ProjectProposal.findById(params.proposalId);
```

```js
// ISPRAVNO — resurs prvo, projekat iz resursa, provera nad tim projektom:
const proposal = await ProjectProposal.findById(params.proposalId);
if (!proposal) return notFoundResponse();
const project = await ClientProject.findById(proposal.projectId);
await requireProjectPermission(user, project, "proposalsRead");
```

Isto važi za svaki ugnežđeni resurs: milestone, task, poruku, kanal, prilog, invitation, `ProjectItem`. Kada URL nosi i roditelja i dete (`client-projects/:projectId/milestones/:milestoneId`), `:projectId` se koristi samo za učitavanje, a onda se **potvrđuje da dete zaista pripada tom roditelju** pre bilo kakve provere prava — nepodudaranje je 404, ne 403, jer bi 403 potvrdio da resurs postoji.

Ovo je razlog zašto `milestone.projectId === project._id` provera postoji u sekciji 9 i zašto DM kanal proverava `memberUserIds` a ne samo `projectId`: bez toga član projekta A može da čita resurse projekta B tako što u telo zahteva upiše svoj `projectId`.

### `lib/project-serializers.mjs` — allowlist, nikad blocklist

Finansijska polja se **ne uklanjaju** iz odgovora — ona **nikada ne uđu** u odgovor za saradnika. Ovo je zabranjeni pattern:

```js
// ZABRANJENO — novo finansijsko polje će jednog dana biti dodato modelu
// i zaboravljeno u delete listi:
if (!canViewFinance) { delete project.price; delete project.totalPrice; }
```

Ispravno — eksplicitna projekcija:

- `serializeProjectForMember(project, access)` — allowlist: `_id, title, description, requirements, status, coverImageUrl, category, createdAt, updatedAt, milestones: [serializeMilestoneForMember]`.
  Milestone allowlist: `_id, title, description, icon, order, status, phaseLabel, phaseNumber, githubBranch, tasks: [{ _id, title, description, order, status }]`.
  **Sledeći ključevi ne smeju postojati u odgovoru** (ni kao `null`): `clientEmail, clientSlug, requestId, linkedProjectId, archivedProposalIds, events, deletedByUserId, deletedByName, milestones[].proposalId, milestones[].revision, milestones[].changeHistory`.
- `serializeMemberPublic(member, { includeEmail })` — ime, avatar, roleLabel, joinedAt; privatni email samo owner-u i adminu.
- `serializeInvitationPreview(invitation, project)` → `{ projectName, inviterName, intendedRoleLabel, maskedEmail, expiresAt, requiresAuthentication }` — ništa osetljivo pre prihvatanja.
- Owner i admin i dalje dobijaju pun dokument — postojeće ponašanje, nulta regresija.

Unit testovi assertuju **odsustvo ključa**, ne null vrednost:

```js
assert.ok(!('proposalId' in serialized.milestones[0]));
assert.ok(!('clientEmail' in serialized));
```

---

## 8. `route.js` — helper sloj PRE endpointa (v2, obavezna korekcija)

Backend je jedan fajl od ~3.845 linija sa `if (pathStr === …)` lancem. To je drugi najveći rizik plana: ~18 novih grana ručno ponavlja auth → raste verovatnoća propuštene provere, nedoslednih 401/403/404 i curenja kroz sporedni endpoint. Fajl se **ne deli** u ovom milestone-u, ali pre dodavanja ijedne grane:

1. `requireAuthenticatedUser(request)` — postojeći inline 401 pattern kao funkcija koja baca `apiError('Unauthorized', 401)`
2. `forbiddenResponse()` / `notFoundResponse()` — konzistentni odgovori
3. Mini matcher u `lib/route-match.mjs` (čist, testiran): `matchRoute(method, pathStr, table)` sa `:param` patternima — **samo za nove grane**, postojeće rute se ne diraju
4. Nove grane grupisane redosledom: auth/invitations → membership → member management → project reads → chat → milestone chat → attachments → proposal/finance restrikcije

Endpoint grana posle ovoga je kratka i uniformna:

```js
const user = await requireAuthenticatedUser(request);
const project = await ClientProject.findById(params.projectId);
const access = await requireProjectPermission(user, project, 'chatWrite');
// … radnja …
return NextResponse.json(serialize(result, access), { headers: getCorsHeaders() });
```

---

## 9. API endpointi

### Invitations i membership (v2) — implementirano u Sekciji 5 ✓

> **Uživo verifikovano, 35 provera** (jednorazni test podaci, kreirano→testirano→obrisano): create/duplicate/revoke/resend/permission-boundary, register-kroz-poziv sa punim lancem (invitation→member→audit→chat sistemska poruka), I3 duplicate-account guard, email mismatch bez otkrivanja prave adrese, istekao poziv, **konkurentnost — dva paralelna accept poziva, tačno jedno članstvo**, member management. Detalji u `documentations/TODO.md` sekcija 5.
>
> **Pravi bug pronađen i ispravljen tokom testa:** `ProjectMember.create({...}, { session })` — Mongoose tretira single-object + options kao DVA dokumenta za upis kad prvi argument nije niz (options objekat postaje „drugi dokument", otud `userId is required` greška na samom options objektu). Ispravljeno na `ProjectMember.create([{...}], { session })`. Pure funkcije i sintaksna provera ovo ne bi uhvatile — čisto Mongoose API ponašanje, vidljivo samo uz pravi poziv nad bazom.

| Metod + path | Radnja |
|---|---|
| `POST /api/client-projects/:id/invitations` | `{ email, intendedRole, roleLabel?, personalMessage? }`; permission `membersInvite`. Već aktivan član → 409 „already a member". Postoji pending → 409 uz ponudu resend/revoke (nikad dva aktivna poziva). Ranije `removed` → reaktivacija postojećeg reda. Kreira invitation sa `tokenHash`, šalje mejl, audit `invitation.created` |
| `GET /api/invitations/preview?token=` | bez auth-a; sha256 → lookup; vraća SAMO `serializeInvitationPreview`; postavlja HttpOnly cookie `dmdevelon_invite` (Secure, SameSite=Lax, 1h) kao nosač tokena kroz registraciju — token u body-ju accept poziva je fallback |
| `POST /api/invitations/accept` | auth obavezan; token iz body-ja ili cookie-ja. Provere: `pending` + rok + `normalizeEmail(user.email) === emailNormalized` (mismatch → 403 „This invitation is for m***@example.com"). **Idempotentno**: unique `(projectId, userId)` + conditional update — dupli klik ne pravi duplo članstvo. Kreira `ProjectMember(active)`, invitation → `accepted`, sistemska poruka u kanal, audit, briše cookie |
| `POST /api/client-projects/:id/invitations/:invId/resend` | novi tokenHash + novi rok; audit `invitation.resent` |
| `DELETE /api/client-projects/:id/invitations/:invId` | status `revoked`; audit `invitation.revoked` |
| `GET /api/client-projects/:id/members` | aktivni članovi kroz `serializeMemberPublic`; pending pozivi samo za nosioce `membersInvite`; email samo owner/adminu |
| `PATCH /api/client-projects/:id/members/:memberId` | role / roleLabel; permission `membersManage`; audit `member.role_changed` |
| `DELETE /api/client-projects/:id/members/:memberId` | `status: 'removed'`; audit `member.removed` |
| `POST /api/client-projects/:id/leave` | collaborator/viewer uklanja samog sebe → `removed`; audit `member.left`; owner ne može (transfer je Faza 2) |

Registracija kroz poziv: `POST /api/auth/register` prima opcioni `inviteToken`. Kad je prisutan i validan, server **ignoriše email iz body-ja i koristi `invitation.emailNormalized`** (UI polje je zaključano), postavlja `emailVerified: true` i odmah izvršava accept logiku.

### Chat — implementirano u Sekciji 6 ✓ (`convert`/`project-items` iz Sekcije 12 sada takođe implementirani ✓)

> **Uživo verifikovano, 49 provera**, sve prošlo bez ijedne ispravke koda (jednorazni test podaci: 5 naloga, 1 projekat, 3 članstva, kreirano→testirano→obrisano). Detalji u `documentations/TODO.md` sekcija 6.
>
> **Ispravka u odnosu na nacrt:** `POST /api/chat/dm` prima `{ projectId, userId }`, ne samo `{ userId }` — `dmKey` je unique po `(projectId, dmKey)` (Sekcija 1), pa je DM uvek vezan za KOJI projekat je doveo ove dve osobe u kontakt; ista dva čoveka na dva različita zajednička projekta dobijaju dva odvojena DM kanala u Fazi 1 (globalni DM nezavisan od projekta je `projectId: null` slučaj, rezervisan za kasnije).

| Path | Radnja |
|---|---|
| `GET /api/chat/channels` | vidljivi kanali sa `unreadCount` + `lastMessage`; **DM filtriran po `memberUserIds` već ovde** — treći korisnik ne sme videti ni da DM postoji. Grupni kanal se ovde lazy-kreira za svaki projekat kom korisnik ima pristup (`getOrCreateGroupChannel`, ista funkcija iz Sekcije 5) |
| `GET /api/chat/channels/:id` | meta + roster (`loadChannelRoster`: owner + aktivni `ProjectMember`; globalni admin namerno nije mention/roster kandidat u Fazi 1 — nema jedan očigledan admin identitet po projektu za poređenje imena) |
| `GET /api/chat/channels/:id/messages?before=&limit=50&flag=&q=` | paginacija unazad (`limit` ograničen [1,100]), filter po flagu (`flag=pinned` je alias za `pinned:true`), pretraga (`q` kroz `escapeRegExp` — korisnički unos se nikad šalje sirov u `$regex`) |
| `GET /api/chat/channels/:id/pinned` | pinovane poruke |
| `POST /api/chat/channels/:id/messages` | slanje; permission `chatWrite`; za DM dodatno `memberUserIds.includes(user._id)`; slanje implicitno označava kanal pročitanim za pošiljaoca |
| `POST /api/chat/channels/:id/read` | upsert `ChatRead` (opcioni `messageId`, inače "sada") |
| `POST /api/chat/channels/:id/clear` | upsert `ChatRead.clearedAt` — per-user čišćenje (5A), redovi u `ChatMessage` netaknuti |
| `POST /api/chat/channels/:id/purge` | **hard delete** `{ scope: "all" \| "older_than", days? }` (default `days: 30`) — `deleteMany` nad porukama kanala, za sve učesnike, bez undo-a. Permission `messagesModerate` (dakle operator, i u DM-u: obe strane već imaju `clear` za svoju kopiju, a deljenu istoriju ne sme rušiti onaj kome najviše smeta). Radi isto na grupnom kanalu i na DM-u; `loadChannelWithAccess` i dalje vraća 404 za DM čiji pozivalac nije član. Uz poruke briše i `chat_message`/`chat_mention` notifikacije tog kanala (nose 140 karaktera tela poruke i `?m=` link), ostavlja system poruku „obrisano N poruka" u kanalu i upisuje `ProjectAuditLog` `chat.purged` — jedini preostali trag da su poruke postojale. Odgovor nosi `convertedCount`: poruke pretvorene u formalni zapis su jedino što purge ne može ostaviti netaknutim (`sourceMessageId` na `ProjectItem`/`ProjectRequest` ostaje da visi), pa operator dobija broj veza koje je upravo prekinuo |
| `POST /api/chat/dm` | `{ projectId, userId }` → get-or-create preko `dmKeyFor`, duplicate-key → učitaj postojeći (I5); cilj mora već biti pravi učesnik ISTOG projekta |
| `POST /api/chat/messages/:id/pin` | `{ pinned }`; permission `pin` |
| `POST /api/chat/messages/:id/convert` | **implementirano u Sekciji 12** ✓ — target `item`\|`request`\|`task`\|`milestone_comment`, permission gate i unutar `sanitizeConvertPayload` |
| `PATCH /api/chat/messages/:id` | edit; **samo autor** (bez admin override-a, za razliku od delete-a); `editedAt`; obrisana poruka se ne može editovati (409) |
| `DELETE /api/chat/messages/:id` | soft delete; autor ili admin (`canModerateMessage`) |
| `GET /api/project-items?projectId=&kind=&status=` | **implementirano u Sekciji 12** ✓ — permission `projectRead`, svaka rola koja vidi projekat vidi i log |
| `POST /api/notifications/purge` | **hard delete zvona** `{ scope: "all" \| "older_than", days? }` (default `days: 30`) — briše ISKLJUČIVO redove pozivaoca (`userId: user._id`; ne postoji parametar za tuđe zvono). Deli `resolvePurgeWindow` sa chat purge-om, pa „starije od mesec dana" znači isto i odbija istu besmislicu na oba mesta. Gate je `user.isAdmin` — proizvodna, ne bezbednosna odluka (redovi su ionako pozivaočevi): kad klijentsko zvono treba istu metlu, skida se ova provera zajedno sa `isAdmin` gate-om u `NotificationBell` |

Sve grane idu kroz `requireProjectPermission` (preko deljenih `loadChannelWithAccess`/`loadMessageWithAccess` helpera u route.js). Validacija: `body` max 10000 kroz `cleanString` · `flag` iz enuma · `replyToMessageId` iz istog kanala · `mentions` presečeni sa članstvom · `admin_only` kanal odbija non-admin sa 403 — sve ovo je već pokriveno postojećom `sanitizeChatMessagePayload` (Sekcija 2), Sekcija 6 je samo poziva.

**Novi fajl `lib/chat-serializers.mjs`** (nije bio eksplicitno u planu, ali analogan `lib/project-serializers.mjs`): `serializeChatMessageForAccess` (attachment filtriranje po `canViewAttachment` — `project_shared`→svi, `client_only`→owner+admin, `internal_team`→samo admin; soft-deleted poruka zadržava `convertedTo`/`flag`/`pinned` ali redaguje `body`/`attachments` za svakog gledaoca), `serializeChannelSummary`, `serializeChannelDetail`, `serializeChannelMember`. Isti „ključ mora biti odsutan, ne `undefined`" bug iz Sekcije 4 se ponovio ovde na `memberUserIds` (prisutan samo za `kind:'dm'`) — uhvaćen unit testom pre uživo testa ovog puta.

### Izmene postojećih endpointa — implementirano u Sekciji 4 ✓

> **Ispravka otkrivena pri implementaciji:** ne postoji standalone `/api/project-proposals` ruta. Proposali su uvek ugnežđeni pod `client-projects/:id/proposals[/:proposalId]` — `:id` je već projekat iz URL-a roditelja, `?projectId=` se nigde ne koristi za proveru prava. Tekst ispod je ispravljen; originalna „project-proposals*" formulacija iz v2 nacrta nije odgovarala stvarnom kodu.

- `GET /api/client-projects` — scoping dobija granu: projekti iz aktivnih membershipa (`ProjectMember.find({userId, status:'active'})`); za njih odgovor ide kroz `serializeProjectForMember` — **i lista, ne samo detalj; liste su najčešće mesto curenja**. Owner/admin (`canAccessClientEntity`) kratko-spaja pre ijednog dodatnog upita — nula regresije, nula dodatnog opterećenja za postojeće korisnike.
- `GET /api/client-projects/:id` — member dozvoljen; member → serializer, owner/admin → pun dokument
- `GET/POST /api/client-projects/:id/messages` (milestone chat) — otvara se za članove kroz `milestoneRead` / `milestoneComment`; `authorRole: 'member'`; member whitelist tipova: `{message, question}`. Provera da `milestone` pripada `project`-u je **već bila tačna by construction** — milestone se traži unutar `project.milestones` niza već učitanog projekta, nikad iz posebne kolekcije po ID-ju iz body-ja.
- `GET /api/client-projects/:id/proposals[/:proposalId]` — `requireProjectPermission(user, project, 'proposalsRead')` pozvan **direktno** za ovu granu (ne posle opšteg `projectRead`): član sa `projectRead` ali bez `proposalsRead` → 403; neko bez ikakvog odnosa prema projektu → 404 pre nego što se `proposalsRead` uopšte ispita. Mutacije nepromenjene (`canPerformClientProposalAction`).
- `project-requests/*` — bez novog pristupa članovima; ali tri `canAccessRequest` denial grane ispravljene sa 401→404 (detalj, POST sub-actions, upload requestId grana), jer „nema odnosa" mora biti 404 svuda
- `POST /api/upload` — dozvoljen članu sa `filesUpload`; **`visibility: 'project_shared'` je default na `ChatMessage.attachments[]` šemi (Sekcija 6/9), `/api/upload` samo vraća `{url, type, name}` i ne dodaje to polje** — ranija formulacija je pogrešno sugerisala da upload endpoint učestvuje u tome

Verifikovano uživo protiv produkcione baze (real admin/owner/stranac JWT, isključivo GET/read pozivi + jedan `POST /upload` bez fajla — nijedan zapis nije upisan niti izmenjen): owner/admin dobijaju identičan odgovor kao pre izmene; stranac dobija 404 na tuđem projektu, tuđem zahtevu, i na upload pokušaju sa tuđim `projectId`-jem. Detalji u `documentations/TODO.md` sekcija 4b.

---

## 10. Domenski moduli i testovi

### `lib/chat-domain.mjs` — čist ESM, bez DB

- `ROLE_PERMISSIONS` — preset po roli, tačno po matrici iz sekcije 6: `projectRead, milestoneRead, milestoneComment, taskRead, chatRead, chatWrite, filesUpload, filesDeleteOwn, membersRead, membersInvite, membersManage, proposalsRead, internalFinanceRead, convertToItem, convertToFormal, pin`
- konstante `MESSAGE_FLAGS`, `CHANNEL_KINDS`, `PROJECT_ITEM_KINDS`, `CONVERT_TARGETS`, `MEMBER_ROLES`, `INVITATION_STATUSES`
- `normalizeEmail(email)` → `trim().toLowerCase()` — literal, bez plus-address transformacija
- `canPostToChannel(access, channel)`, `canModerateMessage(access, message)`, `canInviteToProject(access)`, `canConvertMessage(access, target)` — `request`/`task`/`milestone_comment` samo owner/admin (`convertToFormal`); `item` sme i collaborator (`convertToItem`)
- `parseMentions(body, members)` → `[userId]`
- `buildReplyPreview(message)` → `{ authorName, body: body.slice(0, 140), messageId }`
- `sanitizeChatMessagePayload(input, { access, channel })`
- `nextItemRef(kind, lastRef)` → `"D-041"`

### `lib/project-serializers.mjs` — sekcija 7

### `lib/route-match.mjs` — sekcija 8

Testovi: `tests/chat-domain.test.mjs`, `tests/project-serializers.test.mjs` (key-absence!), `tests/route-match.test.mjs` — po uzoru na `tests/project-proposal-domain.test.mjs`. `npm test` → `node --test tests/*.test.mjs`.

---

## 11. UI — implementirano u Sekciji 8 ✓

### Layout

```
┌─────────────┬──────────────────────────────────────────┐
│ Channels    │ Header: naziv + [Filter ▾] + [Search]    │
│  # Group    ├──────────────────────────────────────────┤
│             │ PinnedBar — TODO lista, collapsible      │
│ Members     ├──────────────────────────────────────────┤
│  Lead Dev*  │                                          │
│  Client     │ MessageList — scroll, paginacija unazad  │
│  Designer   │                                          │
│  Developer  ├──────────────────────────────────────────┤
│             │ [📎] [Flag ▾]  auto-grow textarea   [➤]  │
│ Direct      │                                          │
└─────────────┴──────────────────────────────────────────┘
```

\* Globalni admin se u listi učesnika prikazuje **poslovnom etiketom** („Lead Developer / Product Owner"), ne tehničkim terminom „superadmin" — to je interna privilegija, klijent vidi poslovnu ulogu.

### Fajlovi u `components/chat/`

| Fajl | Uloga |
|---|---|
| `ProjectChat.jsx` | shell; prima `viewerRole`, deljen između klijenta i admina |
| `ChannelSidebar.jsx` | grupa, učesnici (admin na vrhu, pa vlasnik, pa ostali sa `roleLabel`), DM lista, unread tačke |
| `ChatHeader.jsx` | naziv + `Select` filter (All / Request / Task / Idea / Problem / Incident / Decision / Pinned) + pretraga |
| `PinnedBar.jsx` | pinovane poruke kao TODO lista ispod header-a |
| `MessageList.jsx` | scroll + paginacija unazad na scroll-to-top |
| `MessageBubble.jsx` | badge po flagu, reply citat, prilozi, `DropdownMenu`: Reply / Pin / **Convert to…** (implementirano u Sekciji 12) / Edit / Delete |
| `MessageComposer.jsx` | auto-grow textarea, **Enter = novi red, Ctrl+Enter = pošalji**, Send (`Send`), attach (`Paperclip`), flag picker, `@` mention autocomplete |
| `ConvertMessageDialog.jsx` | **implementirano u Sekciji 12** ✓ — jedan dijalog, cilj se bira prvi (item/request/task/milestone_comment), polja se menjaju u zavisnosti od izbora |
| `InviteMemberDialog.jsx` | email + **rola (Collaborator / Viewer)** + roleLabel + opciona lična poruka (v2 — umesto checkbox-ova) |
| `TeamPanel.jsx` | v2 — aktivni članovi (ime, roleLabel, email samo ako prisutan i samo owner/adminu vidljiv sa servera) + pending pozivi (email, rola, ko je pozvao, **Resend**, **Revoke**) + **Leave project** za člana / **Remove** za druge |

### Mapa boja za flagove

| Flag | Boja | Ikonica |
|---|---|---|
| `request` | `bg-amber-600` | `FileText` |
| `task` | `bg-indigo-600` | `ListChecks` |
| `idea` | `bg-purple-600` | `Lightbulb` |
| `problem` | `bg-orange-600` | `AlertTriangle` |
| `incident` | `bg-red-600` | `Siren` |
| `decision` | `bg-green-600` | `Gavel` |

### Refaktor uz put

`readAsDataURL` je dupliran u `hooks/useAuth.js`, `components/dashboard/MilestoneChat.jsx:18`, `components/dashboard/RequestConversation.jsx` — izvući u `lib/utils.js`, koristiti na sva četiri mesta uključujući novi composer.

### Hookovi — implementirano u Sekciji 7 ✓

`hooks/useProjectChat.js`:
- `useChatChannels()` — `refetchInterval: 15000`; plus `startDirectMessage` (`POST /chat/dm`) i `clearConversation` (`POST /chat/channels/:id/clear`) — nisu bili eksplicitno navedeni u v2 nacrtu, ali oba endpointa postoje od Sekcije 6 i moraju biti dostupna odnekud u UI sloju
- `useChatMessages(channelId, { flag, q })` — `useInfiniteQuery` (prva upotreba u ovom kodbejzu), `refetchInterval: 4000`, `staleTime: 0`, `refetchOnMount: 'always'`. TanStack Query v5 zahteva eksplicitni `initialPageParam`; stranice stižu najnovije-prvo sa `before` kursorom ka starijim porukama, `messages` izlaz je već sravnjen u jedan hronološki (najstarije→najnovije) niz
- mutacije: `sendMessage`, `editMessage`, `deleteMessage`, `togglePin`, `markRead`, `uploadAttachment`, **`convertMessage`** (implementirano u Sekciji 12, invalidira i `['project-items']`)
- `useChatPinned(channelId)` — mala zasebna funkcija u istom fajlu, priprema za PinnedBar (Sekcija 11)

`hooks/useProjectMembers.js` — `members`, `invitations`, `invite`, `resendInvitation`, `revokeInvitation`, `updateMember`, `removeMember`, `leaveProject`; `leaveProject` dodatno invalidira `client-projects` i `chat-channels`.

Verifikacija: hookovi nisu pure funkcije (nisu node:test-abilni); provereno sintaksno i uživo kroz privremenu test stranicu montiranu na pravom dev serveru (kompajlira se, montira, razumno početno stanje). Puna interaktivna provera prirodno čeka Sekciju 8, gde prve prave komponente koriste ove hookove.

### Napomene i odstupanja pri implementaciji (Sekcija 8)

- **Deljeni React Query ključ** — `MessageList.jsx` i `MessageComposer.jsx` oba pozivaju `useChatMessages(channelId, {flag, q})` sa identičnim argumentima (composer prima `flag`/`search` kao prop samo iz tog razloga) da bi TanStack Query prepoznao isti query ključ i delio jedan cache/polling ciklus umesto dva paralelna 4s pollinga za isti kanal.
- **Numerički unread bedž** u `ChannelSidebar.jsx` — svesno odstupanje od plana (koji je pominjao „unread tačke"); chat generiše više poruka od ostalih delova aplikacije, pa je broj korisniji signal od proste tačke.
- **`onOpenTeamPanel` dostupan oba `viewerRole`-a**, ne samo adminu — originalni zahtev eksplicitno traži da klijent može da pozove saradnika sa svog dashboard-a; `membersInvite` dozvola se ionako izvodi iz role na projektu (owner/admin/client_lead), ne iz globalnog admin flaga, pa nema razloga da UI sakriva dugme od klijenta koji tu dozvolu ima.
- **`ConvertMessageDialog.jsx` i „Convert to…" stavka u `MessageBubble.jsx` dropdown-u** — implementirano u Sekciji 12, gated sa `canConvertToItem`/`canConvertToFormal` (isti server-sourced obrazac kao `canPin`).
- Verifikacija: `npm test` nepromenjeno 130/130 (komponente su React UI, ne pure funkcije). Sintaksno provereno svih 9 fajlova (`.jsx`→privremeni `.js`, `node --check`). Uživo mount test kroz privremenu rutu (`app/chattestxyz/page.js`, obrisana posle) na pravom dev serveru: 200, marker prisutan, loading stanje bez auth tokena je očekivano (ne greška), nema error overlay-a. `providers/QueryProvider.js` iz root layout-a već pokriva sve hookove korišćene u ovim komponentama.
- **Ispravka u Sekciji 11:** ovde opisan Pin/Unpin dropdown item je isprva bio prikazan SVIMA bez obzira na dozvolu (server je ispravno vraćao 403, ali UI nije unapred znao) — `viewerRole` ("client"/"admin") opisuje dashboard, ne stvarnu ulogu na projektu, pa nije mogao razlikovati `viewer` (bez `pin` dozvole) od `owner`/`collaborator` (sa njom), obe strane istog `viewerRole="client"`. Sekcija 11 je dodala `canPin` polje pravo iz servera (`serializeChannelSummary`) da UI prestane da nagađa.

### Integracija — klijentski dashboard (`app/dashboard/page.js`) — implementirano u Sekciji 9 ✓

1. `DASHBOARD_TABS` → `["services", "testimonials", "chat"]`
2. Nav dugme odmah posle Testimonials, `<MessagesSquare /><span>Chat</span>` + unread tačka — tačka je `totalUnreadChat = chatChannels.reduce((sum,c)=>sum+(c.unreadCount||0),0)` preko `useChatChannels()` pozvanog na nivou stranice; deli isti `['chat-channels']` query ključ sa `ProjectChat`-om iznutra (ista „deljeni query ključ" navika iz Sekcije 8), pa nema drugog pollinga. Tačka se **ne prikazuje dok je Chat tab aktivan** — na aktivnom dugmetu je pozadina već `bg-[#FFB633]`, ista boja kao tačka, pa bi bila nevidljiva
3. `{activeTab === "chat" && <ProjectChat viewerRole="client" />}`
4. Dugme **Invite team member** na kartici projekta (u „Projects & history", ne na pending-request karticama — zahtev bez odobrenja nema `ClientProject._id` ni chat kanal), `e.stopPropagation()`, otvara `TeamPanel` (iz Sekcije 8) sa `projectId={project._id}`

### Integracija — admin (`app/admin/page.js`) — implementirano u Sekciji 9 ✓

Tab `chat`: `menuItems` (odmah posle „Client Projects"), `ADMIN_TABS`, `renderContent()` → `<ProjectChat viewerRole="admin" />`. Nema posebnog project-picker-a za admina — `ChannelSidebar`-ova lista grupnih kanala (jedan po projektu kom admin ima pristup) je sam picker, samo duža lista nego kod klijenta koji ima svega par projekata.

**Verifikacija:** `npm test` nepromenjeno 130/130 (integracija ne dodaje pure funkcije). `node --check` na oba fajla (već `.js`, ne `.jsx`). Uživo kroz pravi dev server: `curl /dashboard` i `curl /admin` → oba 200, samo „Loading…" u telu (očekivano bez prave sesije), bez error-overlay markera — pošto su `ProjectChat`, `TeamPanel`, `useChatChannels` i nove ikonice statički importi na vrhu oba fajla, Turbopack kompajlira ceo modul-graf (uključujući sve `components/chat/*`) pri prvom zahtevu bez obzira koja se JSX grana trenutno renderuje, pa čist 200 potvrđuje da se ništa iz Sekcije 8 ne raspada pri pravoj integraciji. Puna interaktivna provera (klik na Chat tab, slanje poruke, Invite dijalog — sve sa pravim ulogovanim nalogom u browseru) namerno nije urađena u ovoj sesiji; ostaje kao ručna provera pre produkcije.

---

## 12. Notifikacije, unread i email — implementirano u Sekciji 10 ✓

- `models/Notification.js` — `channelId` + indeks `(userId, channelId)` (postojalo od Sekcije 1); `POST /api/notifications/read` sad prihvata `{ channelId }` samostalno (nova `else if` grana pre postojeće `entityId` grane) ili `{ entityId, channelId }` zajedno
- `lib/notify.js` — `"chat_message"` dodat u `DIGEST_TYPES` (kontroliše samo inline-vs-digest granu unutar `notifyUser()`); **`"chat_mention"` NE ide u digest** → mejl odmah. `notifyUser()` dobio novi `channelId` parametar
  - **Ispravka nad planom:** `runEmailDigest()` u `route.js` ima svoju ODVOJENU hardkodiranu `type: {$in:[...]}` listu, ne čita `DIGEST_TYPES` iz `lib/notify.js` — ažurirano na oba mesta, inače bi cron petlja nikad ne bi pokupila `chat_message` red iz baze uprkos ispravnom `DIGEST_TYPES` unosu
- `hooks/useNotifications.js` — invalidacija `['chat-messages']` dodata pored postojeće `['project-messages']`. **`unreadChannelIds`/`unreadByChannel` namerno izostavljeni** — chat već ima precizniji, namenski `ChatRead` sistem (Sekcija 6) koji `useChatChannels()` (Sekcija 8/9) pretvara u tačan unread bedž/tačku; notification-based paralelno brojanje bilo bi samo netačnija senka istog podatka
- `components/NotificationBell.jsx` — kategorija `"Chat"` u `CATEGORY_ORDER.client` i `.admin`; `categoryOf()` proverava `n.channelId` pre `entityType`-baziranih provera (chat notifikacije nose `entityType: "project"` radi ponovne upotrebe postojeće infrastrukture, pa bi inače pale u "Projects"/"My Projects")
- `lib/email-templates.js` — `projectInvite(...)` već implementirano u Sekciji 5/13, nepromenjeno ovde
- **Fan-out (I6)** u `POST /api/chat/channels/:id/messages`: grupni kanal → roster (owner+aktivni članovi) osim autora + svi admini osim autora (admin-autor ne ponovo-obaveštava druge admine, ista asimetrija kao postojeći milestone chat); DM → samo drugi učesnik, link zavisi od `isAdmin` te osobe (jedina grana gde je ta provera potrebna, jer roster nikad ne sadrži globalne admine). Mention → `chat_mention` tip (mogu ga pogoditi samo roster entries, nikad admin); inače `chat_message`
- **Web push za chat radi besplatno** — `notifyUser()` već bezuslovno zove `sendPushToUser()` za svaki tip, nijedna nova linija koda nije trebala
- **Dodato, nije bilo u planu:** `?channel=<channelId>` deep-link — `ProjectChat` prima `initialChannelId` prop (bira ga kao podrazumevani SAMO dok ništa nije ručno izabrano, da ga 15s kanal-poll ne otima nazad); `app/dashboard/page.js`/`app/admin/page.js` čitaju `searchParams.get("channel")`. Bez ovoga bi notifikacioni/email/push linkovi sleteli na Chat tab ali na POGREŠAN razgovor
- **Dodato, nije bilo u planu:** admin sidebar dobija istu unread tačku na Chat stavci koju je klijentski dashboard već dobio u Sekciji 9 (`totalUnreadChat` preko `useChatChannels()`, deli isti query ključ)

**Verifikacija:** `npm test` nepromenjeno 130/130. Uživo test (28 provera, 4 jednorazna naloga + 1 projekat + 1 članstvo, kreirani→testirani→obrisani preko pravog dev servera): register → lazy kanal → poruka sa `@mention` → owner dobija `chat_mention`, admin dobija `chat_message`, autor i stranac ne dobijaju ništa → digest query filter zaista pokupi `chat_message` red (bez pokretanja pravog cron endpointa — taj bi mejlovao SVE korisnike sa čekajućim digestom u celom sistemu, van domašaja jednoraznog testa) → `POST /notifications/read {channelId}` označi tačno tog korisnika, ne dira tuđe redove → baza vraćena na tačno prethodno stanje na svih 7 dotaknutih kolekcija. Usput otkriveno (nije bug u proizvodnom kodu): `notifyAdmins()` je ispravno obavestio i pravi, postojeći admin nalog u produkciji (ne samo test-admin), pa je prvi cleanup prolaz (filtriran po `userId ∈ testUserIds`) ostavio jedan real-admin red — ispravljeno brisanjem po `channelId` samostalno.

---

## 13. Invite flow (v2) — implementirano i uživo verifikovano ✓

```
Owner / klijent / admin unosi email + rolu (Collaborator|Viewer) + opcionu poruku
        ↓
ProjectInvitation(pending, tokenHash = sha256(raw), expiresAt = +7d)  + audit
        ↓
Mejl sa ${APP_URL}/invite?token=RAW
        ↓
/invite stranica → GET /invitations/preview → bezbedna polja + HttpOnly cookie
        ├── ima nalog  → prijava na istoj stranici → accept (email match) → član
        └── nema nalog → registracija sa ZAKLJUČANIM email poljem
                          → User(emailVerified: true) → accept → član
        ↓
Sistemska poruka "<Name> joined the group" → redirect /dashboard?tab=chat
```

Pravila:

- Token: nasumičan (`randomBytes(32).toString('base64url')`), jednokratan, vremenski ograničen, u bazi **samo hash**, poništen posle prihvatanja.
- Accept je **idempotentan** — višestruki klik ne kreira duplo članstvo.
- Prijavljen korisnik sa drugim mejlom → „This invitation is for m***@example.com. You are signed in as a different user." — **nikad automatsko dodavanje**.
- Istekao / opozvan / iskorišćen token → jasna poruka + „Request a new invitation".
- Ponovni poziv istoj osobi: aktivan član → „already a member"; pending → resend ili revoke; ranije uklonjen → **reaktivacija člana**, ne novi red.
- Email poređenje: literal normalizovan (`trim().toLowerCase()`), bez gmail plus/dot transformacija.

**Napomena o „reaktivacija":** dešava se na **accept**, ne na kreiranje poziva. Kreiranje samo NE blokira ponovni poziv nekome ko je ranije uklonjen (`resolveInvitationAction` propušta `removed` kao `create`); `acceptInvitationForUser` je taj koji, ako `ProjectMember` red već postoji za taj par (bilo kog statusa), ponovo koristi isti red umesto da pravi drugi — to je i mehanizam koji čini accept idempotentnim pod konkurencijom (I2), ne samo pri reaktivaciji.

**Odstupanje od nacrta, sa razlogom:** kolona "Sistemska poruka u kanal" u dijagramu iznad je Sekcija 6 posao po prvobitnom planu, ali povučena unapred u Sekciju 5 (`getOrCreateGroupChannel`/`postSystemMessage` u route.js) — accept bez nje ne bi bio kompletan prema ovom istom dijagramu, a kanal-kreiranje je dovoljno malo i samostalno da ne opravdava odlaganje. Sekcija 6 ponovo koristi iste funkcije.

**Šta iz I4 NIJE urađeno** (ne blokira Sekciju 6, ali ostaje otvoreno): `Referrer-Policy: no-referrer` u `next.config.js`; rate limit na slanje poziva. Sve ostalo iz I4 (bez logovanja tokena, cookie briše se i na uspeh i na neuspeh, `history.replaceState`) jeste urađeno i uživo potvrđeno.

---

## 13A. Handoff — od chat item-a do stvarnog rada (implementirano ✓)

Nastalo posle korisnikovog uživo korišćenja: „ne zna se gde handoff ide", i „novi milestone se kreirao bez ikakvog odobrenja klijenta, a to znači nove sate i cenu".

### Tvrdo ograničenje modela (provereno u kodu, nije pretpostavka)

`models/ProjectProposal.js` ima **unique indeks `{ projectId, phaseNumber }`** → **jedna ponuda po fazi**. Posledica: prihvaćena faza **ne može** dobiti još jedan milestone kroz odobrenje, jer bi to zahtevalo drugu ponudu za isti `phaseNumber`. Zato:

> **Svaki novi rad koji traži odobrenje postaje NOVA faza.** Ne postoji „dodaj milestone u postojeću fazu uz Send" — arhitektura to ne dozvoljava bez migracije. Korisnik je to prihvatio kao odluku.

### Tri ishoda, razlika je komercijalna a ne tehnička

| Ishod | Odobrenje | Endpoint |
|---|---|---|
| Task u **prihvaćen** milestone | ne treba — u dogovorenom obimu, primenjuje se odmah | `POST /api/project-items/:id/task` |
| **Nov rad** (milestone i/ili faza) | **da** — draft ponuda → Send → klijent prihvata → `reconcileProposalMilestones` materijalizuje | `POST /api/project-items/:id/handoff` |
| Povlačenje / brisanje | — | `POST .../proposals/:pid/withdraw` (sent→draft), `DELETE .../proposals/:pid` (samo draft/rejected) |

**Uklonjeno:** `POST /api/project-items/:id/milestone` — pisalo je živ milestone bez odobrenja. Zabeleženo kao ispravka.

### Vidljivost
- `PendingWorkSection` (admin, vrh kartice projekta): sve u `draft|sent|changes_requested|rejected`, status rečima („Awaiting client · 2d"), poreklo `D-001` preko `sourceItemRef`, akcije Edit/Send/Withdraw/Delete. Prihvaćeno se ne prikazuje — to je već u stablu.
- **Admin stablo grupisano po fazama** (`(phaseNumber, order)` + separator). Ranije samo po `order`, a `order` je faza-lokalan → faze su se preplitale.
- `ProjectItem.handoffProposalId` / `ProjectProposal.sourceItemId`+`sourceItemRef` drže vezu u oba smera.

---

## 13A-2. Brisanje ponuda — pun životni ciklus (implementirano ✓)

Ranije nije bilo dokumentovano, a u praksi je bio ćorsokak. Pravilo: **meko pa tvrdo** — ništa se ne briše iz baze dok prvo ne bude odmotano iz plana.

```
draft ─────────────────────────────────────▶ Delete forever
sent ──── Withdraw ──▶ draft ──────────────▶ Delete forever
rejected ──────────────────────────────────▶ Delete forever
accepted ─ Delete phase (arhivira) ─▶ archived ─▶ Delete forever
master (faza 1) ───────────────────────────▶ NIKAD (zaštićen)
```

- **„Delete phase"** = meko: `status → archived`, milestone-ovi se `$pull`-uju iz projekta u transakciji, zapis ostaje sa razlogom (`archiveReason`) i događajem u feed-u.
- **„Delete forever"** = tvrdo: briše red iz baze, čisti `archivedProposalIds` i `handoffProposalId`. Ne nudi se za `sent`/`accepted` — tamo prvo ide withdraw odnosno archive.

### Operatorski override nad započetim radom

Do sada je `preparePhaseArchive` bezuslovno odbijao arhiviranje ako je bilo šta u fazi započeto (`workStartedAt`, status ≠ `pending`, započet task, ili postojeći `changeHistory`) — dugme je bilo **disabled** i faza je ostajala neuklonjiva zauvek. To je bila namerna politika („dogovoren i započet rad je trajan zapis"), ali je pravila ćorsokak kad admin uoči sopstvenu grešku ili se sa klijentom naknadno dogovori da se deo izbaci.

Nova politika (potvrdio korisnik): **admin sme da ukloni i započetu prihvaćenu fazu, bez odobrenja klijenta**, ali:

- `preparePhaseArchive(proposal, milestones, { force: true })` — `force` **ne proširuje ŠTA** sme da se obriše: master proposal i ne-`accepted` statusi i dalje bacaju `MASTER_PROPOSAL_IMMUTABLE` / `PHASE_NOT_ACCEPTED`. Utiče samo na to da li započet rad blokira.
- Endpoint traži **drugu, zasebnu potvrdnu frazu** (`forceConfirmation: "DELETE STARTED WORK"`) pored postojeće — jedan promašen klik ne može da je aktivira.
- Razlog je i dalje obavezan i **upisuje se u `archiveReason` sa prefiksom** `[Force-deleted over N started milestone(s)]`, pa arhivirani red ostaje jedini, ali potpun, trag šta je uklonjeno i zašto.
- Master proposal (faza 1) ostaje **nedodirljiv**: on je ceo dogovoreni obim projekta; ako je pogrešan, ispravlja se kroz `Create revision`, ne brisanjem.

4 nova testa čuvaju baš ta ograničenja (force radi nad započetim radom · force NE otključava master · force NE otključava ne-accepted statuse · force nad nedirnutom fazom daje identičan rezultat kao običan archive).

---

## 13B. Politika notifikacija (implementirano ✓)

`lib/notification-policy.mjs` — čista, testirana odluka „šta se šalje":

- **`inApp` je uvek `true`.** Bell i toast broje svaku poruku; prigušuje se samo ono što prekida (mejl, push).
- **Konverzacijski** (`chat_message`, `project_message`, `request_message`): primalac online → ništa; inače najviše **jednom na sat po kanalu**.
- **Akcioni** (`chat_mention`, `project_proposal_*`, `request_created`, pozivi): **nikad se ne prigušuju**. Namerno odstupanje od „ako su svi online ne šalji ništa" — ponuda koja čeka odobrenje mora da stigne i na mejl.

Prateće izmene: `Notification.pushedAt` (push se prigušuje odvojeno od mejla) · `GET /api/notifications` je **drugi heartbeat** za prisustvo, pa neko ko čita dashboard više ne izgleda offline · prag prisustva `45s → 90s` · `runEmailDigest` poštuje istu politiku i **importuje** `DIGEST_TYPES` umesto druge kopije liste · uklonjeno dupliranje gde je admin-koji-je-i-član dobijao dve notifikacije za istu poruku · **toast za dolazne notifikacije** (ranije nije postojao nijedan; dedupe je modul-level jer je hook montiran na 7 mesta).

---

## 13C. Auto-osvežavanje bez websocket-a (implementirano ✓)

Problem: `['client-projects']`, `['client-projects', id]` i `['project-proposals', …]` **nemaju polling**, a nema ni websocket-a — pa je klijentovo prihvatanje faze ostajalo nevidljivo adminu do ručnog refreša.

Rešenje koristi jedini postojeći cross-browser signal: `useNotifications` (30 s) je već piggyback-ovao invalidaciju za chat, sad pokriva i `client-projects` / `project-proposals` / `project-items`. Bez novog transporta, bez dodatnih zahteva (invalidacija dira samo montirane ključeve). Uz to `acceptProposal` upisuje već vraćeni `project` u keš (`setQueryData`) da onaj ko klikne vidi promenu odmah.

---

## 14. Redosled rada — Faza 1 (v2)

Detaljna čekirana lista u [TODO.md](./TODO.md).

1. Dokumentacija ažurirana na v2 (ovaj fajl + TODO.md)
2. Modeli: `ProjectInvitation`, `ProjectMember`, `ProjectAuditLog`, `ChatChannel`, `ChatMessage`, `ChatRead`, `ProjectItem` + izmene `Notification`, `ProjectMessage`
3. Čisti moduli + testovi: `lib/chat-domain.mjs`, `lib/project-serializers.mjs`, `lib/route-match.mjs` → `npm test` zeleno
4. `lib/project-access.js` + helper sloj u `route.js` (requireAuthenticatedUser, forbidden/notFound, matcher tabele)
5. Postojeći endpointi: scoping + serializer na `GET /client-projects[/:id]`, `proposalsRead` gate na `GET /client-projects/:id/proposals[/:proposalId]`, milestone chat za članove, `POST /upload` — **✓ implementirano, sekcija 4**
6. Invitations & membership API + `projectInvite` template + `app/invite/page.js` + audit log
7. Chat API kroz `requireProjectPermission`
8. Hookovi: `useProjectChat.js`, `useProjectMembers.js`
9. `components/chat/*` + TeamPanel + integracija (dashboard tab, admin tab, Invite dugme)
10. Notifikacije: channelId, digest, bell kategorija, mention email
11. Pin + PinnedBar + filter po flagu + pretraga
12. `ConvertMessageDialog` + convert endpoint + `ProjectItem` lista

---

## 15. Verifikacija

```bash
npm test        # chat-domain + serializers (key-absence) + route-match + postojeći testovi
npm run dev     # port 3003
```

### Kada se šta pokreće

Bezbednosni E2E se **ne odlaže za kraj Faze 1**. Sekcija 4 je jedina koja menja ponašanje endpointa koje živi klijenti već koriste, i jedina koja otvara projekat nekome ko nije vlasnik — od trenutka kada je merge-ovana, curenje je moguće. Zato:

| Kada | Šta se pokreće |
|---|---|
| **Odmah po Sekciji 4** | SEC 1, 2, 3 (serializer i scoping), 4, 5, 6 (proposal 403), 7 (milestone mutacije 403), 8 (request 404), 9 (nečlan 404), 11 (**owner regresija**) |
| Po Sekciji 6 (chat API) | SEC 10 (DM izolacija) |
| Po Sekciji 5 (invitations) | F 3–7 |
| Kraj Faze 1 | ceo skup, kao regresija |

SEC 1–9 i 11 su izvodljivi čim Sekcija 4 postoji jer traže samo ručno ubačen `ProjectMember` red i dva tokena — ne traže ni chat, ni invite flow, ni UI. Owner regresija (SEC 11) je najvažnija od njih: ona hvata štetu po postojećim klijentima, koja je jedini deo ovog posla koji može da pokvari nešto što danas radi.

### E2E bezbednost — direktni API napadi (collaborator token, ne UI)

E2E ne sme samo da potvrdi da dugme nije prikazano — testira se direktan poziv:

1. Collaborator vidi projekat u My Projects → `GET /api/client-projects` 200 — **✓ verifikovano uživo**
2. `jq` potvrda da u odgovoru **ne postoje ključevi** `proposalId`, `changeHistory`, `clientEmail`, `requestId`, `archivedProposalIds` — odsustvo ključa, ne `null` (null i dalje otkriva strukturu) — **✓ pokriveno unit testovima** (`tests/project-serializers.test.mjs`)
3. `GET /api/client-projects/:id` → 200, ista provera ključeva — **✓ verifikovano uživo** (owner/admin regresija potvrđena na realnim podacima)
4. `GET /api/client-projects/:id/proposals[/:proposalId]` → **403** za collaborator-a (nema `proposalsRead`)
5. isto — pojedinačan proposal koji pripada projektu gde JE član → **403**
6. `POST/PUT/PATCH/DELETE` na proposal → **403/401** — nepromenjeno, ove grane nisu rewire-ovane (mutacije ostaju `canPerformClientProposalAction`, owner/admin only)
7. `PUT /api/client-projects/:id/milestones/:mid` i `PATCH .../milestone/*` → nepromenjeno, isti razlog kao (6)
8. `GET /api/project-requests/:id` istog projekta → **404** — **✓ verifikovano uživo** (bilo 401 pre izmene)
9. Nečlan: `GET /api/client-projects/:tuđiId` → **404** — **✓ verifikovano uživo**
10. Treći korisnik: `GET /api/chat/channels` ne sadrži tuđ DM — ni kao meta (čeka Sekciju 6)
11. Owner regresija: pun dokument identičan kao pre izmena — **✓ verifikovano uživo**, ceo skup ključeva identičan.
    **Šta „identičan" znači:** isti skup poslovnih polja i iste vrednosti. Redosled ključeva i interni Mongoose oblik objekta **nisu deo ugovora** — poredi se JSON semantika, ne serijalizovani string.
12. Client lead* sa `proposalsRead` (kad se uključi) dobija dozvoljena polja — čeka Fazu 2 (client_lead u UI)

**Resource-first napadi** — član projekta A prilaže svoj `projectId` uz tuđi resurs:

13. Proposal ruta je uvek `client-projects/:id/proposals/:proposalId` — `:id` u URL-u JESTE projekat, nema odvojenog `?projectId=` parametra koji bi mogao da laže. Stvarni rizik ovde je (4)/(5) — collaborator sa pristupom projektu ali ne i ponudi — koji je već pokriven.
14. `POST /api/client-projects/:A/messages` sa `milestoneId` iz projekta B → **404**, ne 403 — bezbedno **by construction**: `milestone` se traži unutar `project.milestones` niza već učitanog projekta A, nikad iz posebne kolekcije po ID-ju iz body-ja, pa tuđi milestoneId prosto nije pronađen
15. `POST /api/chat/channels/:kanalIzB/messages` kao član samo projekta A → **404** (čeka Sekciju 6)
16. `POST /api/chat/messages/:id/convert` gde poruka pripada projektu B → **404**
17. Reply na `replyToMessageId` iz drugog kanala → **400** (već pokriveno unit testom `sanitizeChatMessagePayload`)

### E2E funkcionalnost

1. Admin pošalje poruku → kanal se lazy kreira
2. Klijent na `/dashboard?tab=chat` → poruka ≤4s; unread tačka nestaje po otvaranju
3. Invite sa kartice projekta → mejl dizajneru (sadržaj: ko, koji projekat, koja prava, adresa, rok)
4. `/invite?token=…` → registracija sa **zaključanim** email poljem → odmah u kanalu i My Projects
5. **Dupli klik na Accept ne pravi duplo članstvo** (idempotencija)
6. Resend → stari token nevažeći, novi radi; Revoke → token mrtav
7. Leave project → član nestaje iz kanala, red ostaje kao `removed`, audit upisan
8. Reply, `@mention` (mejl odmah, ne digest), upload slike i PDF-a, edit, delete
9. Pin → PinnedBar; filter „Incident" → samo taj flag; pretraga radi
10. Convert to request → `ProjectRequest` sa `sourceMessageId`; poruka označena „Converted to…"
11. Save as decision → `ProjectItem` `ref: "D-001"`, `confirmedBy`, `decidedAt`
12. Milestone chat regresija: `question` / `change_request` / `change_agreed` rade kao pre + novi member komentar prolazi sa `authorRole: 'member'`
13. Audit log sadrži ceo životni ciklus: created → resent → accepted → role_changed → removed/left

---

## 16. Faza 2 — ne ulazi u ovu isporuku

- Sistemski kanali: `Announcements` (`admin_only`), `Ideas`, `Development`, `Design & Content`, `Incidents` (auto-feed iz `ProjectItem`), `Milestone Activity` (auto-feed iz `ClientProject.events`)
- **Privatni storage + kratkotrajni signed URL za SVE priloge** (novi chat + retrofit milestone/request priloga); antivirus sken, sanitizacija imena, zabrana izvršnih fajlova
- `client_lead` i `project_admin` u UI + transfer vlasništva pri napuštanju
- Task assignee + `taskUpdateOwn` za collaborator-a
- Interna finansijska polja iza `internalFinanceRead` (marža, trošak saradnika, interna kalkulacija)
- Thread-ovi (odgovori u pod-niz), typing indikator, presence
- Arhiviranje kanala, moderacija
- AI rezimei: dnevni/nedeljni, nove odluke, otvorena pitanja, nepotvrđeni predlozi, poruke za taskove
- Globalna pretraga po projektu, članu, datumu, milestone-u i tipu odluke
- Migracija milestone chata (`ProjectMessage`) pod isti model kanala
- Razbijanje `route.js` na module

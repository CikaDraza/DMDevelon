# Codex prompt — DMDevelon: više proposal-a i faza unutar jednog projekta

Radi na postojećoj DMDevelon aplikaciji. Nemoj praviti novi projekat, paralelnu aplikaciju niti izolovani demo. Implementiraj funkcionalnost u postojećem sistemu, uz očuvanje postojećih korisnika, podataka, autorizacije, notifikacija, milestone chat-a i vizuelnog identiteta.

## Poslovni cilj

Jedan klijentski projekat mora ostati jedna stavka u pregledu projekata, ali unutar njega mora moći da postoji:

- jedan **Master Proposal** nastao iz originalnog zahteva klijenta;
- neograničen broj narednih proposal-a po fazama, npr. **Faza 2**, **Faza 3**;
- zaseban scope, trajanje, cena, verzija, status i plan milestones/tasks za svaki proposal;
- zasebno slanje, traženje izmena i prihvatanje svake faze;
- milestones koji se nakon prihvatanja proposal-a dodaju u isti postojeći projekat i ostaju povezani sa proposal-om/fazom iz koje su nastali;
- pitanja i zahtevi za izmene na svakom milestone-u;
- admin-only uređivanje milestone-a i njegovih taskova nakon dogovorene izmene, sa obaveznim razlogom izmene i audit istorijom.

Ne želim da se Faza 2, Faza 3 i ostale faze prikazuju kao posebni projekti na dashboard-u.

## Prvo analiziraj postojeći sistem

Pre izmene koda pregledaj najmanje sledeće fajlove i potvrdi kako trenutno funkcionišu:

- `models/ProjectRequest.js`
- `models/ClientProject.js`
- `models/ProjectMessage.js`
- `models/Notification.js`
- `app/api/[[...path]]/route.js`
- `hooks/useProjectRequests.js`
- `hooks/useClientProjects.js`
- `components/admin/ProjectRequestsManager.jsx`
- `components/admin/ClientProjectsManager.jsx`
- `components/dashboard/MilestoneChat.jsx`
- `components/dashboard/RequestConversation.jsx`
- `app/dashboard/requests/[id]/page.js`
- `app/dashboard/projects/[id]/page.js`
- `app/dashboard/page.js`
- `components/ui/project-timeline.jsx`

Postojeće stanje koje treba proveriti u kodu:

- `ProjectRequest` trenutno ima jedan ugnežđeni `proposal` sa poljima `title`, `scope`, `timeline`, `budget`, `version`, `sentAt` i `acceptedAt`.
- Pri prihvatanju proposal-a API pravi `ClientProject`, ali trenutno ga kreira sa praznim `milestones` nizom.
- `ClientProject` trenutno čuva milestones i tasks kao ugnežđene dokumente.
- `ProjectMessage` je vezan za `projectId` i `milestoneId`.
- Klijentska stranica projekta već ima dugme **Ask a question** i otvara `MilestoneChat`.
- Admin `ClientProjectsManager` već sadrži UI i lokalne helper-e za kreiranje/uređivanje milestones-a i taskova.
- API već ima granularni PATCH za status projekta, milestone-a i task-a.

Ako se stvarno stanje razlikuje, prilagodi plan stvarnom kodu. Pre implementacije napiši kratak rezime pronađenog toka, zatim implementiraj. Nemoj se zaustaviti samo na planu.

## Arhitektonska odluka

Uvedi poseban model/collection `ProjectProposal`, jer proposal ima sopstveni lifecycle, verzije, prihvatanje i notifikacije. Nemoj sve proposal-e ugnezditi u `ClientProject`, kako uređivanje proposal-a ne bi bilo u konfliktu sa čestim ažuriranjem progress-a i chat-a.

Početni proposal u `ProjectRequest` može privremeno ostati radi backward compatibility-ja. Kada klijent prihvati početni proposal:

1. kreira se jedan `ClientProject` kao i do sada;
2. prihvaćeni početni proposal kopira se kao nepromenljivi **Master Proposal** u `ProjectProposal`;
3. planirani milestones iz proposal-a pretvaraju se u operativne milestones projekta;
4. svaki kreirani milestone dobija `proposalId`, `phaseNumber` i `phaseLabel`;
5. ponovljeni zahtev za prihvatanje mora biti idempotentan i ne sme praviti dupli projekat, proposal ili milestones.

Za sve naredne faze proposal se kreira direktno unutar postojećeg `ClientProject` toka.

## Model `ProjectProposal`

Dodaj `models/ProjectProposal.js` sa UUID string `_id`, timestamps i najmanje sledećim poljima:

```js
{
  _id,
  projectId,             // required nakon kreiranja projekta
  requestId,             // samo za početni master proposal
  clientUserId,
  kind,                  // "master" | "phase"
  phaseNumber,           // master/Phase 1 = 1, zatim 2, 3...
  phaseLabel,            // "Master Proposal", "Faza 2"...
  title,
  scope,                 // Markdown
  timeline,              // tekstualno trajanje, zadrži kompatibilnost sa postojećim poljem
  budget,                // tekstualna cena, zadrži kompatibilnost
  status,                // draft | sent | changes_requested | accepted | rejected | archived
  version,
  milestonePlan: [],     // snapshot plana milestones/tasks iz proposal-a
  revisionHistory: [],   // prethodni snapshot-i ili jasno strukturisana istorija verzija
  createdByUserId,
  sentAt,
  acceptedAt,
  rejectedAt
}
```

`milestonePlan` koristi planersku varijantu postojećeg milestone/task oblika, ali ne sme deliti iste mutable objekte sa operativnim `ClientProject.milestones` nizom.

Dodaj odgovarajuće indekse:

- `projectId + phaseNumber`;
- `projectId + status`;
- jedinstven master proposal po projektu;
- `requestId` za početni proposal.

Ako partial unique index nije pouzdan u postojećem deployment-u, zaštiti pravilo i na serveru.

## Proposal state machine

Server mora da sprovodi dozvoljene tranzicije:

```text
draft -> sent
sent -> accepted
sent -> changes_requested
changes_requested -> draft/revised -> sent
sent -> rejected
accepted -> immutable
```

Pravila:

- Klijent ne vidi `draft` proposal.
- Samo admin kreira, menja i šalje proposal.
- Samo vlasnik projekta/klijent može da prihvati proposal ili traži izmene.
- Admin ne sme u ime klijenta označiti proposal kao prihvaćen kroz običan update endpoint.
- Prihvaćeni proposal se ne menja in-place.
- Nova izmena scope-a, cene ili trajanja prihvaćenog proposal-a zahteva novu verziju/revision ili poseban change proposal.
- Ponovno slanje nakon traženih izmena povećava `version` i čuva prethodni snapshot.
- Prihvatanje proposal-a samo jednom materijalizuje njegove milestones u projekat.

## Promene postojećih modela

### `ProjectRequest`

Proširi postojeći početni `ProposalSchema` tako da može da sadrži `milestonePlan` ili `milestones`, `kind: "master"`, `phaseNumber: 1` i `phaseLabel`. Nemoj odmah obrisati postojeće polje `proposal` niti pokvariti postojeće request dokumente.

### `ClientProject.MilestoneSchema`

Dodaj:

```js
proposalId: String
phaseNumber: Number
phaseLabel: String
revision: Number
changeHistory: [{
  changedAt,
  changedByUserId,
  changedByName,
  changeSummary,
  sourceMessageId,
  before,
  after
}]
```

`before` i `after` treba da budu ograničeni snapshot-i dozvoljenih milestone/task polja, bez nepotrebnog dupliranja celog projekta.

### `ProjectMessage`

Zadrži postojeću kompatibilnost i dodaj opciono:

```js
proposalId: String
messageType: "message" | "question" | "change_request" | "system" | "change_agreed"
```

Stari dokumenti bez `messageType` tretiraju se kao `message`.

### `Notification`

Dodaj opciono `proposalId`, da proposal notifikacija može otvoriti tačan proposal na stranici projekta.

## API

U postojeći catch-all API uvedi jasne, autorizovane rute. Prilagodi nazive postojećem routing stilu ako je potrebno, ali zadrži iste domenske operacije:

```text
GET    /api/client-projects/:projectId/proposals
POST   /api/client-projects/:projectId/proposals
GET    /api/client-projects/:projectId/proposals/:proposalId
PATCH  /api/client-projects/:projectId/proposals/:proposalId
POST   /api/client-projects/:projectId/proposals/:proposalId/send
POST   /api/client-projects/:projectId/proposals/:proposalId/accept
POST   /api/client-projects/:projectId/proposals/:proposalId/request-changes
POST   /api/client-projects/:projectId/proposals/:proposalId/reject
PUT    /api/client-projects/:projectId/milestones/:milestoneId
```

Zahtevi za API:

- koristi postojeće `getUserFromRequest`, admin i ownership provere;
- ne prihvataj `clientUserId`, `projectId`, `acceptedAt`, `status` ili owner polja iz nepouzdanog body-ja bez server-side odluke;
- validiraj dozvoljena polja i state transition;
- ne koristi nezaštićeni mass assignment;
- vrati 400 za nevalidan payload, 401/403 za nedozvoljenu akciju, 404 za nepostojeći resurs i 409 za konflikt stanja/duplo prihvatanje;
- prihvatanje mora biti idempotentno;
- za materijalizaciju milestones-a koristi server-generisane UUID vrednosti;
- sačuvaj `proposalId` na svakom operativnom milestone-u;
- ne briši milestone razgovore prilikom uređivanja milestone-a;
- nemoj menjati `_id` postojećeg milestone-a ili task-a tokom editovanja, osim za novododate taskove;
- emituj postojeće project events i notifikacije za slanje, traženje izmena, prihvatanje proposal-a i dogovorenu izmenu milestone-a.

Ako Mongo deployment podržava transactions, koristi session za prihvatanje proposal-a i kreiranje milestones-a. Ako ne podržava, uvedi determinističku idempotency zaštitu i proveru/reconciliation kako delimičan neuspeh ne bi napravio duplikate.

## Hooks i cache

Dodaj npr. `hooks/useProjectProposals.js` ili proširi `useClientProjects.js` jasnim hook-ovima za:

- listu proposal-a projekta;
- create/update draft;
- send;
- accept;
- request changes;
- reject;
- admin edit milestone-a sa taskovima.

Koristi postojeći React Query obrazac. Posle mutation-a invalidiraj:

- `['client-projects']`;
- `['client-projects', projectId]`;
- `['project-proposals', projectId]`;
- relevantne notification query-je.

## Reusable editori

Nemoj kopirati veliki milestone builder na više mesta.

Izvuci postojeći milestone/task builder iz `components/admin/ClientProjectsManager.jsx` u reusable komponente, na primer:

```text
components/admin/MilestonePlanEditor.jsx
components/admin/ProposalEditorDialog.jsx
components/admin/MilestoneEditorDialog.jsx
```

`MilestonePlanEditor` mora podržati:

- dodavanje, uklanjanje i promenu redosleda milestones-a;
- naslov, opis, ikonu i git branch;
- dodavanje, uklanjanje i promenu redosleda tasks;
- status polja samo kada uređuje operativni milestone, ne u proposal draft-u ako status nema poslovni smisao;
- stabilne postojeće `_id` vrednosti pri editovanju;
- validaciju praznog naslova i duplih order vrednosti.

## Admin UX

U `ClientProjectsManager` za svaki projekat dodaj sekciju **Proposals**:

- Master Proposal je prvi;
- zatim Phase/Faza proposal-i sortirani po `phaseNumber`;
- prikaži status, verziju, cenu, trajanje i broj planiranih milestones-a;
- dugme **Add proposal**;
- forma automatski predlaže sledeći `phaseNumber` i naziv `Faza N`, ali admin može da izmeni label;
- akcije zavise od statusa: Edit draft, Send, View, Create revision;
- prihvaćeni proposal je read-only.

U admin prikazu svakog operativnog milestone-a dodaj dugme **Edit milestone** neposredno pre postojećeg Chat/Ask a question dugmeta.

Klik otvara `MilestoneEditorDialog` popunjen postojećim milestone-om i njegovim taskovima. Pri čuvanju zahtevaj:

- `changeSummary` — obavezan tekst šta je dogovoreno i promenjeno;
- opciono `sourceMessageId` ako je izmena nastala iz konkretne klijentske poruke;
- eksplicitnu potvrdu **Save agreed change**.

Izmena mora:

- sačuvati prethodno stanje u `changeHistory`;
- dodati project event;
- poslati klijentu notifikaciju;
- osvežiti otvoreni milestone i timeline;
- ostaviti snapshot prihvaćenog proposal-a nepromenjenim.

Na stranici `app/dashboard/projects/[id]/page.js` dugme **Edit milestone** može biti prikazano samo ako `user.isAdmin === true`. Klijent nikada ne dobija direktnu edit akciju. Za klijenta ostaje **Ask a question**.

## Client UX

Na `/dashboard/projects/[id]` prikaži jedan projekat, a unutar njega novu sekciju **Proposals & phases** iznad timeline-a:

- Master Proposal;
- Faza 2, Faza 3...
- status badge i verzija;
- collapsible scope;
- cena i trajanje;
- preview planiranih milestones-a;
- accepted proposal read-only;
- sent proposal ima **Accept proposal** i **Request changes**;
- draft proposal nije prisutan u API odgovoru za klijenta.

Kada klijent prihvati novu fazu:

- ne kreira se novi projekat;
- proposal prelazi u `accepted`;
- milestones te faze dodaju se postojećem projektu;
- timeline i progress se osvežavaju;
- milestones su vizuelno grupisani po `phaseLabel` ili imaju jasan phase badge.

Postojeći dashboard `app/dashboard/page.js` i dalje prikazuje samo jednu project karticu. Ukupni progress može ostati zbir svih prihvaćenih milestones-a, ali na detaljnoj stranici prikaži i progress po fazi ako to može biti urađeno bez dupliranja logike.

## Pitanja i zahtevi za izmene milestone-a

Postojeći `MilestoneChat` mora nastaviti da radi.

Dodaj jasan izbor ili akciju kojom klijent može poslati:

- obično pitanje;
- **Request a change**.

Za `change_request`:

- sačuvaj `messageType`;
- prikaži vidljiv badge u razgovoru;
- pošalji admin notifikaciju sa deep-linkom na projekat i milestone;
- admin i dalje odlučuje da li je izmena prihvaćena;
- stvarna izmena se primenjuje samo kroz admin `Edit milestone` / `Save agreed change` tok.

Ne pretvaraj svaku chat poruku automatski u promenu scope-a.

## Notifikacije i deep-linkovi

Dodaj tipove notifikacija po postojećem obrascu:

- `project_proposal_sent`;
- `project_proposal_changes_requested`;
- `project_proposal_accepted`;
- `milestone_change_requested`;
- `milestone_change_applied`.

Proposal link treba da vodi na:

```text
/dashboard/projects/:projectId?proposal=:proposalId
```

Milestone link ostaje:

```text
/dashboard/projects/:projectId?m=:milestoneId
```

Ako su oba potrebna, podrži oba query parametra. Otvaranje deep-linka treba da označi relevantnu notifikaciju kao pročitanu, bez označavanja nepovezanih milestone poruka.

## Migracija postojećih podataka

Dodaj idempotentnu migration skriptu, npr.:

```text
scripts/migrate-project-proposals.mjs
```

Skripta mora podrazumevano raditi `--dry-run`, a menjati podatke samo uz `--apply`.

Za svaki postojeći `ClientProject`:

1. Ako ima `requestId` i prihvaćeni `ProjectRequest.proposal`, napravi accepted Master Proposal snapshot iz njega.
2. Ako nema odgovarajući request/proposal, napravi legacy accepted Master Proposal iz `project.title`, `project.description`, `project.requirements` i postojećih milestones-a.
3. Postojećim milestones-ima dodaj `proposalId`, `phaseNumber: 1` i odgovarajući `phaseLabel` bez promene njihovog `_id`.
4. Ne dupliraj proposal ni pri ponovljenom pokretanju skripte.
5. Ne menjaj niti briši postojeće `ProjectMessage` dokumente.
6. Ispiši broj pregledanih, migriranih, preskočenih i problematičnih dokumenata.

Posebno proveri postojeći projekat sa ID-em:

```text
d9d435d4-ab36-41f1-93c5-7b435ce270d6
```

Nemoj hardkodovati taj ID u aplikacionu logiku; koristi ga samo za verifikaciju migracije i UI toka ako postoji u razvojnoj bazi.

## Backward compatibility

- Postojeći request → proposal → accept tok mora nastaviti da radi.
- Stari `ProjectRequest.proposal` dokumenti bez milestones-a moraju biti validni.
- Stari projekti bez `proposalId` ne smeju rušiti UI pre migracije; prikaži ih pod fallback grupom `Master / Existing scope`.
- Postojeći milestone i task status PATCH endpoint-i moraju nastaviti da rade.
- Postojeći milestone chat i attachments moraju ostati dostupni.
- Ne menjaj javni portfolio `Project` model; ova funkcionalnost pripada `ClientProject` domenu.
- Ne preimenuj postojeće rute bez compatibility sloja.

## Security i integritet

- Klijent može čitati samo sopstveni projekat i njegove sent/accepted/changes_requested proposal-e.
- Draft proposal nije dozvoljeno vratiti klijentu čak ni ako direktno pogodi endpoint.
- Samo admin može menjati proposal i operativni milestone/task sadržaj.
- Client accept endpoint mora proveriti da je proposal `sent`, da pripada projektu i da projekat pripada tom klijentu.
- Sanitizuj/validiraj Markdown i payload veličine u skladu sa postojećim rendererom.
- Ne veruj `authorRole`, `acceptedAt`, `createdByUserId`, `clientUserId` ili ownership poljima iz body-ja.
- Sačuvaj prihvaćeni proposal kao audit snapshot.
- Sve mutacije moraju imati server-side authorization, čak i kada je dugme skriveno u UI-u.

## Acceptance kriterijumi

Implementacija je završena tek kada su dokazani sledeći tokovi:

1. Klijent šalje project request; admin kreira Master Proposal sa scope-om, cenom, trajanjem i milestone planom.
2. Klijent traži izmenu; admin šalje novu verziju; prethodna verzija ostaje u istoriji.
3. Klijent prihvata Master Proposal; kreira se tačno jedan `ClientProject`, master proposal snapshot i milestones.
4. Projekat se na dashboard-u prikazuje kao jedna kartica.
5. Admin u istom projektu klikne **Add proposal**, kreira `Faza 2` i doda njen scope, cenu, trajanje, milestones i tasks.
6. Draft Faze 2 nije vidljiv klijentu.
7. Posle slanja klijent dobija notifikaciju i vidi Fazu 2 na postojećoj project stranici.
8. Klijent može da prihvati Fazu 2 ili traži izmene.
9. Prihvatanje Faze 2 dodaje njene milestones postojećem projektu bez duplikata.
10. Timeline i progress prikazuju milestones povezane sa odgovarajućom fazom.
11. Klijent može postaviti pitanje ili poslati `change_request` za konkretan milestone.
12. Admin vidi **Edit milestone** pre Chat/Ask dugmeta, menja milestone/tasks uz obavezan `changeSummary`, a klijent dobija notifikaciju.
13. Pri editovanju operativnog milestone-a prihvaćeni proposal snapshot ostaje nepromenjen.
14. Neadmin korisnik ne može pozvati admin proposal/milestone endpoint ni direktnim HTTP zahtevom.
15. Postojeći projekti, statusi, chat poruke, attachments i notifikacije nastavljaju da rade.
16. Dvostruki klik ili ponovljen accept zahtev ne pravi dupli projekat, proposal ili milestones.
17. Mobilni prikaz i postojeći tamni DMDevelon dizajn ostaju konzistentni.

## Verifikacija

Pre završnog odgovora:

- pokreni postojeće testove ako postoje;
- dodaj ciljane testove za proposal state machine, ownership, draft visibility, idempotent accept i milestone change audit;
- pokreni `yarn build`;
- pokreni migration skriptu u `--dry-run` režimu;
- proveri da nema React key upozorenja i da se postojeći chat deep-linkovi nisu pokvarili;
- ručno ili testom prođi tok Master Proposal → accepted project → Add Faza 2 → send → request changes → resend → accept → milestones;
- sačuvaj postojeće korisničke izmene u dirty worktree-u i ne resetuj nepovezane fajlove.

## Završni odgovor

Na kraju prikaži:

1. kratak opis implementiranog toka;
2. spisak promenjenih i novih fajlova;
3. model i migration odluke;
4. API rute;
5. rezultate testova i build-a;
6. šta je ostalo kao eventualni follow-up.

Ne završavaj sa mockup-om ili samo opisom. Implementiraj funkcionalnost end-to-end u postojećoj aplikaciji.

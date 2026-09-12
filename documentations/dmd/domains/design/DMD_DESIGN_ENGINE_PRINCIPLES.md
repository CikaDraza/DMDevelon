# DMD Design Engine — Product & Architecture Principles

**Status:** ACTIVE
**Authority:** canonical
**Owner domain:** Design
**Supersedes:** —
**Superseded by:** —

**Source artifact:** https://claude.ai/code/artifact/d4a482da-640b-4f78-9cb6-5cc8a58889a2?via=auto_preview

## 1. Core principle

DMD nije „AI website generator iz jednog prompta“.

Osnovno pravilo sistema je:

> **AI interprets. The system decides. The Design Engine renders.**

AI služi za razumevanje neuređenog ljudskog inputa, vođenje razgovora, ekstrakciju podataka, klasifikaciju i pojašnjenja.

AI **ne odlučuje** koji UX obrazac odgovara poslovnom modelu.

Izbor UX obrasca, strukture proizvoda, hijerarhije informacija i dozvoljenih design pravila mora da bude vođen sistemom kroz deterministička pravila, konfiguraciju i validirane design sisteme.

---

## 2. Product invariant

> **Engine ne sme da dizajnira ono što još ne razume.**

Primer lošeg inputa:

> „Bavim se coachingom i želim moderan sajt.“

To nije dovoljan input za dizajn.

Sistem mora prvo da razume:

- šta klijent stvarno radi;
- kome prodaje;
- koji problem rešava;
- šta se konkretno dešava kada kupac/klijent započne saradnju;
- koje metode, procese ili pristupe koristi;
- šta je glavni conversion event;
- šta gradi poverenje;
- koje informacije korisnik mora da razume pre akcije;
- kako biznis funkcioniše operativno;
- koji sadržaji, proizvodi, usluge ili tokovi postoje;
- koji poslovni cilj digitalni proizvod mora da podrži.

Ako odgovor nije dovoljno jasan, agent ne prihvata maglovit input samo da bi završio intake.

Umesto toga:
1. reformuliše pitanje;
2. daje primer;
3. traži konkretniji odgovor;
4. ažurira strukturisano stanje tek kada postoji dovoljno informacija.

---

## 3. Adaptive Discovery

Chat je korisnički interfejs, ali iza njega postoji strukturisani intake.

Korisnik razgovara prirodnim, non-IT jezikom.

Sistem u pozadini gradi model, npr:

- `business`
- `audience`
- `offer`
- `services`
- `methodology`
- `conversion`
- `trust`
- `content`
- `operations`
- `brand`
- `growth_goals`
- `constraints`

Korisnik ne mora da zna nijedan od ovih tehničkih pojmova.

AI agent treba da:
- prepozna šta je već poznato;
- prepozna šta nedostaje;
- ne ponavlja nepotrebno pitanja;
- traži preciziranje kada je odgovor nejasan;
- prevodi non-IT odgovor u strukturisan input za engine.

---

## 4. Understanding Gate

Ne postoji direktan tok:

`prompt -> generation`

nego:

`conversation -> structured state -> completeness/confidence -> system decision -> generation`

Primer:

```text
methodology:
  status: complete

primary_offer:
  status: complete

target_audience:
  status: partial

conversion_goal:
  status: missing
```

Dok ključni podaci nisu dovoljno jasni, sistem ne sme da dozvoli Design Engine-u da izmišlja.

---

## 5. Product type selection

Korisnik prvo bira ili kroz razgovor otkriva koju vrstu digitalnog sistema želi.

Primeri:

- CRM
- Growth Business OS
- E-commerce
- Search / Discovery app
- LRM
- Dashboard
- Education platform
- Booking / Service Business
- druge buduće kategorije

Izbor platforme određuje:

- koje podatke discovery mora da prikupi;
- koji UX obrasci su dozvoljeni;
- koje funkcionalne capability-je sistem uključuje;
- koji design system ili njihova kombinacija predstavlja odgovarajuću osnovu;
- koje business rules i conversion logike se primenjuju.

---

## 6. System chooses the UX pattern

**AI ne bira UX obrazac. Sistem bira UX obrazac na osnovu strukturisanog poslovnog modela.**

Primer stručne usluge:

```text
business_model = service_expert
conversion_goal = consultation_booking
trust_dependency = high
offer_complexity = medium
content_authority = important
```

Sistem može da izabere hijerarhiju:

`authority -> methodology -> process -> proof/trust -> CTA`

E-commerce može zahtevati:

`product discovery -> categories -> product proof -> price/offer -> cart/checkout`

CRM / Dashboard može zahtevati:

`status -> alerts -> primary actions -> workflows -> detail views`

Odluka nije estetska improvizacija AI modela.

To je rezultat poslovnog modela, UX pravila i design system konfiguracije.

---

## 7. Existing Design Systems as source material

DMD već ima više različitih design sistema i reference implementations:

1. **Marysoll Design System**
2. **Mobile-First Admin Panel Design System**
3. **Psihointegritet Design System**
4. **P.DC / Sanja variation**
5. **English Tutor Design System**
6. **The Lash Room Y2K Design System**

Ovi sistemi predstavljaju dokaz da ista osnovna pravila mogu da proizvedu različite identitete bez pravljenja potpuno novog sajta od nule.

Cilj budućeg Design Engine-a nije da kopira postojeći template, već da iz ovih sistema izvuče pravila.

---

## 8. Three layers of Design Engine knowledge

### 8.1 Design Primitives

Osnovne vrednosti i vizuelni tokeni:

- spacing
- radius
- typography scale
- container widths
- motion
- density
- layout rhythm
- responsive behavior

### 8.2 Design Grammar

Pravila koja određuju kako se formiraju i kombinuju:

- Hero
- content sections
- cards
- CTA zones
- navigation
- editorial surfaces
- forms
- onboarding flows
- dashboards
- discovery views
- booking flows

Design grammar nije samo vizuelno pravilo.

Ona može da sadrži i UX hijerarhiju:

> Za ovu vrstu poslovnog problema ova informacija mora prethoditi ovoj akciji.

### 8.3 Brand Configuration

Varijacije koje daju različit identitet:

- boje
- font karakter
- fotografija
- tonalitet
- visual density
- nivo soft / professional / editorial / bold / playful
- motion character
- imagery rules
- brand-specific expression

---

## 9. Strategy orchestration

Kada je poslovni model dovoljno poznat, strukturisan input može biti prosleđen specijalizovanim engine-ima ili AI agentima.

Primeri:

- business strategy
- offer positioning
- conversion / funnel
- CTA strategy
- SEO
- content architecture
- marketing
- UX
- domain specialists
- visual design

Ovi agenti ne smeju da grade svaki svoju nezavisnu interpretaciju.

Svi treba da čitaju isti normalizovani business model i isti verified project state.

---

## 10. Example — Sanja / P.DC discovery

Razgovor sa Sanjom pokazuje zašto jedan prompt nije dovoljan.

Početni opis tipa:

> mentor / konsultant / psihoterapijski pristup

nije dovoljan za ozbiljan digitalni proizvod.

Kroz razgovor su otkrivene važne informacije:

- tri konkretne metodologije;
- način na koji ih koristi;
- potreba da metodologije budu objašnjene;
- teorijski okvir koji će se postepeno predstavljati;
- blog kao povremeni, ali važan content format;
- društvene mreže kao zaseban kanal;
- video trenutno nije glavni web format;
- potreba za Instagram template sistemom;
- šta klijent mora da razume pre zakazivanja;
- šta Sanja stvarno radi sa ljudima kada saradnja počne.

To je pravi requirements discovery.

Chat samo skriva kompleksnost klasičnog intake-a.

---

## 11. Product positioning

DMD ne treba pozicionirati kao:

> „AI napravi sajt iz prompta.“

Bolje pozicioniranje:

> **Sistem prvo razume vaš biznis, zatim definiše šta digitalni proizvod treba da radi, a tek onda ga dizajnira.**

Još kraće:

> **Ne morate da znate šta da kažete AI-ju. Sistem zna šta treba da sazna od vas.**

Ovo predstavlja ključnu razliku u odnosu na jeftine generativne proizvode koji:

- koriste premalo podataka;
- generišu prerano;
- prebacuju odgovornost za dobar prompt na klijenta;
- troše tokene bez stabilne poslovne strukture;
- proizvode generičke rezultate;
- nemaju determinističku UX logiku;
- nemaju validirane design systems i domain rules.

---

## 12. Target architecture

Visok nivo toka:

```text
Client
  ↓
AI-guided Discovery
  ↓
Structured Business Model
  ↓
Understanding / Completeness Gate
  ↓
Business & Product Rules
  ↓
UX Pattern Selection
  ↓
Strategy Orchestration
  ↓
Design Engine
  ↓
Design System + Brand Configuration
  ↓
Custom Digital Product
```

Ključna granica:

```text
AI = interpretation
System = decisions
Engine = execution
```

---

## 13. Strategic value

Glavna prednost DMD pristupa nije samo AI.

Prednost je kombinacija:

- strukturisanog discovery-ja;
- business-model reasoning-a;
- determinističkih pravila;
- validiranih UX obrazaca;
- više postojećih design sistema;
- specijalizovanih agenata;
- zajedničkog project state-a;
- dijagnostike;
- dokumentacije;
- razvoja i praćenja projekta.

Time DMD može da pređe iz:

> portfolio + project tracking

u napredniji sloj:

> **AI-assisted business, product, design and development operating system.**

# DMD Workspace — Experience Example

**Status:** SUPPORTING
**Authority:** companion
**Owner domain:** Workspace / Product UX
**Supersedes:** —
**Superseded by:** —

Fokus na ono što korisnik doživi posle CTA-a, jer će upravo taj prvi Workspace odlučiti da li DMD deluje kao stvarno nov proizvod ili samo kao još jedan AI chat sa lepim preview-em.

CTA koji smo definisali radi dobro upravo zato što ne tera klijenta da unapred zna šta kupuje:

Have an idea? Let’s build it.
No technical brief required.

A sekcija odmah ispod objašnjava suštinu bez tehničkog jezika: korisnik ne mora da zna da li mu treba website, booking, marketplace, portal ili custom application; treba da objasni šta želi da njegov biznis ili korisnici mogu da urade.

Ono što sada moramo da pogodimo: prvih 5–10 minuta

Mislim da tu imamo jedan veoma važan cilj:

Korisnik mora relativno brzo da pomisli: „Ovaj sistem stvarno razume šta pokušavam da napravim.“

Ne prvo:

„Wow, lepo priča AI.“

I ne:

„Wow, generisao mi je landing page.“

To već postoji na deset mesta.

DMD mora da napravi drugačiji aha moment.

Zamisli da kliknem Start with your idea.

Otvara se fullscreen Workspace. Levo razgovor, desno u početku ne prazan canvas, nego vrlo mirna početna površina. Dvokolonski model koji smo definisali je dobar: razgovor je kontrolna površina, a desno se menja artefakt u zavisnosti od faze — prvo understanding, kasnije solution/design/commercial/project.

Prva poruka ne bi trebalo da bude klasično:

What kind of website do you need?

Niti:

Select your project type.

Već nešto poput:

What are you trying to make possible?

I ispod možda 3 vrlo mala primera, ne kao kategorije:

Customers should be able to book me
I want to sell my service differently
I have an idea for a platform

i slobodan input:

Tell me in your own words.

To je veoma važan detalj. Od prvog ekrana govorimo čoveku: ne moraš da razumeš naš sistem — sistem će razumeti tebe.

Prvi „wow“ ne bih još pravio kroz design

To mi je sada još jasnije.

Posle nekoliko poruka, desna strana treba prvi put da „oživi“.

Recimo korisnik kaže:

Imam školu engleskog. Sada mi se ljudi javljaju na Instagramu, onda ih pitamo koji nivo imaju i dogovaramo čas. Hteo bih da im bude lakše da krenu i da nastavnik zna nešto o njima pre časa.

DMD razgovara još malo.

A onda se desno pojavi nešto ovako:

Here’s what I understand

Your goal
Help new students go from interest to the right lesson with less manual messaging.

Today
Instagram inquiry → manual questions → lesson arranged manually

What should improve
Inquiry → understand student → recommend next step → schedule → teacher receives context

People involved
Student · Teacher · Business owner

Important
You don’t necessarily need a traditional course website.

Is this accurate?

Yes, continue
Something is missing

E to je već proizvod.

Jer korisnik upravo vidi da njegov neuredan opis postaje strukturisan business/product model.

To je BI koji radi, ali korisnik ne vidi Business Intelligence, facts, provenance, VerifiedBusinessState. To smo već dobro postavili u arhitekturi: prvo razumemo potrebu, zatim capabilities, pa tek onda product fit.

Tek posle tog trenutka dolazi druga demonstracija inteligencije

Nakon što korisnik potvrdi:

Da, upravo to.

Workspace može da kaže:

I think we have enough to explore a solution.

I desno se više ne prikazuje samo summary.

Počinje da se formira:

Recommended product direction

Ne nešto banalno kao:

You need a website.

Već:

Customer acquisition

landing / discovery
initial intake

Service delivery

student profile
teacher context
scheduling

Business operations

client management
follow-up

I onda:

Recommended foundation

Custom digital service platform

ili, kod beauty primera:

Marysoll foundation

sa objašnjenjem zašto.

U dokumentu smo baš ovo dobro definisali: izbor proizvoda dolazi posle razumevanja, a postojeća platforma se preporučuje zato što već poseduje tražene capabilities, ne zato što je korisnik kliknuo „beauty app“.

To je drugi aha:

„Nije me samo saslušao — razumeo je kakav sistem iz toga proizlazi.“

Treći aha je tek Design

I onda bih mu dao vizuelni rezultat.

Ne mora DMD odmah da renderuje 12 stranica.

Naprotiv, model iz dokumenta mi se i dalje sviđa:

complete Design Strategy → complete structure → full Design Spec → rendered Homepage

Za ozbiljniji projekat cela logika proizvoda može biti definisana, a besplatno stvarno renderujemo homepage + responsive preview.

Tu korisnik dobija:

Preview | Structure | Solution

i Desktop / Tablet / Mobile.

Tada više nije:

„AI mi je napravio web stranicu.“

nego:

„Objasnio sam biznis → razumeo je problem → predložio proizvod → sada gledam kako bi taj proizvod mogao da izgleda.“

To je mnogo snažniji niz.

Zato bih prvi Workspace slice definisao ovako

Ne bih mu sada dao zadatak „napravi split-screen chat“.

To bi bilo premalo.

DMD-WORKSPACE-0 treba da dokaže user experience hipotezu, čak i ako je sve iza toga fixture/mock state:

Entry
→ idea

Conversation
→ user explains problem naturally

Understanding
→ right panel becomes structured understanding

Confirmation
→ user corrects / approves

Solution direction
→ capabilities + recommended product direction

Design transition
→ preview appears

I tek posle toga razmišljamo o unlocku, registraciji, paymentu itd.

Arhitektonski roadmap koji smo već definisali lepo podržava upravo ovakav vertikalni razvoj: Workspace shell → anonymous session → stvarni AI → verified understanding → product routing → design → commercial → project mode.

Jednu stvar bih posebno čuvao

Ne smemo rano da pretvorimo razgovor u formular.

Naravno da engine iza razgovora mora da prikupi strukturisane podatke.

Ali korisnik ne treba da oseća:

Step 2/9 — Business type
Step 3/9 — Number of employees
Step 4/9 — Select features

Jer smo tada samo napravili onboarding wizard sa AI avatarom.

Može postojati progres, ali semantički:

Understanding your business
→ Shaping the solution
→ Creating the first preview

a ne „7 od 14 pitanja“.

I mislim da je ovde zapravo glavna inovaciona teza DMD-a:

Korisnik ne konfiguriše digitalni proizvod. DMD zajedno sa njim otkriva šta proizvod treba da bude.

A zatim isti Workspace ne nestaje nakon prodaje. Postaje mesto gde se radi design, commercial decision, a kasnije i stvarni projekat — upravo ona ideja „jedan razgovor i jedan workspace od prve ideje do aktivnog projekta“.

Zato bih sledeće razradio baš prvi konkretan Workspace UX screen-by-screen, od klika na Start with your idea do trenutka kada desno prvi put dobije Here’s what I understand. To je, po meni, sada najkritičniji deo celog DMD proizvoda.

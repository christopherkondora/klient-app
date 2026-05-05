# Lejart szamla email ertesites terv

## Cel

A Klient automatikusan felismerje a lejart, meg nem fizetett szamlakat, es kezelje az ezekhez kapcsolodo email ertesiteseket.

Az ertesites ket iranyba mukodhet:

- a felhasznalo fele: kintlevoseg-figyelmeztetes es osszesito
- az ugyfel fele: udvarias fizetesi emlekezteto

Az elso verzio celja nem a teljesen automata behajtas, hanem egy biztonsagos, kontrollalhato reminder rendszer.

## Alapelv

A lejart szamla erzekeny uzleti helyzet. Emiatt az MVP-ben az ugyfelnek kuldott email ne induljon automatikusan alapertelmezetten.

Javasolt alap mukodes:

- automatikus overdue detekcio
- automatikus vagy napi osszesito ertesites a felhasznalonak
- ugyfel-emlekezteto csak felhasznaloi jovahagyassal
- kesobb explicit opt-in mellett automata ugyfel reminder

## Overdue detekcio

Egy szamla akkor tekintheto lejartnak, ha:

- statusza `pending`
- van fizetesi hatarido mezije
- a fizetesi hatarido korabbi, mint az aktualis nap
- nem `paid`
- nem `cancelled`

A provider sync utan mindig ujra kell ertekelni a statuszt, mert elofordulhat, hogy a szamla Billingo vagy Szamlazz.hu oldalon idokozben fizetett lett.

Javasolt statuszlogika:

```text
pending + due_date < today -> overdue
paid -> paid, soha nem overdue
cancelled -> cancelled, soha nem overdue
provider status update -> helyi statusz ujraertekelese
```

## Spamvedelem es kovetesi mezok

Az email kuldeshez szukseg van nyilvantartasra, hogy az app ne kuldjon ugyanarra a szamlara minden inditaskor uj ertesitest.

Javasolt uj mezok vagy kulon tabla:

- `overdue_user_notified_at`
- `overdue_client_notified_at`
- `overdue_reminder_count`
- `last_reminder_sent_at`
- `next_reminder_allowed_at`

Ha a schema tisztasaga fontosabb, erdemes kulon `invoice_reminders` tablat hasznalni, ahol minden kuldes es probalkozas naplozhato.

## Futtatasi pontok

Az overdue check termeszetes trigger pontjai:

- app inditas / login utan
- 30 perces billing sync utan
- manualis szamla szinkron utan
- kesobb napi hatterellenorzeskent

MVP-ben a legjobb illeszkedes:

1. billing sync lefut
2. provider statuszok frissulnek
3. overdue check lefut
4. ujonnan lejart vagy meg nem ertesitett szamlak bekerulnek az ertesitesi folyamatba

## Felhasznalonak kuldott email

A felhasznalonak meno email legyen inkabb osszesito, nem minden szamlarol kulon level.

Javasolt tartalom:

- lejart szamlak szama
- osszes lejart osszeg
- ugyfel neve
- szamlaszam
- esedekesseg
- brutto osszeg
- rovid akciojavaslat: szamla megnyitasa vagy emlekezteto kuldese

Javasolt gyakorisag:

- napi egyszeri osszesito
- vagy azonnali ertesites csak akkor, ha uj szamla valt lejartta

## Ugyfelnek kuldott email

Az ugyfelnek kuldott email szamlankenti emlekezteto legyen, visszafogott, udvarias hangnemben.

Javasolt tartalom:

- megszolitas
- szamlaszam
- brutto osszeg
- eredeti fizetesi hatarido
- fizetesi link vagy szamla PDF, ha elerheto
- udvarias zaras: ha kozben rendezte, tekintse targytalannak

MVP-ben az ugyfel email kuldese manualis action legyen a felhasznalo reszerol.

## Email kuldesi csatornak

### Provider alapu kuldes

Billingo vagy Szamlazz.hu kuldi a szamlat vagy emlekeztetot, ha erre van megfelelo API lehetoseg.

Elonyok:

- hivatalos szamlazos email
- PDF/link provider oldalon adott
- kisebb sajat email deliverability kockazat

Hatranyok:

- kevesebb kontroll a szoveg felett
- providerfuggo mukodes

### Sajat email kuldes Supabase Edge Functionnel

Supabase Edge Function kuldi az emailt kulso szolgaltaton keresztul, peldaul Resend, Postmark vagy SendGrid hasznalataval.

Elonyok:

- teljes kontroll a sablon felett
- user es ugyfel email kulon stilusban kezelheto
- kesobb konnyen bovitheto reminder sorozatta

Hatranyok:

- email szolgaltato setup kell
- domain hitelesites kell
- deliverability es spam reputation kezelendo

Javaslat:

- felhasznaloi osszesito: sajat email kuldes Edge Functionnel
- ugyfel emlekezteto: elso korben provider alapu, ha elegendo; kesobb sajat sablon, ha nagyobb kontroll kell

## App beallitasok

Javasolt beallitasok kesobbi verziora:

- lejart szamla ertesites be/ki
- user email: napi osszesito / azonnali / kikapcsolva
- ugyfel reminder: manualis / automatikus X nap utan / kikapcsolva
- elso emlekezteto kesleltetese: 1, 3 vagy 7 nap
- ismetles gyakorisaga: peldaul heti egyszer
- maximalis emlekezteto szam: peldaul 3

MVP-ben eleg lehet:

- user ertesites be/ki
- ugyfel emlekezteto manualis gombbal

## UI terv

A Penzugyek / Szamlak feluleten:

- overdue badge a lejart szamlakon
- utolso ertesites datuma
- reminder count megjelenitese, ha van
- `Emlekezteto kuldese` action
- sikeres kuldes utan visszajelzes

Keszobb Dashboardon:

- lejart szamlak rovid figyelmezteto blokk
- osszes lejart osszeg
- link a szamla listara

## Varhatoan erintett fajlok

- `electron/database.ts`
- `electron/billing/sync-service.ts`
- `electron/billing/billing-service.ts`
- `electron/ipc.ts`
- `src/pages/Finances.tsx`
- `src/vite-env.d.ts`
- `email-templates/`
- `supabase/functions/`

## MVP kivitelezesi sorrend

1. Overdue detekcio helyi DB-ben
2. Statuszfrissites billing sync utan
3. Finances oldalon overdue badge es szures
4. Felhasznaloi email osszesito
5. Ugyfel email manualis kuldesi actionnel
6. Spamvedelem: notified_at, reminder_count, cooldown
7. Beallitasok minimalis felulete
8. Keszobbi automata ugyfel reminder explicit opt-in mellett

## Nyitott dontesek

- Az ugyfel emailt provider kuldje vagy sajat email szolgaltato?
- A user email legyen napi osszesito vagy azonnali?
- Keszitsunk kulon `invoice_reminders` tablat, vagy eleg az `invoices` tabla bovites?
- Milyen legyen az elso automata reminder kesleltetese, ha kesobb bekapcsoljuk?
- Kell-e sablon testreszabasi lehetoseg a felhasznalonak?

## Javasolt elso verzio

Az elso verzio legyen konzervativ:

- az app felismeri es jeloli a lejart szamlakat
- a felhasznalo kap email osszesitot
- az ugyfelnek csak manualis jovahagyassal megy ki emlekezteto
- minden kuldes naplozva van
- automata ugyfel email csak kesobbi, explicit opt-in funkciokent kerul be

# Élő fizetés és számla email tesztlista

Ez a lista arra való, hogy egy valódi Stripe fizetéssel végigellenőrizzük a teljes MVP folyamatot:

- Stripe Checkout sikeres fizetés
- Supabase `stripe-webhook` feldolgozás
- előfizetés aktiválás
- Billingo számla létrehozás
- Billingo számla email kiküldés

## Cél

A teszt akkor tekinthető sikeresnek, ha egy éles vásárlás után:

- az appban az előfizetés aktív lesz
- a `subscriptions` tábla helyesen frissül
- Billingóban létrejön a számla
- a vevő megkapja a számla emailt
- nincs duplikált számla vagy duplikált webhook-feldolgozás

## Előfeltételek

Teszt előtt ellenőrizd:

- a Stripe product és price rekordok éles módban a kívánt árakat használják
- a Stripe webhook endpoint aktív: `https://arbhhltbjovuxwvfcnni.supabase.co/functions/v1/stripe-webhook`
- a Stripe események be vannak kapcsolva:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `payment_intent.succeeded`
- a Supabase projekt linked állapotban van a CLI-ben
- a `stripe-webhook` legfrissebb verziója deployolva van
- a Billingo secret-ek éles értékekre mutatnak
- van egy valódi, elérhető email című tesztfelhasználó

Aktuális elvárt Klient árak:

- havi: `4 990 Ft`
- éves: `49 900 Ft`
- lifetime: `149 900 Ft`

## Teszt 1: első sikeres havi vásárlás

1. Regisztrálj vagy lépj be egy olyan felhasználóval, akinél még nincs aktív Klient előfizetés.
2. Nyisd meg a paywallt az appban.
3. Ellenőrizd, hogy a megjelenített ár havi csomagnál `4 990 Ft`.
4. Indítsd el a havi checkoutot.
5. Stripe Checkoutban végezd el a valós fizetést.
6. A fizetés után várd meg, amíg az app visszatér vagy újra lekéri az előfizetés állapotát.

Elvárt eredmény:

- az appban az előfizetés `active`
- a paywall nem kényszerít újabb vásárlásra
- a Settings előfizetés nézetében is a helyes csomag látszik
- a Stripe-ban létrejön a checkout, customer, subscription és invoice
- a Supabase `subscriptions` táblában a felhasználó előfizetése frissül
- a `subscription_billing_events` táblában létrejön egy feldolgozott esemény
- Billingóban létrejön egy számla `4 990 Ft` összeggel
- a teszt email címre megérkezik a Billingo számla email

## Teszt 2: első sikeres éves vásárlás

1. Ismételd meg a fenti folyamatot egy külön tesztfelhasználóval vagy egy korábban törölt/lejárt accounttal.
2. A paywallon válaszd az éves csomagot.
3. Ellenőrizd, hogy az ár `49 900 Ft`.
4. Végezd el a fizetést.

Elvárt eredmény:

- az appban aktív éves előfizetés jön létre
- a Stripe subscription a megfelelő éves price ID-hoz kapcsolódik
- Billingóban a számla összege `49 900 Ft`
- a számla email sikeresen megérkezik

## Teszt 3: lifetime vásárlás

1. Nyisd meg a paywallt egy lifetime nélküli tesztfelhasználóval.
2. Ellenőrizd, hogy a lifetime ár `149 900 Ft`.
3. Indítsd el a lifetime checkoutot.
4. Végezd el a fizetést.

Elvárt eredmény:

- az appban a lifetime hozzáférés aktív lesz
- nem jön létre ismétlődő subscription, ha a jelenlegi flow egyszeri vásárlásként kezeli
- Billingóban a számla összege `149 900 Ft`
- a számla email sikeresen megérkezik

## Teszt 4: webhook idempotencia ellenőrzése

Ez nem külön vásárlás, hanem az előző sikeres fizetések után ellenőrzendő.

Nézd meg, hogy ugyanahhoz a Stripe invoice-hoz:

- nem jött létre két Billingo számla
- a `subscription_billing_events` táblában nincs többszörös sikeres feldolgozás ugyanarra az invoice-ra
- a Stripe `invoice.paid` és `invoice.payment_succeeded` események nem duplikálták a Billingo számlázást

## Teszt 5: megújuló számlázás

Ez a legfontosabb utóteszt a havi vagy éves előfizetés után.

Ellenőrizendő, amikor a következő valódi ciklus lefut, vagy ha külön tesztkörnyezetben szimuláljátok:

- Stripe létrehoz egy új megújuló invoice-t
- a webhook csak `subscription_cycle` esetén készít új Billingo számlát
- az új ciklushoz új Billingo számla készül
- az új számla emailje is kimegy
- nem az első checkout ágat futja újra a rendszer

## Teszt 6: sikertelen fizetés ellenőrzése

Ha ezt élő módban nem akarjátok végigpróbálni, elég ellenőrizni a logikát teszt módban.

Elvárt jelenlegi viselkedés:

- sikertelen fizetésnél a rendszer nem küld saját branded emailt
- a státusz `past_due` irányba tud elmozdulni
- nem készül sikeres Billingo számla és nem megy ki számla email

## Kézi ellenőrzési pontok

Fizetés után ezt a minimum ellenőrzési sort érdemes végigfuttatni:

1. Stripe Dashboard: checkout, payment, customer, invoice, subscription rendben van.
2. Supabase `subscriptions`: a userhez a helyes plan és státusz tartozik.
3. Supabase `subscription_billing_events`: az esemény `processed`, a Stripe és Billingo azonosítók el vannak mentve.
4. Billingo: létrejött a megfelelő összegű számla.
5. Email inbox: megérkezett a számla email, spambe sem csúszott.
6. App UI: a paywall és a settings is aktív előfizetést mutat.

## Javasolt SQL ellenőrzések

Hasznos gyors lekérdezések live teszt után:

```sql
select user_id, status, plan, stripe_subscription_id, current_period_end
from public.subscriptions
order by updated_at desc
limit 10;
```

```sql
select stripe_event_type, stripe_invoice_id, stripe_subscription_id, module, plan, status, billingo_invoice_id, billingo_email_sent, billingo_email_error, created_at
from public.subscription_billing_events
order by created_at desc
limit 20;
```

## Teszt lezárási feltételek

Az MVP email-számlázási folyamat akkor tekinthető késznek, ha legalább egy sikeres havi vagy éves élő vásárlás után egyszerre igaz az alábbi összes pont:

- az app aktiválta az előfizetést
- a helyes ár szerepelt a UI-ban
- a helyes összegű Billingo számla jött létre
- a számla email tényleg megérkezett
- nem keletkezett duplikált számla
- a Supabase naplózás visszakövethető

## Megjegyzés

A jelenlegi MVP-ben a számla emailt a Billingo küldi. Ezért ennél a tesztnél nem egy külön Resend vagy Postmark integrációt kell ellenőrizni, hanem azt, hogy a Billingo `send` endpoint hívása sikeres volt-e és a levél ténylegesen megérkezett-e.
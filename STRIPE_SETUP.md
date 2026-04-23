# Stripe + Billingo beállítási útmutató

## 1. Supabase adatbázis migráció

Ha a `subscriptions` tábla még régi `lemon_squeezy_*` oszlopokat használ, futtasd az alábbi SQL-t a Supabase SQL Editorban:

```sql
ALTER TABLE public.subscriptions RENAME COLUMN lemon_squeezy_customer_id TO stripe_customer_id;
ALTER TABLE public.subscriptions RENAME COLUMN lemon_squeezy_subscription_id TO stripe_subscription_id;
```

Ha a tábla már `stripe_*` oszlopokat használ (újabb setup), ez a lépés kihagyható.

---

## 2. Supabase secrets beállítása

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set BILLINGO_API_KEY=ab379f0a-26dc-11f1-8e47-026634090519
```

> A `STRIPE_WEBHOOK_SECRET` értékét a 4. lépésben kapod meg.

---

## 3. Edge Functions deploy

```bash
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
```

Ellenőrizd, hogy mindkét függvény megjelenik a Supabase Dashboard → Edge Functions alatt.

---

## 4. Stripe Webhook beállítása

1. Nyisd meg a [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Kattints az **Add endpoint** gombra
3. Endpoint URL:
   ```
   https://arbhhltbjovuxwvfcnni.supabase.co/functions/v1/stripe-webhook
   ```
4. Events to send — válaszd ki:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Kattints az **Add endpoint** gombra
6. Másold ki a **Signing secret** (`whsec_...`) értékét
7. Állítsd be Supabase-ben:
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```

---

## 5. Billingo beállítás

1. A Billingo Dashboard-on hozz létre egy **számlázási blokkot** (vagy használd az alapértelmezettet)
2. Jegyzd fel a `block_id` értékét
3. A `stripe-webhook/index.ts`-ben a `block_id: 0` értéket cseréld a sajátodra
4. Teszteld a számla létrehozást a Billingo Sandbox-ban

---

## 6. Teljes flow tesztelése

1. Indítsd el az Electron appot (`npm run dev`)
2. Jelentkezz be / regisztrálj
3. A Paywall-on válassz egy csomagot
4. Stripe Checkout-on használd a teszt kártyát: `4242 4242 4242 4242`
5. Ellenőrizd:
   - Supabase `subscriptions` tábla frissült (status: `active`)
   - Stripe Dashboard-on megjelent a payment/subscription
   - Billingo-ban létrejött a számla (ha be van konfigurálva)

---

## Stripe teszt kártyaszámok

| Kártya | Eredmény |
|--------|----------|
| `4242 4242 4242 4242` | Sikeres fizetés |
| `4000 0000 0000 3220` | 3D Secure szükséges |
| `4000 0000 0000 9995` | Elutasított |

Lejárat: bármilyen jövőbeli dátum. CVC: bármilyen 3 számjegy.

---

## Éles módra váltás

1. Stripe Dashboard-on kapcsolj **Live mode**-ra
2. Hozd létre az éles Price-okat (monthly/yearly/lifetime)
3. Frissítsd a Price ID-kat a `create-checkout/index.ts`-ben
4. Frissítsd a Supabase secrets-et az éles kulcsokkal
5. Hozz létre új webhook endpoint-ot Live módban
6. Billingo: kapcsolj ki sandbox módot

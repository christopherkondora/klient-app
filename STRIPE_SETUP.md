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
supabase secrets set BILLINGO_ENV=sandbox  # or "production" for live mode
```

> A `STRIPE_WEBHOOK_SECRET` értékét a 4. lépésben kapod meg.
> A `BILLINGO_ENV` alapértelmezett értéke "sandbox" (biztonság miatt). Éles módhoz állítsd "production"-re.

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

### 7.1. Hozz létre éles Price-okat

1. Stripe Dashboard-on kapcsolj **Live mode**-ra (jobb felső sarokban)
2. Navigálj: **Products** → **Add product** (vagy használd a meglévő "Klient" terméket)
3. Hozz létre 3 Price-ot:
   - **Monthly**: 3,990 HUF, recurring (monthly)
   - **Yearly**: 39,900 HUF, recurring (yearly)
   - **Lifetime**: 119,900 HUF, one-time payment
4. Másold ki mindhárom Price ID-t (pl. `price_...`)

### 7.2. Állítsd be az éles környezeti változókat

```bash
# Stripe környezet: production vagy test
supabase secrets set STRIPE_ENV=production

# Éles API kulcs (sk_live_... formátumú)
supabase secrets set STRIPE_SECRET_KEY=sk_live_...

# Éles Price ID-k
supabase secrets set STRIPE_PRICE_MONTHLY_PROD=price_...
supabase secrets set STRIPE_PRICE_YEARLY_PROD=price_...
supabase secrets set STRIPE_PRICE_LIFETIME_PROD=price_...

# Alkalmazás URL (opcionális, alapértelmezett: https://klient.work)
supabase secrets set APP_URL=https://klient.work

# Éles webhook secret (lásd 7.3. lépés)
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

### 7.3. Hozz létre éles webhook endpoint-ot

1. Stripe Dashboard → **Developers** → **Webhooks** (Live mode!)
2. **Add endpoint** → Endpoint URL:
   ```
   https://arbhhltbjovuxwvfcnni.supabase.co/functions/v1/stripe-webhook
   ```
3. Válaszd ki az eventeket (ugyanazok, mint teszt módban)
4. Másold ki a **Signing secret** (`whsec_...`) értékét
5. Állítsd be: `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`

### 7.4. Verifikáld a domain-t

Stripe Dashboard → **Settings** → **Customer emails** → **Domains**
- Add hozzá: `klient.work`
- Kövesd a verifikációs lépéseket (DNS record vagy fájl feltöltés)

### 7.5. Billingo éles mód

```bash
# Állítsd át production módba (alapértelmezett: sandbox)
supabase secrets set BILLINGO_ENV=production

# Frissítsd az éles API kulccsal
supabase secrets set BILLINGO_API_KEY=<éles_billingo_api_kulcs>
```

**Fontos:**
- A `BILLINGO_ENV=production` kapcsolja át az API endpoint-ot `api.billingo.hu`-ra
- Sandbox módban (`BILLINGO_ENV=sandbox`) az endpoint `api.sandbox.billingo.hu`
- Alapértelmezett érték: `sandbox` (biztonság miatt)
- Verifikáld a sandbox URL-t a Billingo dokumentációban, ha szükséges

### 7.6. Éles deploy

```bash
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
supabase functions deploy manage-subscription
```

### 7.7. Teszt éles kártyával (kis összeg)

1. Nyisd meg az appot
2. Válassz ki egy csomagot (akár Monthly 3,990 Ft)
3. Használj **valódi kártyát** (csak teszt célra, kisebb összeg)
4. Ellenőrizd:
   - Stripe Live Dashboard-on megjelent a payment
   - Supabase `subscriptions` tábla frissült (`status: active`)
   - Billingo számla létrejött (ha engedélyezve)
   - Alkalmazásban a paywall eltűnt

### 7.8. Visszaváltás teszt módba

Ha vissza kell váltani teszt módba (pl. további fejlesztés):

```bash
supabase secrets set STRIPE_ENV=test
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... # teszt webhook secret
```

**Megjegyzés:** Az éles Price ID-k megmaradnak az environment-ben, de csak akkor használódnak, ha `STRIPE_ENV=production`.

---

## 8. Payment Recovery Sync Tool

A `sync-stripe-subscriptions` Edge Function segít szinkronizálni a Stripe előfizetéseket az adatbázissal, ha webhook késik vagy sikertelen.

### 8.1. Deploy

```bash
supabase functions deploy sync-stripe-subscriptions
```

### 8.2. Állíts be sync secret-et

```bash
# Biztonságos random string generálása
supabase secrets set SYNC_SECRET=$(openssl rand -hex 32)
```

### 8.3. Használat

**Manuális futtatás:**

```bash
# Kérd le a sync secret-et
SYNC_SECRET=$(supabase secrets list | grep SYNC_SECRET | awk '{print $2}')

# Futtasd a sync-et
curl -X POST https://arbhhltbjovuxwvfcnni.supabase.co/functions/v1/sync-stripe-subscriptions \
  -H "Authorization: Bearer $SYNC_SECRET"
```

**Automatikus futtatás (opcionális):**

Beállíthatsz egy cron job-ot vagy scheduled function-t, hogy óránként fusson:

```bash
# Például GitHub Actions vagy Vercel Cron használatával
0 * * * * curl -X POST ... # Óránként
```

### 8.4. Mi történik a sync során?

1. Lekéri az összes előfizetést az adatbázisból, aminek van `stripe_subscription_id`-ja
2. Minden előfizetéshez lekéri a Stripe állapotot
3. Összehasonlítja a local és Stripe státuszt
4. Ha eltérés van, frissíti az adatbázist a Stripe állapot alapján
5. Ha az előfizetés nem található Stripe-ban, `expired`-re állítja

### 8.5. Mikor használd?

- **Webhook probléma**: Ha webhook nem sült el vagy késik
- **Adatbázis visszaállítás után**: Ha adatbázist visszaállítottad backup-ból
- **Rendszeres karbantartás**: Heti egyszer futtatva megelőzően javítja az eltéréseket
- **Debug**: Ha egy user azt mondja, hogy fizetett de nincs hozzáférése

### 8.6. Response példa

```json
{
  "success": true,
  "summary": {
    "total": 45,
    "updated": 2,
    "errors": 0,
    "in_sync": 43
  },
  "results": [
    {
      "user_id": "uuid",
      "local_status": "trial",
      "stripe_status": "active",
      "updated": true
    }
  ],
  "environment": "production"
}
```

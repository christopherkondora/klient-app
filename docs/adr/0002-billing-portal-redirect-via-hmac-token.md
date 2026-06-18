# Stripe Customer Portal link az emailben HMAC-signed token + billing.html oldalon keresztül megy

A dunning email nem tartalmaz közvetlenül Stripe Customer Portal session URL-t, mert az session URL-ek 5 percig érvényesek és egyszer használhatók — egy emailbe ágyazva garantáltan lejárnak, mire a user elolvassa. Ehelyett az email egy `https://klient.work/billing?token=<hmac_token>` linket tartalmaz. A klient.work `billing.html` oldal client-side JS-sel hívja a `create-billing-portal` Supabase Edge Functiont, ami validálja a tokent és friss session URL-t generál, majd a böngésző átirányít a Stripe Portalra. A token `HMAC-SHA256(user_id:stripe_customer_id:expires_at)` struktúrájú, 7 napos lejárattal, `BILLING_PORTAL_TOKEN_SECRET` Supabase secrettel aláírva.

## Considered Options

- **Előre generált Stripe session URL az emailben** — nem működik, mert 5 percen belül lejár.
- **Statikus Stripe billing portal link** — Stripe Dashboard-on konfigurálható megosztható URL; a user az email-cím megadásával hitelesíti magát. Nulla kód, de rosszabb UX (extra lépés), és nem egyértelműen Klient-branded élmény.
- **Vercel serverless function a klient.work-ön** — server-side redirect egy API route-ból. Karbantartandó Vercel function, míg a static page + Edge Function pattern illeszkedik a meglévő klient.work és Supabase infrastruktúrához.

## Consequences

- A `create-billing-portal` Edge Function kétféle auth-ot kezel: Bearer JWT-t (app-ból indított portal) és HMAC URL tokent (emailből induló portal).
- A `BILLING_PORTAL_TOKEN_SECRET` értéket Supabase secretbe kell felvenni és soha nem kerülhet kliensbe.
- A `billing.html` oldalt fel kell venni a klient.work `vite.config.js` rollupOptions input-jaiba.

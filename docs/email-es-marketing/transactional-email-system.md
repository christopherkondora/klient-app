# Tranzakcios email rendszer

## Kiindulo allapot

A `base.md` es a `context.md` alapjan a Klient jelenleg eles Stripe fizetesre van allitva. A sikeres elso checkout utan a `stripe-webhook` aktivalja az elofizetest es Billingo szamlat keszit, de korabban nem hivta meg a Billingo email kuldesi endpointjat. A megujulo havi/eves Stripe terhelesekhez sem volt kulon Billingo szamlazas + email flow.

Az auth email sablonok kulon csatornan mennek Supabase Authon keresztul:

- regisztracios megerosites: `email-templates/confirm-signup.html`
- jelszo visszaallitas: `email-templates/reset-password.html`

Az elofizeteshez kotott szamla emailt elso korben Billingo kuldi, mert ez a legkisebb deliverability es compliance kockazatu megoldas: a hivatalos szamlazo rendszer kuldi ki a szamlat.

## MVP dontesek

1. Sikeres elso Stripe Checkout utan Billingo szamla keszul, majd a webhook meghivja a Billingo `POST /documents/{id}/send` endpointot.
2. Sikeres megujulo Stripe subscription terhelesnel (`invoice.paid` / `invoice.payment_succeeded`, `billing_reason=subscription_cycle`) ugyanigy Billingo szamla keszul es emailben kimegy.
3. Stripe webhook retry es parhuzamos sikeres invoice eventek ellen kulon Supabase tabla naplozza az esemenyeket, hogy ugyanarra az eventre vagy Stripe invoice-ra ne keszuljon duplikalt szamla.
4. Sikertelen Stripe fizetesnel a jelenlegi flow egyelore csak `past_due` allapotot allit. Sajatos dunning emailhez kesobb kulso email szolgaltato kell.
5. Lemondas/ujraaktivalas visszaigazolo app-emailje szinten kesobbi sajat email szolgaltatos fazis.

## Erintett Stripe esemenyek

A Stripe webhook endpointon ezek kellenek:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `payment_intent.succeeded`

A megujulo szamlazas csak akkor fut, ha a Stripe invoice `billing_reason` erteke `subscription_cycle`. Igy az elso subscription invoice nem duplikalja a `checkout.session.completed` agban mar letrehozott Billingo szamlat.

## Adatbazis

Uj tabla: `public.subscription_billing_events`.

Celja:

- Stripe event idempotencia (`stripe_event_id` unique)
- Stripe invoice idempotencia (`stripe_invoice_id` partial unique index)
- Billingo szamla azonosito naplozasa
- Billingo email kuldes eredmenyenek naplozasa
- hibas esemenyek kesobbi visszakereshetosege

Fontos mezok:

- `stripe_event_id`
- `stripe_event_type`
- `stripe_invoice_id`
- `stripe_checkout_session_id`
- `stripe_subscription_id`
- `user_id`
- `module` (`klient` vagy `ads`)
- `plan`
- `customer_email`
- `billingo_invoice_id`
- `billingo_partner_id`
- `billingo_email_sent`
- `billingo_email_error`
- `status` (`processing`, `processed`, `skipped`, `failed`)

## Kovetkezo fazis

Sajat tranzakcios email szolgaltato akkor kell, ha nem csak szamla emailt akarunk kuldeni, hanem Klient brandelt app emaileket is:

- sikeres elofizetes visszaigazolas
- sikertelen fizetes/dunning
- lemondas visszaigazolas
- idoszak vege elotti emlekezteto
- trial vege elotti email
- marketing/onboarding email sorozat

Ehhez javasolt kulso szolgaltato: Resend vagy Postmark. A kulcs Supabase secret legyen, nem desktop app config.

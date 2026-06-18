# Resend email küldés a stripe-webhook Edge Functionben van

A Klient-branded tranzakciós emaileket (welcome, renewal, dunning) a `stripe-webhook` Supabase Edge Function küldi Resend-en keresztül, nem egy önálló `send-email` Edge Function. A webhook már ismeri az összes szükséges adatot (plan, customerEmail, userId, event típus), így egy külön függvény csak extra HTTP hop-ot és extra deploy-felületet adna hozzá valódi izolációs előny nélkül.

## Considered Options

- **Önálló `send-email` Edge Function** — a stripe-webhook meghívja, a logika szétválik. Elvileg tisztább szétválasztás, de a két függvény szorosan csatolt marad (azonos adatokat használnak), és az extra indirekcó hibakeresést nehezít.

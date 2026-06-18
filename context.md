# Klient – AI Context File

> Minden új session elején töltsd be ezt a fájlt. Minden kódmódosítás után frissíteni kell.

## Projekt leírás

**Klient** egy magyar nyelvű, Electron asztali alkalmazás szabadúszók és kisvállalkozások számára. Projektek, ügyfelek, számlázás, szerződések, naptár, jegyzetek, hangfelvételek, fájlok és adózás kezelése egyetlen appban. Két magyar számlázó szolgáltatóval integrálódik (Billingo, Számlázz.hu), Stripe előfizetéssel és Supabase auth/edge functions háttérrel.

## Domain nyelv - felvételek

**Ügyfélhívás**: Ügyfélhez kötött, alapértelmezetten kétszereplős beszélgetés a felhasználó és az ügyfél között.
_Kerüld_: általános meeting, meeting transcription

**Belső megbeszélés**: Ügyfélhez nem kötött céges/csapatbeszélgetés, amely külön felvételi use case-ként kezelendő.
_Kerüld_: ügyfélhívás

**Beszélő**: Egy diarizációval elkülönített résztvevő, akinek a szerepe vagy neve automatikusan javasolható, de felhasználó által pontosítható.
_Kerüld_: speaker, szereplő

### Felvételi kapcsolatok

- Az **Ügyfélhívás** alapértelmezetten 2 **Beszélőből** áll: a felhasználóból és az ügyfélből.
- Az **Ügyfélhívás** indítása előtt a felhasználó megadhatja a várt **Beszélők** számát; 2 az alapértelmezett.
- A **Belső megbeszélés** nem az **Ügyfélhívás** speciális esete, hanem későbbi külön felvételi use case.
- A **Felvételek** belépési pontja a jobb alsó utility railből nyíló, elhomályosított háttér fölötti panel; nem sidebar menüpont és nem teljes képernyős oldal.
- A Dashboard headerben lévő gyors felvétel nem marad elsődleges felvételi belépési pont.
- A **Felvételek** panel elsődleges nézete az új felvétel indítása; az ügyfél választása opcionális, hogy **Belső megbeszélés** is rögzíthető legyen.
- A felvételek elsődleges felhasználói értéke az AI összefoglaló; a teljes átirat ellenőrzési, keresési és audit célú másodlagos nézet.
- A teljes átirat nem hosszú inline görgetős blokk, hanem az összefoglalóhoz hasonlóan külön megnyitható, strukturált nézet.
- A speaker-tagolt átirat elsődleges célja a jobb AI összefoglaló; első körben csak könnyű beszélőnév/szerep ellenőrzést és javítást igényel, nem teljes CRM-memória rendszert.
- Felvétel előtt csak az elvárt **Beszélők** számát kell megadni; beszélőneveket/szerepeket a feldolgozás után lehet pontosítani, mert előtte lassítaná és zavarná a gyors indítást.
- A felvétel feldolgozása automatikus: diarizáció, beszélő-szerep javaslat és összefoglaló készül; ha a szerep-hozzárendelés bizonytalan, a felvétel review státuszt kap, és az összefoglaló újragenerálható javítás után.
- **Ügyfélhívásnál** a summary automatikusan készülhet a javasolt `Te`/`Ügyfél` szerepekkel; **Belső megbeszélésnél** a summary előtt a felhasználó hozzárendeli a neveket a beszélőkhöz.
- **Belső megbeszélésnél** a beszélők elnevezése ajánlott, de nem hard-blocker; a review UI beszélőnként mutasson rövid mintamondatot, hogy gyorsan azonosítható legyen ki beszélt.
- Első verziós review triggerek: az elvárt és talált beszélőszám eltér, az AI szerep-hozzárendelés confidence értéke `medium` vagy `low`, vagy nincs ügyfél kiválasztva egy ügyfélhívásként címkézett felvételhez.
- A speaker-tagolt felvételek első implementációja ElevenLabs Scribe v2-re épül; Soniox későbbi migrációs lehetőség, de jelenleg az API előfizetési kötelezettség miatt nem első verziós opció.
- A felvételek feldolgozási állapota explicit státusz, nem a `transcription` és `ai_summary` mezők meglétéből következtetett állapot; első státuszok: `recorded`, `transcribing`, `summarizing`, `ready`, `needs_review`, `failed`.
- A beszélő-szerep hozzárendelés külön Supabase Edge Function felelősség (`assign-recording-speakers`), nem a meglévő summary prompt része; a summary már címkézett/tagolt transcriptből készül.
- A beszélő-szerep hozzárendelés minimális kontextust kap: diarizált szegmensek, elvárt beszélőszám, felvételtípus, ügyfélhívásnál ügyfél/user név vagy cégnév; nem kap teljes ügyféladatlapot, számlázási adatokat, jegyzeteket vagy projektelőzményt.

---

## Tech Stack

| Réteg | Technológia | Verzió |
|-------|------------|--------|
| Runtime | Electron | 41 |
| Frontend | React | 19 |
| Language | TypeScript | 5.9 |
| Bundler | Vite | 7.3 |
| CSS | Tailwind CSS | 4.2 |
| DB | sql.js (SQLite) | – |
| Auth/Backend | Supabase | – |
| Payment | Stripe | – |
| Invoicing | Billingo API v3, Számlázz.hu XML API | – |
| Speech | ElevenLabs Scribe v2 (WebSocket + HTTP) | – |
| PDF | pdf-lib | – |
| Rich Text | TipTap | – |
| Fonts | Space Grotesk (heading), Red Hat Display (body) | – |

---

## Mappastruktúra

```
Klient/
├── electron/                     # Electron main process
│   ├── main.ts                   # App lifecycle, window, tray, ElevenLabs Scribe WS, auto-updater
│   ├── preload.ts                # contextBridge – 90+ IPC method exposed to renderer
│   ├── database.ts               # sql.js SQLite init, migrations, user-scoped DB
│   ├── db-helpers.ts             # Generic CRUD helpers (getAll, getById, create, update, delete)
│   ├── ipc.ts                    # 60+ ipcMain handlers (CRUD, billing, files, speech, tax, stb.)
│   ├── supabase.ts               # Supabase client, file-based auth persistence
│   ├── billing-store.ts          # safeStorage encrypted API key storage
│   ├── contract-templates.ts     # 3 magyar szerződés sablon (megbízási, vállalkozási, NDA)
│   ├── pdf-generator.ts          # pdf-lib contract PDF generation
│   ├── tax-service.ts            # 6 magyar adónem kalkuláció (KATA, KIVA, ÁFA, stb.)
│   ├── tax-service.test.ts       # Tax service unit tests│   ├── ads-store.ts              # safeStorage encrypted Google Ads credentials
│   ├── ads-auth.ts               # OAuth2 PKCE flow, loopback redirect, token refresh
│   ├── ads-api.ts                # google-ads-api wrapper, GAQL queries (12 fetch fn)
│   ├── ads-sync.ts               # 6h sync, incremental + full + campaign-type-specific detail sync
│   ├── ads-ai.ts                 # Context builder → Supabase edge function call
│   ├── ads-alerts.ts             # Rule-based anomaly detection (7 campaign + 3 account rules), post-sync
│   └── billing/
│       ├── billing-service.ts    # Unified billing orchestrator (provider detection, invoice flow)
│       ├── billingo-adapter.ts   # Billingo REST API adapter
│       ├── szamlazz-adapter.ts   # Számlázz.hu XML API adapter
│       └── sync-service.ts       # 30 perces invoice status polling
│
├── src/                          # React renderer process
│   ├── App.tsx                   # HashRouter, routes, Layout, context providers
│   ├── main.tsx                  # React entry point
│   ├── index.css                 # Tailwind + theme CSS variables + global styles
│   ├── vite-env.d.ts             # window.api type declarations (90+ methods, ExtractedExpense)
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx         # KPI kártyák, naptár, shortcutok, jegyzetek
│   │   ├── Clients.tsx           # Ügyféllista + CRUD
│   │   ├── ClientDetail.tsx      # Ügyfél részletek, projektek, számlák, jegyzetek, fájlok
│   │   ├── Projects.tsx          # Projektlista + szűrők
│   │   ├── ProjectDetail.tsx     # Projekt részletek, óra tracking, számlák, jegyzetek
│   │   ├── Calendar.tsx          # Heti/havi naptár, drag-drop események
│   │   ├── Finances.tsx          # Bevétel/kiadás, számlák, grafikonok, adó kalkulátor, extra costs
│   │   ├── Notes.tsx             # Globális jegyzetek (TipTap editor, képek)
│   │   ├── Recordings.tsx        # Hangfelvétel + ElevenLabs Scribe v2 átirás + AI összefoglaló (MarkdownSummary)
│   │   ├── Files.tsx             # Fájlkezelő (Explorer-szerű, drag-out, OS clipboard, rubber-band)
│   │   ├── Shortcuts.tsx         # Gyorslinkek kezelése
│   │   ├── Team.tsx              # Csapattagok, hozzárendelés projektekhez
│   │   ├── Settings.tsx          # Felhasználói beállítások, téma, számlázó konfig
│   │   ├── Onboarding.tsx        # Első belépés wizard
│   │   ├── PaymentSuccess.tsx    # Stripe fizetés sikeres
│   │   ├── PaymentCancel.tsx     # Stripe fizetés megszakítva
│   │   ├── AdsOverview.tsx       # Google Ads áttekintés oldal: KPI, alert banner, AI elemzés, account selector
│   │   ├── AdsCampaigns.tsx      # Google Ads kampánylista
│   │   ├── AdsCampaignDetail.tsx # Kampány részletező oldal
│   │   ├── AdsAlerts.tsx         # Ads riasztások oldal
│   │   ├── AdsAiPage.tsx         # Ads AI elemzések oldal
│   │   └── AdsSettings.tsx       # Ads beállítások és account linking
│   │
│   ├── components/
│   │   ├── Layout.tsx            # Sidebar + TitleBar + tartalom wrapper
│   │   ├── Sidebar.tsx           # Navigáció, aktív route kiemelés
│   │   ├── TitleBar.tsx          # Custom title bar (minimize/maximize/close)
│   │   ├── ConfirmDialog.tsx     # Újrahasználható megerősítő dialog
│   │   ├── DatePicker.tsx        # Egyedi dátumválasztó
│   │   ├── TimePicker.tsx        # Egyedi időválasztó
│   │   ├── HexColorPicker.tsx    # Színválasztó hex értékkel
│   │   ├── Paywall.tsx           # Előfizetési paywall
│   │   ├── TrialBanner.tsx       # Próbaidő visszaszámláló banner
│   │   ├── UpdateBanner.tsx      # App frissítés banner
│   │   ├── NotesPanel.tsx        # TipTap rich text editor panel
│   │   ├── ResizableImage.tsx    # TipTap image node view (resize handles)
│   │   ├── ResizableImageExtension.ts # TipTap extension
│   │   ├── InvoiceGenerateModal.tsx   # Számla generálás modal (Billingo/Számlázz.hu)
│   │   ├── InvoiceUploadModal.tsx     # Manuális számla feltöltés
│   │   ├── InvoicePdfViewer.tsx       # PDF előnézet
│   │   ├── SttDisclaimerModal.tsx     # STT disclaimer popup ("ne jelenjen meg" checkbox, localStorage)
│   │   ├── MarkdownSummary.tsx        # react-markdown alapú AI összefoglaló megjelenítő + stripMarkdown util
│   │   ├── ManualRevenueModal.tsx     # Kézi bevétel rögzítés
│   │   ├── ExpenseModal.tsx           # Kiadás hozzáadás/szerkesztés (AI PDF extraction + extra cost)
│   │   ├── ContractGenerateModal.tsx  # Szerződés generálás modal
│   │   ├── Pagination.tsx             # Újrahasználható lapozó (25/oldal, billentyű nav, ellipszis)
│   │   ├── AdsAccountSelector.tsx     # Ads account selector ügyfélnévvel, portal dropdownnal
│   │   ├── SearchCampaignDetail.tsx   # Search kampány 4 tab (Kulcsszavak, Hirdetésszövegek, Keresési kif., Negatív kw)
│   │   └── PMaxCampaignDetail.tsx     # PMax kampány 5 tab (Csatorna, Asset groupok, Asset minősítés, Termékek, Elhelyezések)
│   │
│   ├── contexts/
│   │   ├── AuthContext.tsx       # Supabase auth state, login/logout/register
│   │   ├── SubscriptionContext.tsx # Trial/paid/lifetime state, feature gating
│   │   ├── ThemeContext.tsx      # 4 téma: dark (default), light, teal-ocean, ash-soft
│   │   └── AdsContext.tsx        # Ads accounts, campaigns, metrics, syncStatus state
│   │
│   ├── types/
│   │   ├── index.ts              # Összes interface (Client, Project, Invoice, Note, stb.)
│   │   ├── tax.ts                # Tax-specifikus típusok
│   │   └── ads.ts                # AdsAccount, AdsCampaign, AdsKeyword, AdsMetricsSummary stb.
│   │
│   └── utils/
│       ├── colors.ts             # Brand színek + segédfüggvények
│       └── shortcutIcons.tsx     # Shortcut ikon komponensek
│
│   └── components/
│       ├── AdsAccountConnect.tsx  # Google Ads fiók összekapcsolás
│       ├── AdsCampaignView.tsx    # Kampány nézet: header+chart (közös) → típus alapján route Search/PMax
│       └── AdsAiPanel.tsx         # AI elemzés panel (dropdown menu + A5 document viewer)
│
├── shared/                       # Közös domain modulok (sem electron, sem react import)
│   ├── invoice-scenario.ts       # Számla szcenárió: ÁFA szabályok, vatCode, záradék
│   └── types/                    # Domain típusok (Client, Project, Invoice…)
│       └── client.ts             # Client interface (renderer + electron közös)
│
├── electron/stores/              # Per-domain SQLite store-ok (factory pattern)
│   └── clients-store.ts          # Clients tábla domain-tipizált CRUD felülete
│
├── src/view-models/              # Renderer-szintű adat-orchestráció (page-szintű)
│   └── dashboard-view-model.ts   # Dashboard load logika tiszta async fn-ekben
│
├── supabase/                     # Supabase Edge Functions + migrations
│   └── functions/ads-analyze/    # Claude API edge function (AI elemzés)
├── scripts/                      # Build/deploy scriptek
├── email-templates/              # Email sablonok
├── assets/                       # App ikonok, képek
├── docs/                         # Dokumentáció
└── skills/                       # AI skill fájlok
```

---

## Brand & Témák

**Színek:** ink `#01161E`, teal `#124559`, steel `#598392`, ash `#AEC3B0`, cream `#EFF6E0`

**Témák (CSS változókkal):**
- `dark` – Alapértelmezett, sötét háttér
- `light` – Világos mód
- `teal-ocean` – Teal dominanciájú
- `ash-soft` – Lágy zöldes-szürke

---

## Adatbázis

**Típus:** sql.js (SQLite, WASM), felhasználónkénti fájl: `{userData}/klient-{userId}.db`

### Táblák

| Tábla | Leírás |
|-------|--------|
| `clients` | Ügyfelek (név, email, cím, adószám, szín) |
| `projects` | Projektek (ügyfélhez kötve, státusz, órabecslés, prioritás) |
| `calendar_events` | Naptár események (work/meeting/deadline/reminder/other) |
| `notes` | Jegyzetek (projekthez/ügyfélhez, pinned, reminder, TipTap HTML) |
| `recordings` | Hangfelvételek (fájl útvonal, átirás, AI összefoglaló) |
| `invoices` | Számlák (provider, provider_invoice_id, status: pending/paid/overdue/cancelled) |
| `contracts` | Szerződések (PDF fájl útvonal) |
| `expenses` | Kiadások (subscription/investment, monthly/yearly/one-time, extra_amount, extra_description) |
| `shortcuts` | Gyorslinkek |
| `user_settings` | Felhasználó beállítások (cég, adószám, téma, számlázó platform) |
| `team_members` | Csapattagok (employee/contractor/freelancer) |
| `project_assignments` | Projekt–csapattag összerendelés |
| `tax_business_types` | Adónem típusok (KATA, KIVA, ÁFA, stb.) |
| `tax_rules` | Adószabályok (típus + év + %) |
| `tax_eligibility_criteria` | Adónem jogosultsági feltételek |
| `tax_calculations` | Számított adók történet |
| `user_tax_settings` | Felhasználó aktív adóneme |
| `ads_accounts` | Összekapcsolt Google Ads fiókok (customer_id, refresh_token_encrypted) |
| `ads_campaigns` | Kampány struktúra (id, name, type, status, budget) |
| `ads_ad_groups` | Hirdetéscsoportok |
| `ads_keywords` | Kulcsszavak + Quality Score (3 komponens) |
| `ads_daily_metrics` | Denormalizált napi metrikák (entity_type + entity_id, indexelt) |
| `ads_sync_log` | Szinkronizáció történet |
| `ads_ai_analyses` | AI elemzések archívum |
| `ads_knowledge_base` | Felhasználó saját AI tudásbázis |
| `ads_alerts` | Riasztások (severity, type, metric, currentValue, previousValue, changePercent) |
| `ads_ad_group_ads` | Hirdetésszövegek (RSA headlines/descriptions JSON, metrikkák) |
| `ads_negative_keywords` | Negatív kulcsszavak (campaign szintű) |
| `ads_asset_groups` | PMax asset csoportok (ad_strength, metrikkák) |
| `ads_asset_group_assets` | PMax assetek (field_type, performance_label: BEST/GOOD/LOW/LEARNING) |
| `ads_shopping_performance` | Termék teljesítmény (product_title, ROAS) |
| `ads_placements` | Elhelyezések (display_name, target_url, placement_type) |

### Fontosabb mezők

- `invoices.status`: `pending` | `paid` | `overdue` | `cancelled`
- `invoices.type`: `invoice` (provider-ből) | `manual` (feltöltött)
- `invoices.amount`: Bruttó összeg (REAL) – **NEM `gross_total`!**
- `projects.status`: `active` | `completed` | `on_hold` | `cancelled`
- `expenses.type`: `subscription` | `investment`
- `expenses.frequency`: `monthly` | `yearly` | `one-time`
- `expenses.extra_amount`: Előfizetésen felüli plusz költség (pl. GitHub Copilot Usage) (REAL, nullable)
- `expenses.extra_description`: Plusz költség leírása (TEXT, nullable)

---

## IPC Handler-ek (50+)

Az IPC rendszer `db:` prefixű handler-ekkel működik, a `preload.ts` bridge-eli a renderer felé.

| Domain | Handler-ek |
|--------|-----------|
| **Auth** | `db:user:get`, `login`, `logout`, `register`, `changePassword`, `resetPassword`, `checkEmailConfirmed`, `googleAuth`, `update` |
| **Subscription** | `db:subscription:get`, `checkout`, `cancel`, `reactivate` |
| **Clients** | `db:clients:getAll`, `get`, `create`, `update`, `delete` |
| **Projects** | `db:projects:getAll`, `get`, `create`, `update`, `delete`, `close`, `markPaid`, `completedHours` |
| **Calendar** | `db:calendar:getAll`, `create`, `update`, `delete` |
| **Notes** | `db:notes:getAll`, `create`, `update`, `delete`, `getReminders` |
| **Recordings** | `db:recordings:getAll`, `create`, `update`, `delete` |
| **Shortcuts** | `db:shortcuts:getAll`, `create`, `update`, `delete` |
| **Contracts** | `db:contracts:getTemplates`, `getAll`, `generate`, `delete` |
| **Invoices** | `db:invoices:getAll`, `getByClient`, `create`, `update`, `delete`, `nextNumber` |
| **Finance** | `db:finance:stats`, `monthlyRevenue`, `enhanced` |
| **Expenses** | `db:expenses:getAll`, `create`, `update`, `delete`, `expenses:extract` (AI PDF) |
| **Dashboard** | `db:dashboard:stats`, `todayNotes`, `upcomingDeadlines` |
| **Team** | `db:team:getAll`, `get`, `create`, `update`, `delete`, `getProjectAssignments`, `getMemberAssignments`, `assignToProject`, `unassignFromProject` |
| **Tax** | `db:tax:getBusinessTypes`, `getRules`, `checkEligibility`, `calculate`, `getAvailableTypes`, `getUserSettings`, `setUserSettings`, `getCalculationHistory` |
| **Billing config** | `billing:set-config`, `get-config`, `test-connection`, `clear-config` |
| **Billingo** | `billing:billingo:get-blocks`, `get-banks`, `ensure-partner`, `create-invoice`, `get-pdf`, `ensure-invoice-pdf`, `cancel`, `get-status` |
| **Számlázz.hu** | `billing:szamlazz:create-invoice`, `get-by-external-id`, `cancel` |
| **Unified billing** | `billing:get-active-provider`, `create-invoice`, `mark-invoice-paid`, `sync-invoices`, `get-last-sync-time` |
| **Files** | `files:getRoot`, `list`, `createFolder`, `rename`, `delete`, `openInExplorer`, `openFile`, `readFile`, `ensureClientFolder`, `ensureProjectFolder`, `saveToClientInvoices`, `renameFolder`, `copyFiles`, `selectFiles`, `selectFolder`, `moveFiles`, `duplicate`, `getAbsolutePath`, `startDrag`, `copyToClipboard` |
| **Window** | `window-minimize`, `window-maximize`, `window-close`, `window-is-maximized`, `update:install` |
| **Speech** | `speech:startStream`, `sendAudio`, `stopStream`, `recordings:transcribe`, `recordings:summarize`, `invoices:extract` |
| **Exchange** | `exchange:getRate` |
| **Ads Auth** | `ads:save-credentials`, `ads:start-oauth`, `ads:list-accounts`, `ads:connect-account`, `ads:disconnect-account`, `ads:get-accounts` |
| **Ads Sync** | `ads:sync-account`, `ads:sync-all`, `ads:get-sync-log`, `ads:get-last-sync` |
| **Ads Data** | `ads:get-campaigns`, `ads:get-campaign-detail`, `ads:get-keywords`, `ads:get-metrics`, `ads:get-search-terms` |
| **Ads Detail** | `ads:get-ad-group-ads`, `ads:get-negative-keywords`, `ads:get-asset-groups`, `ads:get-asset-group-assets`, `ads:get-shopping-performance`, `ads:get-placements`, `ads:get-keywords-with-metrics` |
| **Ads Alerts** | `ads:get-alerts`, `ads:dismiss-alert`, `ads:get-alert-count` |
| **Ads AI** | `ads:run-analysis`, `ads:get-analyses`, `ads:get-analysis` |
| **Ads KB** | `ads:kb-create`, `ads:kb-getAll`, `ads:kb-update`, `ads:kb-delete` |

---

## Integrációk

### Billingo API v3
- **URL:** `https://api.billingo.hu/v3`
- **Auth:** `X-API-KEY` header (safeStorage-ból)
- **Funkciók:** Partner kezelés, számla létrehozás, PDF letöltés (202 retry), storno (`POST /documents/{id}/cancel` üres body-val), fizetés jelölés, email küldés (`POST /documents/{id}/send`)
- **Rate limit:** 429-re 3x retry, 3 sec delay
- **Storno response:** `{ id, invoice_number, gross_total, type: "cancellation" }`
- **Fontos:** Billingónál nincs külön sandbox URL; mindig `https://api.billingo.hu/v3` használandó. Teszt/éles működést az API kulcs és block ID dönti el.
- **PDF recovery:** `billing:ensure-invoice-pdf` ellenőrzi a mentett PDF útvonalat; hiányzó vagy Windows-unsafe útvonal esetén újraletölti Billingóból, biztonságos `Files/{ClientName}/Szamlak/` mappába menti, és frissíti az `invoices.file_path` mezőt.

### Számlázz.hu XML API
- **URL:** `https://www.szamlazz.hu/szamla/`
- **Auth:** `szamlaagentkulcs` XML mezőben (safeStorage-ból)
- **Formátum:** Multipart/form-data XML request, HTTP header + PDF response
- **Funkciók:** Számla létrehozás (`xmlagentxmlfile`), storno (`szamla_agent_st`), fizetés (`szamla_agent_kifiz`), lekérdezés external ID-vel
- **Automatikus email:** `eszamla: true` + vevő email → automatikusan küld

### Supabase
- **URL:** `https://arbhhltbjovuxwvfcnni.supabase.co`
- **Auth:** Email/password + Google OAuth (PKCE), file-based session persistence
- **Edge Functions:** `get-elevenlabs-key`, `get-deepgram-key` (deprecated, megtartva rollback-hez), `summarize`, `invoice-extract`, `expense-extract`, `create-checkout`, `manage-subscription`, `stripe-webhook`, `sync-stripe-subscriptions`, `transcribe` (mind `--no-verify-jwt`)
- **RPC:** `expire_subscription(p_user_id)`
- **Tábla:** `subscriptions` (status, trial_ends_at, current_period_end)

### Stripe
- **Via Supabase Edge Functions:** `create-checkout` (Monthly/Yearly/Lifetime), `manage-subscription`, `create-billing-portal`
- **Webhook:** Supabase-ben kezelve, `subscriptions` táblát frissíti
- **Aktuális Supabase secrets állapot (2026-05-03):** `STRIPE_ENV=production`, production price secret-ek beállítva, `create-checkout` és `stripe-webhook` Edge Function aktív.
- **Billingo webhook állapot:** `BILLINGO_BLOCK_ID=315117` (production block), a beállított Billingo API kulcs nem egyezik a korábbi dokumentált tesztkulccsal. `BILLINGO_ENV` jelenleg `sandbox`, de a kódban csak logolásra szolgál; érdemes `production`-re igazítani, hogy ne legyen félrevezető.
- **Előfizetéses számla email flow:** a Stripe webhook sikeres első checkout után Billingo számlát hoz létre és meghívja a Billingo `POST /documents/{id}/send` endpointot. Megújuló Stripe terheléseknél az `invoice.paid` / `invoice.payment_succeeded` ág csak `billing_reason=subscription_cycle` esetén készít és küld Billingo számlát. Az idempotenciát a Supabase `subscription_billing_events` tábla adja `stripe_event_id` és `stripe_invoice_id` alapján.
- **Customer Portal:** Stripe Dashboard-on konfigurált, kártyaadatok és fizetési módszer kezelésére. Session URL generálás: `create-billing-portal` Edge Function (app-ból Bearer JWT-vel, emailből HMAC tokennel). `return_url`: `https://klient.work/subscription`.

### Resend
- **Cél:** Klient-branded tranzakciós emailek küldése (nem számla — az Billingo dolga)
- **Feladó:** `Kristóf a Klient-től <hello@klient.work>`
- **API kulcs:** Supabase secret `RESEND_API_KEY`
- **Küldés helye:** `stripe-webhook` Edge Function, a Billingo hívások mellé építve
- **Email típusok:**
  - **Welcome Email** — első sikeres havi/éves előfizetésnél (`checkout.session.completed`, plan≠lifetime)
  - **Lifetime Welcome Email** — lifetime vásárlásnál (`checkout.session.completed`, plan=lifetime); külön, speciális szöveg
  - **Renewal Notification** — csak éves megújulásnál (`invoice.paid`, `billing_reason=subscription_cycle`, plan=yearly)
  - **Dunning Email** — sikertelen fizetésnél (`invoice.payment_failed`); stripe_invoice_id alapján idempotens, max 1 email/invoice
- **Nyomkövetés:** `subscription_billing_events` tábla, új mezők: `resend_email_id`, `resend_email_sent`, `resend_email_error`
- **Billing Portal Redirect flow:** email tartalmaz `https://klient.work/billing?token=<hmac_token>` linket → `billing.html` oldal JS-sel hívja a `create-billing-portal` Edge Functiont → redirect a Stripe Customer Portalra. HMAC token: `HMAC-SHA256(user_id + ":" + stripe_customer_id + ":" + expires_at)`, 7 napos lejárat, secret: `BILLING_PORTAL_TOKEN_SECRET` Supabase secret.

### ElevenLabs Scribe v2
- **Real-time (Notes diktálás):** WebSocket `wss://api.elevenlabs.io/v1/speech-to-text/realtime`, auth: `xi-api-key` header, `model_id=scribe_v2_realtime`, `language_code=hun`, `commit_strategy=vad`, `audio_format=pcm_16000`
- **Batch (Recordings átirás):** HTTP `POST https://api.elevenlabs.io/v1/speech-to-text`, multipart form, `model_id=scribe_v2`, `language_code=hun`, max 3 GB, WebM/WAV/MP3/OGG/M4A/FLAC formátumok
- **Keyterms:** `számla, Billingo, NAV, KATA, KIVA, TAO, ÁFA, ügyfél, projekt, határidő, megbízási, vállalkozói, számlázz.hu, Klient, bevétel, kiadás` — mindkét pipeline-on aktív (+20% surcharge)
- **API kulcs:** Supabase secret `ELEVENLABS_API_KEY`, kiadja a `get-elevenlabs-key` Edge Function; a main process cache-eli (`cachedElevenLabsKey`)
- **AI summary:** Supabase `summarize` Edge Function (GPT-4o-mini, strukturált markdown output: `## ` szekciók, `- ` listák)

### Frankfurter
- **URL:** `https://api.frankfurter.dev`
- **Cél:** Valuta átváltás (EUR/USD→HUF kiadásoknál)

### Google Ads API
- **SDK:** `google-ads-api` (Opteo, npm)
- **API verzió:** v23.2
- **Auth:** OAuth2 PKCE + developer token
- **Lekérdezés:** GAQL (Google Ads Query Language)
- **Rate limit:** token bucket, 15 000 ops/nap (Basic Access)
- **Pénzügyi értékek:** micros / 1 000 000 konverzió

### Claude API (AI elemzéshez)
- **Via Supabase Edge Function:** `ads-analyze`
- **Model:** claude-sonnet-4-20250514
- **Input:** markdown táblázatok (metrikák) + system prompt (benchmarkok)
- **Output:** magyar nyelvű elemzés, javaslatok

---

## Google Ads AI Elemző Modul

> **Fizetős kiegészítő modul** — külön előfizetéssel érhető el, az alap app működik nélküle.

### Architektúra

| Réteg | Fájl | Leírás |
|-------|------|--------|
| Credential Store | `electron/ads-store.ts` | safeStorage (mint billing-store.ts) |
| OAuth2 | `electron/ads-auth.ts` | PKCE flow, loopback redirect, token refresh |
| API Wrapper | `electron/ads-api.ts` | Opteo `google-ads-api` npm csomag, GAQL lekérdezések |
| Sync Engine | `electron/ads-sync.ts` | node-cron 6 óránként, inkrementális + full sync |
| AI Orchestrator | `electron/ads-ai.ts` | Context készítés → Supabase edge function hívás |
| Edge Function | `supabase/functions/ads-analyze` | Claude API (Anthropic SDK), system prompt + benchmarkok |
| Típusok | `src/types/ads.ts` | AdsAccount, AdsCampaign, AdsKeyword, AdsMetricsSummary stb. |
| Context | `src/contexts/AdsContext.tsx` | accounts, campaigns, metrics, syncStatus state |
| Fő oldal | `src/pages/Ads.tsx` | Fiók lista, KPI kártyák, kampány táblázat |
| Alert System | `electron/ads-alerts.ts` | Rule-based anomaly detection, post-sync trigger |
| Komponensek | `src/components/Ads*.tsx` | AccountConnect, CampaignView, AiPanel |
| Search Detail | `src/components/SearchCampaignDetail.tsx` | 4 tab: Kulcsszavak (paginated+filtered), Hirdetésszövegek, Keresési kif., Negatív kw |
| PMax Detail | `src/components/PMaxCampaignDetail.tsx` | 5 tab: Csatorna bontás, Asset groupok, Asset minősítés, Termékek, Elhelyezések |
| Pagination | `src/components/Pagination.tsx` | Reusable, 25/page, keyboard nav |

### Kritikus szabályok

- **sql.js** adatbázis (NEM better-sqlite3)
- OAuth: **shell.openExternal()** + loopback redirect (NEM BrowserWindow)
- Credentials: **safeStorage** a main process-ben (billing-store.ts minta)
- Pénzügyi értékek: **micros / 1 000 000** konverzió
- Claude API kulcs: **Supabase edge function-ben**, NEM a desktop appban
- Az Ads modul **opcionális** — az alap app működjön nélküle
- Kampány státusz: **színes pötty** (zöld=aktív, szürke=szüneteltetve), NEM Play/Pause ikon
- Alert leírások mindig tartalmazzák az **időtávot** ("Az utóbbi 7 napban:")
- Sidebar alert badge: **kis piros pötty** (szám nélkül)
- `ads_asset_group_assets`: **nincs UNIQUE** constraint — sync előtt DELETE + INSERT
- Search terms: **live API** fetch (nem szinkronizált DB-be)
- `ads:get-keywords-with-metrics`: 4-table JOIN (keywords → ad_groups → campaigns → daily_metrics)

---

## Fő Folyamatok

### Bejelentkezés
1. React → `db:user:login` → Supabase `signInWithPassword()`
2. Sikeres → `switchDatabase(userId)` → user-specifikus SQLite init
3. `ensureLocalUser()` → `user_settings` sor létrehozás/frissítés
4. `syncService.startPolling()` → 30 perces billing szinkron indul

### Számla létrehozás
1. React → `billing:create-invoice` → `billingService.createInvoice()`
2. Provider detection → Billingo VAGY Számlázz.hu adapter
3. **Billingo:** `ensurePartner()` → `createInvoice()` → `getInvoicePdf()` (202 retry) → `sendInvoice()` (email)
4. **Számlázz.hu:** XML build → POST multipart → invoice number + PDF headerből
5. DB mentés: `invoices` tábla (provider, provider_invoice_id, provider_synced_at)
6. Return: invoice number, gross total, PDF base64

### Storno
1. React → `db:invoices:delete` → provider cancel API hívás
2. **Billingo:** `POST /documents/{id}/cancel` → storno doc + PDF letöltés
3. **Számlázz.hu:** XML cancel (`szamla_agent_st`)
4. Negatív összegű storno rekord az `invoices` táblába, eredeti `cancelled` státuszra
5. Hiba → `{ success: false, error: message }` → frontend `alert()`

### Billing szinkron
- 30 percenként lekérdezi az összes `pending` számlát a provider API-ból
- Státusz változás → DB update → `billing:sync-updated` event a renderernek

### Szerződés generálás
1. Template kiválasztás (megbízási/vállalkozási/NDA) + mezők kitöltés
2. `generateContractLines()` → szöveg összeállítás
3. `generateContractPdf()` → pdf-lib PDF
4. Mentés: `{ClientName}/Szerződések/` + `contracts` tábla rekord

### AI Kiadás feldolgozás (Expense Extract)
1. React ExpenseModal → PDF feltöltés (drag-drop vagy fájlválasztó)
2. `expenses:extract` IPC → fájl beolvasás → base64 → Supabase `expense-extract` Edge Function
3. Edge Function → OpenAI GPT-4o-mini (PDF mint `type: 'file'`) → strukturált JSON válasz
4. Visszakapott mezők: name, amount, currency, category, type, frequency, date, vendor, notes, subscription_hint, extra_amount, extra_description
5. Form automatikus kitöltés + AI prefill banner + subscription hint megjelenítés
- **Összegszabály:** az AI prompt a fizetendő bruttó végösszeget használja (`Total`, `Amount due`, `Balance due`, tax-inclusive total), nem a nettó subtotal/line item árat. Példa: 18 EUR + 27% VAT → 22.86 EUR.
- **Decimal költségbevitel:** HUF egész számra normalizál, nem-HUF pénznemeknél (EUR/USD stb.) két tizedesjegyet enged a `parseDecimalNum` / `fmtDecimalNum` helperrel.

### Fájlrendszer
- Root: `{userData}/Files/{ClientName}/{ProjectName}/`
- Auto-created: ügyfél mappa, projekt mappa, `Szamlak/`, `Szerződések/`
- Fájlnév/mappanév sanitization: `<>:"/\|?*` és control karakterek → `_`, valamint záró pont/szóköz eltávolítása. Windows alatt a trailing `.` vagy space útvonalszegmens webview/Electron `ERR_FILE_NOT_FOUND` hibát okozhat.
- **Drag-out:** `ipcMain.on` + `ipcRenderer.send` (szinkron, nem handle/invoke) → `webContents.startDrag`
- **Copy to OS clipboard:** PowerShell `Set-Clipboard -Path` (Windows) / `file://` URI (macOS/Linux)
- **Műveletek:** copy, cut, paste, duplicate, move, rename, delete, rubber-band selection

---

## Page view-modelek (`src/view-models/`)

A nagy oldal-komponensek (Dashboard ~1000 sor, Finances ~1300, ProjectDetail ~1500) eddig egyszerre voltak megjelenítők és adat-orchestrátorok. A betöltési logika — 8+ párhuzamos IPC-hívás, derived state összeállítás, sync-event reakció — a komponens body-jában élt, és csak a teljes oldal renderelésével lehetett volna tesztelni.

Az új minta: minden ilyen oldalhoz tartozik egy view-model modul (pl. `dashboard-view-model.ts`), ami **tiszta async függvényeket** exportál:

- `loadDashboardSnapshot(api: DashboardApi): Promise<DashboardSnapshot>` — egy kép a Dashboardhoz tartozó összes adatról.
- `loadCalendarSnapshot(api, view, anchor)` — a naptár-tartomány lekérése.
- `calendarRange(view, anchor)` — tiszta dátum-kalkuláció.

A `DashboardApi` interface a `window.electronAPI` vonatkozó részhalmaza, így a komponens egyszerűen `loadDashboardSnapshot(window.electronAPI)`-t hív. A teszt mock-objektumot ad át, és ellenőrzi az IPC-hívások számát, a snapshot összeállítását, a derived state-et (pl. csak az aktív projektek maradnak), és a hibautakat.

A komponens JSX-e érintetlen marad — csak a `loadData()` és `loadCalendarEvents()` belső 30-40 sora zsugorodik 5-6 sorrá.

**Migráció állapota:** Dashboard ✅. A Finances, ProjectDetail, ClientDetail page-ek még inline orchestrációt használnak. Fokozatosan migrálódnak.

---

## Per-domain stores (`electron/stores/`)

A 142 IPC handler korábban közvetlenül `db-helpers.ts`-en keresztül raw SQL-t futtatott, és nyers `Record<string, unknown>` sorokat lökött a renderer felé — a domain típusok (Client, Project, …) csak a renderer oldali `vite-env.d.ts`-ben éltek, a main process nem tudott róluk.

Az új minta: minden tábla saját store-modult kap (`clients-store.ts`, később `projects-store.ts` stb.). A store-modul **factory** (`createClientsStore({ getDb, saveDb })`), ami:

- **Domain-tipizált felületet ad** — pl. `list(): Client[]`, `byId(id): Client | null`, `create(input: ClientInput): Client`. Ezek a típusok a `shared/types/`-ban élnek, mindkét oldal innen importál.
- **A row → Client mapping a store felelőssége** — a renderer biztos lehet abban, hogy minden mező megvan és a default értékek normalizáltak.
- **Tesztben in-memory sql.js-szel hajtható** — a `getDb`/`saveDb` deps kívülről jönnek, nincs szükség az alkalmazás teljes db-állapotára.

Az IPC handlerek vékonyak: `ipcMain.handle('db:clients:getAll', () => clientsStore.list())`. Fájlrendszer mellékhatások (mappa-létrehozás, átnevezés ügyfél-rename-kor) az IPC rétegben maradnak — nem domain logika.

**Migráció állapota:** clients ✅. A többi domain (projects, invoices, expenses, calendar, notes, recordings, contracts, shortcuts, team, tax, ads…) még közvetlenül `db-helpers.ts`-t használ. Fokozatosan migrálódnak — a `db-helpers.ts` akkor törölhető, ha minden hívó áttért.

---

## Számla szcenárió (`shared/invoice-scenario.ts`)

Egyetlen igazság a magyar számlázás ÁFA-szabályaira. Bemenet: vevő országkódja, vevő EU ÁFA száma, eladó áfa-státusza (`standard | exempt`), alapértelmezett HU ÁFA kulcs, számla nyelve. Kimenet: `{ kind, vatRate, vatCode?, comment, useEuVatNumberAsTaxCode }`.

A `kind` öt eset: `hu-domestic-standard`, `hu-domestic-aam` (alanyi adómentes), `eu-b2b` (EU vevő érvényes EU VAT számmal — fordított adózás), `eu-b2c` (EU vevő VAT szám nélkül — HU 27% ÁFA), `third-country` (EU-n kívül — EUK).

Mindkét folyamat innen vezeti le az értékeit:
- `src/components/InvoiceGenerateModal.tsx` — űrlap-előnézet, vatCode/záradék mezők kitöltése.
- `electron/ipc.ts` (`resolveLocalInvoiceVatRate`) — kézi rögzített számláknál a HU ÁFA kulcs visszaállítása.

A `vatCode` értékkészlete a magyar számlázási rövidítések (AAM, EU, EUK, ATHK, …). A Billingo / Számlázz.hu adapter ezeket a saját formátumára fordítja át — a szcenárió nem ismeri a provider API-kat.

A modul tilos electron- vagy React-importot tenni, hogy mindkét oldal terhelés nélkül használhassa.

---

## Konvenciók

- **Nyelv:** Magyar UI szövegek, angol kód (változónevek, kommentek)
- **Routing:** HashRouter (`/#/dashboard`, `/#/clients/:id`, stb.)
- **State:** React context (Auth, Subscription, Theme) + lokális useState
- **IPC naming:** `domain:entity:action` (pl. `db:clients:create`, `billing:billingo:get-blocks`)
- **DB ID-k:** UUID v4 (`crypto.randomUUID()`)
- **Dátumok:** ISO string SQLite-ban, `date-fns` a formázáshoz
- **Stílus:** Tailwind utility classes, CSS változók a témákhoz
- **Típusok:** `src/types/index.ts` központi típus definíciók
- **Error handling:** IPC try/catch → `{ success: false, error }` pattern, frontend `alert()`
- **Billing keys:** safeStorage (OS-level encryption) via `billing-store.ts`
- **PDF-ek:** Base64 string-ként mozognak IPC-n keresztül

---

## Jelenlegi állapot & TODO-k

### Kész
- Teljes CRUD: ügyfelek, projektek, naptár, jegyzetek, hangfelvételek, fájlok, shortcutok, csapat, kiadások
- Billingo + Számlázz.hu integráció (létrehozás, PDF, storno, fizetés jelölés, email küldés)
- Szerződés generálás (3 sablon) + in-app PDF megjelenítő
- Adó kalkulátor (6 magyar adónem, 2026 szabályok) + adóhatáridők naptár szinkron
- Előfizetés kezelés (Stripe: Monthly/Yearly/Lifetime, trial)
- ElevenLabs Scribe v2 speech-to-text (real-time WebSocket + batch HTTP), magyar `hun` language code, Klient domain keyterms
- STT disclaimer modal (`SttDisclaimerModal`) — minden STT gomb előtt jelenik meg, localStorage "ne mutasd újra" opcióval
- AI összefoglaló markdown renderelés (`MarkdownSummary` + `stripMarkdown`), listanézeti preview szöveggé alakítva
- `summarize` Edge Function frissítve: strukturált markdown output (## szekciók + bullet listák)
- 4 téma, Pomodoro timer (átnevezés, láthatóság), Exchange rates
- AI kiadás feldolgozás (PDF → OpenAI GPT-4o-mini → form kitöltés, subscription hint)
- Előfizetésen felüli plusz költségek (extra_amount + extra_description, pl. GitHub Copilot Usage)
- Nem-HUF költségek tizedes összeggel rögzíthetők (pl. 22.86 EUR), HUF továbbra is egész számra kerekítve/normalizálva.
- Pénzügyek oldalon a költségdoboz két szekcióra bontva jelenik meg: eszközök/szolgáltatások és személyi jellegű költségek; a kártya magassága kötött, belső scrollal.
- A korábbi külön bevételi grafikon megszűnt; a jobb oldali `BEVÉTEL ÉS KÖLTSÉG` widget kombinált bevételi oszlop + költségvonal grafikont mutat. Egyetlen bevételes hónapot is renderel, és a költségpontok HTML körök, hogy ne torzuljanak SVG skálázás miatt.
- Billingo PDF megnyitás ellenőrzött: Finances, ClientDetail és ProjectDetail előbb `ensureInvoicePdf`-et hív, így hiányzó/unsafe PDF lokális útvonal Billingóból újraletölthető.
- Stripe előfizetéses Billingo email MVP: első sikeres checkout és havi/éves megújuló terhelés után Billingo számla email küldés, `subscription_billing_events` eseménynaplóval a duplikált webhook eventek és azonos Stripe invoice-ok ellen.
- Fájlkezelő: drag-out OS-re, copy-to-clipboard (PowerShell Set-Clipboard), duplicate, move, rubber-band selection
- DatePicker overflow fix, light téma amber színek

### Kész (Google Ads modul)
- Ads fiók OAuth2, kampányok, hirdetéscsoportok, kulcsszavak szinkron
- Külön Ads route-struktúra: `AdsLayout` + `AdsOverview` / `AdsCampaigns` / `AdsAlerts` / `AdsAiPage` / `AdsSettings`
- KPI kártyák (5 db: megjelenítés, kattintás, CTR, költés, konverzió; benchmark színek, info tooltip)
- Kampány táblázat (szűrők: aktív/szüneteltetve/mind, default ENABLED)
- Kampány részletes nézet: header+chart (közös) + típus alapú routing
- Search kampány: 4 tab (Kulcsszavak paginated+filter+QS dots, Hirdetésszövegek card grid, Keresési kifejezések live API, Negatív kulcsszavak chip view)
- PMax kampány: 5 tab (Csatorna bontás KPI cards, Asset groupok strength bar, Asset minősítés BEST/GOOD/LOW/LEARNING, Termékek paginated+ROAS, Elhelyezések top 50)
- Alert rendszer: 10 szabály (7 kampány + 3 fiók szintű), post-sync trigger, alert banner, dismiss, sidebar pötty
- AI elemzés panel (dropdown menu + A5 nézet)
- Sync: kampány típus szerinti detail sync (SEARCH→ads+neg kw, PMAX→asset groups+assets+shopping+placements)
- Account selector ügyfélnév-prioritással az Ads overview fejlécében

### Friss megjegyzések
- A kanonikus Klient előfizetési árak 2026-05-04-től: havi `4 990 Ft`, éves `49 900 Ft`, lifetime `149 900 Ft`; weboldal, app UI, Stripe/Billingo tesztlista és egyéb dokumentáció ezeket használja.
- A base Dashboardból az Ads widget el lett távolítva, hogy a Klient főfelület fókuszált maradjon.
- A `npm run dev` fejlesztői indulása gyorsítva lett: Electron watch build + `nodemon` restart, nincs automatikus DevTools megnyitás.
- A base polish terv UX-001 feladata elkészült: a Dashboard, Pénzügyek, Ügyfelek, Projektek, Naptár, Fájlok és Beállítások most közös `PageHeader` komponensre épülnek, egységes title/subtitle/actions ritmussal.
- A base polish terv UX-003 feladata elkészült: a shared vizuális rendszer kapott olvashatóbb secondary text tier-eket, és a Dashboard, Pénzügyek, Ügyfelek oldalakon a halk meta/helper szövegek kontrasztja emelve lett.
- A base polish terv UX-002 feladata elkészült: a sidebar shortcut blokk másodlagosabb vizuális súlyt kapott, a fő navigáció dominánsabb lett, a jobb alsó Notes/Pomodoro/Ads utility-k pedig közös railbe rendeződtek.
- A base polish terv UX-101 feladata elkészült: a Dashboard headerben az óra és a billing shortcut most közös halk utility-csoport, a Gyors felvétel pedig az egyetlen egyértelmű header action maradt.
- A base polish terv UX-102 feladata elkészült: a Dashboard most egyértelműbben különíti el a hero bevételi blokkot, az operatív mini stat support zónát és a naptár melletti "Mai fókusz" panelt.
- Az onboarding ÁFA lépése áfakörös felhasználóknál már bekéri és a tax profile-ba menti az ÁFA bevallási gyakoriságot (`havi` / `negyedeves` / `eves`), a TaxSection pedig az éves ÁFA bevallást és a 2026-os 20M Ft-os AAM limitet is következetesen jelzi.
- A Supabase regisztrációs flow javítva lett: email-megerősítésnél a signUp már nem hoz létre fél-authenticated lokális user állapotot, a login/register valódi hibaüzenetet ad, és az onboardingból újraküldhető a megerősítő email.
- A Google auth közben jelentkező `no such column: country_code` hiba javítva lett: a kliens ország/EU ÁFA mezők migrációja most a VAT backfill előtt fut le, így régebbi lokális adatbázisokon sem akad el az auth utáni DB inicializálás.
- 2026-05-03 ellenőrzés: Stripe production módban van a Supabase secrets szerint; Billingo production block ID-val fut, de `BILLINGO_ENV` logcímke még `sandbox`. Következő élesítés előtt igazítsd `production`-re. A webhook kód már tartalmaz Billingo számla email küldést és megújuló terhelés számlázást; production deploy előtt futtasd a `subscription_billing_events` migrációt, deployold újra a `stripe-webhook` functiont, és kapcsold be Stripe-ban az `invoice.paid` / `invoice.payment_succeeded` eseményeket.

### Lehetséges fejlesztések
- Lejárt számlák automatikus detekció (overdue → email emlékeztető)
- Tranzakciós app email rendszer: sikeres fizetés visszaigazolás, sikertelen fizetés/dunning, lemondás/lejárás, trial vége előtti értesítés saját email szolgáltatóval (Resend/Postmark/SendGrid). A Billingo számla email küldés első verziója már a Stripe webhookban van.
- Számlázz.hu PDF újraletöltés
- Dashboard bővítés (több widget)
- Offline mode javítás
- Export funkciók (CSV, PDF report)

---

- 2026-05-05: Page view-model minta indult — `src/view-models/dashboard-view-model.ts`. A Dashboard (1000 sor, 17 useState) betöltési logikája egy tiszta `loadDashboardSnapshot(api)` függvényben él, amit teszt mock-API-val hajtott. A komponens JSX-e érintetlen, csak a `loadData()`/`loadCalendarEvents()` 30-40 sora zsugorodott 5-6 sorrá. A Vitest config bővült: `src/**/*.test.ts` és `shared/**/*.test.ts` is felfedezésre kerül.
- 2026-05-05: Per-domain stores minta indult — `electron/stores/clients-store.ts` factory pattern alapján, in-memory sql.js teszttel. Az `db:clients:*` 5 IPC handler innen szolgálódik ki, a Client típus pedig átkerült a `shared/types/client.ts`-be (a renderer `vite-env.d.ts` `declare global`-lá szervezve, hogy az importok ne változzanak). A pattern később megy át a többi domainre.
- 2026-05-05: A számla szcenárió logika konszolidálva egy közös modulba (`shared/invoice-scenario.ts`). Korábban a renderer (`src/utils/vat.ts`) és a main (`billing-service.ts resolveVatCode`) párhuzamosan, hiányosan tartotta — pl. AAM eladó esetén az űrlap-előnézet 27%-ot mutatott, miközben a kiküldött számla AAM 0%-ot. Az új modul mindkét oldalt egyetlen igazságról szolgálja ki, és többnyelvű (hu/en/de) záradékot is tud. Egy korábbi inkonzisztencia is javítva: EU B2C esetben a régi modul "VAT-exempt" záradékot tett, miközben 27% ÁFA-val ment ki a számla — most B2C-re nincs auto-záradék.

- 2026-05-13: ElevenLabs Scribe v2 migráció — a Deepgram Nova-3 mindkét pipeline-ban (real-time WS + batch HTTP) le van cserélve ElevenLabs Scribe v2-re. A frontend (preload.ts, NotesPanel, Recordings) változatlan; a `speech:sendAudio` handler Deepgram-nél nyers bufferrel, ElevenLabs-nél JSON `{ message_type: "input_audio_chunk", audio_base_64 }` formátummal küldi az adatot. Magyar Klient domain keyterms mindkét pipeline-on aktív. Új Supabase edge function: `get-elevenlabs-key` (deployolva). `get-deepgram-key` megtartva rollback céljára.
- 2026-05-13: STT disclaimer modal hozzáadva (`src/components/SttDisclaimerModal.tsx`) — minden STT indítás előtt jelenik meg (Recordings + NotesPanel), közös localStorage kulcson (`stt_disclaimer_dismissed`) tárolja a "ne mutasd újra" döntést.
- 2026-05-13: AI összefoglaló markdown renderelés — `src/components/MarkdownSummary.tsx` (`react-markdown` + `remark-gfm`, Klient témájú stílus), `stripMarkdown()` util a listanézeti previewhoz. `summarize` Edge Function átdolgozva: strukturált `## ` szekciók és `- ` listák, nincs nyers `**` karakter a szövegben.

- 2026-05-20: Klient-branded Resend email rendszer és Stripe Customer Portal integráció. Új migráció `subscription_billing_events` Resend tracking mezőkkel (`resend_email_id`, `resend_email_sent`, `resend_email_error`). Új `create-billing-portal` Edge Function kétféle auth útvonallal (Bearer JWT az appból, HMAC token az emailből) — testable `handler.ts` + `index.ts` Deno entry split, 11 integrációs teszttel. Új `shared/hmac-token.ts` (Web Crypto, 9 unit teszt) és párhuzamos `supabase/functions/_shared/hmac-token.ts`. A `stripe-webhook` négy Resend emailt küld: Welcome (monthly/yearly), Lifetime Welcome (lifetime), Yearly Renewal (`invoice.paid` + `subscription_cycle`), Dunning (`invoice.payment_failed`) — utóbbi 7 napos HMAC-aláírt `klient.work/billing?token=` linkkel. Új klient.work oldalak: `billing.html` (token → portal redirect) és `subscription.html` (return confirmation), mindkettő a `vite.config.js` rollupOptions-ban. Settings → Előfizetés tabba új "Fizetési adatok módosítása" gomb `active`/`past_due` státusznál (lifetime/trial kivételével). Production deploy előtt szükséges manuális lépések: Stripe Customer Portal konfigurálás (`return_url=https://klient.work/subscription`), Resend `klient.work` domain hitelesítés (`hello@klient.work` sender), Supabase secrets: `RESEND_API_KEY` és `BILLING_PORTAL_TOKEN_SECRET` (32+ byte random hex).

*Utolsó frissítés: 2026-05-20*

# KLIENT Adómodul – Implementációs Terv

> **Cél:** Lépésről lépésre, checkbox-okkal követhető implementációs terv az adómodul teljes megvalósításához.
> **Szabály:** Minden fázis végén VERIFY lépés. Nem lépünk tovább amíg a verify nem PASS.

---

## Kiindulási állapot

### Meglévő elemek

| Elem | Fájl | Állapot |
|------|------|---------|
| `tax-service.ts` | `electron/tax-service.ts` | 6 kalkulátor (KIVA, AFA, AAM, ATALANYADOZAS, KFT_TAO, KATA) – hiányos |
| `tax-service.test.ts` | `electron/tax-service.test.ts` | ~800 sor, vitest |
| DB táblák | `electron/database.ts` L249-310 | `tax_business_types`, `tax_rules`, `tax_eligibility_criteria`, `tax_calculations`, `user_tax_settings` |
| Seed adatok | `electron/database.ts` L488-530 | 6 business type + 2026-os rule-ok – DE 40% átalány (kell 45%), KIVA 11% (kell 10%) |
| IPC handlerek | `electron/ipc.ts` L1563-1596 | 8 handler |
| Preload | `electron/preload.ts` L163-171 | 8 metódus |
| vite-env.d.ts | `src/vite-env.d.ts` L600-670 | window.api típusok |
| Frontend típusok | `src/types/tax.ts` | BusinessType enum, TaxRule, TaxCalcInput, TaxCalcResult |

### Hiányzó elemek

| # | Elem | Leírás |
|---|------|--------|
| H1 | `tax_parameters` tábla | Évenkénti adóparaméterek (minimálbér, kulcsok, limitek) |
| H2 | `business_profile` tábla | Felhasználó vállalkozás profil (EV/Kft/Bt, átalány/VSZJA, fő/mellék) |
| H3 | HIPA települési adatbázis | `hipa_rates` tábla HAKKA CSV-ből (~3080 település) |
| H4 | Átalányadó komplex kalkulátor | SZJA + TB (18.5%) + SZOCHO (13%) + adómentes sáv + fő/mellék + szkkép |
| H5 | VSZJA kalkulátor | Vállalkozói SZJA (valós költségek) |
| H6 | TAO komplex kalkulátor | Osztalék SZJA + SZOCHO + minimum adóalap |
| H7 | KIVA komplex kalkulátor | Személyi kifizetés alap, osztalék, beruházás |
| H8 | HIPA kalkulátor | Árbevétel + egyszerűsített + KIVA alany módszer |
| H9 | Adózás szekció UI | Pénzügyek oldalba — collapsible panel |
| H10 | Profil wizard | 5 lépéses modal |
| H11 | Naptár integráció | Adó-határidők outline stílus |
| H12 | Figyelmeztetések | AAM, átalány limit, határidők |

### 2026-os paraméterek

```
minimálbér_havi        = 322_800
garantált_bérminimum   = 373_200
minimálbér_éves        = 3_873_600
gbm_éves               = 4_478_400
átalány_limit          = 38_736_000
átalány_adómentes_sáv  = 1_936_800
szocho_plafon          = 92_966_400 (jövedelem felett nincs SZOCHO)
szja = 0.15, tb = 0.185, szocho = 0.13, tao = 0.09, kiva = 0.10
aam_limit = 20_000_000
atalany_altalanos = 0.45 (régi 40% → frissítendő!)
atalany_specialis = 0.80
atalany_kisker = 0.90 (ÚJ)
```

### KATA eltávolítandó

Nem releváns a célközönségnek. Törölnivaló: DB seed, enum, switch case, tesztek.

---

## Függőségi gráf

```
F1 (DB) → F2 (Engine) → F3 (IPC) → F4 (Wizard) ─┬→ F5 (UI)
                                                    └→ F6 (Naptár)
F7 (Tesztek): F2-től indítható, F6 után véglegesítendő
Párhuzamosítható: F4+F5; F5+F6
```

## Módosítandó fájlok

| Fájl | Művelet | Fázis |
|------|---------|-------|
| `electron/database.ts` | Mód: 3 új tábla + seed frissítés + KATA törlés | F1 |
| `electron/tax-engine.ts` | ÚJ: kalkulátor függvények | F2 |
| `electron/tax-service.ts` | Mód: KATA törlés, engine wrapper fn-ek | F2–F3 |
| `electron/tax-service.test.ts` | Mód: KATA törlés, frissítés | F7 |
| `electron/tax-engine.test.ts` | ÚJ: engine tesztek | F7 |
| `electron/ipc.ts` | Mód: 9 új handler | F3 |
| `electron/preload.ts` | Mód: 9 új metódus | F3 |
| `src/types/tax.ts` | Mód: KATA törlés, új interface-ek | F2 |
| `src/vite-env.d.ts` | Mód: API típusok | F3 |
| `src/components/TaxProfileWizard.tsx` | ÚJ: wizard modal | F4 |
| `src/components/TaxSection.tsx` | ÚJ: collapsible szekció | F5 |
| `src/pages/Finances.tsx` | Mód: TaxSection beillesztés | F5 |
| `src/pages/Calendar.tsx` | Mód: outline deadline-ok | F6 |

---

## FÁZIS 1: Adatbázis bővítés + seed frissítés

**Fájl:** `electron/database.ts`

### 1.1 — `tax_parameters` tábla létrehozása

- [ ] Tábla létrehozása az alábbi oszlopokkal:
  - `year` INTEGER UNIQUE
  - `minimalber_havi`, `garantalt_berminimum_havi`
  - `szja_kulcs`, `tb_kulcs`, `szocho_kulcs`, `tao_kulcs`, `kiva_kulcs`
  - `aam_limit`
  - `atalany_altalanos`, `atalany_specialis`, `atalany_kisker`
  - `atalany_limit_szorzo` (10), `atalany_adomentes_szorzo` (0.5)
  - `szocho_plafon_szorzo` (24)
  - `hipa_max_kulcs` (0.02)
  - `afa_standard` (0.27), `afa_reduced` (0.18), `afa_super_reduced` (0.05)
- [ ] Seed: 2026-os sor (322800, 373200, 0.15, 0.185, stb.)
- [ ] Seed: 2027-es sor (AAM 22M, átalány 50%)

### 1.2 — `business_profile` tábla létrehozása

- [ ] Tábla létrehozása az alábbi oszlopokkal:
  - `user_id` TEXT UNIQUE
  - `vallalkozas_tipus` TEXT ('EV'|'Kft'|'Bt'|'Kkt')
  - `adozas_forma` TEXT ('atalany'|'vszja'|'TAO'|'KIVA')
  - `foglalkozas` TEXT ('fofoglalkozasu'|'mellekfoglalkozasu')
  - `koltseghanyad` REAL
  - `szakkepzettseg` INTEGER (0/1)
  - `aam_valasztott` INTEGER (0/1)
  - `afa_bevallas` TEXT
  - `hipa_kulcs` REAL
  - `hipa_telepules` TEXT
  - `hipa_egyszeru` INTEGER (0/1)
  - `adoev` INTEGER
  - `beallitva` INTEGER (0/1)

### 1.3 — `hipa_rates` tábla létrehozása és HAKKA CSV betöltése

- [ ] Tábla létrehozása: `megye` TEXT, `telepules` TEXT, `kulcs` REAL, UNIQUE(megye, telepules)
- [ ] CSV beolvasás: `C:\Users\chris\Business\Klient\Helyi adók\helyi_adok_iparuzesi.csv`
  - Formátum: `Megye,Név,Adónem,Adómértékek,Adóelőnyök`
  - Rate parsing: `parseFloat("2.0000  %; ".replace(/[^0-9.]/g, ''))`
  - ~3080 sor
- [ ] Budapest manuális hozzáadás (hiányzik a CSV-ből): `Budapest, Budapest, 2.0`

### 1.4 — Seed frissítések

- [ ] UPDATE átalány 40% → 45%: `tr-atal-gen-2026` rule
- [ ] INSERT 90% kisker átalány: `tr-atal-kisker-2026`
- [ ] UPDATE KIVA 11% → 10%: `tr-kiva-2026`
- [ ] KIVA eligibility frissítés: 6Mrd belépés, 100 fő
- [ ] DELETE KATA minden táblából (tax_business_types, tax_rules, tax_eligibility_criteria)

### ✅ VERIFY F1

- [ ] `tax_parameters`: 2 sor (2026, 2027)
- [ ] `business_profile` tábla létezik
- [ ] `hipa_rates`: 3080+ sor + Budapest benne van
- [ ] `tr-atal-gen-2026` rule rate = 45.0
- [ ] KATA törölve mindenhonnan
- [ ] App hiba nélkül elindul (`npm run dev`)

---

## FÁZIS 2: Tax engine újraírás

### 2.1 — Típusok bővítés (`src/types/tax.ts`)

- [ ] KATA eltávolítása a `BusinessType` enumból
- [ ] Új interface: `TaxParameters` (DB tábla tükör)
- [ ] Új interface: `BusinessProfile` (DB tábla tükör)
- [ ] Új interface: `AtalanyadoResult` (szja, tb, szocho, adómentesSáv, járulékAlap, összesen)
- [ ] Új interface: `VszjaResult` (vallSzja, kivet, szja, tb, szocho, összesen)
- [ ] Új interface: `TaoResult` (tao, osztalekSzja, osztalekSzocho, összesen)
- [ ] Új interface: `KivaResult` (alap, kiva, összesen)
- [ ] Új interface: `HipaResult` (alap, kulcs, összeg, egyszerusitett)
- [ ] Új interface: `TaxEstimate` (összesítés profil alapján, negyedéves bontással)
- [ ] Új interface: `QuarterBreakdown` (negyedéves részletezés)
- [ ] Új interface: `TaxWarning` (type, severity, message)
- [ ] Új interface: `HipaRate` (megye, telepules, kulcs)
- [ ] Új interface: `TaxDeadline` (dátum, típus, leírás, szín)

### 2.2 — `electron/tax-engine.ts` létrehozása (ÚJ fájl)

Tiszta függvények, 0 DB/IPC függőség.

- [ ] **`calculateAtalanyado(bevétel, params, profil)`**
  1. átalányJövedelem = bevétel × (1 - költséghányad)
  2. adómentesSáv = minimálbérÉves × 0.5 = 1_936_800
  3. adóköteles = max(0, jövedelem - adómentesSáv)
  4. szja = adóköteles × 0.15
  5. Főfoglalkozású: járulékAlap = max(jövedelem, szkkép ? gbmÉves : minÉves)
  6. Mellékfoglalkozású: járulékAlap = jövedelem; ha ≤ adómentesSáv → minden 0
  7. tb = járulékAlap × 0.185
  8. szocho: plafon = minÉves × 24, alap = min(jövedelem, plafon), főfogl: max(alap, minJárulékAlap), × 0.13
  9. Math.round() kerekítés forintra

- [ ] **`calculateVszja(bevétel, költségek, kivét, params, profil)`**
  1. vállJövedelem = bevétel - költségek
  2. vállSzja = vállJövedelem × 0.09
  3. kivét → SZJA 15% + TB + SZOCHO (mint átalánynál)

- [ ] **`calculateTao(bevétel, eredmény, osztalék, params)`**
  1. min. adóalap = bevétel × 0.02
  2. tao = max(eredmény, min.alap) × 0.09
  3. osztalék: SZJA 15% + SZOCHO 13% (plafonig)

- [ ] **`calculateKiva(személyiKifizetések, osztalék, beruházás, params)`**
  1. alap = max(személyiKifizetések, szem.kif + osztalék - beruházás)
  2. kiva = alap × 0.10

- [ ] **`calculateHipa(bevétel, profil, hipaKulcs, params)`**
  - EV átalány egyszerűsített: sávos (≤12M→2.5M, ≤18M→6M, ≤25M→8.5M) × kulcs
  - EV átalány normál: jövedelem × 1.2 × kulcs
  - KIVA: kivaAlap × 1.2 × kulcs
  - Egyéb: árbevétel × kulcs

- [ ] **`calculateFullEstimate(bevétel, profil, params, hipaKulcs)`** — kombinálja mindent → TaxEstimate
- [ ] **`compareTaxForms(bevétel, költségek, params, hipaKulcs)`** — átalány vs VSZJA vs TAO+osztalék
- [ ] **`generateTaxDeadlines(profil, adoev)`** — profil → TaxDeadline[] (EV: ápr12/júl12/okt12/jan12, ÁFA, HIPA: márc15/szept15, stb.)
- [ ] **`generateTaxWarnings(bevétel, profil, params)`** — AAM ≥80% → warn, >100% → danger, átalány limit, határidők

### 2.3 — `electron/tax-service.ts` módosítás

- [ ] KATA case eltávolítás a `calculateTax()` switch-ből
- [ ] ATALANYADOZAS case → `tax-engine.ts` `calculateAtalanyado()` hívás
- [ ] Új fn: `getTaxParameters(year)` — DB lekérdezés
- [ ] Új fn: `getBusinessProfile(userId)` — DB lekérdezés
- [ ] Új fn: `saveBusinessProfile(profil)` — DB upsert
- [ ] Új fn: `searchHipaRates(query)` — LIKE keresés, max 10
- [ ] Új fn: `getHipaRate(megye, telepules)` — pontos lekérdezés
- [ ] Új fn: `getFullTaxEstimate(userId, adoev)` — profil + params + engine
- [ ] Új fn: `getTaxDeadlines(userId, adoev)` — engine hívás
- [ ] Új fn: `getTaxWarnings(userId, bevétel, adoev)` — engine hívás

### ✅ VERIFY F2

- [ ] `npx vitest run` → PASS (meglévő tesztek)
- [ ] Átalány: 10M / 45% / fő / nem szkkép → helyes számok (SZJA + TB + SZOCHO)
- [ ] Mellékfoglalkozású adómentes sáv alatti → 0 SZJA, 0 TB, 0 SZOCHO
- [ ] KATA tesztek törölve, nincs KATA hivatkozás
- [ ] TypeScript hiba nélkül fordul (`npx tsc --noEmit`)

---

## FÁZIS 3: IPC + Preload bővítés

### 3.1 — Új IPC handlerek (`electron/ipc.ts`)

- [ ] `tax:get-parameters` → `taxService.getTaxParameters(year)`
- [ ] `tax:get-profile` → `taxService.getBusinessProfile(userId)`
- [ ] `tax:save-profile` → `taxService.saveBusinessProfile(profil)`
- [ ] `tax:search-hipa` → `taxService.searchHipaRates(query)`
- [ ] `tax:get-hipa-rate` → `taxService.getHipaRate(megye, telepules)`
- [ ] `tax:full-estimate` → `taxService.getFullTaxEstimate(userId, adoev)`
- [ ] `tax:get-deadlines` → `taxService.getTaxDeadlines(userId, adoev)`
- [ ] `tax:get-warnings` → `taxService.getTaxWarnings(userId, bevétel, adoev)`
- [ ] `tax:compare-forms` → `taxService.compareTaxForms(...)`

### 3.2 — Preload bridge (`electron/preload.ts`)

- [ ] `getTaxParameters(year)` metódus
- [ ] `getTaxProfile(userId)` metódus
- [ ] `saveTaxProfile(profil)` metódus
- [ ] `searchHipaRates(query)` metódus
- [ ] `getHipaRate(megye, telepules)` metódus
- [ ] `getFullTaxEstimate(userId, adoev)` metódus
- [ ] `getTaxDeadlines(userId, adoev)` metódus
- [ ] `getTaxWarnings(userId, bevétel, adoev)` metódus
- [ ] `compareTaxForms(...)` metódus

### 3.3 — Típus deklarációk (`src/vite-env.d.ts`)

- [ ] Minden új preload metódushoz window.electronAPI típus bejegyzés

### ✅ VERIFY F3

- [ ] App elindul hiba nélkül
- [ ] DevTools console: `window.electronAPI.getTaxParameters(2026)` → valid objektum
- [ ] DevTools console: `searchHipaRates('Buda')` → találatok
- [ ] DevTools console: `saveTaxProfile(...)` → mentés + visszaolvasás OK
- [ ] TypeScript fordul (`npx tsc --noEmit`)

---

## FÁZIS 4: Profil Wizard UI

**Fájl:** `src/components/TaxProfileWizard.tsx` (ÚJ)

### 4.1 — Wizard komponens

- [ ] 5 lépéses modal (meglévő modal mintára: InvoiceGenerateModal, ContractGenerateModal)

### 4.2 — 1. lépés: Vállalkozás típusa

- [ ] Rádió kártyák: EV / Kft / Bt / Kkt

### 4.3 — 2. lépés: Adózási forma

- [ ] EV → átalány / VSZJA választás
- [ ] Ha átalány → költséghányad (45% / 80% / 90%) + főfogl/mellék + szakképzettség
- [ ] Társaság → TAO / KIVA választás

### 4.4 — 3. lépés: ÁFA

- [ ] AAM igen/nem toggle
- [ ] Ha nem AAM → bevallás gyakoriság (havi/negyedéves/éves)

### 4.5 — 4. lépés: HIPA

- [ ] Település autocomplete keresés (debounce 300ms, max 10 találat)
- [ ] Formátum: "Település (Megye) – X.XX%"
- [ ] Kulcs betöltés a kiválasztott településhez
- [ ] Egyszerűsített toggle (ha EV átalány)

### 4.6 — 5. lépés: Összegzés + Mentés

- [ ] Profil összegzés kártya
- [ ] Mentés gomb → `saveTaxProfile()`
- [ ] Mentés után: adó-határidők generálása a naptárba

### 4.7 — Szerkesztés mód

- [ ] Wizard újranyitáskor meglévő adatok betöltődnek

### ✅ VERIFY F4

- [ ] Wizard végigléphető (1→2→3→4→5→mentés)
- [ ] HIPA autocomplete működik, település kiválasztás betölti a kulcsot
- [ ] Mentés → `business_profile` rekord megjelenik DB-ben
- [ ] Újranyitás → meglévő adatok látszanak
- [ ] Lépések közti navigáció (vissza/előre) működik

---

## FÁZIS 5: Finances → Adózás szekció

### 5.1 — `src/components/TaxSection.tsx` létrehozása (ÚJ)

- [ ] Ha nincs profil → CTA kártya: "Adózási profil beállítása" gomb → wizard megnyitás
- [ ] Ha van profil, collapsed állapot:
  - 3 KPI kártya: SZJA összeg, Járulékok összeg (TB+SZOCHO), HIPA összeg
  - Összesen sor
  - Figyelmeztetések (warning badge-ek)
- [ ] Ha van profil, expanded állapot:
  - Profil kártya (vállalkozás típus, adóforma, település)
  - Negyedéves bontás táblázat
  - Adóforma összehasonlítás (compareTaxForms eredménye)
- [ ] Hover tooltip a számítás lépéseivel
- [ ] [⚙] gomb → wizard megnyitás szerkesztésre
- [ ] Adatforrás: `enhanced.yearlyRevenue` + invoices negyedéves bontás + `getFullTaxEstimate()`

### 5.2 — `src/pages/Finances.tsx` módosítás

- [ ] TaxSection import
- [ ] TaxSection beillesztése a Hero szekció és a havi összehasonlítás közé
- [ ] Szükséges state-ek és adatlekérés hookba

### ✅ VERIFY F5

- [ ] Adózás szekció megjelenik a Pénzügyek oldalon
- [ ] Profil nélkül → CTA kártya
- [ ] Profillal → számok megjelennek
- [ ] Collapse/expand működik
- [ ] Tooltip hover OK
- [ ] Wizard megnyitható a [⚙] gombbal

---

## FÁZIS 6: Naptár integráció

### 6.1 — Tax deadline generálás

- [ ] Profil mentéskor: régi `[TAX]` prefixű események törlése `calendar_events`-ből
- [ ] Új `[TAX]` események generálása a profil alapján → `calendar_events` INSERT

### 6.2 — Színkódok definiálása

- [ ] SZJA/Járulék: `#f97316` (orange)
- [ ] ÁFA: `#3b82f6` (blue)
- [ ] HIPA: `#22c55e` (green)
- [ ] TAO: `#a855f7` (purple)
- [ ] KIVA: `#124559` (teal)
- [ ] SZJA éves: `#ef4444` (red)

### 6.3 — `src/pages/Calendar.tsx` módosítás

- [ ] `eventAccentColor()` bővítés: `[TAX]` prefix alapján szín meghatározás
- [ ] Outline ring stílus tax deadline eventi-oknál (`ring-2 ring-[szín]`)
- [ ] Nem blokkoló megjelenés (outline, nem háttér)

### ✅ VERIFY F6

- [ ] Profil mentés → naptárban megjelennek az adó-határidők
- [ ] Outline stílus (nem tömör háttér)
- [ ] Profil módosítás → régi törlődik, új generálódik
- [ ] Helyes színkódok típus szerint

---

## FÁZIS 7: Tesztek

### 7.1 — `electron/tax-engine.test.ts` létrehozása (ÚJ)

- [ ] Átalány teszt: 10M / 45% / fő / nem szkkép → SZJA + TB + SZOCHO helyes
- [ ] Átalány teszt: 5M / 45% / fő / minimál járulék alap → minimum alap alkalmazása
- [ ] Átalány teszt: 3M / 45% / mellék / adómentes sáv alatti → 0 SZJA, 0 TB, 0 SZOCHO
- [ ] Átalány teszt: 20M / 80% / szkkép → GBM járulék alap
- [ ] Átalány teszt: 35M → figyelmeztetés
- [ ] Átalány teszt: 40M → ineligible
- [ ] VSZJA teszt: 15M bevétel / 8M költség / 5M kivét
- [ ] TAO teszt: minimum adóalap eset
- [ ] TAO teszt: osztalék SZJA + SZOCHO
- [ ] KIVA teszt: normál eset
- [ ] KIVA teszt: magas osztalék → alap emelkedik
- [ ] HIPA teszt: sávos egyszerűsített
- [ ] HIPA teszt: ×1.2 szorzós normál
- [ ] HIPA teszt: KIVA alany
- [ ] Warnings teszt: AAM 85% → warn
- [ ] Warnings teszt: AAM 101% → danger
- [ ] compareTaxForms teszt: 15M → átalány kedvezőbb

### 7.2 — `electron/tax-service.test.ts` frissítés

- [ ] KATA tesztek eltávolítása
- [ ] KIVA rate 11% → 10% javítás tesztekben
- [ ] ATALANYADOZAS 40% → 45% javítás tesztekben

### ✅ VERIFY F7

- [ ] `npx vitest run` → 100% PASS
- [ ] `tax-engine.ts` coverage > 90%
- [ ] Nincs KATA hivatkozás semmilyen tesztben

---

## Fontos szabályok

1. **NE hardcoded paraméterek** — minden a `tax_parameters` táblából jöjjön
2. **`tax-engine.ts` = tiszta függvények**, `tax-service.ts` = DB wrapper
3. **`Math.round()`** kerekítés forintra minden összegnél
4. **UTF-8** ékezetes településnevek kezelése (HIPA keresés)
5. Az invoices táblában **`amount`** a mező — NEM `gross_total`
6. **SZOCHO plafon = jövedelem** alapú, nem bevétel
7. Mellékfoglalkozásnál adómentes sáv alatti → **TB, SZOCHO, SZJA = 0**
8. 2026: minimálbér 322800, GBM 373200, **SZOCHO szorzó 100%** (112.5% eltörölve)

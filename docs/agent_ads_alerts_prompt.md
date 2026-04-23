# Google Ads — Automatikus figyelmeztetés rendszer

## Kontextus

A Google Ads modul jelenleg csak manuális AI elemzést támogat (a felhasználó rákattint az "AI Elemzés" gombra). Szükség van egy **automatikus figyelmeztetés rendszerre**, ami a szinkron után azonnal jelzi ha probléma van — anélkül, hogy a felhasználónak kéne elemzést kérnie.

A rendszer két rétegből áll:
1. **Rule-based riasztások** — minden szinkron után lefut, nulla API költség, azonnali
2. **Automatikus AI elemzés** — csak akkor fut ha a rule-based réteg anomáliát talál

---

## 1. rész: Rule-based anomália detekció

### Fájl: `electron/ads-alerts.ts` (ÚJ)

Hozd létre ezt a fájlt. Tiszta függvények, nulla AI/API függőség.

#### `detectAnomalies(accountId): AdsAlert[]`

Ez a fő függvény. A DB-ből lekérdezi az utolsó 7 nap és az előző 7 nap aggregált metrikáit kampányonként, összehasonlítja őket, és riasztásokat generál.

**Logika:**

```typescript
// Kampányonként összehasonlítás: utolsó 7 nap vs előző 7 nap
// Csak ENABLED kampányokra, amiknek volt legalább 100 impression az előző 7 napban

for (each campaign) {
  const current = last7DaysMetrics
  const previous = previous7DaysMetrics
  
  // Ha nincs előző adat, skip
  if (previous.impressions < 100) continue
  
  const changes = {
    ctr: percentChange(current.ctr, previous.ctr),
    cpc: percentChange(current.avgCpc, previous.avgCpc),
    conversions: percentChange(current.conversions, previous.conversions),
    cost: percentChange(current.cost, previous.cost),
    impressionShare: current.searchImpressionShare - previous.searchImpressionShare,
  }
  
  // Riasztási szabályok:
  if (changes.conversions < -30) → CRITICAL: "Konverziók 30%+ csökkenése"
  if (changes.ctr < -25) → WARNING: "CTR 25%+ csökkenése"  
  if (changes.cpc > 30) → WARNING: "CPC 30%+ emelkedése"
  if (changes.cost > 50 && changes.conversions < 0) → CRITICAL: "Költés nő, konverziók csökkennek"
  if (current.searchBudgetLostIS > 20) → INFO: "Budget korlát: 20%+ impression share veszteség"
  if (current.roas < 2 && current.cost > 10000) → WARNING: "Alacsony ROAS (<2x), kampány veszteséges lehet"
  if (changes.impressionShare < -15) → WARNING: "Impression share 15%+ csökkenése"
}
```

#### `detectAccountLevelAlerts(accountId): AdsAlert[]`

Fiók szintű riasztások (nem kampány specifikus):

```typescript
// Teljes fiók szintű ellenőrzések
if (totalSpendThisWeek === 0 && totalSpendLastWeek > 0) → CRITICAL: "Fiók leállt — nincs költés az elmúlt 7 napban"
if (totalConversions7d === 0 && totalConversions14d > 0) → CRITICAL: "Nincs konverzió az elmúlt 7 napban"
if (enabledCampaignsCount === 0) → INFO: "Nincs aktív kampány"
```

#### AdsAlert interface (add hozzá a `src/types/ads.ts`-hez)

```typescript
interface AdsAlert {
  id: string                    // crypto.randomUUID()
  accountId: string
  campaignId?: string           // null ha fiók szintű
  campaignName?: string
  severity: 'critical' | 'warning' | 'info'
  type: string                  // 'conversions_drop' | 'ctr_drop' | 'cpc_spike' | 'budget_limited' | 'low_roas' | 'account_stopped' stb.
  title: string                 // rövid cím, magyarul
  description: string           // részletesebb leírás, konkrét számokkal
  metric: string                // melyik metrika érintett
  currentValue: number
  previousValue: number
  changePercent: number
  detectedAt: string            // ISO datetime
  dismissed: boolean            // felhasználó elutasította-e
  aiAnalysisId?: string         // ha AI elemzés is futott rá
}
```

### DB tábla hozzáadás (`electron/database.ts`)

```sql
CREATE TABLE IF NOT EXISTS ads_alerts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  campaign_id TEXT,
  campaign_name TEXT,
  severity TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  metric TEXT,
  current_value REAL,
  previous_value REAL,
  change_percent REAL,
  detected_at TEXT DEFAULT (datetime('now')),
  dismissed INTEGER DEFAULT 0,
  ai_analysis_id TEXT,
  FOREIGN KEY (account_id) REFERENCES ads_accounts(id)
);
```

---

## 2. rész: Szinkron utáni automatikus futtatás

### `electron/ads-sync.ts` módosítás

A `syncAccount()` függvény végén, sikeres szinkron után:

```typescript
// Meglévő syncAccount() végére, a 'completed' sync_log update után:

// 1. Rule-based riasztások futtatása
const alerts = [
  ...detectAnomalies(accountId),
  ...detectAccountLevelAlerts(accountId)
]

// 2. Régi (>7 napos), nem dismissed riasztások törlése
db.run(`DELETE FROM ads_alerts WHERE account_id = ? AND dismissed = 0 AND detected_at < datetime('now', '-7 days')`, [accountId])

// 3. Új riasztások mentése (upsert — ugyanolyan type + campaign_id kombóra ne duplikáljon)
for (const alert of alerts) {
  db.run(`INSERT OR REPLACE INTO ads_alerts (...) VALUES (...)`, [...])
}

// 4. Ha van CRITICAL riasztás → automatikus AI elemzés
const criticalAlerts = alerts.filter(a => a.severity === 'critical')
if (criticalAlerts.length > 0) {
  try {
    const analysisResult = await runAnalysis(accountId, 'anomaly')
    // Az első critical alert-hez rendeld hozzá az AI elemzés ID-t
    if (analysisResult?.id) {
      for (const alert of criticalAlerts) {
        db.run(`UPDATE ads_alerts SET ai_analysis_id = ? WHERE id = ?`, [analysisResult.id, alert.id])
      }
    }
  } catch (err) {
    console.error('[ads-sync] Auto AI analysis failed:', err)
    // Nem kritikus hiba — a riasztás megjelenik AI elemzés nélkül is
  }
}

// 5. Értesítsd a renderert
mainWindow?.webContents.send('ads:alerts-updated', { accountId, alertCount: alerts.length })
```

---

## 3. rész: Dashboard UI — figyelmeztetések megjelenítése

### `src/pages/Ads.tsx` módosítás

A KPI kártyák FELETT (ha vannak aktív riasztások) jelenjen meg egy figyelmeztetés szekció:

```
┌──────────────────────────────────────────────────────────────┐
│ 🔴 2 figyelmeztetés                                    [×]  │
│                                                              │
│ ● KRITIKUS: KK-Performance Max — Konverziók 50% csökkenése  │
│   Utolsó 7 nap: 5 konv. vs előző 7 nap: 10 konv.           │
│   [AI Elemzés megtekintése →]                                │
│                                                              │
│ ● FIGYELEM: KK-Márkavédelem — CPC 35% emelkedése            │
│   Utolsó 7 nap: 181 Ft/kattintás vs előző: 134 Ft           │
│   [Elemzés kérése →]                                         │
└──────────────────────────────────────────────────────────────┘
```

**Megjelenítési szabályok:**

- `critical` → piros háttér/keret, 🔴 ikon
- `warning` → sárga/narancs háttér/keret, 🟡 ikon
- `info` → kék háttér/keret, 🔵 ikon
- Minden riasztásnál: kampány név, konkrét számok, százalékos változás
- Ha van `aiAnalysisId` → "AI Elemzés megtekintése →" link (megnyitja az AI panel előzményekből)
- Ha nincs `aiAnalysisId` → "Elemzés kérése →" gomb (elindítja az anomália elemzést)
- "[×]" dismiss gomb → `dismissed = 1` a DB-ben, eltűnik a dashboardról
- Dismissed riasztások NEM jelennek meg, de a DB-ben megmaradnak

### IPC handlerek

- [ ] `ads:get-alerts` → aktív (nem dismissed) riasztások lekérése
- [ ] `ads:dismiss-alert` → riasztás elutasítása
- [ ] `ads:get-alert-count` → badge szám a sidebar-hoz

### Sidebar badge

A `Sidebar.tsx`-ben a Google Ads menüpont mellé kerüljön egy **piros badge szám** ha vannak critical/warning riasztások (ahogy a legtöbb appban az értesítéseknél szokás):

```
Google Ads  🔴 2
```

Az `ads:alerts-updated` IPC event-re frissüljön a badge szám.

---

## 4. rész: Verify

- [ ] Szinkron után automatikusan futnak a rule-based riasztások
- [ ] Ha nincs anomália → nincs riasztás a dashboardon
- [ ] Ha van >30% konverzió csökkenés → CRITICAL riasztás megjelenik
- [ ] CRITICAL riasztásnál automatikus AI elemzés fut
- [ ] Az AI elemzés eredménye linkelhető a riasztásból
- [ ] Dismiss gomb eltünteti a riasztást
- [ ] Sidebar badge mutatja az aktív riasztások számát
- [ ] 7 napnál régebbi, nem dismissed riasztások automatikusan törlődnek
- [ ] Ha nincs adat az előző időszakból (új kampány), nem generál hamis riasztást
- [ ] TypeScript hiba nélkül fordul
- [ ] App elindul hiba nélkül

## Fontos szabályok

1. **Minimum threshold**: csak olyan kampányokra riasszon, amiknek volt legalább 100 impression az előző 7 napban — különben hamis riasztások lesznek szüneteltetett kampányoknál
2. **Ne duplikáljon**: ugyanolyan type + campaign_id kombinációra ne hozzon létre új riasztást ha már van aktív (nem dismissed) ugyanolyan
3. **AI költség kontroll**: automatikus AI elemzés CSAK critical riasztásnál, és maximum napi 1× fiókonként (ne fusson minden 6 órás szinkronnál)
4. **Ne blokkolja a szinkront**: az alert detekció és AI hívás async, a szinkron "completed" státuszt kapjon MIELŐTT az alertek futnak

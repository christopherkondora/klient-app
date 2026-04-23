# Magyar vállalkozások adózása 2026-ban: teljes útmutató a KLIENT adómodulhoz

A 2026-os adóév több jelentős változást hozott a magyar kisvállalkozói adózásban: az **általános átalányköltség-hányad 45%-ra emelkedett**, az **AAM értékhatár 20 millió Ft-ra nőtt**, a **SZOCHO 112,5%-os szorzója megszűnt**, és a **KIVA mérethatárok megduplázódtak**. A minimálbér bruttó **322 800 Ft/hó**, a garantált bérminimum **373 200 Ft/hó**. Az SZJA (15%), TAO (9%), KIVA (10%), SZOCHO (13%) és TB járulék (18,5%) kulcsok változatlanok. Ez az útmutató minden lényeges adószabályt tartalmaz, amelyre a KLIENT app adómoduljának szüksége lehet marketing ügynökségek és freelancerek kiszolgálásához.

---

## 1. Egyéni vállalkozók átalányadózása: a freelancerek fő adóformája

### Bevételi limit és költséghányadok

Az átalányadózás 2026-os bevételi határa az éves minimálbér **tízszerese**: 322 800 × 12 × 10 = **38 736 000 Ft**. Kiskereskedelmi tevékenységnél az ötvenszerese, azaz **193 680 000 Ft**. Év közben induló vállalkozónál a limitet a működés napjaira kell arányosítani.

A költséghányadok 2026-ban:

- **45%** — általános költséghányad (2025-ben még 40% volt; IT, marketing, tanácsadás, szellemi szolgáltatások ide tartoznak)
- **80%** — speciális tevékenységeknél (feldolgozóipar, építőipar, fodrászat, gépjárműjavítás, fényképészet, vendéglátás stb., ÖVTJ'24 kódok alapján). Kizárólag akkor alkalmazható, ha az **egész éves bevétel** 80%-os vagy magasabb kategóriájú tevékenységből származik
- **90%** — kizárólag kiskereskedelmi tevékenység (vendéglátás nélkül)

**2027-től az általános költséghányad tovább emelkedik 50%-ra** — ez már elfogadott törvényi rendelkezés.

### Az átalányadó alapja és kiszámítása

Az SZJA kulcs **15%**, de van egy adómentes sáv. Az átalányban megállapított jövedelem (bevétel minus költséghányad) éves minimálbér felét, azaz **1 936 800 Ft-ot** el nem érő része SZJA-mentes. Gyakorlati hatás: 45%-os költséghányaddal kb. **3 521 455 Ft éves bevételig** egyáltalán nem kell SZJA-t fizetni. A 80%-os költséghányadnál ez a határ kb. **9 684 000 Ft**.

A számítási képlet az adómodulhoz:

```
Átalányjövedelem = Bevétel × (1 - költséghányad%)
Adóköteles jövedelem = max(0, Átalányjövedelem - 1 936 800)
SZJA = Adóköteles jövedelem × 15%
```

### Járulékok átalányadózó EV-nél

A **TB járulék 18,5%**, a **SZOCHO 13%**. A minimum járulékalap 2026-tól a minimálbér (vagy garantált bérminimum) **100%-a** — a korábbi 112,5%-os szorzó megszűnt. Ez fontos egyszerűsítés.

**Főfoglalkozású EV havi minimum közterhei:**

| Alap | TB (18,5%) | SZOCHO (13%) | Összesen |
|---|---|---|---|
| Minimálbér: 322 800 Ft | 59 718 Ft | 41 964 Ft | **101 682 Ft/hó** |
| Garantált bérmin.: 373 200 Ft | 69 042 Ft | 48 516 Ft | **117 558 Ft/hó** |

A **SZOCHO éves plafon** a minimálbér 24-szerese: **7 747 200 Ft** éves átalányjövedelem felett már nem kell SZOCHO-t fizetni. Mellékállású (többes jogviszonyú) EV nem fizet minimum járulékot — csak a tényleges jövedelem után fizet, és az éves minimálbér felét meg nem haladó jövedelemrész után TB, SZOCHO és SZJA-előleg sem fizetendő.

### Negyedéves bevallás és fizetés

2026-tól **minden EV negyedévente** nyújtja be a járulékbevallást (2658-as nyomtatvány), havi bontásban, de negyedéves fizetéssel:

| Időszak | Bevallás + fizetés határidő |
|---|---|
| Q1 (jan–márc) | **április 12.** |
| Q2 (ápr–jún) | **július 12.** |
| Q3 (júl–szept) | **október 12.** |
| Q4 (okt–dec) | **január 12.** (köv. év) |

Az éves SZJA bevallás (25SZJA) határideje: **2027. május 20.** (a 2026-os adóévre).

### Kizárás és választás

Az átalányadózásból kiesik az EV, ha a bevétele meghaladja a limitet (38,7M Ft), vagy ha mulasztási bírságot kapott számla- vagy nyugtaadási kötelezettség elmulasztásáért. A kiesés évére visszamenőleg kell a vállalkozói SZJA-ra áttérni, és a kiesés évét követő **12 hónapig** nem választható újra az átalányadó. Az átalányadózás választásához nincs tevékenységi korlát, és a korábbi évek bevételét sem kell vizsgálni.

---

## 2. Alanyi adómentesség és ÁFA: a számlázás alapjai

### AAM 2026-ban: 20 millió Ft-os határ

Az alanyi adómentesség értékhatára **lépcsőzetesen emelkedik**: 2026-ban **20 millió Ft**, 2027-ben 22 millió Ft, 2028-ban 24 millió Ft. Az AAM és az átalányadó **egyszerre választható** — az AAM az ÁFA-ra, az átalányadó az SZJA-ra vonatkozik. Kombinálásuk a legtöbb freelancer és kis marketing ügynökség számára optimális.

Az AAM határ átlépésekor az EV **azonnal áfakörössé válik** — már a határt átlépő számlát áfásan kell kiállítani. Az adószám 9. számjegye 1-ről 2-re változik. A megszűnés évét követő két évig nem választható újra az AAM, de 2026-ban egy amnesztia-szabály érvényes: aki 2024-ben vagy 2025-ben lépte át az akkori alacsonyabb limitet, de 20M Ft alatt maradt, újra választhatta.

Az AAM **tevékenységtől függetlenül** választható, de bizonyos ügyleteknél az AAM-es adóalany sem mentesül az áfa alól: tárgyi eszköz értékesítése, új közlekedési eszköz közösségen belüli értékesítése, építési telek/új ingatlan értékesítése, és fordított adózás alá eső ügyletek.

### ÁFA kulcsok és bevallási rend

Az általános ÁFA kulcs változatlanul **27%** (EU legmagasabb). Kedvezményes kulcsok: **5%** (könyvek, alapélelmiszerek, internet, szálláshely, éttermi szolgáltatás helyben fogyasztva) és **18%** (tejtermékek, gabonakészítmények, egyes cukrászsütemények).

Az ÁFA bevallás gyakoriságát a megelőző 2. év adatai határozzák meg:

| Gyakoriság | Feltétel |
|---|---|
| **Havi** | Elszámolandó adó pozitív és ≥ 1 000 000 Ft/év |
| **Negyedéves** | Főszabály (nem havi és nem éves) |
| **Éves** | Elszámolandó adó < 250 000 Ft ÉS árbevétel < 50M Ft ÉS nincs közösségi adószám |

Bevallási határidők: havi bevallóknál a **tárgyhót követő hó 20-a**, negyedéveseknél a **negyedévet követő hó 20-a**, éveseknél **február 25.** Az ÁFA visszaigénylés kiutalási határideje főszabályként **75 nap**, megbízható adózónál **30 nap**.

---

## 3. Társaságok adózása: TAO versus KIVA

### TAO: 9%-os társasági adó

A TAO kulcs **9%** — az EU legalacsonyabb társasági adókulcsa, 2016 óta változatlan. Az adóalap a számviteli adózás előtti eredmény, korrigálva a Tao tv. szerinti növelő és csökkentő tételekkel. A jövedelem-minimum a korrigált bevétel **2%-a**.

A TAO-előleg fizetési szabály 2026-ban módosult: a negyedéves fizetés határa **5 millió Ft-ról 20 millió Ft-ra** emelkedett. Ha az előző évi fizetendő TAO ≤ 20M Ft, negyedévente kell fizetni (negyedévet követő hó 20-ig); ha > 20M Ft, havonta (tárgyhót követő hó 20-ig). Az utolsó negyedévi előleget **december 20-ig** kell befizetni. Az éves TAO bevallás határideje: **május 31.**

**Marketing/IT cégeknek releváns adókedvezmények:**
- **K+F adóalap-kedvezmény**: saját K+F közvetlen költsége **kétszeresen** levonható az adóalapból
- **K+F adókedvezmény (Tao tv. 22/G. §)**: K+F költségek **10%-a** közvetlenül a számított adóból vonható le, 5 éves kötöttséggel, fel nem használt rész visszatéríthető
- **Fejlesztési tartalék**: eredménytartalékból lekötött tartalék adóalap-csökkentő (max. 10 Mrd Ft, 4 éven belül beruházásra fordítandó)
- **SZOCHO K+F kedvezmény**: saját K+F bérköltség 6,5%-a levonható a SZOCHO-ból havonta

Az **osztalék** után a magánszemély tulajdonost **15% SZJA** és **13% SZOCHO** terheli. A SZOCHO plafon éves szinten **7 747 200 Ft** jövedelem — ezen felül nem kell SZOCHO-t fizetni. A korábbi évek **vesztesége 5 évig** határozható el, legfeljebb a pozitív adóalap 50%-áig használható fel (FIFO sorrendben).

### KIVA: a bérintenzív kisvállalkozások adója

A KIVA kulcs **10%**, és egyszerre váltja ki a **TAO-t (9%) és a SZOCHO-t (13%)**. Ez a KIVA legfőbb előnye: bérintenzív cégeknél jelentős megtakarítást jelent. Az adóalap minimuma a személyi jellegű kifizetések összege. Növelő tételek: jóváhagyott osztalék, tőkekivonás, pénztárnövekedés (mentesített érték felett). Csökkentő tételek: beruházások kifizetett értéke, kapott osztalék, elhatárolt veszteség.

**2026-os KIVA mérethatárok (jelentősen bővültek):**

| Feltétel | Belépési határ | Kilépési határ |
|---|---|---|
| Éves bevétel | ≤ **6 Mrd Ft** | **12 Mrd Ft** |
| Mérlegfőösszeg | ≤ **6 Mrd Ft** | — |
| Létszám | ≤ **100 fő** | **200 fő** |

A KIVA választásának bejelentése az előző év **december 31-ig** szükséges, vagy évközi belépéskor bármikor megtehető (a bejelentést követő hónap 1-jétől hatályos). Kilépés önkéntesen **december 1–20.** között. A KIVA negyedéves előleg fizetési határideje a **negyedévet követő hó 20-a** (ápr. 20., júl. 20., okt. 20., jan. 20.). Éves bevallás: **május 31.**

A KIVA **nem előnyös**, ha a cég alacsony bérköltségű és magas osztalékot fizet (az osztalék növeli a KIVA-alapot), vagy ha jelentős TAO-adókedvezményeket lehetne érvényesíteni (fejlesztési, K+F), amelyek KIVA-ban nem vehetők igénybe.

---

## 4. HIPA: a helyi iparűzési adó részletei

A HIPA maximális törvényi kulcsa **2%**; 2026-ban **1794 település** alkalmazza a maximumot (köztük Budapest). Az adóalap: nettó árbevétel − ELÁBÉ − közvetített szolgáltatások − alvállalkozói teljesítések − anyagköltség − K+F közvetlen költség. Az útdíj 7,5%-a levonható a fizetendő adóból.

**Átalányadózó EV-k egyszerűsített HIPA lehetőségei:**
- Átalányjövedelem **120%-a** mint adóalap
- Nettó árbevétel **80%-a** mint adóalap (ha bevétel ≤ 8M Ft)
- **Sávos egyszerűsített rendszer** (≤ 25M Ft bevételig): fix adóalapok bevételi sávonként (2,5M / 6M / 8,5M Ft), évente egyszeri fizetés május 31-ig, bevallás nem szükséges

**KIVA alanyok** HIPA alapja: KIVA adóalap × 120%.

A HIPA bevallás határideje **május 31.**, az előleg két részletben fizetendő: **március 15.** és **szeptember 15.** Az AAM önmagában **nem jelent HIPA-mentességet** — az AAM kizárólag az ÁFA-rendszerre vonatkozik. Törvényi HIPA-mentesség közhasznú nonprofit szervezetekre, egyesületekre, alapítványokra vonatkozik. Az önkormányzatok saját rendeletben állapíthatnak meg további kedvezményeket.

### HIPA adatbázis az implementációhoz

A magyar települések HIPA kulcsait a **Magyar Államkincstár HAKKA rendszere** tartalmazza: **hakka.allamkincstar.gov.hu**. Az oldal település név vagy adószám alapján kereshető, és havi országos adatok letölthetők (Excel/CSV formátumban). **Dedikált nyilvános REST API nincs**, de a letölthető havi dump gépileg feldolgozható. Az ÁNYK HIPAK nyomtatvány is tartalmazza az aktuális mértékeket. A KLIENT app számára a legpraktikusabb megoldás a MÁK havi adatdump rendszeres importálása lenne.

---

## 5. Számlázási szabályok és EU-s ügyletek

### AAM-es számla

Az alanyi adómentes számlán kötelezően fel kell tüntetni az **„alanyi adómentes"** szöveget (vagy „AAM" kódot). ÁFA mérték és áthárított adó **nem szerepelhet**. A nettó összeg egyenlő a bruttó összeggel. Ajánlott hivatkozás: „Az Áfa tv. XIII. fejezete szerinti alanyi adómentesség."

### EU-s szolgáltatásnyújtás (B2B)

Közösségen belüli szolgáltatásnyújtásnál (Áfa tv. 37. §) a teljesítés helye a megrendelő letelepedési helye, így **magyar ÁFA nem számítandó fel**. A számlán kötelező szöveg: **„fordított adózás"** (angolul „Reverse charge"), hivatkozás: Council Directive 2006/112/EC Article 196. **Mindkét fél közösségi adószáma** (HU + 8 számjegy) kötelezően szerepel. A VIES rendszerben kell ellenőrizni a partner EU-s adószámát.

A **tárgyi adómentes** (TAM) és az **alanyi adómentes** (AAM) számla eltér: a TAM az ügylet jellege miatt mentes (Áfa tv. VI. fejezet), az AAM az adóalany személye miatt (Áfa tv. XIII. fejezet). A számlán nem szabad összekeverni a hivatkozásokat.

### NAV Online Számla

A NAV Online Számla adatszolgáltatás 2026-ban minden belföldi számlára kötelező (értékhatár nélkül). **2026. szeptember 1-jétől a nyugtákról is kötelező** az adatszolgáltatás. Az API aktuális verziója **v3.0**, nyilvános dokumentáció és XSD sémák elérhetők: onlineszamla.nav.gov.hu/dokumentaciok és GitHub: github.com/nav-gov-hu/Online-Invoice. Teszt API: api-test.onlineszamla.nav.gov.hu.

---

## 6. A 2026-os kulcsváltozások és a 2027-es kilátások összefoglalva

**2026-ban hatályba lépett legfontosabb változások:**

| Változás | Korábbi | 2026-os érték |
|---|---|---|
| Minimálbér | 290 800 Ft | **322 800 Ft** (+11%) |
| Garantált bérminimum | 348 800 Ft | **373 200 Ft** (+7%) |
| Átalány költséghányad (általános) | 40% | **45%** |
| AAM értékhatár | 18M Ft | **20M Ft** |
| SZOCHO minimális alap szorzó | 112,5% | **100%** (megszűnt) |
| KIVA belépési bevételi határ | 3 Mrd Ft | **6 Mrd Ft** |
| KIVA belépési létszám | 50 fő | **100 fő** |
| TAO negyedéves előleg határ | 5M Ft | **20M Ft** |
| EV járulékbevallás | havi | **negyedéves** |

Egyéb lényeges változások: tartós megbízási jogviszony bevezetése (min. SZOCHO-alap: minimálbér 30%-a = 96 840 Ft), távmunka költségtérítés igazolás nélkül 32 280 Ft/hó, reklámadó továbbra is 0%-os kulccsal érvényes (gyakorlatilag felfüggesztve), családi kedvezmény duplázódása (kétgyermekes anyák adómentessége kibővítve).

**Már elfogadott, 2027-es változások:**
- AAM értékhatár: **22 millió Ft**
- Átalány költséghányad: **50%** (a jelenlegi 45%-ról)
- **ÁNYK rendszer megszűnik** 2027. január 1-jétől — átállás e-áfa vagy M2M rendszerre szükséges
- TAO, KIVA, SZJA, SZOCHO kulcsok: **nincs bejelentett változás**
- 2027-es minimálbér összege még nem ismert (várhatóan 2026 végén lesz kormányrendelet)

---

## 7. Adónaptár a KLIENT app számára

Az adómodul naptárfunkciójához a legfontosabb ismétlődő határidők:

**Havi (munkáltatóknál):** tárgyhót követő hó **12.** — SZJA és járulék befizetés, 08-as bevallás. Tárgyhót követő hó **20.** — havi ÁFA bevallás és befizetés, havi TAO-előleg.

**Negyedéves (EV-knél):** negyedévet követő hó **12.** — EV járulékbevallás (2658) és befizetés, SZJA-előleg. Negyedévet követő hó **20.** — negyedéves ÁFA, TAO-előleg (negyedéves fizetőknél), KIVA előleg, innovációs járulék előleg.

**Féléves HIPA:** **március 15.** és **szeptember 15.** — HIPA előleg befizetés.

**Éves:** **február 25.** — éves ÁFA bevallás. **Május 20.** — SZJA bevallás (EV-k). **Május 31.** — TAO bevallás, KIVA éves bevallás, HIPA bevallás, éves beszámoló letétbe helyezése. **December 20.** — utolsó negyedévi TAO-előleg.

## Konklúzió: mit kell tudnia a KLIENT adómodulnak

A 2026-os magyar adórendszer a freelancerek és kis marketing ügynökségek szempontjából három fő útvonalat kínál: **átalányadó + AAM** az egyszerűség és alacsony adminisztráció jegyében (45%-os költséghányad, 20M Ft-os AAM határ, negyedéves bevallás); **vállalkozói SZJA** a magas valós költségű EV-knek; és **Kft. KIVA-val** a bérintenzív kiscsapatoknak (10%-os adó kiváltja a TAO-t és SZOCHO-t). A KLIENT app adómoduljának legkritikusabb elemei: a járulékalap-kalkulátor (ahol a 112,5%-os szorzó megszűnése és a SZOCHO plafon figyelembe vétele kulcsfontosságú), a negyedéves bevallási határidők nyomon követése, a HAKKA adatbázisból importált HIPA kulcsok, és a számlázási modul AAM/fordított adózás szövegkezelése. A 2027-es **50%-os költséghányad** és **22M Ft-os AAM határ** már törvénybe iktatott, így az app jövőbiztos tervezéséhez ezeket érdemes előre implementálni.
# Magyar STT 2025–2026: Mit használj a Deepgram Nova‑3 helyett a Klient‑ben?

## TL;DR

- **Váltás ajánlott**: a Deepgram Nova‑3 nem a legjobb választás magyarra sem pontosság, sem ár szempontjából. A Soniox saját, 2025‑ös, 60 nyelvre kiterjedő YouTube‑benchmarkjában (kétszeresen ellenőrzött humán ground truth) **Soniox 5,6% WER magyaron, Deepgram (Nova‑2) 24,7%** — és a Nova‑3 magyar (`hu`) támogatás csak 2025. november 4‑én jelent meg, magyarra publikált konkrét WER szám nélkül.
- **Elsődleges ajánlás API‑ra: Soniox** — a legjobb magyar pontosság (5,6% WER), beépített diarizáció + bármi‑bármi fordítás, ~$0,10–0,12/óra (kb. 35–45 Ft/óra), ami **6×–8× olcsóbb, mint a Deepgram Nova‑3 streaming** ($0,46/óra a hivatalos $0,0077/perc PAYG árból). Ez az 5 000 Ft/hó Klient áron a margin szempontjából game changer.
- **Hibrid architektúra javasolt**: rövid diktáláshoz **lokális whisper.cpp** (`@kutalia/whisper-node-addon` — prebuilt Node/Electron bindingek Windows/Linux/macOS x64+arm64‑re) a Trendency `whisper-large-v3-hu` modellel (a HF model card szerint „mean Word Error Rate of 11.26 on the Common Voice dataset's 19.0, 20.0 and 21.0 deltas”); hosszú hívás/meeting átirathoz **Soniox batch API**. Backup vendor: **ElevenLabs Scribe v2 batch ($0,22/óra)**, amelynek hivatalos STT oldala a magyart az „Excellent Accuracy (≤ 5% Word Error Rate – WER)” kategóriába sorolja.

## Key Findings

### 1. Magyar pontosság (WER) — 2025/2026‑os adatok

A magyar nyelv agglutináló, mélyen ragozó morfológiája miatt sok ASR rendszer megbotlik rajta. A legmegbízhatóbb független(ebb) magyar nyelvi mérés a Soniox 2025. márciusi benchmarkja (45–70 perc valós YouTube‑audió nyelvenként, kétszeresen ellenőrzött humán ground truth, batch módban):

| Szolgáltató / Modell | Magyar WER (batch, Soniox 2025 benchmark) |
|---|---|
| **Soniox** stt-async-preview | **5,6%** |
| Speechmatics enhanced | 9,5% |
| ElevenLabs Scribe v1 | 9,6% |
| Azure Best | 13,6% |
| OpenAI Whisper large-v3 | 14,3% |
| AWS Best | 14,7% |
| **Deepgram Nova-2** (Nova-3 magyarul akkor még nem volt) | **24,7%** |
| Google long / chirp_2 | 25,2% |
| AssemblyAI (Universal/best) | 33,9% |

Fontos kontextus:
- A benchmark a **Soniox saját publikációja**, ezért az abszolút sorrendet enyhe szkepticizmussal kell kezelni — DE a Soniox magyar első helyét keresztvalidálja, hogy az ElevenLabs (versenyző) és a Speechmatics is történelmileg erős magyaron, és a Soniox–OpenAI/Google/Azure relatív sorrendek konzisztensek a vállalkozói visszajelzésekkel.
- A **Deepgram Nova-3 magyar (`hu`) támogatás 2025. november 4-én jelent meg** monolingvális modellként (Deepgram changelog, 2025-11-04: *„Nova-3 supports 11 new languages — We've added support for 11 new languages with non-English monolingual Nova-3 models”*). Deepgram blog (2025. nov.): *„Hungarian (hu): An agglutinative language with long compound suffix chains. Nova-3 maintains high accuracy even as words stretch across many morphemes.”* Az aggregált javulás Nova‑2‑höz képest a 11 új nyelven: *„Korean, Czech, and Hindi show the largest gains, with up to 27 percent WER reduction.”* Magyarra **nincs publikált konkrét WER szám**. Optimista becslés (a 27% relatív csökkenést rávetítve a 24,7% Nova‑2‑re): ~18% Hungarian WER — még így is **lényegesen rosszabb, mint a Soniox vagy a Speechmatics**.
- **ElevenLabs Scribe** hivatalos STT oldala (elevenlabs.io/speech-to-text) a magyart explicit az „Excellent Accuracy (≤ 5% Word Error Rate - WER)” kategóriába sorolja Scribe v1 és v2 esetén egyaránt. Nyelvspecifikus FLEURS/CV breakdown nem publikus; a Soniox független benchmark szerinti 9,6% (v1) ennél óvatosabb és reálisabb gyakorlati érték.

### 2. Deepgram Nova‑3 helyzete magyarra

- **Mikor jelent meg**: 2025. november 4. (`hu` mint a 11 új monolingvális Nova‑3 nyelv egyike).
- **Ár**: $0,0077/perc streaming pay‑as‑you‑go = **$0,46/óra**, batch $0,0043/perc ≈ **$0,26/óra**. Growth planen $0,0065/perc streaming.
- **Erősség**: alacsony latency (Deepgram dokumentumai szerint P50 ~300 ms streamingen), kiváló JavaScript/Node SDK (`@deepgram/sdk`), Keyterm Prompting támogatott magyarra is, érett dokumentáció, EU‑hosted endpoint elérhető.
- **Gyenge pont**: a magyar pontosság — még a Nova‑3 javulással is — vélhetően nagyságrendekkel elmarad a Soniox/ElevenLabs/Speechmatics alternatíváktól, ráadásul drágább.

### 3. Lokális / on‑device opciók

| Modell | Hungarian WER | Méret | Electron‑integráció |
|---|---|---|---|
| **Trendency `whisper-large-v3-hu`** (HF) | **11,26%** (Common Voice 19/20/21 átlag, „other+validated” — a HF model card adata) | ~3 GB | faster‑whisper / whisper.cpp |
| OpenAI Whisper large-v3 (bázis) | 14,1% (FLEURS, NVIDIA Canary tech report) | ~3 GB | whisper.cpp |
| **NVIDIA Parakeet TDT 0.6B v3** | 15,7% (FLEURS Hungarian, Canary‑1B‑v2 paper) | 600M paraméter | nehezebb; nincs natív Node binding |
| Whisper Small | 38,9% (FLEURS) | ~500 MB | whisper.cpp — gyenge, nem ajánlott |
| Vosk | Nincs hivatalos magyar modell | — | Nem opció |

**Electron + Node.js integráció**:
- **`@kutalia/whisper-node-addon`** (npm) — prebuilt whisper.cpp bindingek Windows x64, Linux x64/arm64, macOS x64/arm64‑re; a README szerint *„Zero-config for Electron - Seamless integration with Electron apps”*, GGML modelleket eszi. Ez a jelenleg legtisztább npm csomag whisper.cpp‑re.
- **`smart-whisper`** — szintén whisper.cpp natív Node addon, GPU támogatás macOS-en automatikus, model managerrel.
- **`nodejs-whisper`** — másik whisper.cpp wrapper, word‑level timestamp támogatással, autoDownloadModelName opcióval.
- **Parakeet** és NVIDIA NeMo: nincs production‑grade Node binding, csak Python — Electronba kizárólag oldalsó Python sidecar processzel vagy ONNX‑konvertálva érdemes (létezik `parakeet-tdt-0.6b-v3-fastapi-openai` ONNX wrapper, de ez Python‑alapú FastAPI).

### 4. API alternatívák — gyors ár/teljesítmény tábla

Hungarian-specific szempontból, $/óra normalizálva, list price 2026 elején:

| Szolgáltató | Magyar WER | Batch ár ($/óra) | Real-time ár ($/óra) | Magyar támogatás | Node SDK |
|---|---|---|---|---|---|
| **Soniox** | **5,6%** | ~$0,10 | ~$0,12 | Igen, kiváló | Igen, REST + WebSocket |
| ElevenLabs Scribe v2 | „Excellent (≤5%)” hivatalos / 9,6% v1 független | **$0,22** (Scribe v1/v2 batch) | **$0,39** (Scribe v2 Realtime) | Igen | `@elevenlabs/elevenlabs-js` |
| Speechmatics | 9,5% | ~$0,30 | ~$0,30 | Igen, történelmileg erős (15. nyelvük volt) | Igen |
| Azure Speech | 13,6% | $0,18 (batch) | $1,00 (standard real-time) | Igen | Igen |
| OpenAI gpt-4o-transcribe | ~14% (Whisper-szint) | $0,006/perc ≈ $0,36/óra | $0,38–$1,15 | Igen | Igen |
| OpenAI gpt-4o-mini-transcribe | rosszabb | $0,003/perc ≈ $0,18/óra | — | Igen | Igen |
| Deepgram Nova-3 | n/a (kb. 18% becslés) | $0,26 | $0,46 | Igen (2025.11.) | Igen, kiváló |
| AWS Transcribe | 14,7% | $0,024/perc = $1,44/óra | streaming $0,024/perc | Igen | Igen |
| Google STT v2 + Chirp/Chirp 2 | 25,2% | $0,016/perc = $0,96 (Dynamic Batch −75%: $0,24) | $0,016/perc | Igen | Igen |
| AssemblyAI Universal-2 | 33,9% (gyenge) | $0,15 + add-onok | $0,15 (streaming) | Igen, de Universal-3 Pro nem támogatja a magyart | Igen, jó |
| Gladia Solaria-1 | n/a (várhatóan jó, 100+ nyelv) | $0,20–$0,61 | $0,25–$0,55 | Igen | REST + WS |

### 5. Magyar fejlesztésű megoldás: Alrite (Régens Zrt.)

- **Termék**: Alrite (Régens Zrt., Budapest) — magyarra optimalizált deep‑learning ASR. Az alrite.io Google Play oldala szerint *„The application can recognize speech on a general vocabulary with 90-95% accuracy”* (nem WER, hanem proprietary marketing metrika).
- **Mód**: SaaS, mobil/desktop alkalmazás és webes API. Wikipédia szerint 2025 tavaszán >265 000 felhasználó.
- **Jelenleg**: nincs nyilvános, dokumentált, Electronba egyszerűen integrálható REST API publikus pricinggal — B2B/enterprise sales-en megy, főleg médiacégekre és nagyvállalatra fókuszálva (Telex, Forbes Hungary cikkek erősítik a publikációs láthatóságot, ISO 27001/9001 + GDPR + Cyber Essentials tanúsítványok).
- **Akadémiai oldal**: BME TMIT (Mihajlik Péter et al., HUN‑REN Nyelvtudományi Kutatóközpont) magyar nyelvű ASR kutatás történelmileg erős, NVIDIA NeMo‑alapú megközelítéseket használnak, de **nincs production‑ready open‑source magyar modell** akadémiai forrásból, amit közvetlenül integrálni lehetne. A leghasznosabb akadémiai/közösségi artifact a `Trendency/whisper-large-v3-hu` Hugging Face fine‑tune.

## Details

### Ajánlott architektúra a Klient‑hez

**Két use case, két különböző stack:**

**(A) Diktálás / szöveges bevitel (rövid, latency‑érzékeny):**
- **Elsődleges**: Soniox streaming WebSocket API. Token-level streaming, magyaron 5,6% WER, $0,12/óra. Ennyiért nincs értelme lokálisat tartani — de…
- **Privacy‑first / offline opció**: `@kutalia/whisper-node-addon` + Trendency `whisper-large-v3-hu` GGML modell. A modell 1–3 GB‑ot foglal, CPU‑n is fut. Marginális költség $0 — ezzel akár „Pro tier” feature‑t is lehet csinálni a Klient‑ben („Offline diktálás”).
- **Ne**: Deepgram Nova‑3 — magyaron pontatlanabb és drágább, mint a Soniox.

**(B) Hívás/meeting felvétel + átirat + summary:**
- **Elsődleges**: Soniox batch async API. Magyar diarizáció beépítve, $0,10/óra.
- **Backup vendor (redundancia)**: ElevenLabs Scribe v2 batch ($0,22/óra), magyar „Excellent Accuracy (≤5% WER)” minősítéssel, robusztus infrastruktúra, 32 beszélőig diarizáció.
- **Summary generálás**: NEM az STT vendor — külön LLM hívás (GPT‑5.4 Mini, Claude Haiku, vagy Gemini Flash) a transcripten. Ez jobb minőségű és olcsóbb, mint a vendor beépített summary feature‑e.

### Költségmodell — konkrét Klient számokkal

Tegyük fel: egy átlag felhasználó havonta 2 órát diktál + 5 órányi meetinget rögzít = **7 óra audió/hó**.

| Megoldás | Költség / felhasználó / hó |
|---|---|
| Deepgram Nova-3 streaming (jelenlegi) | 7 × $0,46 = $3,22 ≈ **1 080 Ft** |
| **Soniox (ajánlott)** | 7 × $0,11 = $0,77 ≈ **260 Ft** |
| ElevenLabs Scribe v2 batch | 7 × $0,22 = $1,54 ≈ **520 Ft** |
| Hibrid: diktálás lokális + meeting Soniox batch | 5 × $0,10 = $0,50 ≈ **170 Ft** |
| Hibrid: diktálás lokális + meeting ElevenLabs | 5 × $0,22 = $1,10 ≈ **370 Ft** |

5 000 Ft/hó/felhasználós áron ez a különbség:
- Deepgram Nova‑3 esetén az STT a bevétel **~22%‑a**.
- Soniox‑szal **~5%**.
- Hibrid lokális+Soniox: **~3,5%**.

**Évesítve 1 000 felhasználó esetén**: ~10 millió Ft STT‑költség Deepgrammel vs. ~3 millió Ft Soniox‑szal — kb. 7 MFt/év margin felszabadítása. (~370 HUF/USD‑n számolva.)

### Implementációs megfontolások

1. **Soniox token‑alapú számlázás bonyolultabb**, mint a Deepgram percalapja — a publikációjuk szerint *„1 hour of audio is ~30,000 input audio tokens”* és a számlázás `$1.50 / 1M input audio tokens` async módban. A publikált $/óra ekvivalens egyértelmű (~$0,10). Készíts saját internal „minutes used” telemetriát az ügyfélnek látható kvóták kiszámolásához.
2. **Diarizáció**: Soniox alapból tartalmazza („all features included by default”); Deepgramnél és AssemblyAI‑nál extra add-on. Ezzel a Klient meeting features (ki mit mondott) drágulás nélkül elérhetők.
3. **EU adatrezidencia**: Soniox in‑region processing több globális régióval, Speechmatics EU/on‑prem, Deepgram EU‑hosted API. KKV ügyfeleknek GDPR szempontból ez fontos lehet — magyar piacra ez különösen.
4. **Lokális Whisper modell csomagolás**: a `whisper-large-v3-hu` GGML formátum kb. 1–3 GB — túl nagy ahhoz, hogy a Klient installerbe rakd. Töltsd le first‑run‑kor a felhasználó gépére, vagy adj `small`/`medium` fallback opciót gyengébb gépekre.
5. **Streaming vs batch**: a meeting use case‑hez **kizárólag batch** kell — a streaming feleslegesen drágább, és a meeting felvétel post‑hoc történik. Csak a real‑time diktálás indokol streaminget.

## Recommendations

### Azonnali lépések (2 hét)

1. **Készíts saját magyar tesztkorpuszt**: 30–60 perc Klient‑releváns audió (KKV‑s értekezlet, telefonos egyeztetés, diktált jegyzet, magyar névanyaggal: pl. „Kovács István Kft.”, „Áfa”, „számlázz.hu”). Annotáld humán ground truth‑szal.
2. **Futtasd le mérést** ezeken: Soniox, Deepgram Nova‑3 (új magyar modell), ElevenLabs Scribe v2, Speechmatics, lokális `whisper-large-v3-hu`. Számolj WER‑t a `jiwer` Python könyvtárral.
3. **Várt eredmény (publikált adatok alapján)**: Soniox 5–10% WER, ElevenLabs 5–10%, Speechmatics 8–12%, lokális Whisper HU 10–15%, Deepgram Nova‑3 15–22%.

### Rövid táv (1–2 hónap)

4. **Migrálj át Soniox‑ra** a backend STT layer mögött. Tedd be **vendor abstraction layer**‑t (TypeScript `interface STTProvider { transcribe(audio): Promise<Transcript> }`), hogy könnyű legyen visszaváltani vagy hibrid futtatni.
5. **Implementáld a lokális Whisper diktálást** `@kutalia/whisper-node-addon`‑nal opcionális feature‑ként. Töltsd le a `whisper-large-v3-hu` GGML modellt first run-kor, mutass progress bar‑t.
6. **Beszélj a Soniox sales‑szel** volume discountért, amint havi audio mennyiséged elhagyja az 1 000 órát. $0,10/óra alá lehet menni enterprise commitmenttel.

### Mikor változtass az ajánláson

- **Térj vissza Deepgramre**, ha a Soniox magyar WER tested-en >15% (nem hisszük, de mérd).
- **Maradj Deepgrammen**, ha critical dependency van real-time multilingual code-switching-re (Deepgram Nova-3 a 10 nyelves valós idejű code-switching‑ben máig piacvezető — de magyar+angol mix-re a Soniox is automatikusan detektálja a nyelvváltást).
- **Térj át teljesen lokális modellre**, ha a havi audio térfogat >5 000 óra/hó (akkor saját GPU szerver Parakeet/faster-whisper olcsóbb, mint bármelyik API; AWS blogposzt szerint Parakeet‑TDT-vel ~tört centekért lehet órát transzkribálni).
- **Tegyél árajánlatot Régens/Alrite‑tól** ha valamelyik nagy KKV ügyfeled magyar data‑residency‑t vagy on‑prem deployment‑et kér — magyar piaci marketing előny lehet a „magyarra optimalizált, magyar fejlesztésű AI”.

## Caveats

- **A Soniox 5,6% magyar WER vendor‑saját benchmark** (Soniox publikálta, ők szerepelnek elsőként). Alapozott, de nem 100% pártatlan. Saját tesztkorpuszon validáld kötelezően a végleges döntés előtt.
- **Deepgram Nova‑3 magyar konkrét WER nincs publikálva** — a ~18%‑os becslés a max. 27%‑os relatív Nova‑2 → Nova‑3 javulásból (Korean/Czech/Hindi adat) ered, optimista átlagos feltevéssel. A valóság lehet 16% vagy 22% is.
- **AssemblyAI Universal‑3 Pro nem támogatja a magyart** (csak EN/ES/FR/DE/IT/PT). Csak a régebbi Universal‑2 igen, és az ott is gyenge a magyaron a Soniox benchmark szerint (33,9%).
- **ElevenLabs hivatalos „≤5% WER” magyar besorolása vs. Soniox független 9,6% (v1) eltér** — az ElevenLabs marketing‑oldali kategória aggregált, a Soniox‑adat egy konkrét YouTube‑korpuszon készült. A valóság gyakorlati Klient use case‑re valószínűleg 6–10% között lesz.
- **Az árak USD‑ben listaárak** — EU adatrezidencia, SLA, on‑prem deployment 10–30% felárat jelenthet. Az árfolyam (USD↔HUF) változik; a Ft‑konverziók ~370 HUF/USD‑n alapulnak (2026. május).
- **A Régens/Alrite API publikus pricing nélkül** kommunikál — bármi konkrét összehasonlítás csak árajánlat után lehetséges. Az „90–95% pontosság” marketing metrika nem WER‑rel ekvivalens.
- **Soniox/ElevenLabs Scribe v2 viszonylag friss termékek** (2024–2025) — Deepgram érettebb a production tooling, observability, support oldalon. Ezt érdemes mérlegelni, ha 24/7 enterprise SLA fontos. Tedd be a vendor abstraction layert most, hogy 6 hónap múlva könnyen újraértékelhesd.
- **A `Trendency/whisper-large-v3-hu` 11,26% Common Voice WER** ugyanazon a dataseten edzett és tesztelt — a HF model card explicit ezt írja: *„We have used both training, test and validation splits as training data”*. Tehát ez **nem held‑out test**, és produkciós környezetben rosszabb lehet.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.39.0';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Te egy senior PPC stratéga vagy 10+ év Google Ads tapasztalattal. Magyar kisvállalkozásokat és freelancereket segítesz, akik ügyfeleik hirdetéseit kezelik.

## Szereped
Nem általánosságokat mondasz — az adatokból konkrét, végrehajtható döntéseket segítesz meghozni. Minden megállapításodat számokkal támasztod alá.

## Iparági benchmarkok (2025, WordStream):
- CTR (Search): átlag 6.66%, jó: 4–8%, kiváló: 8%+
- Konverziós ráta: átlag 7.52%, jó: 3–10%, kiváló: 10%+
- Quality Score: átlag 5–6, jó: 7+, kiváló: 8+
- ROAS: iparágtól függ, általában 3–4x a minimum cél

## Kimeneti szabályok
- Magyar nyelv, szakkifejezések angolul (CPC, CTR, ROAS, QS stb.)
- Markdown formátum: fejlécek (##), táblázatok (| | |), felsorolások (-)
- **Táblázatokat MINDIG markdown pipe-szintaxissal írd** fejlécsorral és elválasztó sorral
- Számokat mindig formázd: ezres elválasztó, Ft pénznem, % százalék
- Tömör, lényegre törő mondatok — ne ismételj adatot, ami a táblázatban már szerepel
- Használd: ✅ pozitív, ⚠️ figyelmeztető, 🔴 kritikus jelöléseket
- Minden elemzés végén adj **"Következő lépések"** szekciót, ahol konkrétan megmondod mit csináljon a felhasználó, milyen sorrendben, és miért
- Ha az adatokban "Ügyfél kontextus" szekció is van (ügyfél neve, bevétele, projektjei), használd fel: vesd össze a hirdetési költést az ügyfél bevételével, adj ROI becslést, és a javaslatokat kontextualizáld az ügyfél üzleti helyzetéhez`;

const ANALYSIS_TYPE_PROMPTS: Record<string, string> = {
  performance: `Készíts átfogó teljesítmény elemzést az alábbi struktúrában:

## Összefoglaló
2-3 mondat: fiók egészségi állapota, legfontosabb szám, legkritikusabb probléma.

## Kampány teljesítmény
Táblázat a kampányokról a legfontosabb metrikákkal. Az utolsó oszlopban adj értékelést (✅/⚠️/🔴).

## Trendek
Heti összehasonlítás: mi javult, mi romlott, mekkora a változás %-ban.

## Top lehetőségek
Számozott lista, priorizálva. Minden ponthoz: mit csináljon, várható hatás, sürgősség.

## Következő lépések
3-5 konkrét teendő, priorizálva, becsült hatással.`,

  budget: `Elemezd a budget elosztást és impression share adatokat:

## Budget összefoglaló
Havi összes költés, napi átlag, top 3 költő kampány.

## Budget hatékonyság
Táblázat: kampány, napi budget, tényleges költés, IS%, Budget Lost IS%, ROAS. Értékelés oszloppal.

## Elszalasztott lehetőségek
Kampányok, ahol a Budget Lost IS% > 10% — mennyi extra forgalom lenne elérhető és mennyibe kerülne.

## Átcsoportosítási javaslatok
Konkrétan: honnan vennél el, hová tennéd, és miért. Táblázatban: kampány, jelenlegi budget, javasolt budget, indoklás.

## Következő lépések
Számozott, priorizált teendők.`,

  keywords: `Elemezd a kulcsszó teljesítményt:

## Kulcsszó összefoglaló
Hány aktív kulcsszó, átlag QS, top és bottom performers.

## Teljesítmény táblázat
Kulcsszavak táblázata: kulcsszó, QS, CTR, CPC, konverzió, ROAS, értékelés.

## Quality Score problémák
Kulcsszavak QS < 5 alatt — mi a gond (expected CTR / ad relevance / landing page) és mit kellene csinálni.

## Negatív kulcsszó javaslatok
Ha vannak magas költségű, nulla konverziós kulcsszavak, javasold negatívnak.

## Következő lépések
Mit optimalizáljon először, másodszor, harmadszor.`,

  anomaly: `Hasonlítsd össze az utolsó 7 napot az előző 7 nappal:

## Összefoglaló
Mi a legfontosabb változás egy mondatban.

## Változások táblázata
Kampányonkénti összehasonlítás: minden metrika előző vs. jelenlegi vs. változás%. Csak a 10%-nál nagyobb változásokat jelöld.

## Kritikus anomáliák
20%+ változások részletes elemzése: mi történhetett, lehetséges okok (szezonalitás, budget limit, verseny, QS romlás).

## Azonnali teendők
Ha van kritikus anomália, mit kell MOST csinálni.

## Következő lépések
Monitorozási javaslatok.`,

  report: `Készíts professzionális havi ügyféljelentést. Tiszta, jól strukturált, copy-paste ready formátum.

# Havi Google Ads jelentés

## Vezetői összefoglaló
3-4 mondat: legfontosabb eredmények, változások, javaslatok.

## KPI áttekintés
Táblázat: metrika, érték, benchmark, értékelés (✅/⚠️/🔴).

## Kampány teljesítmény
Részletes táblázat minden kampányról.

## Heti trendek
Mit mutat a hétről hétre változás.

## Eredmények és sikerek
Ami jól ment, konkrét számokkal.

## Fejlesztési területek
Ami nem ment jól, és mit javasol a szakértő.

## Következő időszak tervei
Konkrét lépések a következő hónapra.`,
};


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Nincs hitelesítés' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Érvénytelen token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'Anthropic API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { analysisType, accountData, customPrompt } = await req.json() as {
      analysisType: string;
      accountData: string;
      customPrompt?: string;
    };

    if (!analysisType || !accountData) {
      return new Response(JSON.stringify({ error: 'Missing analysisType or accountData' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const typePrompt = ANALYSIS_TYPE_PROMPTS[analysisType] || ANALYSIS_TYPE_PROMPTS.performance;
    const userMessage = customPrompt
      ? `${typePrompt}\n\nFelhasználó kérdése: ${customPrompt}\n\n---\n\n${accountData}`
      : `${typePrompt}\n\n---\n\n${accountData}`;

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const analysis = message.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');

    return new Response(JSON.stringify({
      analysis,
      analysisType,
      model: message.model,
      usage: message.usage,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[ads-analyze] Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

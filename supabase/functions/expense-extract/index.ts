import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { fileBase64 } = await req.json() as { fileBase64: string };
    if (!fileBase64) {
      return new Response(JSON.stringify({ error: 'No file data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[ExpenseExtract] PDF base64 length: ${fileBase64.length}`);

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Kiadás-adatkinyerő asszisztens vagy. Egy PDF számla vagy bizonylat alapján kinyered a kiadás adatait JSON formátumban:
- name: a kiadás neve/leírása (string, pl. "Figma éves előfizetés", "irodabérlés", "domain megújítás"). Ha van alap előfizetés + extra usage, a name az alap előfizetés legyen.
- amount: a fizetendő bruttó összeg számként (number vagy null). Elsődlegesen a számla "Total", "Amount due", "Balance due", "Total including tax" vagy ezekkel egyenértékű végösszeg mezőjét használd. Ha van ÁFA/tax/VAT/sales tax, az amount mindig tartalmazza az adót. Ne a nettó subtotal, ne a tax excluding total, ne a line item unit price legyen.
- currency: pénznem (string, alapértelmezett "HUF")
- category: kategória, az alábbiak egyike: "software", "marketing", "office", "hosting", "insurance", "transport", "education", "equipment", "other"
- type: "subscription" (előfizetés/ismétlődő szolgáltatás) vagy "investment" (egyszeri beruházás)
- frequency: "monthly" (havi), "yearly" (éves), vagy "one-time" (egyszeri)
- date: a számla/bizonylat dátuma YYYY-MM-DD formátumban (string vagy null)
- vendor: az eladó/szolgáltató neve (string vagy null)
- notes: egyéb releváns megjegyzés (string vagy null)
- subscription_hint: ha úgy ítéled meg, hogy ez egy előfizetés, írd ide a magyar nyelvű indoklást röviden (string vagy null, pl. "Claude Pro havi előfizetés felismerve", "Figma éves díj — ismétlődő kiadásként rögzítve"). Ha nem előfizetés, legyen null.
- extra_amount: előfizetésen felüli extra/usage költség összege számként (number vagy null). Pl. API usage, token túlhasználat, Copilot Usage stb. Ha nincs ilyen, legyen null.
- extra_description: az extra költség leírása (string vagy null, pl. "Copilot Usage", "API túlhasználat", "Extra token")

EXTRA KÖLTSÉG FELISMERÉS — FONTOS:
Sok SaaS számlán az alap előfizetési díj mellett van extra usage/használat alapú költség is. Példák:
- GitHub: "Copilot Pro - $10.00" + "Copilot Usage - $0.84"
- OpenAI: "ChatGPT Plus - $20.00" + "API Usage - $5.30"
- AWS/Cloud: alap díj + használat alapú kiegészítés
Ha ilyeneket látsz, az "amount" legyen az alap előfizetési díj bruttó összege, az "extra_amount" legyen a usage/extra rész bruttó összege, és az "extra_description" írja le mit fed az extra.
Ha a számlán nincs ilyen bontás (csak egy végösszeg van), az amount legyen a teljes összeg és extra_amount legyen null.

ÖSSZEG KINYERÉS — NAGYON FONTOS:
- Mindig azt az összeget add vissza, amit a felhasználónak ténylegesen fizetnie kell.
- Ha a számla tartalmaz "Subtotal", "Total excluding tax", "VAT" és "Total/Amount due" sorokat, akkor a "Total/Amount due" értéke az amount.
- Példa: ha a sor tétel €18.00, VAT 27% €4.86, Amount due €22.86, akkor amount = 22.86, nem 18.
- Csak akkor használj nettó összeget, ha a dokumentumban nincs adó és nincs külön bruttó/végösszeg mező.

ELŐFIZETÉS FELISMERÉS — NAGYON FONTOS:
Ha az alábbi jeleket látod, MINDIG "subscription" típusú és a megfelelő frequency (monthly/yearly) legyen:
- SaaS / szoftver szolgáltatás díja (pl. Claude, ChatGPT, Figma, Adobe, Notion, Slack, GitHub, AWS, Google Workspace stb.)
- Havi/éves díj, membership, plan, Pro/Plus/Premium, recurring, "your plan", "invoice for subscription"
- Email receipt / visszaigazolás / payment confirmation ismétlődő szolgáltatásról
- Hosting, domain, szerver bérlés, SSL, CDN díjak
- Felhő szolgáltatások (AWS, Azure, GCP, Vercel, Netlify, Supabase stb.)
- Biztosítás, bérlet, tagsági díj

A "subscription_hint" mezőben röviden jelezd, miért gondolod ismétlődőnek (pl. "GPT Plus havi előfizetés", "AWS havi szerverdíj").

KATEGÓRIA MEGHATÁROZÁS:
- software: szoftver előfizetés, licenc, SaaS szolgáltatás
- hosting: szerver, domain, SSL, CDN, felhő infrastruktúra
- marketing: reklám, hirdetés, SEO, social media
- office: irodabérlés, közüzemi díj, irodaszer
- insurance: biztosítás
- transport: szállítás, utazás, üzemanyag
- education: képzés, tanfolyam, konferencia
- equipment: hardver, eszköz, bútor
- other: ha nem illik máshová

Ha valamit nem tudsz biztosan kiolvasni, legyen null. NE találj ki adatot.
Csak a JSON objektumot add vissza, semmi mást.`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'file',
                file: {
                  filename: 'expense.pdf',
                  file_data: `data:application/pdf;base64,${fileBase64}`,
                },
              },
              {
                type: 'text',
                text: 'Kinyerd a kiadás adatait ebből a PDF számlából.',
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!openaiResponse.ok) {
      const errBody = await openaiResponse.text();
      console.error(`[ExpenseExtract] OpenAI API error ${openaiResponse.status}:`, errBody);
      return new Response(JSON.stringify({ error: `OpenAI API error: ${openaiResponse.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiJson = await openaiResponse.json();
    const content = openaiJson.choices?.[0]?.message?.content || '';
    console.log('[ExpenseExtract] OpenAI raw content:', content.substring(0, 500));

    if (!content) {
      return new Response(JSON.stringify({ error: 'OpenAI returned empty response' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const extracted = JSON.parse(cleaned);

    return new Response(JSON.stringify({ data: extracted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[ExpenseExtract] Error:', err);
    return new Response(JSON.stringify({ error: `Expense extraction failed: ${String(err)}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

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

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Read PDF as base64 from request body
    const { fileBase64 } = await req.json() as { fileBase64: string };
    if (!fileBase64) {
      return new Response(JSON.stringify({ error: 'No file data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call OpenAI API with Vision
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
            content: `Számla adatkinyerő asszisztens vagy. Egy PDF számla képéből kinyered a következő adatokat JSON formátumban:
- invoice_number: számlaszám (string vagy null ha nem olvasható)
- client_name: ügyfél/vevő neve (string vagy null)
- amount: összeg számként (number vagy null) - mindig a bruttó végösszeg
- currency: pénznem (string, alapértelmezett "HUF")
- issue_date: kiállítás dátuma YYYY-MM-DD formátumban (string vagy null)
- due_date: fizetési határidő YYYY-MM-DD formátumban (string vagy null)
- is_incoming: boolean - true ha EZ egy bejövő számla (mi vagyunk a vevő), false ha kimenő (mi vagyunk az eladó). Az eladó/szállító vs vevő/megrendelő alapján döntsd el.

FONTOS: Ha valamit nem tudsz biztosan kiolvasni, az értéke legyen null. NE találj ki adatot.
Csak a JSON objektumot add vissza, semmi mást.`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'file',
                file: {
                  filename: 'invoice.pdf',
                  file_data: `data:application/pdf;base64,${fileBase64}`,
                },
              },
              {
                type: 'text',
                text: 'Kinyerd az adatokat ebből a számlából.',
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    const openaiJson = await openaiResponse.json();
    const content = openaiJson.choices?.[0]?.message?.content || '';
    const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const extracted = JSON.parse(cleaned);

    return new Response(JSON.stringify({ data: extracted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[InvoiceExtract] Error:', err);
    return new Response(JSON.stringify({ error: 'Invoice extraction failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

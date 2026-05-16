import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RecordingSegment = {
  speakerId: string;
  text: string;
  start: number | null;
  end: number | null;
};

type AssignInput = {
  segments: RecordingSegment[];
  expectedSpeakerCount: number;
  recordingType: 'client_call' | 'internal_meeting';
  clientName?: string | null;
  userName?: string | null;
  userCompanyName?: string | null;
};

function fallbackSpeakers(input: AssignInput) {
  const ids = Array.from(new Set((input.segments || []).map(segment => segment.speakerId))).filter(Boolean);
  const speakerIds = ids.length > 0
    ? ids
    : Array.from({ length: Math.max(input.expectedSpeakerCount || 2, 1) }, (_, index) => `speaker_${index}`);

  return speakerIds.map((id, index) => {
    if (input.recordingType === 'client_call' && index === 0) return { id, label: 'Te', role: 'user' };
    if (input.recordingType === 'client_call' && index === 1) return { id, label: 'Ügyfél', role: 'client' };
    return { id, label: `Beszélő ${index + 1}`, role: 'participant' };
  });
}

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

    const input = await req.json() as AssignInput;
    if (!Array.isArray(input.segments) || input.segments.length === 0) {
      return new Response(JSON.stringify({
        speakers: fallbackSpeakers(input),
        confidence: 'low',
        needsReview: true,
        reason: 'Nem érkezett diarizált átirat.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (input.recordingType === 'internal_meeting') {
      return new Response(JSON.stringify({
        speakers: fallbackSpeakers(input),
        confidence: 'medium',
        needsReview: true,
        reason: 'Belső megbeszélésnél a beszélők neveit a felhasználó pontosítja az összefoglaló előtt.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const compactTranscript = input.segments
      .slice(0, 80)
      .map(segment => `${segment.speakerId}: ${segment.text}`)
      .join('\n');

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Magyar üzleti hívások beszélő-szerep hozzárendelője vagy. Csak JSON-t adj vissza. Feladat: a diarizált speaker_id-kat rendeld szerepekhez: user, client vagy participant. Ha bizonytalan vagy, needsReview=true és confidence medium vagy low. Ne találj ki új speaker_id-t.`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              recordingType: input.recordingType,
              expectedSpeakerCount: input.expectedSpeakerCount,
              userName: input.userName,
              userCompanyName: input.userCompanyName,
              clientName: input.clientName,
              transcript: compactTranscript,
              requiredShape: {
                speakers: [{ id: 'speaker_0', label: 'Te', role: 'user' }],
                confidence: 'high | medium | low',
                needsReview: false,
                reason: 'rövid magyar indoklás',
              },
            }),
          },
        ],
        temperature: 0.1,
        max_tokens: 700,
      }),
    });

    const openaiJson = await openaiResponse.json();
    const content = openaiJson.choices?.[0]?.message?.content || '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }

    const fallback = fallbackSpeakers(input);
    const validIds = new Set(input.segments.map(segment => segment.speakerId));
    const speakers = Array.isArray(parsed.speakers)
      ? parsed.speakers
          .filter((speaker: any) => speaker && validIds.has(speaker.id))
          .map((speaker: any) => ({
            id: speaker.id,
            label: typeof speaker.label === 'string' && speaker.label.trim() ? speaker.label.trim() : speaker.id,
            role: ['user', 'client', 'participant'].includes(speaker.role) ? speaker.role : 'participant',
          }))
      : [];

    const confidence = ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium';
    const needsReview = Boolean(parsed.needsReview) || confidence !== 'high' || speakers.length !== validIds.size;

    return new Response(JSON.stringify({
      speakers: speakers.length > 0 ? speakers : fallback,
      confidence,
      needsReview,
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[AssignRecordingSpeakers] Error:', err);
    return new Response(JSON.stringify({ error: 'Speaker assignment failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

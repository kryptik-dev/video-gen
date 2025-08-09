import axios from 'axios';

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

function buildPrompt(dateStr) {
  return [
    {
      role: 'user',
      parts: [
        {
          text: `You are a content planner for daily short-form videos.
Return ONLY strict JSON (no markdown, no backticks) with this shape:
{
  "title": string,
  "description": string,
  "tags": string[],
  "scenes": [
    { "text": string, "searchTerms": string[] }
  ],
  "musicTag": string, // choose from: sad, melancholic, happy, euphoric/high, excited, chill, uneasy, angry, dark, hopeful, contemplative, funny/quirky
  "voice": string      // choose a kokoro voice e.g. af_heart, am_liam, bf_isabella
}

Constraints:
- Audience: general-interest Shorts.
- Topic: create a timely, trending micro-story for today (${dateStr}).
- Duration: keep narration <= 20 seconds total.
- Scenes: 1-3 scenes max, each with concise narration.
- searchTerms: concrete visual keywords for Pexels (e.g., "city skyline", "clock closeup", "crowd cheering").
- Keep title catchy (< 70 chars). Description 1-2 sentences + 3-5 hashtags.
- Vary topic daily; avoid repeats of recent global meme topics.
`
        }
      ]
    }
  ];
}

function parseGeminiResponse(data) {
  const candidates = data?.candidates;
  const text = candidates?.[0]?.content?.parts?.[0]?.text || '';
  try {
    return JSON.parse(text);
  } catch (_) {
    // Try to salvage JSON in case of extra text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (_) {}
    }
    throw new Error('Failed to parse Gemini JSON response');
  }
}

export async function generateDailyPlan() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const dateStr = new Date().toISOString().slice(0, 10);
  const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(DEFAULT_MODEL)}:generateContent?key=${apiKey}`;

  const { data } = await axios.post(url, {
    contents: buildPrompt(dateStr)
  }, {
    timeout: 30_000
  });

  const plan = parseGeminiResponse(data);

  // Basic validation and fallbacks
  if (!Array.isArray(plan?.scenes) || plan.scenes.length === 0) {
    plan.scenes = [
      { text: 'A fascinating bite-sized fact for today.', searchTerms: ['nature', 'city', 'time'] }
    ];
  }
  if (!plan.musicTag) plan.musicTag = 'chill';
  if (!plan.voice) plan.voice = 'af_heart';
  if (!Array.isArray(plan.tags)) plan.tags = ['shorts'];
  if (!plan.title) plan.title = 'Daily Bite';
  if (!plan.description) plan.description = 'Daily short. #shorts';

  return plan;
}




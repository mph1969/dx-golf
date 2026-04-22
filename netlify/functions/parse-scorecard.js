// Parse a golf scorecard image into structured course data via Claude Vision.
//
// Client POSTs { image: "data:image/...;base64,...", hint?: string }
// Response: { ok: true, course: {...} } | { ok: false, error: "..." }
//
// Requires Netlify env var: ANTHROPIC_API_KEY

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2048;

const TOOL = {
  name: 'save_scorecard',
  description: 'Save parsed golf scorecard data. Return null for any yardage or rating not visible on the card. Par and stroke index are always required per hole.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Course name (e.g. "Nicklaus Course")' },
      club: { type: 'string', description: 'Club or facility name (e.g. "BRG Danang Golf Resort")' },
      notes: { type: 'string', description: 'Any other useful detail visible (optional)' },
      tees: {
        type: 'object',
        description: 'Tee metadata keyed by standard color: gold (longest/championship), blue, white, red (shortest). Omit keys for tees not present on the card.',
        properties: {
          gold:  { type: 'object', properties: { rating: { type: ['number','null'] }, slope: { type: ['number','null'] }, par: { type: ['number','null'] }, label: { type: 'string' } } },
          blue:  { type: 'object', properties: { rating: { type: ['number','null'] }, slope: { type: ['number','null'] }, par: { type: ['number','null'] }, label: { type: 'string' } } },
          white: { type: 'object', properties: { rating: { type: ['number','null'] }, slope: { type: ['number','null'] }, par: { type: ['number','null'] }, label: { type: 'string' } } },
          red:   { type: 'object', properties: { rating: { type: ['number','null'] }, slope: { type: ['number','null'] }, par: { type: ['number','null'] }, label: { type: 'string' } } }
        }
      },
      holes: {
        type: 'array',
        minItems: 18,
        maxItems: 18,
        description: 'Exactly 18 holes in course order (1..18). If the card only shows 9, mark missing data null but still return 18 entries.',
        items: {
          type: 'object',
          properties: {
            par: { type: 'number' },
            si: { type: 'number', description: 'Stroke index 1..18, unique across all 18 holes' },
            gold:  { type: ['number','null'] },
            blue:  { type: ['number','null'] },
            white: { type: ['number','null'] },
            red:   { type: ['number','null'] }
          },
          required: ['par','si']
        }
      }
    },
    required: ['name','holes']
  }
};

const SYSTEM = [
  'You are a precise golf scorecard parser.',
  'Given a photo of a scorecard, extract hole-by-hole data and tee metadata and return it via the save_scorecard tool.',
  'Rules:',
  '- Always return exactly 18 holes, in course order (front 9 then back 9).',
  '- Stroke indices (SI) must be integers 1..18 with no duplicates. Some cards label SI as "Index", "HCP", "Hdcp" or "Handicap".',
  '- Map the physical tee colors on the card to the standard set: gold = longest/championship, red = shortest/forward, with blue and white in between. If the card uses names like "Monty", "Black", "Yellow", "Green" etc, pick the closest standard slot and put the original label in tees.<color>.label.',
  '- Yardages are sometimes in meters; if clearly labeled meters, convert to yards by multiplying by 1.0936 and rounding.',
  '- If a value is not visible, return null. Do not guess.',
  '- The Course Rating and Slope Rating may be printed separately or absent; leave null when absent.',
  '- Do not include the OUT/IN/TOTAL summary rows as holes.'
].join('\n');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'POST only' }) };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server missing ANTHROPIC_API_KEY' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON body' }) }; }

  const image = body.image;
  const hint = typeof body.hint === 'string' ? body.hint : '';
  if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Missing or malformed image' }) };
  }

  const m = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Image must be a base64 data URL' }) };
  }
  const mediaType = m[1];
  const data = m[2];

  const userText = hint
    ? `Parse this scorecard. Context: ${hint}`
    : 'Parse this scorecard into structured data using the save_scorecard tool.';

  const payload = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: 'save_scorecard' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
          { type: 'text', text: userText }
        ]
      }
    ]
  };

  let apiResp;
  try {
    apiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ ok: false, error: 'Upstream request failed: ' + (e && e.message) }) };
  }

  const raw = await apiResp.text();
  if (!apiResp.ok) {
    return { statusCode: apiResp.status, body: JSON.stringify({ ok: false, error: 'Claude API ' + apiResp.status, detail: raw.slice(0, 500) }) };
  }

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { return { statusCode: 502, body: JSON.stringify({ ok: false, error: 'Could not parse Claude response' }) }; }

  const toolBlock = Array.isArray(parsed.content)
    ? parsed.content.find(b => b.type === 'tool_use' && b.name === 'save_scorecard')
    : null;
  if (!toolBlock || !toolBlock.input) {
    return { statusCode: 502, body: JSON.stringify({ ok: false, error: 'No tool_use block returned', stop: parsed.stop_reason }) };
  }

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ok: true, course: toolBlock.input, usage: parsed.usage || null })
  };
};

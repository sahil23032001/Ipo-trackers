import { NextResponse } from 'next/server'

let cache = { date: null, data: null }

const today = () => new Date().toISOString().split('T')[0]

const PROMPT = (date) => `You are an AI financial research analyst for the Indian IPO market.
Current Date: ${date}

List all IPOs on NSE/BSE (Mainboard, SME, InvIT, REIT) that are open, upcoming, recently listed, or closed near ${date}.
Return ONLY a valid JSON array — no markdown, no explanation.

Rules:
- Sort by ipo_open_date latest first
- All money in INR crores
- AI scores 0–10
- expected_listing_price = price_band_max + current_gmp (null if no GMP)

Each item:
{
  "ipo_name": "",
  "company_name": "",
  "exchange": "NSE | BSE | BOTH",
  "ipo_type": "Mainboard | SME | InvIT | REIT",
  "sector": "",
  "status": "Open | Upcoming | Listed | Closed",
  "ipo_open_date": "",
  "ipo_close_date": "",
  "listing_date": "",
  "price_band_min": null,
  "price_band_max": null,
  "lot_size": null,
  "issue_size_cr": null,
  "gmp": null,
  "expected_listing_price": null,
  "expected_gain_percent": null,
  "overall_score": null,
  "listing_gain_score": null,
  "long_term_score": null,
  "strengths": [],
  "risks": []
}`

export async function GET(req) {
  const force = new URL(req.url).searchParams.get('refresh') === 'true'
  const date = today()

  if (!force && cache.date === date && cache.data) {
    return NextResponse.json({ data: cache.data, cached: true, date })
  }

  const key = process.env.GROQ_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'GROQ_API_KEY not set in environment variables' }, { status: 500 })
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 8000,
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'Return ONLY valid JSON arrays. No markdown. No explanation.' },
          { role: 'user', content: PROMPT(date) },
        ],
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error?.message || `Groq error ${res.status}`)
    }

    const json = await res.json()
    let text = json.choices[0].message.content.replace(/```json|```/gi, '').trim()
    const match = text.match(/\[[\s\S]*\]/)
    if (match) text = match[0]

    const data = JSON.parse(text)
    cache = { date, data }

    return NextResponse.json({ data, cached: false, date })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

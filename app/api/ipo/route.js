import { NextResponse } from 'next/server'

let cache = { date: null, data: null }

const today = () => new Date().toISOString().split('T')[0]

const PROMPT = (date) => {
  const label = new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  return `You are an expert Indian IPO market analyst.

TODAY IS: ${date} (${label})

TASK: Return Indian IPOs in this priority order:
1. OPEN IPOs — currently accepting subscriptions (ipo_open_date <= ${date} AND ipo_close_date >= ${date}) — include ALL of them
2. UPCOMING IPOs — opening within next 15 days from ${date}
3. RECENTLY LISTED — listed within last 30 days from ${date}
4. RECENTLY CLOSED — closed within last 7 days, listing pending

STATUS RULES (apply strictly based on ${date}):
- "Open"     → ipo_open_date <= ${date} AND ipo_close_date >= ${date}
- "Upcoming" → ipo_open_date > ${date}
- "Listed"   → listing_date != null AND listing_date <= ${date}
- "Closed"   → ipo_close_date < ${date} AND (listing_date is null OR listing_date > ${date})

Only include 2025-2026 IPOs. All dates YYYY-MM-DD. Money in INR crores. Scores 0-10.
Return ONLY a raw JSON array. No markdown. No code fences. No text outside the array.

Each object:
{
  "ipo_name": "Company IPO",
  "company_name": "Full Name Ltd",
  "exchange": "NSE or BSE or BOTH",
  "ipo_type": "Mainboard or SME or InvIT or REIT",
  "sector": "sector name",
  "status": "Open or Upcoming or Listed or Closed",
  "ipo_open_date": "YYYY-MM-DD",
  "ipo_close_date": "YYYY-MM-DD",
  "listing_date": "YYYY-MM-DD or null",
  "price_band_min": 100,
  "price_band_max": 110,
  "lot_size": 135,
  "issue_size_cr": 500,
  "gmp": 25,
  "expected_listing_price": 135,
  "expected_gain_percent": 22.7,
  "overall_score": 7.5,
  "listing_gain_score": 7.0,
  "long_term_score": 6.5,
  "strengths": ["Point 1", "Point 2", "Point 3"],
  "risks": ["Risk 1", "Risk 2"]
}`
}

export async function GET(req) {
  const force = new URL(req.url).searchParams.get('refresh') === 'true'
  const date = today()

  // Serve cache if same day and not forced
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
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: `You are an Indian IPO data API. Today is ${date}. Return ONLY a valid JSON array. No markdown, no code fences, no text outside the array.`
          },
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

    const raw = JSON.parse(text)

    // Server-side status correction based on real date
    const now = new Date(date)
    const processed = raw.map(ipo => {
      const open    = ipo.ipo_open_date  ? new Date(ipo.ipo_open_date)  : null
      const close   = ipo.ipo_close_date ? new Date(ipo.ipo_close_date) : null
      const listing = ipo.listing_date   ? new Date(ipo.listing_date)   : null
      let status = ipo.status
      if      (listing && listing <= now)                     status = 'Listed'
      else if (open && close && open <= now && now <= close)  status = 'Open'
      else if (open && open > now)                            status = 'Upcoming'
      else if (close && close < now)                          status = 'Closed'
      return { ...ipo, status }
    })

    // Sort: Open first, then Upcoming, then Listed, then Closed
    const ORDER = { Open: 0, Upcoming: 1, Listed: 2, Closed: 3 }
    processed.sort((a, b) => {
      const statusDiff = (ORDER[a.status] ?? 4) - (ORDER[b.status] ?? 4)
      if (statusDiff !== 0) return statusDiff
      return (b.ipo_open_date || '').localeCompare(a.ipo_open_date || '')
    })

    cache = { date, data: processed }
    return NextResponse.json({ data: processed, cached: false, date })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

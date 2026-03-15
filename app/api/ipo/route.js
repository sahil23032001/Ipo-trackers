import { NextResponse } from 'next/server'

let cache = { date: null, data: null }
const today = () => new Date().toISOString().split('T')[0]

// Step 1: Scrape Chittorgarh for real IPO names + dates
async function scrapeChittorgarh() {
  try {
    const res = await fetch('https://www.chittorgarh.com/report/ipo-in-india-list-main-board-sme/82/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.google.com/',
        'Cache-Control': 'no-cache',
      },
    })
    if (!res.ok) return null
    const html = await res.text()
    return html
  } catch {
    return null
  }
}

// Parse basic IPO rows from HTML table
function parseIPOTable(html) {
  const ipos = []
  // Match table rows with IPO data
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
  const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').trim()

  let rowMatch
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const row = rowMatch[1]
    const cells = []
    let cellMatch
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(stripTags(cellMatch[1]))
    }
    if (cells.length >= 4 && cells[0] && cells[0].length > 2 && !cells[0].toLowerCase().includes('company')) {
      ipos.push({
        ipo_name: cells[0].includes('IPO') ? cells[0] : cells[0] + ' IPO',
        company_name: cells[0],
        ipo_open_date: cells[1] || '',
        ipo_close_date: cells[2] || '',
        listing_date: cells[3] || null,
        issue_size_cr: cells[4] ? parseFloat(cells[4].replace(/[^\d.]/g, '')) || null : null,
        price_band: cells[5] || '',
      })
    }
  }
  return ipos.slice(0, 30) // top 30 rows
}

// Step 2: Use Groq to enrich the real IPO list with scores, GMP estimates, strengths, risks
async function enrichWithGroq(ipos, date, apiKey) {
  const slim = ipos.map(i => ({
    ipo_name: i.ipo_name,
    company_name: i.company_name,
    open: i.ipo_open_date,
    close: i.ipo_close_date,
    listing: i.listing_date,
    size: i.issue_size_cr,
    price_band: i.price_band,
  }))

  const prompt = `Today is ${date}.

Here are REAL Indian IPOs scraped from chittorgarh.com:
${JSON.stringify(slim, null, 2)}

For each IPO above, return enriched data. Use your knowledge about these companies to fill in:
- exchange, ipo_type, sector
- price_band_min, price_band_max, lot_size
- gmp (grey market premium estimate, null if unknown)
- expected_listing_price, expected_gain_percent
- overall_score, listing_gain_score, long_term_score (0-10)
- strengths (2-3 points), risks (2 points)

Status rules based on ${date}:
- "Open" if open_date <= ${date} AND close_date >= ${date}
- "Upcoming" if open_date > ${date}
- "Listed" if listing_date <= ${date}
- "Closed" otherwise

Return ONLY a JSON array with ALL these fields per item:
{
  "ipo_name": "", "company_name": "", "exchange": "", "ipo_type": "",
  "sector": "", "status": "",
  "ipo_open_date": "", "ipo_close_date": "", "listing_date": null,
  "price_band_min": null, "price_band_max": null, "lot_size": null,
  "issue_size_cr": null, "gmp": null,
  "expected_listing_price": null, "expected_gain_percent": null,
  "overall_score": null, "listing_gain_score": null, "long_term_score": null,
  "strengths": [], "risks": []
}
No markdown. No explanation. Just the array.`

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 8000,
      temperature: 0.1,
      messages: [
        { role: 'system', content: 'You are an Indian IPO analyst. Return ONLY valid JSON arrays. No markdown, no code fences.' },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!res.ok) throw new Error(`Groq error ${res.status}`)
  const json = await res.json()
  let text = json.choices[0].message.content.replace(/```json|```/gi, '').trim()
  const match = text.match(/\[[\s\S]*\]/)
  return JSON.parse(match ? match[0] : text)
}

// Fallback: pure Groq if scraping fails
async function groqFallback(date, apiKey) {
  const label = new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 8000,
      temperature: 0.1,
      messages: [
        { role: 'system', content: 'You are an Indian IPO data analyst. Return ONLY a valid JSON array. No markdown, no code fences.' },
        { role: 'user', content: `Today is ${date} (${label}). List all real Indian IPOs that are Open, Upcoming (next 15 days), or recently Listed/Closed (last 20 days) relative to ${date}. Only 2025-2026 IPOs. Sort: Open first, then Upcoming, then Listed, then Closed. Return JSON array with fields: ipo_name, company_name, exchange, ipo_type, sector, status, ipo_open_date, ipo_close_date, listing_date, price_band_min, price_band_max, lot_size, issue_size_cr, gmp, expected_listing_price, expected_gain_percent, overall_score, listing_gain_score, long_term_score, strengths[], risks[]. No markdown.` },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Groq fallback error ${res.status}`)
  const json = await res.json()
  let text = json.choices[0].message.content.replace(/```json|```/gi, '').trim()
  const match = text.match(/\[[\s\S]*\]/)
  return JSON.parse(match ? match[0] : text)
}

function correctStatuses(data, date) {
  const now = new Date(date)
  return data.map(ipo => {
    const open    = ipo.ipo_open_date  ? new Date(ipo.ipo_open_date)  : null
    const close   = ipo.ipo_close_date ? new Date(ipo.ipo_close_date) : null
    const listing = ipo.listing_date   ? new Date(ipo.listing_date)   : null
    let status = ipo.status
    if      (listing && listing <= now)                     status = 'Listed'
    else if (open && close && open <= now && now <= close)  status = 'Open'
    else if (open && open > now)                            status = 'Upcoming'
    else if (close && close < now)                          status = 'Closed'
    return { ...ipo, status }
  }).sort((a, b) => {
    const ORDER = { Open: 0, Upcoming: 1, Listed: 2, Closed: 3 }
    const d = (ORDER[a.status] ?? 4) - (ORDER[b.status] ?? 4)
    return d !== 0 ? d : (b.ipo_open_date || '').localeCompare(a.ipo_open_date || '')
  })
}

export async function GET(req) {
  const force = new URL(req.url).searchParams.get('refresh') === 'true'
  const date = today()

  if (!force && cache.date === date && cache.data) {
    return NextResponse.json({ data: cache.data, cached: true, date, source: 'cache' })
  }

  const key = process.env.GROQ_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'GROQ_API_KEY not set' }, { status: 500 })
  }

  try {
    let rawData
    let source = 'groq'

    // Try scraping Chittorgarh first
    const html = await scrapeChittorgarh()
    if (html && html.length > 5000) {
      const scraped = parseIPOTable(html)
      if (scraped.length > 0) {
        // Enrich scraped real data with Groq
        rawData = await enrichWithGroq(scraped, date, key)
        source = 'chittorgarh+groq'
      }
    }

    // Fallback to pure Groq if scraping failed
    if (!rawData || rawData.length === 0) {
      rawData = await groqFallback(date, key)
      source = 'groq'
    }

    const processed = correctStatuses(rawData, date)
    cache = { date, data: processed }

    return NextResponse.json({ data: processed, cached: false, date, source })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

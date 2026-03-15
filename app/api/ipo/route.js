import { NextResponse } from 'next/server'

let cache = { date: null, data: null }
const today = () => new Date().toISOString().split('T')[0]

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Referer': 'https://www.google.com/',
}

const strip = (s) => s?.replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim() || ''

// Parse ipowatch.in IPO table
function parseIpoWatchTable(html) {
  const ipos = []
  // Find all table rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i

  let row
  while ((row = rowRegex.exec(html)) !== null) {
    const rowHtml = row[1]
    const cells = []
    let cell
    while ((cell = cellRegex.exec(rowHtml)) !== null) {
      cells.push({ text: strip(cell[1]), html: cell[1] })
    }

    if (cells.length >= 3) {
      const nameCell = cells[0]
      const name = nameCell.text
      if (!name || name.length < 3 || name.toLowerCase().includes('company') || name.toLowerCase().includes('ipo name')) continue

      // Extract link for more details
      const linkMatch = nameCell.html.match(linkRegex)
      const link = linkMatch ? linkMatch[1] : null

      // Parse date range like "16-18 March" or "16th – 18th Mar 2026"
      const dateText = cells[1]?.text || ''
      const sizeText = cells[2]?.text || ''
      const priceText = cells[3]?.text || ''

      ipos.push({ name, dateText, sizeText, priceText, link })
    }
  }
  return ipos
}

// Parse dates like "16-18 March", "16th – 18th Mar 2026", "24-27 March"
function parseDateRange(str, year = new Date().getFullYear()) {
  if (!str) return { open: null, close: null }
  const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
    january:1,february:2,march:3,april:4,june:6,july:7,august:8,september:9,october:10,november:11,december:12 }

  // Match patterns like "16-18 March" or "16 – 18 Mar 2026"
  const m = str.toLowerCase().match(/(\d+)[^\d]+(\d+)[^\d]*([a-z]+)[\s,]*(\d{4})?/)
  if (m) {
    const mon = months[m[3].substring(0,3)]
    if (!mon) return { open: null, close: null }
    const y = m[4] ? parseInt(m[4]) : year
    const pad = (n) => String(n).padStart(2,'0')
    return {
      open: `${y}-${pad(mon)}-${pad(parseInt(m[1]))}`,
      close: `${y}-${pad(mon)}-${pad(parseInt(m[2]))}`
    }
  }
  return { open: null, close: null }
}

// Parse price band like "₹304 to ₹320" or "₹99 – ₹100"
function parsePriceBand(str) {
  if (!str) return { min: null, max: null }
  const nums = str.replace(/[₹Rs.,]/g,'').match(/\d+/g)
  if (!nums || nums.length < 2) return { min: nums?.[0] ? parseInt(nums[0]) : null, max: null }
  return { min: parseInt(nums[0]), max: parseInt(nums[nums.length-1]) }
}

// Parse issue size like "₹400 Cr." -> 400
function parseSize(str) {
  if (!str) return null
  const m = str.replace(/[₹,]/g,'').match(/[\d.]+/)
  return m ? parseFloat(m[0]) : null
}

async function scrapeIPOWatch() {
  try {
    const res = await fetch('https://ipowatch.in/upcoming-ipo-list/', { headers: HEADERS })
    if (!res.ok) return []
    const html = await res.text()
    return parseIpoWatchTable(html)
  } catch { return [] }
}

async function scrapeGMP() {
  try {
    const res = await fetch('https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/', { headers: HEADERS })
    if (!res.ok) return {}
    const html = await res.text()

    const gmpMap = {}
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
    let row
    while ((row = rowRegex.exec(html)) !== null) {
      const cells = []
      let cell
      while ((cell = cellRegex.exec(row[1])) !== null) {
        cells.push(strip(cell[1]))
      }
      if (cells.length >= 3) {
        const name = cells[0]?.toLowerCase().replace(/\s*ipo\s*/gi,'').trim()
        const gmpStr = cells[1] || cells[2] || ''
        const gmpNum = gmpStr.replace(/[₹+\s]/g,'').match(/-?\d+/)
        if (name && gmpNum) {
          gmpMap[name] = parseInt(gmpNum[0])
        }
      }
    }
    return gmpMap
  } catch { return {} }
}

async function enrichWithGroq(ipos, gmpMap, date, apiKey) {
  const prompt = `Today is ${date}. Here are REAL Indian IPOs from ipowatch.in.
Enrich each with your knowledge. Match GMP from the map by company name (fuzzy match).

IPOs:
${JSON.stringify(ipos, null, 2)}

GMP Map (company_name_lowercase -> gmp_value):
${JSON.stringify(gmpMap, null, 2)}

For each IPO return:
- exchange: "NSE" or "BSE" or "BOTH"  
- ipo_type: "Mainboard" or "SME" or "InvIT" or "REIT"
- sector: the company's sector
- lot_size: realistic lot size in shares
- gmp: match from GMP map or null
- expected_listing_price: price_band_max + gmp (null if no gmp)
- expected_gain_percent: round((gmp/price_band_max)*100, 2) or null
- overall_score: 0-10
- listing_gain_score: 0-10
- long_term_score: 0-10
- strengths: 2-3 short points
- risks: 2 short points

STATUS based on ${date}:
- "Open" if open_date <= ${date} AND close_date >= ${date}
- "Upcoming" if open_date > ${date}
- "Listed" if listing_date <= ${date}  
- "Closed" if close_date < ${date}

Return ONLY JSON array, no markdown:
[{"ipo_name":"","company_name":"","exchange":"","ipo_type":"","sector":"","status":"",
"ipo_open_date":"YYYY-MM-DD","ipo_close_date":"YYYY-MM-DD","listing_date":null,
"price_band_min":null,"price_band_max":null,"lot_size":null,"issue_size_cr":null,
"gmp":null,"expected_listing_price":null,"expected_gain_percent":null,
"overall_score":null,"listing_gain_score":null,"long_term_score":null,
"strengths":[],"risks":[]}]`

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 8000,
      temperature: 0.1,
      messages: [
        { role: 'system', content: 'Indian IPO analyst. Return ONLY valid JSON array. No markdown.' },
        { role: 'user', content: prompt },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Groq ${res.status}`)
  const json = await res.json()
  let text = json.choices[0].message.content.replace(/```json|```/gi, '').trim()
  const m = text.match(/\[[\s\S]*\]/)
  return JSON.parse(m ? m[0] : text)
}

function correctStatuses(data, date) {
  const now = new Date(date)
  const ORDER = { Open: 0, Upcoming: 1, Listed: 2, Closed: 3 }
  return data.map(ipo => {
    const open    = ipo.ipo_open_date  ? new Date(ipo.ipo_open_date)  : null
    const close   = ipo.ipo_close_date ? new Date(ipo.ipo_close_date) : null
    const listing = ipo.listing_date   ? new Date(ipo.listing_date)   : null
    let status = ipo.status
    if      (listing && listing <= now)                    status = 'Listed'
    else if (open && close && open <= now && now <= close) status = 'Open'
    else if (open && open > now)                           status = 'Upcoming'
    else if (close && close < now)                         status = 'Closed'
    return { ...ipo, status }
  }).sort((a, b) => {
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
  if (!key) return NextResponse.json({ error: 'GROQ_API_KEY not set' }, { status: 500 })

  try {
    // Scrape IPOWatch + GMP in parallel
    const [rawIpos, gmpMap] = await Promise.all([scrapeIPOWatch(), scrapeGMP()])

    let source = 'groq-only'
    let enriched

    if (rawIpos.length > 0) {
      // Prepare structured data for Groq enrichment
      const structured = rawIpos.slice(0, 20).map(i => {
        const { open, close } = parseDateRange(i.dateText)
        const { min, max } = parsePriceBand(i.priceText)
        const size = parseSize(i.sizeText)
        return {
          ipo_name: i.name.endsWith('IPO') ? i.name : i.name + ' IPO',
          company_name: i.name,
          ipo_open_date: open,
          ipo_close_date: close,
          issue_size_cr: size,
          price_band_min: min,
          price_band_max: max,
        }
      })

      enriched = await enrichWithGroq(structured, gmpMap, date, key)
      source = 'ipowatch+groq'
    } else {
      // Pure Groq fallback
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 8000, temperature: 0.1,
          messages: [
            { role: 'system', content: 'Return ONLY a valid JSON array. No markdown.' },
            { role: 'user', content: `Today is ${date}. List real Indian IPOs open/upcoming/recently listed. Fields: ipo_name,company_name,exchange,ipo_type,sector,status,ipo_open_date,ipo_close_date,listing_date,price_band_min,price_band_max,lot_size,issue_size_cr,gmp,expected_listing_price,expected_gain_percent,overall_score,listing_gain_score,long_term_score,strengths[],risks[].` },
          ],
        }),
      })
      const j = await res.json()
      let t = j.choices[0].message.content.replace(/```json|```/gi,'').trim()
      const m = t.match(/\[[\s\S]*\]/)
      enriched = JSON.parse(m ? m[0] : t)
    }

    const processed = correctStatuses(enriched, date)
    cache = { date, data: processed }
    return NextResponse.json({ data: processed, cached: false, date, source })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

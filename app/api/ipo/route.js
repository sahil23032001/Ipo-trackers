import { NextResponse } from 'next/server'

// In-memory cache (works within same instance)
let memCache = { ts: 0, data: null }
const TWO_HOURS = 2 * 60 * 60 * 1000
const today = () => new Date().toISOString().split('T')[0]

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Referer': 'https://www.google.com/',
}

const strip = (s) => s?.replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim() || ''

function parseIpoWatchTable(html) {
  const ipos = []
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
  let row
  while ((row = rowRegex.exec(html)) !== null) {
    const rowHtml = row[1]
    const cells = []
    let cell
    while ((cell = cellRegex.exec(rowHtml)) !== null) {
      cells.push(strip(cell[1]))
    }
    if (cells.length >= 3) {
      const name = cells[0]
      if (!name || name.length < 3 || name.toLowerCase().includes('company') || name.toLowerCase().includes('ipo name')) continue
      ipos.push({ name, dateText: cells[1] || '', sizeText: cells[2] || '', priceText: cells[3] || '' })
    }
  }
  return ipos
}

function parseDateRange(str, year = new Date().getFullYear()) {
  if (!str) return { open: null, close: null }
  const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
    january:1,february:2,march:3,april:4,june:6,july:7,august:8,september:9,october:10,november:11,december:12 }
  const m = str.toLowerCase().match(/(\d+)[^\d]+(\d+)[^\d]*([a-z]+)[\s,]*(\d{4})?/)
  if (m) {
    const mon = months[m[3].substring(0,3)]
    if (!mon) return { open: null, close: null }
    const y = m[4] ? parseInt(m[4]) : year
    const pad = (n) => String(n).padStart(2,'0')
    return { open: `${y}-${pad(mon)}-${pad(parseInt(m[1]))}`, close: `${y}-${pad(mon)}-${pad(parseInt(m[2]))}` }
  }
  return { open: null, close: null }
}

function parsePriceBand(str) {
  if (!str) return { min: null, max: null }
  const nums = str.replace(/[₹Rs.,]/g,'').match(/\d+/g)
  if (!nums || nums.length < 2) return { min: nums?.[0] ? parseInt(nums[0]) : null, max: null }
  return { min: parseInt(nums[0]), max: parseInt(nums[nums.length-1]) }
}

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
      while ((cell = cellRegex.exec(row[1])) !== null) cells.push(strip(cell[1]))
      if (cells.length >= 2) {
        const name = cells[0]?.toLowerCase().replace(/\s*ipo\s*/gi,'').trim()
        const gmpStr = cells[1] || cells[2] || ''
        const gmpNum = gmpStr.replace(/[₹+\s]/g,'').match(/-?\d+/)
        if (name && gmpNum) gmpMap[name] = parseInt(gmpNum[0])
      }
    }
    return gmpMap
  } catch { return {} }
}

async function enrichWithGroq(ipos, gmpMap, date, apiKey) {
  const prompt = `Today is ${date}. These are REAL Indian IPOs from ipowatch.in. Enrich with your knowledge.

IPOs: ${JSON.stringify(ipos, null, 2)}
GMP Map: ${JSON.stringify(gmpMap, null, 2)}

For each: exchange, ipo_type, sector, lot_size, gmp (from map or null), expected_listing_price, expected_gain_percent, overall_score, listing_gain_score, long_term_score (0-10), strengths(2-3), risks(2).

STATUS based on ${date}:
"Open" → open_date <= ${date} AND close_date >= ${date}
"Upcoming" → open_date > ${date}
"Listed" → listing_date <= ${date}
"Closed" → close_date < ${date}

Return ONLY JSON array, no markdown:
[{"ipo_name":"","company_name":"","exchange":"","ipo_type":"","sector":"","status":"","ipo_open_date":"","ipo_close_date":"","listing_date":null,"price_band_min":null,"price_band_max":null,"lot_size":null,"issue_size_cr":null,"gmp":null,"expected_listing_price":null,"expected_gain_percent":null,"overall_score":null,"listing_gain_score":null,"long_term_score":null,"strengths":[],"risks":[]}]`

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 8000, temperature: 0.1,
      messages: [
        { role: 'system', content: 'Indian IPO analyst. Return ONLY valid JSON array. No markdown.' },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Groq ${res.status}`)
  }
  const json = await res.json()
  let text = json.choices[0].message.content.replace(/```json|```/gi, '').trim()
  const m = text.match(/\[[\s\S]*\]/)
  return JSON.parse(m ? m[0] : text)
}

function processAndSort(data, date) {
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

// Read from Vercel KV if available
async function kvGet(key) {
  try {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null
    const res = await fetch(`${process.env.KV_REST_API_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
    })
    const json = await res.json()
    return json.result ? JSON.parse(json.result) : null
  } catch { return null }
}

// Write to Vercel KV if available, with 2hr TTL
async function kvSet(key, value) {
  try {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return
    await fetch(`${process.env.KV_REST_API_URL}/set/${key}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(value), ex: 7200 }) // 7200s = 2 hours
    })
  } catch {}
}

export async function GET(req) {
  const force = new URL(req.url).searchParams.get('refresh') === 'true'
  const date = today()

  // 1. Check in-memory cache first (same serverless instance)
  if (!force && memCache.data && (Date.now() - memCache.ts < TWO_HOURS)) {
    return NextResponse.json({ data: memCache.data, cached: true, date, source: 'mem-cache' })
  }

  // 2. Check Vercel KV cache (persists across instances)
  if (!force) {
    const kv = await kvGet('ipo_cache')
    if (kv && kv.ts && (Date.now() - kv.ts < TWO_HOURS)) {
      memCache = { ts: kv.ts, data: kv.data } // warm up mem cache
      return NextResponse.json({ data: kv.data, cached: true, date, source: 'kv-cache' })
    }
  }

  const key = process.env.GROQ_API_KEY
  if (!key) return NextResponse.json({ error: 'GROQ_API_KEY not set' }, { status: 500 })

  try {
    const [rawIpos, gmpMap] = await Promise.all([scrapeIPOWatch(), scrapeGMP()])

    let enriched, source

    if (rawIpos.length > 0) {
      const structured = rawIpos.slice(0, 20).map(i => {
        const { open, close } = parseDateRange(i.dateText)
        const { min, max } = parsePriceBand(i.priceText)
        return {
          ipo_name: i.name.endsWith('IPO') ? i.name : i.name + ' IPO',
          company_name: i.name,
          ipo_open_date: open, ipo_close_date: close,
          issue_size_cr: parseSize(i.sizeText),
          price_band_min: min, price_band_max: max,
        }
      })
      enriched = await enrichWithGroq(structured, gmpMap, date, key)
      source = 'ipowatch+groq'
    } else {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile', max_tokens: 8000, temperature: 0.1,
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
      source = 'groq-only'
    }

    const processed = processAndSort(enriched, date)
    const payload = { ts: Date.now(), data: processed }

    // Save to both caches
    memCache = payload
    await kvSet('ipo_cache', payload)

    return NextResponse.json({ data: processed, cached: false, date, source })
  } catch (e) {
    // On error, return stale cache if available rather than failing
    if (memCache.data) {
      return NextResponse.json({ data: memCache.data, cached: true, date, source: 'stale-cache', warning: e.message })
    }
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'

let memCache = { ts: 0, data: null }
const ONE_HOUR = 60 * 60 * 1000
const today = () => new Date().toISOString().split('T')[0]

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Referer': 'https://www.google.com/',
}

// ── GitHub file store ──────────────────────────────────────
// Stores cache.json in your GitHub repo under /data/cache.json
// Env vars needed: GITHUB_TOKEN, GITHUB_REPO (e.g. "username/ipo-intelligence")

async function githubRead() {
  const repo  = process.env.GITHUB_REPO
  const token = process.env.GITHUB_TOKEN
  if (!repo || !token) return null
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/data/cache.json`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' }
    })
    if (!res.ok) return null
    const json = await res.json()
    // Content is base64 encoded
    const decoded = Buffer.from(json.content, 'base64').toString('utf-8')
    return { data: JSON.parse(decoded), sha: json.sha }
  } catch { return null }
}

async function githubWrite(data, sha) {
  const repo  = process.env.GITHUB_REPO
  const token = process.env.GITHUB_TOKEN
  if (!repo || !token) return
  try {
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64')
    await fetch(`https://api.github.com/repos/${repo}/contents/data/cache.json`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `chore: update IPO cache ${today()}`,
        content,
        sha, // required for updates, undefined for first create
      })
    })
  } catch {}
}

// ── Scraping ───────────────────────────────────────────────
const strip = (s) => s?.replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim() || ''

function parseTable(html) {
  const ipos = []
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
  let row
  while ((row = rowRegex.exec(html)) !== null) {
    const cells = []
    let cell
    while ((cell = cellRegex.exec(row[1])) !== null) cells.push(strip(cell[1]))
    if (cells.length >= 3) {
      const name = cells[0]
      if (!name || name.length < 3 || /company|ipo name/i.test(name)) continue
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
  if (!m) return { open: null, close: null }
  const mon = months[m[3].substring(0,3)]
  if (!mon) return { open: null, close: null }
  const y = m[4] ? parseInt(m[4]) : year
  const pad = n => String(n).padStart(2,'0')
  return { open: `${y}-${pad(mon)}-${pad(parseInt(m[1]))}`, close: `${y}-${pad(mon)}-${pad(parseInt(m[2]))}` }
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
    return parseTable(await res.text())
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
        const gmpNum = (cells[1] || cells[2] || '').replace(/[₹+\s]/g,'').match(/-?\d+/)
        if (name && gmpNum) gmpMap[name] = parseInt(gmpNum[0])
      }
    }
    return gmpMap
  } catch { return {} }
}

// ── Groq ───────────────────────────────────────────────────
async function enrichWithGroq(ipos, gmpMap, date, apiKey) {
  const prompt = `Today is ${date}. Real Indian IPOs from ipowatch.in:
${JSON.stringify(ipos)}
GMP map: ${JSON.stringify(gmpMap)}

Return JSON array. Each item: exchange, ipo_type, sector, lot_size, gmp(from map or null), expected_listing_price(max+gmp), expected_gain_percent, overall_score, listing_gain_score, long_term_score(0-10), strengths(2), risks(2).
Status: Open if open<=${date}<=close, Upcoming if open>${date}, Listed if listing<=${date}, else Closed.
Only JSON array no markdown.`

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant', max_tokens: 4000, temperature: 0.1,
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

// ── Main handler ───────────────────────────────────────────
export async function GET(req) {
  const force = new URL(req.url).searchParams.get('refresh') === 'true'
  const date = today()

  // 1. In-memory cache (fastest, same instance)
  if (!force && memCache.data && (Date.now() - memCache.ts < ONE_HOUR)) {
    return NextResponse.json({ data: memCache.data, cached: true, date, source: 'memory' })
  }

  // 2. GitHub file cache (persists across all instances and deployments)
  if (!force) {
    const stored = await githubRead()
    if (stored?.data?.ts && (Date.now() - stored.data.ts < ONE_HOUR)) {
      memCache = { ts: stored.data.ts, data: stored.data.ipos }
      return NextResponse.json({ data: stored.data.ipos, cached: true, date, source: 'github' })
    }
  }

  // 3. Both expired — fetch fresh data
  const key = process.env.GROQ_API_KEY
  if (!key) return NextResponse.json({ error: 'GROQ_API_KEY not set' }, { status: 500 })

  try {
    const [rawIpos, gmpMap] = await Promise.all([scrapeIPOWatch(), scrapeGMP()])

    let enriched, source

    if (rawIpos.length > 0) {
      const structured = rawIpos.slice(0, 12).map(i => {
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
          model: 'llama-3.1-8b-instant', max_tokens: 4000, temperature: 0.1,
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
    const payload = { ts: Date.now(), date, ipos: processed }

    // Save to memory + GitHub
    memCache = { ts: payload.ts, data: processed }
    const existing = await githubRead() // get current sha for update
    await githubWrite(payload, existing?.sha)

    return NextResponse.json({ data: processed, cached: false, date, source })
  } catch (e) {
    // Return stale data on error
    if (memCache.data) {
      return NextResponse.json({ data: memCache.data, cached: true, date, source: 'stale', warning: e.message })
    }
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

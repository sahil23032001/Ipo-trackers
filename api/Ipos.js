// ── Budget: 25 API requests per day (free tier, limit=1 per request) ────────
// Strategy:
//   - All 4 statuses share a single daily fetch cycle
//   - On first request, we figure out total pages across all statuses,
//     then distribute remaining budget proportionally
//   - Everything is cached for 24 hours — zero API calls after initial load
//   - If budget runs out mid-fetch, we stop and serve what we have

const cache  = new Map(); // 'all' → { byStatus, fetchedAt }
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DAILY_BUDGET = 25;
const DELAY  = 200; // ms between requests

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchPage(status, page, apiKey) {
  const params = new URLSearchParams({ status, page, limit: 1 });
  const res  = await fetch(`https://api.ipoalerts.in/ipos?${params}`, {
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' }
  });
  return res.json();
}

async function fetchAllStatuses(apiKey) {
  const statuses = ['open', 'upcoming', 'announced', 'closed'];
  const byStatus = {};
  let requestsUsed = 0;

  // ── Phase 1: probe each status (4 requests) to get total page counts ──
  const probeCounts = {};
  for (const status of statuses) {
    if (requestsUsed >= DAILY_BUDGET) break;
    const data = await fetchPage(status, 1, apiKey);
    requestsUsed++;
    probeCounts[status] = {
      totalPages: data.meta?.totalPages || 1,
      firstIpo:   data.ipos || []
    };
    byStatus[status] = [...(data.ipos || [])];
    await sleep(DELAY);
  }

  // ── Phase 2: distribute remaining budget proportionally ───────────────
  const remaining = DAILY_BUDGET - requestsUsed; // e.g. 21 left
  const totalExtraPages = statuses.reduce((sum, s) => {
    return sum + Math.max(0, (probeCounts[s]?.totalPages || 1) - 1);
  }, 0);

  // Build a flat queue of (status, page) pairs ordered by priority (open first)
  const queue = [];
  for (const status of statuses) {
    const total = probeCounts[status]?.totalPages || 1;
    for (let p = 2; p <= total; p++) {
      queue.push({ status, page: p });
    }
  }

  // Fetch up to the remaining budget
  const toFetch = queue.slice(0, remaining);
  for (const { status, page } of toFetch) {
    if (requestsUsed >= DAILY_BUDGET) break;
    await sleep(DELAY);
    const data = await fetchPage(status, page, apiKey);
    requestsUsed++;
    if (data.ipos?.length) {
      byStatus[status] = [...(byStatus[status] || []), ...data.ipos];
    }
  }

  return { byStatus, requestsUsed, totalExtraPages };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.IPO_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'IPO_API_KEY env variable not set' });

  const { status = 'open' } = req.query;
  const now    = Date.now();
  const cached = cache.get('all');

  // ── Serve from cache if still fresh (24h) ──────────────────────────────
  if (cached && now - cached.fetchedAt < TTL_MS) {
    const ageMin    = Math.floor((now - cached.fetchedAt) / 1000 / 60);
    const expiresIn = Math.ceil((TTL_MS - (now - cached.fetchedAt)) / 1000 / 60);
    const ipos      = cached.byStatus[status] || [];
    res.setHeader('X-Cache',           'HIT');
    res.setHeader('X-Cache-Age',       `${ageMin}m`);
    res.setHeader('X-Cache-Expires',   `${expiresIn}m`);
    res.setHeader('X-IPO-Count',       String(ipos.length));
    res.setHeader('X-Requests-Used',   String(cached.requestsUsed));
    return res.status(200).json({ ipos, meta: { count: ipos.length } });
  }

  // ── Cache miss — run full daily fetch ─────────────────────────────────
  try {
    const { byStatus, requestsUsed, totalExtraPages } = await fetchAllStatuses(API_KEY);

    cache.set('all', { byStatus, fetchedAt: now, requestsUsed });

    const ipos = byStatus[status] || [];
    const truncated = (DAILY_BUDGET - 4) < totalExtraPages; // did we run out?

    res.setHeader('X-Cache',           'MISS');
    res.setHeader('X-Cache-Expires',   '1440m');
    res.setHeader('X-IPO-Count',       String(ipos.length));
    res.setHeader('X-Requests-Used',   String(requestsUsed));
    res.setHeader('X-Budget-Truncated', String(truncated));
    return res.status(200).json({ ipos, meta: { count: ipos.length, truncated } });

  } catch (err) {
    if (cached) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json({
        ipos: cached.byStatus[status] || [],
        meta: { count: (cached.byStatus[status] || []).length },
        _stale: true
      });
    }
    return res.status(500).json({ error: 'Failed to fetch IPO data', detail: err.message });
  }
}

// pages/api/ipos.js
// Budget: 25 API requests per day — paginates with limit=1, caches for 24h

const cache  = new Map();
const TTL_MS = 24 * 60 * 60 * 1000;
const DAILY_BUDGET = 25;
const DELAY  = 300;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchPage(status, page, apiKey) {
  const params = new URLSearchParams({ status, page, limit: 1 });
  const res = await fetch(`https://api.ipoalerts.in/ipos?${params}`, {
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' }
  });
  return res.json();
}

async function fetchAllStatuses(apiKey) {
  const statuses = ['open', 'upcoming', 'announced', 'closed'];
  const byStatus = {};
  let requestsUsed = 0;
  const probeCounts = {};

  for (const status of statuses) {
    if (requestsUsed >= DAILY_BUDGET) break;
    const data = await fetchPage(status, 1, apiKey);
    requestsUsed++;
    probeCounts[status] = { totalPages: data.meta?.totalPages || 1 };
    byStatus[status] = [...(data.ipos || [])];
    await sleep(DELAY);
  }

  const remaining = DAILY_BUDGET - requestsUsed;
  const queue = [];
  for (const status of statuses) {
    const total = probeCounts[status]?.totalPages || 1;
    for (let p = 2; p <= total; p++) queue.push({ status, page: p });
  }

  for (const { status, page } of queue.slice(0, remaining)) {
    if (requestsUsed >= DAILY_BUDGET) break;
    await sleep(DELAY);
    const data = await fetchPage(status, page, apiKey);
    requestsUsed++;
    if (data.ipos?.length) {
      byStatus[status] = [...(byStatus[status] || []), ...data.ipos];
    }
  }

  return { byStatus, requestsUsed };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.IPO_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'IPO_API_KEY not set' });

  const { status = 'open' } = req.query;
  const now    = Date.now();
  const cached = cache.get('all');

  if (cached && now - cached.fetchedAt < TTL_MS) {
    const ipos = cached.byStatus[status] || [];
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json({ ipos, meta: { count: ipos.length } });
  }

  try {
    const { byStatus, requestsUsed } = await fetchAllStatuses(API_KEY);
    cache.set('all', { byStatus, fetchedAt: now, requestsUsed });
    const ipos = byStatus[status] || [];
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Requests-Used', String(requestsUsed));
    return res.status(200).json({ ipos, meta: { count: ipos.length } });
  } catch (err) {
    if (cached) {
      return res.status(200).json({
        ipos: cached.byStatus[status] || [],
        meta: { count: (cached.byStatus[status] || []).length },
        _stale: true
      });
    }
    return res.status(500).json({ error: err.message });
  }
}

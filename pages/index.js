import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtDate = d => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }); }
  catch { return d; }
};
const fmtSize = v => {
  const n = parseFloat(v) || 0;
  if (!n) return '—';
  return '₹' + (n / 100).toFixed(0) + 'Cr';
};
const initials = name => (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
const gmpMean  = ipo => ipo.gmp?.aggregations?.mean ?? null;

function calcScore(ipo) {
  let s = 50;
  const g = gmpMean(ipo);
  if (g !== null) { if (g > 40) s += 22; else if (g > 20) s += 14; else if (g > 8) s += 7; else if (g < 0) s -= 18; }
  const sub = parseFloat(ipo.subscriptionTimes || ipo.subscription) || 0;
  if (sub > 50) s += 20; else if (sub > 20) s += 13; else if (sub > 5) s += 7; else if (sub > 0 && sub < 1) s -= 14;
  const sz = parseFloat(ipo.issueSize) || 0;
  if (sz > 5000) s += 8; else if (sz > 1000) s += 4;
  const lg = parseFloat(ipo.listingGain);
  if (!isNaN(lg)) { if (lg > 50) s += 10; else if (lg > 20) s += 6; else if (lg < 0) s -= 8; }
  s = Math.max(8, Math.min(96, Math.round(s)));
  if (s >= 72) return { s, cls: 'sr-h', v: 'Strong Apply' };
  if (s >= 50) return { s, cls: 'sr-m', v: 'Moderate' };
  return { s, cls: 'sr-l', v: 'Avoid' };
}

// ── Card Component ─────────────────────────────────────────────────────────
function IPOCard({ ipo, idx }) {
  const [drawer, setDrawer] = useState(null); // null | 'detail' | 'ai'
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const { s, cls, v } = calcScore(ipo);
  const gVal = gmpMean(ipo);
  const gStr = gVal !== null ? (gVal > 0 ? '+' : '') + gVal.toFixed(1) : null;
  const gCls = gVal === null ? 'neu' : gVal > 0 ? 'pos' : gVal < 0 ? 'neg' : 'neu';
  const srcs = (ipo.gmp?.sources || []).slice(0, 3);
  const sub  = parseFloat(ipo.subscriptionTimes || ipo.subscription) || null;
  const lg   = parseFloat(ipo.listingGain);
  const hasLG = !isNaN(lg);

  const slabel = { open: 'Open Now', upcoming: 'Upcoming', announced: 'Announced', closed: 'Closed' };
  const scls   = { open: 'b-open', upcoming: 'b-upcoming', announced: 'b-announced', closed: 'b-closed' };

  async function loadAI() {
    if (drawer === 'ai') { setDrawer(null); return; }
    setDrawer('ai');
    if (aiText) return;
    setAiLoading(true);
    const { s: score, v: verdict } = calcScore(ipo);
    const prompt = `You are a sharp Indian equity analyst. Write a 3–4 sentence analysis for a retail investor. Cover the core business, one key strength, one clear risk, and a direct verdict. Concise, no disclaimers.\n\nCompany: ${ipo.name} (${ipo.symbol || 'N/A'})\nIssue Size: ${fmtSize(ipo.issueSize)} | Price Band: ${ipo.priceRange || 'TBA'}\nStatus: ${ipo.status} | Score: ${score}/100 — ${verdict}\nGMP: ${gVal !== null ? (gVal > 0 ? '+' : '') + gVal + '%' : 'N/A'}\n${ipo.listingGain ? `Listing Gain: ${ipo.listingGain}%` : ''}\n${(ipo.strengths || []).slice(0, 2).join('; ')}`;
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
      });
      const data = await res.json();
      setAiText(data.content?.[0]?.text || 'Analysis unavailable.');
    } catch { setAiText('Could not load analysis.'); }
    finally { setAiLoading(false); }
  }

  return (
    <div className="card" style={{ animationDelay: `${idx * 0.04}s` }}>
      {/* Head */}
      <div className="chead">
        <div className="clogo">
          {ipo.logo
            ? <img src={ipo.logo} alt="" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
            : null}
          <span style={{ display: ipo.logo ? 'none' : 'flex' }}>{initials(ipo.name)}</span>
        </div>
        <div className="ctitle">
          <div className="cname" title={ipo.name}>{ipo.name || 'Unknown'}</div>
          <div className="cmeta">
            <span className={`badge ${scls[ipo.status] || 'b-closed'}`}>{slabel[ipo.status] || ipo.status}</span>
            {ipo.symbol && <span className="badge badge-sym">{ipo.symbol}</span>}
            {ipo.type && <span className="badge b-closed">{ipo.type}</span>}
          </div>
        </div>
      </div>

      {/* GMP */}
      {gVal !== null ? (
        <div className="gmp-row">
          <div className="gmp-main">
            <span className={`gmp-v ${gCls}`}>{gStr}</span>
            <span className="gmp-tag">gmp</span>
            {ipo.gmp?.aggregations && <span className="gmp-range">({ipo.gmp.aggregations.min}–{ipo.gmp.aggregations.max})</span>}
          </div>
          <div className="gmp-srcs">
            {srcs.map((x, i) => <span key={i} className="gmp-src-chip">{x.name} <b>{x.gmpPrice > 0 ? '+' : ''}{x.gmpPrice}</b></span>)}
          </div>
        </div>
      ) : (
        <div className="gmp-na">— GMP not available on free plan</div>
      )}

      {/* Metrics */}
      <div className="mets">
        <div className="met"><div className="mv">{fmtSize(ipo.issueSize)}</div><div className="ml">issue size</div></div>
        <div className="met"><div className="mv">{ipo.priceRange || '—'}</div><div className="ml">price band</div></div>
        <div className="met">
          {hasLG
            ? <><div className={`mv ${lg > 0 ? 'pos' : lg < 0 ? 'neg' : ''}`}>{lg > 0 ? '+' : ''}{lg}%</div><div className="ml">listing gain</div></>
            : sub
            ? <><div className="mv" style={{ color: sub > 10 ? 'var(--green)' : sub < 1 ? 'var(--red)' : 'var(--text)' }}>{sub.toFixed(1)}×</div><div className="ml">subscribed</div></>
            : <><div className="mv" style={{ color: 'var(--text3)' }}>—</div><div className="ml">n/a</div></>}
        </div>
      </div>

      {/* Dates */}
      <div className="dates">
        <div className="ditem"><span className="dk">opens</span><span className="dv">{fmtDate(ipo.startDate)}</span></div>
        <div className="ditem"><span className="dk">closes</span><span className="dv">{fmtDate(ipo.endDate)}</span></div>
        {ipo.listingDate && <div className="ditem"><span className="dk">listing</span><span className="dv">{fmtDate(ipo.listingDate)}</span></div>}
        {ipo.minQty && <div className="ditem"><span className="dk">min qty</span><span className="dv">{ipo.minQty}</span></div>}
        {ipo.minAmount && <div className="ditem"><span className="dk">min amt</span><span className="dv">₹{parseFloat(ipo.minAmount).toLocaleString('en-IN')}</span></div>}
      </div>

      {/* Footer */}
      <div className="cfoot">
        <div className="score-group">
          <div className={`score-ring ${cls}`}>{s}</div>
          <div><div className="verdict">{v}</div><div className="vsub">{ipo.source ? ipo.source.toUpperCase() : 'NSE/BSE'}</div></div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setDrawer(drawer === 'detail' ? null : 'detail')}>Details</button>
          <button className="btn" onClick={loadAI}>{drawer === 'ai' ? 'Close' : '✦ AI'}</button>
          {ipo.prospectusUrl && <a href={ipo.prospectusUrl} target="_blank" rel="noreferrer"><button className="btn">DRHP ↗</button></a>}
        </div>
      </div>

      {/* Drawer */}
      <div className={`drawer ${drawer ? 'open' : ''}`}>
        <div className="drawer-inner">
          {drawer === 'detail' && (
            <>
              {ipo.about && <div className="dsec"><div className="dtitle">About</div><div className="dbody">{ipo.about}</div></div>}
              {(ipo.strengths || []).length > 0 && <div className="dsec"><div className="dtitle">Strengths</div><div className="tag-row">{ipo.strengths.slice(0, 6).map((x, i) => <span key={i} className="tag s">{x}</span>)}</div></div>}
              {(ipo.risks || []).length > 0 && <div className="dsec"><div className="dtitle">Risks</div><div className="tag-row">{ipo.risks.slice(0, 6).map((x, i) => <span key={i} className="tag r">{x}</span>)}</div></div>}
              {!ipo.about && !(ipo.strengths || []).length && !(ipo.risks || []).length && <div className="dbody" style={{ color: 'var(--text3)' }}>No additional details available.</div>}
            </>
          )}
          {drawer === 'ai' && (
            aiLoading
              ? <div className="ai-loading">Analysing <span className="dots"><span/><span/><span/></span></div>
              : <><div className="ai-hd">AI Analysis — {ipo.name}</div><div className="ai-body">{aiText}</div></>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Home() {
  const [ipos, setIpos]       = useState([]);
  const [filter, setFilter]   = useState('all');
  const [query, setQuery]     = useState('');
  const [status, setStatus]   = useState('connecting'); // connecting | live | error | nodata
  const [date, setDate]       = useState('');

  useEffect(() => {
    setDate(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }));
    async function load() {
      try {
        const statuses = ['open', 'upcoming', 'announced', 'closed'];
        const results = await Promise.allSettled(
          statuses.map(s =>
            fetch(`/api/ipos?status=${s}`)
              .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
              .then(d => (d.ipos || []).map(i => ({ ...i, status: s })))
          )
        );
        const all = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
        if (!all.length) { setStatus('nodata'); return; }
        const order = { open: 0, upcoming: 1, announced: 2, closed: 3 };
        all.sort((a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4));
        setIpos(all);
        setStatus('live');
      } catch {
        setStatus('error');
      }
    }
    load();
  }, []);

  const counts = { all: ipos.length, open: 0, upcoming: 0, announced: 0, closed: 0 };
  ipos.forEach(i => { if (counts[i.status] !== undefined) counts[i.status]++; });
  const gmps = ipos.map(gmpMean).filter(g => g !== null && g !== 0);
  const avgGmp = gmps.length ? (gmps.reduce((a, b) => a + b, 0) / gmps.length).toFixed(1) : null;

  const filtered = ipos
    .filter(i => filter === 'all' || i.status === filter)
    .filter(i => !query || (i.name || '').toLowerCase().includes(query.toLowerCase()) || (i.symbol || '').toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <Head>
        <title>IPO Pulse — Indian IPO Tracker</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <header>
        <div className="logo"><div className="logo-dot" /><span>IPO Pulse</span></div>
        <div className="header-right">
          <span className={`pill ${status === 'live' ? 'live' : status === 'error' || status === 'nodata' ? 'err' : ''}`}>{status}</span>
          <span className="pill">{date}</span>
        </div>
      </header>

      <div className="hero">
        {[
          [ipos.length, 'total'],
          [counts.open, 'open'],
          [counts.upcoming, 'upcoming'],
          [avgGmp !== null ? (avgGmp > 0 ? '+' : '') + avgGmp + '%' : '—', 'avg gmp'],
        ].map(([n, l], i) => (
          <>
            {i > 0 && <div key={`d${i}`} className="hdiv" />}
            <div key={l} className="hstat"><div className="n">{n}</div><div className="l">{l}</div></div>
          </>
        ))}
      </div>

      <div className="toolbar">
        <div className="tabs">
          {['all', 'open', 'upcoming', 'announced', 'closed'].map(f => (
            <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)} <span className="tab-n">{counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="search-bar">
          <input type="search" placeholder="Search by name or symbol…" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" />
        </div>
      </div>

      <div className="grid">
        {status === 'connecting' && [0,1,2,3].map(i => <div key={i} className="skel" style={{ animationDelay: `${i * 0.07}s` }} />)}
        {status === 'nodata' && (
          <div className="err-card">
            <strong>No IPOs returned</strong>
            <p>Daily budget (25/day) may be exhausted, or IPO_API_KEY is not set in Vercel environment variables.</p>
          </div>
        )}
        {status === 'error' && <div className="err-card"><strong>Failed to load data</strong><p>Check Vercel function logs for details.</p></div>}
        {filtered.length === 0 && status === 'live' && <div className="empty">No IPOs match this filter.</div>}
        {filtered.map((ipo, idx) => <IPOCard key={ipo.id} ipo={ipo} idx={idx} />)}
      </div>

      <footer>
        Data via <a href="https://ipoalerts.in" target="_blank" rel="noreferrer">ipoalerts.in</a> · NSE / BSE · GMP is unofficial · Not investment advice<br />
        Built by <a href="https://www.linkedin.com/in/sahil-jain-7a374b199/" target="_blank" rel="noreferrer">Sahil Jain</a> · <a href="https://builder-stratgey.vercel.app/" target="_blank" rel="noreferrer">DerivAI ↗</a> · AI by Claude
      </footer>

      <style jsx global>{`
        :root {
          --bg:#0a0a0b; --bg1:#111113; --bg2:#18181b; --bg3:#1f1f23;
          --line:rgba(255,255,255,0.07); --line2:rgba(255,255,255,0.12);
          --text:#e8e8ea; --text2:#8b8b91; --text3:#55555c;
          --green:#22c55e; --green-dim:rgba(34,197,94,0.12);
          --red:#ef4444; --red-dim:rgba(239,68,68,0.12);
          --amber:#f59e0b; --amber-dim:rgba(245,158,11,0.12);
          --blue:#3b82f6; --blue-dim:rgba(59,130,246,0.12);
          --purple:#a855f7; --purple-dim:rgba(168,85,247,0.12);
          --r:6px; --r2:10px;
          --mono:'Geist Mono',monospace; --sans:'Geist',sans-serif;
        }
        *{margin:0;padding:0;box-sizing:border-box;}
        html{-webkit-tap-highlight-color:transparent;}
        body{font-family:var(--sans);background:var(--bg);color:var(--text);min-height:100vh;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;}
        a{color:inherit;text-decoration:none;}
        button{font-family:var(--sans);cursor:pointer;}
        header{position:sticky;top:0;z-index:200;background:rgba(10,10,11,0.85);backdrop-filter:blur(16px);border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 1rem;height:52px;}
        .logo{font-size:1rem;font-weight:600;letter-spacing:-0.03em;display:flex;align-items:center;gap:6px;}
        .logo-dot{width:6px;height:6px;border-radius:50%;background:var(--green);animation:glow 2s ease-in-out infinite;flex-shrink:0;}
        @keyframes glow{0%,100%{box-shadow:0 0 4px var(--green);opacity:1;}50%{box-shadow:0 0 10px var(--green);opacity:0.7;}}
        .header-right{display:flex;align-items:center;gap:8px;}
        .pill{font-family:var(--mono);font-size:0.6rem;letter-spacing:0.06em;padding:3px 8px;border-radius:100px;border:1px solid var(--line2);color:var(--text2);text-transform:uppercase;}
        .pill.live{border-color:rgba(34,197,94,0.3);color:var(--green);}
        .pill.err{border-color:rgba(239,68,68,0.3);color:var(--red);}
        .hero{background:var(--bg1);border-bottom:1px solid var(--line);padding:1rem;display:flex;gap:0;overflow-x:auto;scrollbar-width:none;}
        .hero::-webkit-scrollbar{display:none;}
        .hstat{flex:0 0 auto;padding:0 1.2rem;border-right:1px solid var(--line);}
        .hstat:first-child{padding-left:0;}
        .hstat:last-child{border-right:none;}
        .hstat .n{font-family:var(--mono);font-size:1.35rem;font-weight:500;letter-spacing:-0.04em;line-height:1;}
        .hstat .l{font-size:0.62rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.08em;margin-top:3px;}
        .hdiv{width:1px;background:var(--line);flex-shrink:0;}
        .toolbar{position:sticky;top:52px;z-index:150;background:rgba(10,10,11,0.9);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);}
        .tabs{display:flex;overflow-x:auto;scrollbar-width:none;padding:0 1rem;}
        .tabs::-webkit-scrollbar{display:none;}
        .tab{flex-shrink:0;background:transparent;border:none;border-bottom:2px solid transparent;padding:10px 12px;font-size:0.78rem;color:var(--text3);transition:color 0.15s,border-color 0.15s;white-space:nowrap;display:flex;align-items:center;gap:5px;}
        .tab:hover{color:var(--text2);}
        .tab.active{color:var(--text);border-bottom-color:var(--text);}
        .tab-n{font-family:var(--mono);font-size:0.58rem;background:var(--bg3);border-radius:100px;padding:1px 5px;color:var(--text3);}
        .search-bar{padding:8px 1rem;border-top:1px solid var(--line);}
        .search-bar input{width:100%;background:var(--bg2);border:1px solid var(--line2);border-radius:var(--r);padding:7px 12px;font-family:var(--sans);font-size:0.82rem;color:var(--text);outline:none;}
        .search-bar input::placeholder{color:var(--text3);}
        .grid{padding:1rem;display:grid;grid-template-columns:1fr;gap:10px;}
        @media(min-width:640px){.grid{grid-template-columns:repeat(2,1fr);}}
        @media(min-width:1024px){.grid{grid-template-columns:repeat(3,1fr);padding:1.25rem 1.5rem;gap:12px;}}
        @media(min-width:1400px){.grid{grid-template-columns:repeat(4,1fr);}}
        .card{background:var(--bg1);border:1px solid var(--line);border-radius:var(--r2);overflow:hidden;transition:border-color 0.2s;animation:up 0.3s ease both;}
        .card:hover{border-color:var(--line2);}
        @keyframes up{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
        .chead{padding:12px 12px 10px;display:flex;gap:10px;align-items:flex-start;border-bottom:1px solid var(--line);}
        .clogo{width:36px;height:36px;border-radius:var(--r);flex-shrink:0;background:var(--bg3);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:0.72rem;color:var(--text2);overflow:hidden;}
        .clogo img{width:100%;height:100%;object-fit:contain;padding:4px;}
        .ctitle{flex:1;min-width:0;}
        .cname{font-size:0.88rem;font-weight:500;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .cmeta{display:flex;gap:5px;margin-top:4px;flex-wrap:wrap;align-items:center;}
        .badge{font-family:var(--mono);font-size:0.58rem;letter-spacing:0.04em;padding:2px 6px;border-radius:4px;border:1px solid;white-space:nowrap;}
        .b-open{color:var(--green);border-color:rgba(34,197,94,0.25);background:var(--green-dim);}
        .b-upcoming{color:var(--blue);border-color:rgba(59,130,246,0.25);background:var(--blue-dim);}
        .b-announced{color:var(--purple);border-color:rgba(168,85,247,0.25);background:var(--purple-dim);}
        .b-closed{color:var(--text3);border-color:var(--line);background:var(--bg3);}
        .badge-sym{color:var(--text3);border-color:transparent;background:transparent;font-size:0.6rem;}
        .gmp-row{padding:8px 12px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:8px;}
        .gmp-main{display:flex;align-items:baseline;gap:6px;}
        .gmp-v{font-family:var(--mono);font-size:1.1rem;font-weight:500;letter-spacing:-0.03em;}
        .gmp-v.pos{color:var(--green);}.gmp-v.neg{color:var(--red);}.gmp-v.neu{color:var(--text3);}
        .gmp-tag{font-family:var(--mono);font-size:0.58rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.08em;}
        .gmp-range{font-family:var(--mono);font-size:0.62rem;color:var(--text3);}
        .gmp-srcs{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;}
        .gmp-src-chip{font-family:var(--mono);font-size:0.58rem;background:var(--bg3);border:1px solid var(--line);border-radius:4px;padding:1px 5px;color:var(--text2);}
        .gmp-src-chip b{color:var(--text);font-weight:500;}
        .gmp-na{padding:6px 12px;border-bottom:1px solid var(--line);font-family:var(--mono);font-size:0.6rem;color:var(--text3);}
        .mets{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid var(--line);}
        .met{padding:8px 10px;border-right:1px solid var(--line);}
        .met:last-child{border-right:none;}
        .mv{font-family:var(--mono);font-size:0.82rem;font-weight:500;color:var(--text);line-height:1;}
        .mv.pos{color:var(--green);}.mv.neg{color:var(--red);}
        .ml{font-size:0.6rem;color:var(--text3);margin-top:2px;}
        .dates{display:flex;gap:0;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid var(--line);}
        .dates::-webkit-scrollbar{display:none;}
        .ditem{flex:0 0 auto;padding:7px 10px;border-right:1px solid var(--line);}
        .ditem:last-child{border-right:none;}
        .dk{font-family:var(--mono);font-size:0.55rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;display:block;}
        .dv{font-family:var(--mono);font-size:0.7rem;color:var(--text);margin-top:1px;}
        .cfoot{padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;}
        .score-group{display:flex;align-items:center;gap:8px;}
        .score-ring{width:32px;height:32px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:0.65rem;font-weight:500;border:1.5px solid;}
        .sr-h{border-color:rgba(34,197,94,0.5);color:var(--green);background:var(--green-dim);}
        .sr-m{border-color:rgba(245,158,11,0.5);color:var(--amber);background:var(--amber-dim);}
        .sr-l{border-color:rgba(239,68,68,0.5);color:var(--red);background:var(--red-dim);}
        .verdict{font-size:0.75rem;font-weight:500;color:var(--text);}
        .vsub{font-size:0.6rem;color:var(--text3);margin-top:1px;}
        .actions{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end;}
        .btn{border:1px solid var(--line2);background:transparent;padding:5px 10px;border-radius:var(--r);font-size:0.7rem;color:var(--text2);transition:background 0.15s,color 0.15s;white-space:nowrap;}
        .btn:hover{background:var(--bg3);color:var(--text);}
        .drawer{max-height:0;overflow:hidden;transition:max-height 0.35s cubic-bezier(0.4,0,0.2,1);border-top:0 solid var(--line);}
        .drawer.open{max-height:500px;border-top-width:1px;overflow-y:auto;}
        .drawer-inner{padding:12px;}
        .dsec{margin-bottom:12px;}
        .dtitle{font-family:var(--mono);font-size:0.58rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;}
        .dbody{font-size:0.8rem;color:var(--text2);line-height:1.6;}
        .tag-row{display:flex;flex-wrap:wrap;gap:5px;}
        .tag{font-size:0.72rem;padding:3px 8px;border-radius:var(--r);background:var(--bg3);border:1px solid var(--line);color:var(--text2);}
        .tag.s{background:var(--green-dim);border-color:rgba(34,197,94,0.2);color:var(--green);}
        .tag.r{background:var(--red-dim);border-color:rgba(239,68,68,0.2);color:var(--red);}
        .ai-hd{font-size:0.72rem;font-weight:500;color:var(--blue);margin-bottom:6px;}
        .ai-body{font-size:0.8rem;color:var(--text2);line-height:1.65;}
        .ai-loading{display:flex;align-items:center;gap:6px;font-family:var(--mono);font-size:0.65rem;color:var(--text3);}
        .dots span{display:inline-block;width:3px;height:3px;border-radius:50%;background:var(--text3);margin:0 2px;animation:dp 1.2s infinite;}
        .dots span:nth-child(2){animation-delay:0.2s;}.dots span:nth-child(3){animation-delay:0.4s;}
        @keyframes dp{0%,80%,100%{opacity:0.2;}40%{opacity:1;}}
        .skel{background:var(--bg1);border:1px solid var(--line);border-radius:var(--r2);height:220px;background:linear-gradient(90deg,var(--bg1) 25%,var(--bg2) 50%,var(--bg1) 75%);background-size:200% 100%;animation:sk 1.4s infinite;}
        @keyframes sk{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
        .empty{grid-column:1/-1;padding:4rem;text-align:center;color:var(--text3);font-size:0.85rem;}
        .err-card{grid-column:1/-1;padding:1rem;background:var(--red-dim);border:1px solid rgba(239,68,68,0.2);border-radius:var(--r2);color:var(--red);font-size:0.82rem;}
        .err-card strong{display:block;margin-bottom:4px;font-size:0.9rem;}
        .err-card p{color:var(--text2);line-height:1.6;}
        footer{padding:1.5rem 1rem;border-top:1px solid var(--line);font-family:var(--mono);font-size:0.6rem;color:var(--text3);text-align:center;line-height:2;}
        footer a{color:var(--text2);}
        @media(min-width:768px){header{padding:0 1.5rem;height:56px;}.hero{padding:1rem 1.5rem;}.tabs{padding:0 1.5rem;}.search-bar{padding:8px 1.5rem;}footer{padding:2rem 1.5rem;}}
      `}</style>
    </>
  );
}

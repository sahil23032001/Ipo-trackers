'use client'
import { useState, useEffect } from 'react'

const STATUS = {
  Open:     { bg: '#00c48420', color: '#00c484', border: '#00c48440' },
  Upcoming: { bg: '#7c3aed20', color: '#a78bfa', border: '#7c3aed40' },
  Listed:   { bg: '#2563eb20', color: '#60a5fa', border: '#2563eb40' },
  Closed:   { bg: '#ffffff10', color: '#6b7280', border: '#ffffff20' },
}
const TYPE_COLOR = { Mainboard: '#f59e0b', SME: '#8b5cf6', InvIT: '#06b6d4', REIT: '#ec4899' }
const fmt = (n) => n != null ? Number(n).toLocaleString('en-IN') : '–'

function Pill({ label, bg, color, border }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700,
      padding: '4px 11px', borderRadius: 999, background: bg, color, border: `1px solid ${border}`,
      whiteSpace: 'nowrap' }}>{label}</span>
  )
}

function ScoreRing({ score, size = 56 }) {
  if (score == null) return null
  const color = score >= 7 ? '#00c484' : score >= 5 ? '#f59e0b' : '#ef4444'
  const r = size / 2 - 5, norm = 2 * Math.PI * r, dash = (score / 10) * norm
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#ffffff10" strokeWidth={4} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={`${dash} ${norm}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.25, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: size * 0.15, color: '#4b5563', lineHeight: 1 }}>/10</span>
      </div>
    </div>
  )
}

function IPOCard({ ipo, onClick }) {
  const st = STATUS[ipo.status] || STATUS.Closed
  const tc = TYPE_COLOR[ipo.ipo_type] || '#6b7280'
  const gain = ipo.expected_gain_percent
  const gainColor = gain >= 20 ? '#00c484' : gain > 0 ? '#a3e635' : gain < 0 ? '#ef4444' : '#6b7280'
  return (
    <div onClick={onClick} className="ipo-card">
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${tc}, ${tc}00)` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ipo-name">{ipo.ipo_name}</div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>{ipo.sector} · {ipo.exchange}</div>
        </div>
        <Pill label={ipo.status} {...st} />
      </div>
      <div className="metric-grid">
        {[
          { label: 'Price Band', value: ipo.price_band_min && ipo.price_band_max ? `₹${ipo.price_band_min}–${ipo.price_band_max}` : 'TBA' },
          { label: 'Issue Size', value: ipo.issue_size_cr ? `₹${fmt(ipo.issue_size_cr)}Cr` : '–' },
          { label: 'GMP', value: ipo.gmp != null ? `+₹${ipo.gmp}` : 'N/A', color: ipo.gmp > 0 ? '#00c484' : '#475569' },
        ].map(m => (
          <div key={m.label} style={{ background: '#ffffff06', borderRadius: 10, padding: '9px 11px', border: '1px solid #ffffff08' }}>
            <div style={{ fontSize: 9, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{m.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: m.color || '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, padding: '2px 9px', borderRadius: 999, background: `${tc}20`, color: tc, fontWeight: 700 }}>{ipo.ipo_type}</span>
          <span style={{ fontSize: 10, color: '#334155' }}>{ipo.ipo_open_date || '–'}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          {gain != null && <div style={{ fontSize: 14, fontWeight: 800, color: gainColor }}>{gain > 0 ? '+' : ''}{gain}%</div>}
          <div style={{ fontSize: 10, color: '#334155' }}>Score {ipo.overall_score ?? '–'}/10</div>
        </div>
      </div>
    </div>
  )
}

function IPOModal({ ipo, onClose }) {
  useEffect(() => {
    const fn = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', fn)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', fn); document.body.style.overflow = '' }
  }, [onClose])

  const st = STATUS[ipo.status] || STATUS.Closed
  const tc = TYPE_COLOR[ipo.ipo_type] || '#6b7280'
  const gain = ipo.expected_gain_percent
  const gainColor = gain > 0 ? '#00c484' : '#ef4444'

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div style={{ height: 3, background: `linear-gradient(90deg, ${tc}, ${tc}00)`, borderRadius: '20px 20px 0 0' }} />

        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <Pill label={ipo.status} {...st} />
                <Pill label={ipo.ipo_type} bg={`${tc}20`} color={tc} border={`${tc}40`} />
              </div>
              <h2 className="modal-title">{ipo.ipo_name}</h2>
              <p style={{ margin: '5px 0 0', fontSize: 12, color: '#475569' }}>{ipo.company_name} · {ipo.sector} · {ipo.exchange}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
              <ScoreRing score={ipo.overall_score} size={56} />
              <span style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>AI Score</span>
            </div>
          </div>
          <button onClick={onClose} className="modal-close">×</button>
        </div>

        <div className="modal-body">
          {/* Pricing */}
          <div className="modal-grid-3">
            {[
              { label: 'Price Band',   value: ipo.price_band_min ? `₹${ipo.price_band_min}–₹${ipo.price_band_max}` : 'TBA' },
              { label: 'Lot Size',     value: ipo.lot_size ? `${ipo.lot_size} shares` : '–' },
              { label: 'Issue Size',   value: ipo.issue_size_cr ? `₹${fmt(ipo.issue_size_cr)} Cr` : '–' },
              { label: 'Open Date',    value: ipo.ipo_open_date || '–' },
              { label: 'Close Date',   value: ipo.ipo_close_date || '–' },
              { label: 'Listing Date', value: ipo.listing_date || 'TBA' },
            ].map(m => (
              <div key={m.label} style={{ background: '#ffffff06', borderRadius: 10, padding: '11px 13px', border: '1px solid #ffffff08' }}>
                <div style={{ fontSize: 9, color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>{m.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#cbd5e1' }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* GMP */}
          {ipo.gmp != null && (
            <div style={{ background: '#00c48410', border: '1px solid #00c48430', borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: '#00c484', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Grey Market Premium</div>
              <div className="modal-grid-3">
                <div><div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>GMP</div><div className="gmp-val" style={{ color: '#00c484' }}>+₹{ipo.gmp}</div></div>
                <div><div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>Expected Price</div><div className="gmp-val" style={{ color: '#cbd5e1' }}>{ipo.expected_listing_price ? `₹${ipo.expected_listing_price}` : '–'}</div></div>
                <div><div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>Est. Gain</div><div className="gmp-val" style={{ color: gainColor }}>{gain != null ? `${gain > 0 ? '+' : ''}${gain}%` : '–'}</div></div>
              </div>
            </div>
          )}

          {/* AI Scores */}
          {(ipo.listing_gain_score != null || ipo.long_term_score != null) && (
            <div style={{ background: '#ffffff04', border: '1px solid #162032', borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>AI Ratings</div>
              {[
                { label: 'Listing Gain Probability', value: ipo.listing_gain_score, color: '#a78bfa' },
                { label: 'Long Term Potential', value: ipo.long_term_score, color: '#06b6d4' },
              ].map(s => s.value != null && (
                <div key={s.label} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{s.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.value}/10</span>
                  </div>
                  <div style={{ height: 4, background: '#ffffff08', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${(s.value/10)*100}%`, height: '100%', background: s.color, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Strengths & Risks */}
          <div className="sr-grid">
            {ipo.strengths?.length > 0 && (
              <div style={{ background: '#00c48408', border: '1px solid #00c48420', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, color: '#00c484', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Strengths</div>
                {ipo.strengths.map((s, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#94a3b8', marginBottom: 7, display: 'flex', gap: 8, lineHeight: 1.5 }}>
                    <span style={{ color: '#00c484', flexShrink: 0 }}>↑</span>{s}
                  </div>
                ))}
              </div>
            )}
            {ipo.risks?.length > 0 && (
              <div style={{ background: '#ef444408', border: '1px solid #ef444420', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Risks</div>
                {ipo.risks.map((r, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#94a3b8', marginBottom: 7, display: 'flex', gap: 8, lineHeight: 1.5 }}>
                    <span style={{ color: '#ef4444', flexShrink: 0 }}>↓</span>{r}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  const [ipos, setIpos]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')
  const [status, setStatus]     = useState('All')
  const [type, setType]         = useState('All')
  const [selected, setSelected] = useState(null)
  const [meta, setMeta]         = useState({ cached: false, date: '' })

  const load = async (force = false) => {
    setLoading(true); setError('')
    try {
      const res  = await fetch(`/api/ipo${force ? '?refresh=true' : ''}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setIpos(json.data || [])
      setMeta({ cached: json.cached, date: json.date })
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 2 * 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const filtered = ipos.filter(ipo => {
    const q = search.toLowerCase()
    return (!search || ipo.ipo_name?.toLowerCase().includes(q) || ipo.sector?.toLowerCase().includes(q) || ipo.company_name?.toLowerCase().includes(q))
      && (status === 'All' || ipo.status === status)
      && (type   === 'All' || ipo.ipo_type === type)
  })

  const stats = [
    { label: 'Total',    value: ipos.length,                                      color: '#60a5fa' },
    { label: 'Open',     value: ipos.filter(i => i.status === 'Open').length,     color: '#00c484' },
    { label: 'Upcoming', value: ipos.filter(i => i.status === 'Upcoming').length, color: '#a78bfa' },
    { label: 'Listed',   value: ipos.filter(i => i.status === 'Listed').length,   color: '#f59e0b' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#070d1a' }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { -webkit-text-size-adjust: 100%; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #1e2d4a; border-radius: 3px; }
        input::placeholder { color: #334155; }
        button { font-family: inherit; cursor: pointer; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes rise { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .card-ani { animation: rise 0.3s ease both; }

        /* ── IPO Card ── */
        .ipo-card {
          background: #0e1525; border: 1px solid #162032; border-radius: 16px;
          padding: 20px; cursor: pointer; position: relative; overflow: hidden;
          transition: border-color 0.18s, transform 0.18s, box-shadow 0.18s;
          -webkit-tap-highlight-color: transparent;
        }
        .ipo-card:hover {
          border-color: #1e2d4a; transform: translateY(-3px);
          box-shadow: 0 8px 32px #00000060;
          background: #141b2d;
        }
        .ipo-card:active { transform: scale(0.98); }
        .ipo-name {
          font-size: 15px; font-weight: 800; color: #f1f5f9; line-height: 1.3;
          margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .metric-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 14px; }

        /* ── Modal ── */
        .modal-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.75);
          z-index: 100; display: flex; align-items: flex-end; justify-content: center;
          padding: 0; backdrop-filter: blur(4px);
        }
        .modal-box {
          background: #0a1120; border: 1px solid #1e2d4a;
          width: 100%; max-height: 92vh; overflow-y: auto;
          border-radius: 20px 20px 0 0; position: relative;
        }
        .modal-header {
          padding: 20px 20px 16px; border-bottom: 1px solid #162032;
          position: sticky; top: 0; background: #0a1120; z-index: 1;
        }
        .modal-title { font-size: 18px; font-weight: 800; color: #f1f5f9; line-height: 1.2; }
        .modal-body { padding: 16px 20px 32px; }
        .modal-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 14px; }
        .gmp-val { font-size: 20px; font-weight: 800; }
        .sr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .modal-close {
          position: absolute; top: 16px; right: 16px;
          background: #162032; border: 1px solid #1e2d4a; color: #6b7280;
          border-radius: 8px; width: 30px; height: 30px;
          font-size: 18px; display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.2s, background 0.2s;
        }
        .modal-close:hover { background: #1e2d4a; color: #94a3b8; opacity: 1 !important; }
        .modal-header:hover .modal-close { opacity: 1; }

        /* ── Stats grid ── */
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
        .stat-val { font-size: 32px; font-weight: 900; line-height: 1; }

        /* ── Filter bar ── */
        .filter-pills { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
        .filter-label { font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-right: 2px; white-space: nowrap; }
        .filter-divider { width: 1px; height: 18px; background: #1e2d4a; margin: 0 4px; }

        /* ── IPO grid ── */
        .ipo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }

        /* ── Nav ── */
        .nav-meta { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #334155; }
        .nav-date { display: block; }

        /* ── TABLET (≤768px) ── */
        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .stat-val { font-size: 26px; }
          .ipo-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
          .ipo-card { padding: 16px; }
          .ipo-name { font-size: 13px; }
        }

        /* ── MOBILE (≤480px) ── */
        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .stat-val { font-size: 28px; }
          .ipo-grid { grid-template-columns: 1fr; gap: 10px; }
          .ipo-name { font-size: 14px; white-space: normal; }
          .metric-grid { grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
          .modal-grid-3 { grid-template-columns: 1fr 1fr; }
          .gmp-val { font-size: 18px; }
          .sr-grid { grid-template-columns: 1fr; }
          .modal-title { font-size: 16px; }
          .nav-date { display: none; }
          .filter-divider { display: none; }
        }
      `}</style>

      {/* Nav */}
      <nav style={{
        padding: '0 16px', height: 56, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid #0f1e35',
        position: 'sticky', top: 0, background: '#070d1a', zIndex: 50,
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#00c484,#0066ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff', fontSize: 16, flexShrink: 0 }}>I</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#f1f5f9', letterSpacing: -0.3 }}>IPO Intelligence</div>
            <div style={{ fontSize: 10, color: '#334155' }}>NSE & BSE · Groq AI</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {meta.date && (
            <div className="nav-meta">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.cached ? '#f59e0b' : '#00c484', display: 'inline-block', flexShrink: 0 }} />
              <span className="nav-date">{meta.cached ? `Cached · ${meta.date}` : `Live · ${meta.date}`}</span>
            </div>
          )}
          <button onClick={() => load(true)} disabled={loading}
            style={{ padding: '6px 14px', borderRadius: 8, background: 'transparent', border: '1px solid #162032', color: '#475569', fontSize: 12, fontWeight: 600 }}>
            {loading ? '…' : '⟳'}
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 14px 80px' }}>

        {/* Stats */}
        {ipos.length > 0 && (
          <div className="stats-grid">
            {stats.map(s => (
              <div key={s.label} style={{ background: '#0e1525', border: '1px solid #162032', borderRadius: 12, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: 50, height: 50, background: `${s.color}08`, borderRadius: '0 12px 0 50px' }} />
                <div style={{ fontSize: 10, color: '#334155', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                <div className="stat-val" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search + Filters */}
        <div style={{ background: '#0e1525', border: '1px solid #162032', borderRadius: 14, padding: '12px 14px', marginBottom: 18 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#334155', fontSize: 14 }}>⌕</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search IPOs, sector, company…"
                style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 9, background: '#ffffff07', border: '1px solid #162032', color: '#cbd5e1', fontSize: 13, outline: 'none' }} />
            </div>
          </div>
          <div className="filter-pills">
            <span className="filter-label">Status</span>
            {['All','Open','Upcoming','Listed','Closed'].map(s => {
              const active = status === s
              const cfg = STATUS[s] || {}
              return (
                <button key={s} onClick={() => setStatus(s)} style={{
                  padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                  background: active ? (cfg.bg || '#ffffff15') : 'transparent',
                  color: active ? (cfg.color || '#f1f5f9') : '#94a3b8',
                  border: `1px solid ${active ? (cfg.border || '#ffffff30') : '#1e2d4a'}`,
                  transition: 'all 0.15s',
                }}>{s}</button>
              )
            })}
            <div className="filter-divider" />
            <span className="filter-label">Type</span>
            {['All','Mainboard','SME','InvIT','REIT'].map(t => {
              const active = type === t
              const tc = TYPE_COLOR[t] || '#6b7280'
              return (
                <button key={t} onClick={() => setType(t)} style={{
                  padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                  background: active ? `${tc}20` : 'transparent',
                  color: active ? tc : '#94a3b8',
                  border: `1px solid ${active ? `${tc}40` : '#1e2d4a'}`,
                  transition: 'all 0.15s',
                }}>{t}</button>
              )
            })}
          </div>
        </div>

        {!loading && ipos.length > 0 && (
          <div style={{ fontSize: 11, color: '#334155', marginBottom: 12, fontWeight: 600 }}>
            Showing {filtered.length} of {ipos.length} IPOs
          </div>
        )}

        {error && (
          <div style={{ background: '#ef444410', border: '1px solid #ef444430', borderRadius: 12, padding: '14px 18px', marginBottom: 18, color: '#fca5a5', fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 14 }}>
            <div style={{ width: 40, height: 40, border: '3px solid #162032', borderTop: '3px solid #00c484', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
            <div style={{ fontSize: 14, color: '#334155', fontWeight: 600, textAlign: 'center' }}>Fetching live IPO data…</div>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="ipo-grid">
            {filtered.map((ipo, i) => (
              <div key={i} className="card-ani" style={{ animationDelay: `${i * 40}ms` }}>
                <IPOCard ipo={ipo} onClick={() => setSelected(ipo)} />
              </div>
            ))}
          </div>
        )}

        {!loading && !error && ipos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#1e2d4a', fontSize: 14 }}>No data. Check your API key.</div>
        )}
        {!loading && ipos.length > 0 && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#1e2d4a', fontSize: 14 }}>No IPOs match your filters.</div>
        )}
      </div>

      {selected && <IPOModal ipo={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

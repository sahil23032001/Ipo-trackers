'use client'
import { useState, useEffect } from 'react'

const STATUS = {
  Open:     { bg: '#00d09c20', color: '#00d09c', border: '#00d09c40' },
  Upcoming: { bg: '#7c3aed20', color: '#a78bfa', border: '#7c3aed40' },
  Listed:   { bg: '#1d4ed820', color: '#60a5fa', border: '#1d4ed840' },
  Closed:   { bg: '#1f293780', color: '#6b7280', border: '#374151' },
}

const TYPE_COLOR = { Mainboard: '#f59e0b', SME: '#8b5cf6', InvIT: '#06b6d4', REIT: '#ec4899' }

function Badge({ label, bg, color, border }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: bg, color, border: `1px solid ${border}` }}>
      {label}
    </span>
  )
}

function ScoreRing({ score }) {
  if (score == null) return <span style={{ color: '#4b5563' }}>–</span>
  const color = score >= 7 ? '#00d09c' : score >= 5 ? '#f59e0b' : '#ef4444'
  const r = 22, norm = 2 * Math.PI * r, dash = (score / 10) * norm
  return (
    <div style={{ position: 'relative', width: 54, height: 54 }}>
      <svg width={54} height={54} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={27} cy={27} r={r} fill="none" stroke="#1f2937" strokeWidth={4} />
        <circle cx={27} cy={27} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={`${dash} ${norm}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color }}>{score}</span>
        <span style={{ fontSize: 8, color: '#4b5563' }}>/10</span>
      </div>
    </div>
  )
}

function IPOCard({ ipo, onClick }) {
  const st = STATUS[ipo.status] || STATUS.Closed
  const gain = ipo.expected_gain_percent
  const gainColor = gain > 0 ? '#00d09c' : gain < 0 ? '#ef4444' : '#6b7280'

  return (
    <div onClick={onClick} style={{
      background: '#111827', border: '1px solid #1f2937', borderRadius: 14,
      padding: '18px 20px', cursor: 'pointer', position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#374151'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#1f2937'; e.currentTarget.style.transform = 'none' }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${TYPE_COLOR[ipo.ipo_type] || '#7c3aed'}, transparent)` }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#f9fafb', marginBottom: 3 }}>{ipo.ipo_name}</div>
          <div style={{ fontSize: 11, color: '#4b5563' }}>{ipo.sector} · {ipo.exchange}</div>
        </div>
        <Badge label={ipo.status} {...st} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Price Band', value: ipo.price_band_min && ipo.price_band_max ? `₹${ipo.price_band_min}–${ipo.price_band_max}` : 'TBA' },
          { label: 'Issue Size',  value: ipo.issue_size_cr ? `₹${ipo.issue_size_cr}Cr` : '–' },
          { label: 'GMP',         value: ipo.gmp != null ? `+₹${ipo.gmp}` : 'N/A', color: ipo.gmp > 0 ? '#00d09c' : '#6b7280' },
        ].map(m => (
          <div key={m.label} style={{ background: '#0d1117', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, color: '#4b5563', marginBottom: 3 }}>{m.label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: m.color || '#e5e7eb' }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20,
            background: `${TYPE_COLOR[ipo.ipo_type] || '#7c3aed'}20`,
            color: TYPE_COLOR[ipo.ipo_type] || '#a78bfa' }}>{ipo.ipo_type}</span>
          <span style={{ fontSize: 10, color: '#4b5563' }}>{ipo.ipo_open_date || '–'}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          {gain != null && <div style={{ fontSize: 13, fontWeight: 700, color: gainColor }}>{gain > 0 ? '+' : ''}{gain}%</div>}
          <div style={{ fontSize: 10, color: '#4b5563' }}>Score: {ipo.overall_score ?? '–'}/10</div>
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
  const gainColor = (ipo.expected_gain_percent || 0) > 0 ? '#00d09c' : '#ef4444'

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000aa', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#0d1117', border: '1px solid #1f2937', borderRadius: 18, width: '100%', maxWidth: 680, maxHeight: '88vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid #1f2937', position: 'sticky', top: 0, background: '#0d1117' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <Badge label={ipo.status} {...st} />
                <Badge label={ipo.ipo_type} bg={`${TYPE_COLOR[ipo.ipo_type] || '#7c3aed'}20`} color={TYPE_COLOR[ipo.ipo_type] || '#a78bfa'} border={`${TYPE_COLOR[ipo.ipo_type] || '#7c3aed'}40`} />
              </div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f9fafb' }}>{ipo.ipo_name}</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#4b5563' }}>{ipo.company_name} · {ipo.sector} · {ipo.exchange}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <ScoreRing score={ipo.overall_score} />
              <span style={{ fontSize: 10, color: '#4b5563' }}>AI Score</span>
            </div>
          </div>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: '#1f2937', border: 'none', color: '#9ca3af', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Pricing */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
            {[
              { label: 'Price Band',   value: ipo.price_band_min ? `₹${ipo.price_band_min} – ₹${ipo.price_band_max}` : 'TBA' },
              { label: 'Lot Size',     value: ipo.lot_size ? `${ipo.lot_size} shares` : '–' },
              { label: 'Issue Size',   value: ipo.issue_size_cr ? `₹${ipo.issue_size_cr} Cr` : '–' },
              { label: 'Open Date',    value: ipo.ipo_open_date || '–' },
              { label: 'Close Date',   value: ipo.ipo_close_date || '–' },
              { label: 'Listing Date', value: ipo.listing_date || '–' },
            ].map(m => (
              <div key={m.label} style={{ background: '#111827', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: '#4b5563', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* GMP */}
          {ipo.gmp != null && (
            <div style={{ background: '#00d09c0a', border: '1px solid #00d09c30', borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: '#00d09c', fontWeight: 600, marginBottom: 10 }}>Grey Market Premium</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                <div><div style={{ fontSize: 10, color: '#4b5563', marginBottom: 4 }}>GMP</div><div style={{ fontSize: 20, fontWeight: 700, color: '#00d09c' }}>+₹{ipo.gmp}</div></div>
                <div><div style={{ fontSize: 10, color: '#4b5563', marginBottom: 4 }}>Expected Price</div><div style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb' }}>{ipo.expected_listing_price ? `₹${ipo.expected_listing_price}` : '–'}</div></div>
                <div><div style={{ fontSize: 10, color: '#4b5563', marginBottom: 4 }}>Est. Gain</div><div style={{ fontSize: 20, fontWeight: 700, color: gainColor }}>{ipo.expected_gain_percent != null ? `${ipo.expected_gain_percent > 0 ? '+' : ''}${ipo.expected_gain_percent}%` : '–'}</div></div>
              </div>
            </div>
          )}

          {/* AI Scores */}
          {(ipo.listing_gain_score != null || ipo.long_term_score != null) && (
            <div style={{ background: '#111827', borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, marginBottom: 12 }}>AI Scores</div>
              {[
                { label: 'Listing Gain',  value: ipo.listing_gain_score, color: '#a78bfa' },
                { label: 'Long Term',     value: ipo.long_term_score,    color: '#06b6d4' },
              ].map(s => s.value != null && (
                <div key={s.label} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{s.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.value}/10</span>
                  </div>
                  <div style={{ height: 4, background: '#1f2937', borderRadius: 4 }}>
                    <div style={{ width: `${(s.value / 10) * 100}%`, height: '100%', background: s.color, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Strengths & Risks */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {ipo.strengths?.length > 0 && (
              <div style={{ background: '#00d09c08', border: '1px solid #00d09c20', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, color: '#00d09c', fontWeight: 600, marginBottom: 10 }}>Strengths</div>
                {ipo.strengths.map((s, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#d1fae5', marginBottom: 6, display: 'flex', gap: 8 }}>
                    <span style={{ color: '#00d09c', flexShrink: 0 }}>+</span>{s}
                  </div>
                ))}
              </div>
            )}
            {ipo.risks?.length > 0 && (
              <div style={{ background: '#ef444408', border: '1px solid #ef444420', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, marginBottom: 10 }}>Risks</div>
                {ipo.risks.map((r, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#fecaca', marginBottom: 6, display: 'flex', gap: 8 }}>
                    <span style={{ color: '#ef4444', flexShrink: 0 }}>!</span>{r}
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
  const [ipos, setIpos]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('All')
  const [type, setType]       = useState('All')
  const [selected, setSelected] = useState(null)
  const [meta, setMeta]       = useState({ cached: false, date: '' })

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

  useEffect(() => { load() }, [])

  const filtered = ipos.filter(ipo => {
    const q = search.toLowerCase()
    return (!search || ipo.ipo_name?.toLowerCase().includes(q) || ipo.sector?.toLowerCase().includes(q))
      && (status === 'All' || ipo.status === status)
      && (type   === 'All' || ipo.ipo_type === type)
  })

  return (
    <div style={{ minHeight: '100vh', background: '#060b12' }}>
      <style>{`*{box-sizing:border-box} ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-thumb{background:#1f2937;border-radius:3px} input::placeholder{color:#374151} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid #111827', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#060b12', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#00d09c,#0066ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 16 }}>I</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#f9fafb' }}>IPO Intelligence</div>
            <div style={{ fontSize: 11, color: '#374151' }}>NSE & BSE · Groq AI</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {meta.date && (
            <span style={{ fontSize: 11, color: '#374151', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.cached ? '#f59e0b' : '#00d09c', display: 'inline-block' }} />
              {meta.cached ? `Cached · ${meta.date}` : `Live · ${meta.date}`}
            </span>
          )}
          <button onClick={() => load(true)} disabled={loading}
            style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8, background: 'transparent', border: '1px solid #1f2937', color: '#6b7280', cursor: 'pointer' }}>
            {loading ? '…' : '⟳ Refresh'}
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>

        {/* Stats bar */}
        {ipos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 24 }}>
            {[
              { label: 'Total', value: ipos.length, color: '#60a5fa' },
              { label: 'Open',  value: ipos.filter(i => i.status === 'Open').length, color: '#00d09c' },
              { label: 'Upcoming', value: ipos.filter(i => i.status === 'Upcoming').length, color: '#a78bfa' },
              { label: 'Listed', value: ipos.filter(i => i.status === 'Listed').length, color: '#f59e0b' },
            ].map(s => (
              <div key={s.label} style={{ background: '#0d1117', border: '1px solid #111827', borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ fontSize: 11, color: '#374151', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#374151' }}>⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 9, background: '#0d1117', border: '1px solid #1f2937', color: '#e5e7eb', fontSize: 13, outline: 'none' }} />
          </div>
          {['All','Open','Upcoming','Listed','Closed'].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: status === s ? '#00d09c' : 'transparent', color: status === s ? '#000' : '#6b7280', border: `1px solid ${status === s ? '#00d09c' : '#1f2937'}` }}>
              {s}
            </button>
          ))}
          {['All','Mainboard','SME','InvIT','REIT'].map(t => (
            <button key={t} onClick={() => setType(t)}
              style={{ padding: '6px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', background: type === t ? `${TYPE_COLOR[t]||'#374151'}25` : 'transparent', color: type === t ? (TYPE_COLOR[t]||'#e5e7eb') : '#4b5563', border: `1px solid ${type === t ? (TYPE_COLOR[t]||'#374151') : '#111827'}` }}>
              {t}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#ef444410', border: '1px solid #ef444430', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#fca5a5', fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#374151' }}>
            <div style={{ width: 40, height: 40, border: '3px solid #1f2937', borderTop: '3px solid #00d09c', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            Fetching IPO data from Groq…
          </div>
        )}

        {/* Grid */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {filtered.map((ipo, i) => <IPOCard key={i} ipo={ipo} onClick={() => setSelected(ipo)} />)}
          </div>
        )}

        {!loading && !error && ipos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#374151' }}>No data loaded yet.</div>
        )}

        {!loading && ipos.length > 0 && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#374151' }}>No IPOs match your filters.</div>
        )}
      </div>

      {selected && <IPOModal ipo={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

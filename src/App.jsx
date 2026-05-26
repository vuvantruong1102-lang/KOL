import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  loadKols, saveKols, loadTemplates, saveTemplates,
  loadLogs, addLog, clearLogs, uid, seedIfEmpty,
  exportAll, importAll,
} from './lib/storage'
import { STAGES, stageOf, TIERS, autoTier, tierLabel, RATING_TAGS } from './lib/constants'

// ============================ Helpers ============================
const fmtNum = (n) => (Number(n) || 0).toLocaleString('vi-VN')
const fmtMoney = (n) => fmtNum(n) + 'đ'
const fmtDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}
const fmtDateShort = (s) => (s ? new Date(s).toLocaleDateString('vi-VN') : '—')
const daysSince = (s) => {
  if (!s) return null
  return Math.floor((Date.now() - new Date(s).getTime()) / 86400000)
}

function emptyKol() {
  return {
    id: uid(),
    name: '', phone: '', email: '', address: '',
    tiktok: '', instagram: '', youtube: '', facebook: '',
    topic: '', followers: 0,
    stage: 'tiem_nang',
    rating: 0, tags: [],
    note: '',
    history: [], // [{id, date, product, videoLink, fee, cost, revenue, note}]
    shipping: [], // [{id, sentAt, orderCode, productName, videoReminded, videoDue}]
    createdAt: new Date().toISOString(),
  }
}

// ============================ App ============================
export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [kols, setKols] = useState([])
  const [templates, setTemplates] = useState([])
  const [logs, setLogs] = useState([])
  const [editing, setEditing] = useState(null) // kol object being edited (drawer)
  const [toast, setToast] = useState('')

  useEffect(() => {
    seedIfEmpty()
    setKols(loadKols())
    setTemplates(loadTemplates())
    setLogs(loadLogs())
  }, [])

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 1800) }

  // ---- persistence wrappers (with logging) ----
  function persistKols(next, logAction, logDetail) {
    setKols(next); saveKols(next)
    if (logAction) setLogs(addLog(logAction, logDetail))
  }
  function persistTemplates(next, logAction, logDetail) {
    setTemplates(next); saveTemplates(next)
    if (logAction) setLogs(addLog(logAction, logDetail))
  }

  function upsertKol(kol) {
    const exists = kols.some((k) => k.id === kol.id)
    const next = exists ? kols.map((k) => (k.id === kol.id ? kol : k)) : [kol, ...kols]
    persistKols(next, exists ? 'Sửa KOL' : 'Thêm KOL', kol.name || '(chưa tên)')
    flash(exists ? 'Đã lưu thay đổi' : 'Đã thêm KOL')
    setEditing(null)
  }
  function removeKol(kol) {
    if (!confirm(`Xoá KOL "${kol.name}"? Không thể hoàn tác.`)) return
    persistKols(kols.filter((k) => k.id !== kol.id), 'Xoá KOL', kol.name)
    flash('Đã xoá KOL')
    setEditing(null)
  }
  function changeStage(kol, stage) {
    const next = kols.map((k) => (k.id === kol.id ? { ...k, stage } : k))
    persistKols(next, 'Đổi trạng thái', `${kol.name}: ${stageOf(stage).label}`)
  }

  const navItems = [
    ['dashboard', 'Tổng quan'],
    ['list', 'Danh sách KOL'],
    ['pipeline', 'Pipeline'],
    ['templates', 'Mẫu liên hệ'],
    ['logs', 'Log'],
  ]

  return (
    <div className="app">
      <div className="topbar">
        <div className="logo"><span className="mark">K</span> KOL Manager</div>
        <nav className="nav">
          {navItems.map(([key, label]) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="spacer" />
        <DataMenu
          onExport={() => doExport()}
          onImport={(data) => { importAll(data); setKols(loadKols()); setTemplates(loadTemplates()); setLogs(loadLogs()); flash('Đã nhập dữ liệu') }}
        />
        <button className="btn primary" onClick={() => setEditing(emptyKol())}>+ Thêm KOL</button>
      </div>

      <div className="main">
        {tab === 'dashboard' && <Dashboard kols={kols} onOpen={setEditing} goTo={setTab} />}
        {tab === 'list' && (
          <KolList kols={kols} onOpen={setEditing} onStage={changeStage} />
        )}
        {tab === 'pipeline' && (
          <Pipeline kols={kols} onOpen={setEditing} onStage={changeStage} />
        )}
        {tab === 'templates' && (
          <Templates
            templates={templates}
            onSave={(t) => persistTemplates(t, null)}
            onLog={(a, d) => setLogs(addLog(a, d))}
            flash={flash}
          />
        )}
        {tab === 'logs' && (
          <Logs logs={logs} onClear={() => { if (confirm('Xoá toàn bộ log?')) { clearLogs(); setLogs([]) } }} />
        )}
      </div>

      {editing && (
        <KolDrawer
          kol={editing}
          templates={templates}
          onClose={() => setEditing(null)}
          onSave={upsertKol}
          onDelete={removeKol}
          flash={flash}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )

  function doExport() {
    const data = exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kol-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    flash('Đã xuất dữ liệu')
  }
}

// ============================ Data menu (export/import) ============================
function DataMenu({ onExport, onImport }) {
  const [open, setOpen] = useState(false)
  const fileRef = useRef(null)
  return (
    <div style={{ position: 'relative' }}>
      <button className="btn ghost" onClick={() => setOpen((o) => !o)}>Dữ liệu ▾</button>
      {open && (
        <div className="panel" style={{ position: 'absolute', right: 0, top: 42, width: 220, padding: 8, zIndex: 60 }}>
          <button className="btn ghost" style={{ width: '100%', justifyContent: 'flex-start' }}
            onClick={() => { onExport(); setOpen(false) }}>⬇ Xuất backup (.json)</button>
          <button className="btn ghost" style={{ width: '100%', justifyContent: 'flex-start' }}
            onClick={() => fileRef.current?.click()}>⬆ Nhập backup (.json)</button>
          <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]; if (!f) return
              const reader = new FileReader()
              reader.onload = () => { try { onImport(JSON.parse(reader.result)) } catch { alert('File không hợp lệ') } setOpen(false) }
              reader.readAsText(f)
            }} />
          <div style={{ borderTop: '1px solid var(--line)', margin: '6px 0' }} />
          <CsvExportButton />
        </div>
      )}
    </div>
  )
}

function CsvExportButton() {
  function exportCsv() {
    const kols = loadKols()
    const headers = ['Tên', 'SĐT', 'Email', 'Địa chỉ', 'TikTok', 'Chủ đề', 'Follow', 'Trạng thái', 'Đánh giá', 'Số lần hợp tác', 'Tổng phí']
    const rows = kols.map((k) => {
      const totalFee = (k.history || []).reduce((s, h) => s + (Number(h.fee) || 0), 0)
      return [k.name, k.phone, k.email, k.address, k.tiktok, k.topic, k.followers,
        stageOf(k.stage).label, k.rating, (k.history || []).length, totalFee]
    })
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'kol-list.csv'; a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <button className="btn ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={exportCsv}>
      ⬇ Xuất danh sách (.csv)
    </button>
  )
}

// ============================ Dashboard ============================
function Dashboard({ kols, onOpen, goTo }) {
  const stats = useMemo(() => {
    const byStage = {}
    STAGES.forEach((s) => (byStage[s.key] = 0))
    let totalFee = 0, totalRevenue = 0, collabs = 0
    kols.forEach((k) => {
      byStage[k.stage] = (byStage[k.stage] || 0) + 1
      ;(k.history || []).forEach((h) => {
        totalFee += Number(h.fee) || 0
        totalRevenue += Number(h.revenue) || 0
        collabs++
      })
    })
    return { byStage, totalFee, totalRevenue, collabs }
  }, [kols])

  // KOL đã gửi hàng nhưng chưa có video / chưa trả quá hạn
  const waiting = useMemo(() => {
    const list = []
    kols.forEach((k) => {
      ;(k.shipping || []).forEach((s) => {
        const hasVideo = (k.history || []).some((h) => h.videoLink)
        const days = daysSince(s.sentAt)
        if (!hasVideo && days !== null && days >= 0) {
          list.push({ kol: k, ship: s, days })
        }
      })
    })
    return list.sort((a, b) => b.days - a.days)
  }, [kols])

  const overdue = waiting.filter((w) => w.days >= 7)

  return (
    <div>
      <div className="page-head"><h1>Tổng quan</h1></div>

      {overdue.length > 0 && (
        <div className="alert warn">
          ⚠ Có <b>{overdue.length}</b> đơn đã gửi hàng quá 7 ngày mà chưa có video. Kiểm tra mục “Chờ video” bên dưới.
        </div>
      )}

      <div className="stats">
        <div className="stat"><div className="num">{fmtNum(kols.length)}</div><div className="lbl">Tổng KOL</div></div>
        <div className="stat"><div className="num" style={{ color: 'var(--ok)' }}>{fmtNum(stats.byStage.hoan_thanh)}</div><div className="lbl">Đã hoàn thành</div></div>
        <div className="stat"><div className="num" style={{ color: 'var(--warn)' }}>{fmtNum(waiting.length)}</div><div className="lbl">Đang chờ video</div></div>
        <div className="stat"><div className="num">{fmtNum(stats.collabs)}</div><div className="lbl">Lượt hợp tác</div></div>
        <div className="stat"><div className="num mono" style={{ fontSize: 19 }}>{fmtMoney(stats.totalFee)}</div><div className="lbl">Tổng chi phí</div></div>
        <div className="stat"><div className="num mono" style={{ fontSize: 19, color: 'var(--ok)' }}>{fmtMoney(stats.totalRevenue)}</div><div className="lbl">Tổng doanh thu (ước)</div></div>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <h3 style={{ marginTop: 0, fontSize: 14 }}>Phân bố theo trạng thái</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STAGES.map((s) => (
            <div key={s.key} onClick={() => goTo('pipeline')} style={{ cursor: 'pointer', flex: '1 1 120px', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}>
              <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: s.color }}>{fmtNum(stats.byStage[s.key] || 0)}</div>
              <div style={{ fontSize: 12, color: 'var(--txt-dim)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0, fontSize: 14 }}>Đơn đang chờ trả video</h3>
        {waiting.length === 0 ? (
          <div style={{ color: 'var(--txt-faint)', padding: '14px 0' }}>Không có đơn nào đang chờ. 🎉</div>
        ) : (
          <div className="table-wrap" style={{ border: 'none' }}>
            <table>
              <thead><tr><th>KOL</th><th>Mã đơn</th><th>Gửi ngày</th><th className="right">Đã chờ</th><th></th></tr></thead>
              <tbody>
                {waiting.slice(0, 20).map((w, i) => (
                  <tr key={i}>
                    <td className="cell-name">{w.kol.name}</td>
                    <td className="mono">{w.ship.orderCode || '—'}</td>
                    <td>{fmtDateShort(w.ship.sentAt)}</td>
                    <td className="right mono" style={{ color: w.days >= 7 ? 'var(--danger)' : 'var(--warn)', fontWeight: 600 }}>{w.days} ngày</td>
                    <td className="right"><button className="btn sm" onClick={() => onOpen(w.kol)}>Mở</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================ KOL List ============================
function KolList({ kols, onOpen, onStage }) {
  const [q, setQ] = useState('')
  const [fStage, setFStage] = useState('')
  const [fTier, setFTier] = useState('')
  const [sortKey, setSortKey] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')

  const filtered = useMemo(() => {
    let arr = kols.filter((k) => {
      if (fStage && k.stage !== fStage) return false
      if (fTier && autoTier(k.followers) !== fTier) return false
      if (q) {
        const hay = `${k.name} ${k.phone} ${k.email} ${k.topic} ${k.tiktok}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
    arr = [...arr].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey]
      if (sortKey === 'followers') { av = Number(av) || 0; bv = Number(bv) || 0 }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [kols, q, fStage, fTier, sortKey, sortDir])

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }
  const arrow = (key) => (sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '')

  return (
    <div>
      <div className="page-head">
        <h1>Danh sách KOL</h1>
        <span style={{ color: 'var(--txt-faint)' }} className="mono">{filtered.length}/{kols.length}</span>
      </div>

      <div className="toolbar">
        <div className="field"><input className="search" type="text" placeholder="Tìm tên, SĐT, email, chủ đề…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select style={{ width: 'auto' }} value={fStage} onChange={(e) => setFStage(e.target.value)}>
          <option value="">Mọi trạng thái</option>
          {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select style={{ width: 'auto' }} value={fTier} onChange={(e) => setFTier(e.target.value)}>
          <option value="">Mọi hạng</option>
          {TIERS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty"><div className="big">∅</div>Chưa có KOL nào khớp. Bấm “+ Thêm KOL” để bắt đầu.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th onClick={() => toggleSort('name')}>KOL{arrow('name')}</th>
                <th onClick={() => toggleSort('topic')}>Chủ đề{arrow('topic')}</th>
                <th onClick={() => toggleSort('followers')} className="right">Follow{arrow('followers')}</th>
                <th>Hạng</th>
                <th>Trạng thái</th>
                <th>Đánh giá</th>
                <th className="right">Liên hệ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((k) => (
                <tr key={k.id} onClick={() => onOpen(k)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div className="cell-name">{k.name || '(chưa tên)'}</div>
                    <div className="cell-sub">{k.tiktok || '—'}</div>
                  </td>
                  <td>{k.topic || '—'}</td>
                  <td className="right mono">{fmtNum(k.followers)}</td>
                  <td><span className="tag">{tierLabel(autoTier(k.followers)).split(' ')[0]}</span></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <select value={k.stage} onChange={(e) => onStage(k, e.target.value)}
                      style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}>
                      {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </td>
                  <td><Stars value={k.rating} readOnly /></td>
                  <td className="right nowrap mono cell-sub">{k.phone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ============================ Pipeline (Kanban) ============================
function Pipeline({ kols, onOpen, onStage }) {
  const [dragId, setDragId] = useState(null)
  const [over, setOver] = useState(null)

  const grouped = useMemo(() => {
    const g = {}
    STAGES.forEach((s) => (g[s.key] = []))
    kols.forEach((k) => { (g[k.stage] || (g[k.stage] = [])).push(k) })
    return g
  }, [kols])

  function onDrop(stageKey) {
    if (dragId) {
      const k = kols.find((x) => x.id === dragId)
      if (k && k.stage !== stageKey) onStage(k, stageKey)
    }
    setDragId(null); setOver(null)
  }

  return (
    <div>
      <div className="page-head"><h1>Pipeline</h1><span style={{ color: 'var(--txt-faint)', fontSize: 13 }}>Kéo thả thẻ để đổi trạng thái</span></div>
      <div className="kanban">
        {STAGES.map((s) => (
          <div key={s.key}
            className={`kcol ${over === s.key ? 'drop-target' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(s.key) }}
            onDragLeave={() => setOver((o) => (o === s.key ? null : o))}
            onDrop={() => onDrop(s.key)}>
            <div className="kcol-head">
              <span className="dot" style={{ width: 9, height: 9, borderRadius: '50%', background: s.color }} />
              {s.label}
              <span className="count">{grouped[s.key].length}</span>
            </div>
            <div className="kcol-body">
              {grouped[s.key].map((k) => (
                <div key={k.id} className={`kcard ${dragId === k.id ? 'dragging' : ''}`}
                  draggable
                  onDragStart={() => setDragId(k.id)}
                  onDragEnd={() => { setDragId(null); setOver(null) }}
                  onClick={() => onOpen(k)}>
                  <div className="kname">{k.name || '(chưa tên)'}</div>
                  <div className="kmeta">
                    <span>{k.topic || '—'}</span>
                    <span className="mono">{fmtNum(k.followers)} follow</span>
                  </div>
                </div>
              ))}
              {grouped[s.key].length === 0 && <div style={{ color: 'var(--txt-faint)', fontSize: 12, padding: 6 }}>Trống</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================ Stars ============================
function Stars({ value = 0, onChange, readOnly }) {
  return (
    <span className="stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`star ${n <= value ? 'on' : ''}`}
          onClick={readOnly ? undefined : (e) => { e.stopPropagation(); onChange?.(n === value ? 0 : n) }}
          style={{ cursor: readOnly ? 'default' : 'pointer' }}>★</span>
      ))}
    </span>
  )
}

// ============================ KOL Drawer (edit form) ============================
function KolDrawer({ kol, templates, onClose, onSave, onDelete, flash }) {
  const [f, setF] = useState(() => JSON.parse(JSON.stringify(kol)))
  const set = (key) => (e) => setF((p) => ({ ...p, [key]: e.target.value }))
  const setVal = (key, val) => setF((p) => ({ ...p, [key]: val }))

  // sync tier auto when followers change (display only)
  const tier = tierLabel(autoTier(f.followers))

  function toggleTag(t) {
    setF((p) => {
      const has = (p.tags || []).includes(t)
      return { ...p, tags: has ? p.tags.filter((x) => x !== t) : [...(p.tags || []), t] }
    })
  }

  // history
  function addHistory() {
    setF((p) => ({ ...p, history: [{ id: uid(), date: new Date().toISOString().slice(0, 10), product: '', videoLink: '', fee: 0, cost: 0, revenue: 0, note: '' }, ...(p.history || [])] }))
  }
  function updHistory(id, key, val) {
    setF((p) => ({ ...p, history: p.history.map((h) => (h.id === id ? { ...h, [key]: val } : h)) }))
  }
  function delHistory(id) { setF((p) => ({ ...p, history: p.history.filter((h) => h.id !== id) })) }

  // shipping
  function addShipping() {
    setF((p) => ({ ...p, shipping: [{ id: uid(), sentAt: new Date().toISOString().slice(0, 10), orderCode: '', productName: '', videoDue: '', videoReminded: false }, ...(p.shipping || [])] }))
  }
  function updShipping(id, key, val) {
    setF((p) => ({ ...p, shipping: p.shipping.map((s) => (s.id === id ? { ...s, [key]: val } : s)) }))
  }
  function delShipping(id) { setF((p) => ({ ...p, shipping: p.shipping.filter((s) => s.id !== id) })) }

  function copyTemplate(t) {
    const text = t.body
      .replaceAll('{ten}', f.name || '')
      .replaceAll('{chude}', f.topic || '')
    navigator.clipboard.writeText(text).then(() => flash('Đã copy mẫu liên hệ'))
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target.classList.contains('overlay')) onClose() }}>
      <div className="drawer">
        <div className="drawer-head">
          <h2>{kol.name ? f.name || kol.name : 'Thêm KOL mới'}</h2>
          <span className="tag">{tier}</span>
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-body">
          {/* Thông tin cá nhân */}
          <div className="section-title">Thông tin cá nhân</div>
          <div className="form-grid">
            <div className="form-row full"><label>Tên KOL</label><input type="text" value={f.name} onChange={set('name')} /></div>
            <div className="form-row"><label>Số điện thoại</label><input type="tel" value={f.phone} onChange={set('phone')} /></div>
            <div className="form-row"><label>Email</label><input type="email" value={f.email} onChange={set('email')} /></div>
            <div className="form-row full"><label>Địa chỉ</label><input type="text" value={f.address} onChange={set('address')} /></div>
          </div>

          {/* Kênh */}
          <div className="section-title">Kênh & nội dung</div>
          <div className="form-grid">
            <div className="form-row"><label>TikTok</label><input type="text" value={f.tiktok} onChange={set('tiktok')} placeholder="@username hoặc link" /></div>
            <div className="form-row"><label>Instagram</label><input type="text" value={f.instagram} onChange={set('instagram')} /></div>
            <div className="form-row"><label>YouTube</label><input type="text" value={f.youtube} onChange={set('youtube')} /></div>
            <div className="form-row"><label>Facebook</label><input type="text" value={f.facebook} onChange={set('facebook')} /></div>
            <div className="form-row"><label>Chủ đề kênh</label><input type="text" value={f.topic} onChange={set('topic')} placeholder="VD: Làm đẹp, Ẩm thực…" /></div>
            <div className="form-row"><label>Lượt follow</label><input type="number" value={f.followers} onChange={(e) => setVal('followers', Number(e.target.value))} /></div>
          </div>

          {/* Trạng thái & đánh giá */}
          <div className="section-title">Trạng thái & đánh giá</div>
          <div className="form-grid">
            <div className="form-row"><label>Trạng thái pipeline</label>
              <select value={f.stage} onChange={set('stage')}>{STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
            </div>
            <div className="form-row"><label>Chấm điểm</label><div style={{ paddingTop: 4 }}><Stars value={f.rating} onChange={(n) => setVal('rating', n)} /></div></div>
            <div className="form-row full"><label>Tag đánh giá</label>
              <div>{RATING_TAGS.map((t) => (
                <span key={t} className="tag" onClick={() => toggleTag(t)}
                  style={{ cursor: 'pointer', borderColor: (f.tags || []).includes(t) ? 'var(--accent)' : 'var(--line-2)', color: (f.tags || []).includes(t) ? 'var(--accent)' : 'var(--txt-dim)' }}>
                  {(f.tags || []).includes(t) ? '✓ ' : ''}{t}
                </span>
              ))}</div>
            </div>
            <div className="form-row full"><label>Ghi chú chung</label><textarea value={f.note} onChange={set('note')} /></div>
          </div>

          {/* Mẫu liên hệ nhanh */}
          {templates.length > 0 && (
            <>
              <div className="section-title">Copy nhanh mẫu liên hệ</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {templates.map((t) => (
                  <button key={t.id} className="btn sm" onClick={() => copyTemplate(t)}>📋 {t.name}</button>
                ))}
              </div>
            </>
          )}

          {/* Gửi hàng */}
          <div className="section-title">
            Gửi hàng
            <button className="btn sm" style={{ float: 'right' }} onClick={addShipping}>+ Thêm đơn</button>
          </div>
          {(f.shipping || []).length === 0 && <div style={{ color: 'var(--txt-faint)', fontSize: 13 }}>Chưa có đơn gửi nào.</div>}
          {(f.shipping || []).map((s) => {
            const days = daysSince(s.sentAt)
            return (
              <div key={s.id} className="hist">
                <div className="form-grid" style={{ gap: 10 }}>
                  <div className="form-row"><label>Ngày gửi</label><input type="date" value={s.sentAt} onChange={(e) => updShipping(s.id, 'sentAt', e.target.value)} /></div>
                  <div className="form-row"><label>Mã đơn hàng</label><input type="text" value={s.orderCode} onChange={(e) => updShipping(s.id, 'orderCode', e.target.value)} /></div>
                  <div className="form-row"><label>Sản phẩm</label><input type="text" value={s.productName} onChange={(e) => updShipping(s.id, 'productName', e.target.value)} /></div>
                  <div className="form-row"><label>Hạn trả video</label><input type="date" value={s.videoDue} onChange={(e) => updShipping(s.id, 'videoDue', e.target.value)} /></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--txt-dim)' }}>
                    <input type="checkbox" checked={!!s.videoReminded} onChange={(e) => updShipping(s.id, 'videoReminded', e.target.checked)} /> Đã nhắc trả video
                  </label>
                  {days !== null && days >= 0 && (
                    <span className="mono" style={{ fontSize: 12, color: days >= 7 ? 'var(--danger)' : 'var(--warn)' }}>Đã gửi {days} ngày</span>
                  )}
                  <button className="btn danger sm" style={{ marginLeft: 'auto' }} onClick={() => delShipping(s.id)}>Xoá</button>
                </div>
              </div>
            )
          })}

          {/* Lịch sử hợp tác */}
          <div className="section-title">
            Lịch sử hợp tác
            <button className="btn sm" style={{ float: 'right' }} onClick={addHistory}>+ Thêm lần</button>
          </div>
          {(f.history || []).length === 0 && <div style={{ color: 'var(--txt-faint)', fontSize: 13 }}>Chưa có lịch sử hợp tác.</div>}
          {(f.history || []).map((h) => {
            const roi = (Number(h.revenue) || 0) - (Number(h.fee) || 0) - (Number(h.cost) || 0)
            return (
              <div key={h.id} className="hist">
                <div className="form-grid" style={{ gap: 10 }}>
                  <div className="form-row"><label>Ngày</label><input type="date" value={h.date} onChange={(e) => updHistory(h.id, 'date', e.target.value)} /></div>
                  <div className="form-row"><label>Sản phẩm hợp tác</label><input type="text" value={h.product} onChange={(e) => updHistory(h.id, 'product', e.target.value)} /></div>
                  <div className="form-row full"><label>Link video</label><input type="url" value={h.videoLink} onChange={(e) => updHistory(h.id, 'videoLink', e.target.value)} placeholder="https://…" /></div>
                  <div className="form-row"><label>Phí (đ)</label><input type="number" value={h.fee} onChange={(e) => updHistory(h.id, 'fee', Number(e.target.value))} /></div>
                  <div className="form-row"><label>Giá vốn hàng (đ)</label><input type="number" value={h.cost} onChange={(e) => updHistory(h.id, 'cost', Number(e.target.value))} /></div>
                  <div className="form-row"><label>Doanh thu thu về (đ)</label><input type="number" value={h.revenue} onChange={(e) => updHistory(h.id, 'revenue', Number(e.target.value))} /></div>
                  <div className="form-row"><label>Lợi nhuận (ước)</label><input type="text" readOnly value={fmtMoney(roi)} style={{ color: roi >= 0 ? 'var(--ok)' : 'var(--danger)' }} /></div>
                  <div className="form-row full"><label>Ghi chú</label><input type="text" value={h.note} onChange={(e) => updHistory(h.id, 'note', e.target.value)} /></div>
                </div>
                <div style={{ display: 'flex', marginTop: 8 }}>
                  {h.videoLink && <a className="linkout" href={h.videoLink} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>▶ Mở video</a>}
                  <button className="btn danger sm" style={{ marginLeft: 'auto' }} onClick={() => delHistory(h.id)}>Xoá</button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="drawer-foot">
          <button className="btn primary" onClick={() => onSave(f)}>Lưu</button>
          <button className="btn ghost" onClick={onClose}>Huỷ</button>
          <div style={{ flex: 1 }} />
          {kol.name !== undefined && kol.createdAt && (
            <button className="btn danger" onClick={() => onDelete(kol)}>Xoá KOL</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================ Templates ============================
function Templates({ templates, onSave, onLog, flash }) {
  const [edit, setEdit] = useState(null)

  function save(t) {
    const exists = templates.some((x) => x.id === t.id)
    const next = exists ? templates.map((x) => (x.id === t.id ? t : x)) : [...templates, t]
    onSave(next); onLog(exists ? 'Sửa mẫu liên hệ' : 'Thêm mẫu liên hệ', t.name)
    setEdit(null); flash('Đã lưu mẫu')
  }
  function del(t) {
    if (!confirm(`Xoá mẫu "${t.name}"?`)) return
    onSave(templates.filter((x) => x.id !== t.id)); onLog('Xoá mẫu liên hệ', t.name); flash('Đã xoá mẫu')
  }
  function copy(t) {
    navigator.clipboard.writeText(t.body).then(() => flash('Đã copy vào clipboard'))
  }

  return (
    <div>
      <div className="page-head">
        <h1>Mẫu liên hệ</h1>
        <div className="spacer" />
        <button className="btn primary" onClick={() => setEdit({ id: uid(), name: '', body: '' })}>+ Thêm mẫu</button>
      </div>
      <p style={{ color: 'var(--txt-dim)', fontSize: 13, marginTop: -6 }}>
        Dùng biến <code className="mono">{'{ten}'}</code> và <code className="mono">{'{chude}'}</code> — khi copy từ trong hồ sơ KOL sẽ tự điền tên và chủ đề.
      </p>

      {templates.length === 0 ? (
        <div className="empty"><div className="big">✎</div>Chưa có mẫu nào.</div>
      ) : (
        <div className="tmpl-grid">
          {templates.map((t) => (
            <div key={t.id} className="tmpl">
              <h3>{t.name}</h3>
              <div className="body">{t.body}</div>
              <div className="actions">
                <button className="btn primary sm" onClick={() => copy(t)}>📋 Copy</button>
                <button className="btn sm" onClick={() => setEdit(t)}>Sửa</button>
                <button className="btn danger sm" onClick={() => del(t)}>Xoá</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {edit && (
        <div className="overlay modal-center" onMouseDown={(e) => { if (e.target.classList.contains('overlay')) setEdit(null) }}>
          <div className="modal-box">
            <div className="drawer-head"><h2 style={{ fontSize: 16 }}>{edit.name ? 'Sửa mẫu' : 'Mẫu mới'}</h2><button className="btn ghost" onClick={() => setEdit(null)}>✕</button></div>
            <div style={{ padding: 20 }}>
              <div className="form-row" style={{ marginBottom: 14 }}><label>Tên mẫu</label><input type="text" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div className="form-row"><label>Nội dung</label><textarea style={{ minHeight: 160 }} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></div>
            </div>
            <div className="drawer-foot"><button className="btn primary" onClick={() => save(edit)}>Lưu</button><button className="btn ghost" onClick={() => setEdit(null)}>Huỷ</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================ Logs ============================
function Logs({ logs, onClear }) {
  return (
    <div>
      <div className="page-head"><h1>Log chỉnh sửa</h1><div className="spacer" />{logs.length > 0 && <button className="btn danger" onClick={onClear}>Xoá log</button>}</div>
      {logs.length === 0 ? (
        <div className="empty"><div className="big">≡</div>Chưa có hoạt động nào được ghi lại.</div>
      ) : (
        <div className="panel">
          {logs.map((l) => (
            <div key={l.id} className="log-line">
              <span className="log-time">{fmtDate(l.time)}</span>
              <span className="log-action">{l.action}</span>
              <span className="log-detail">{l.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

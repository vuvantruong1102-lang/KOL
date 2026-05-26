import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  loadKols, saveKols, loadWorks, saveWorks, loadVideos, saveVideos,
  loadTemplates, saveTemplates, loadLogs, addLog, clearLogs, uid,
  seedIfEmpty, exportAll, importAll,
} from './lib/storage'
import { WORK_STATUS, statusOf, TIERS, autoTier, tierLabel, RATING_TAGS } from './lib/constants'

// ============================ Helpers ============================
// Format số lượt follow kiểu 1k, 10k, 1.2M
function fmtFollow(n) {
  n = Number(n) || 0
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1).replace('.0', '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1).replace('.0', '') + 'k'
  return String(n)
}
const fmtNum = (n) => (Number(n) || 0).toLocaleString('vi-VN')
const fmtMoney = (n) => fmtNum(n) + 'đ'
const fmtDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}
const fmtDateShort = (s) => (s ? new Date(s).toLocaleDateString('vi-VN') : '—')
const daysSince = (s) => (s ? Math.floor((Date.now() - new Date(s).getTime()) / 86400000) : null)

function emptyKol() {
  return {
    id: uid(), name: '', phone: '', email: '', address: '',
    tiktok: '', instagram: '', youtube: '', facebook: '',
    topic: '', followers: 0, rating: 0, tags: [], note: '',
    createdAt: new Date().toISOString(),
  }
}
function emptyWork(kol) {
  return {
    id: uid(),
    kolId: kol ? kol.id : '',
    kolName: kol ? kol.name : '',
    followers: kol ? kol.followers : 0,
    status: 'da_lien_he',
    canReup: '',          // '', 'co', 'khong'
    fee: 0,
    shipChannel: '',      // kênh gửi hàng
    orderCode: '',
    shipDate: '',
    note: '',
    videoLink: '',
    createdAt: new Date().toISOString(),
  }
}

// ============================ App ============================
export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [kols, setKols] = useState([])
  const [works, setWorks] = useState([])
  const [videos, setVideos] = useState([])
  const [templates, setTemplates] = useState([])
  const [logs, setLogs] = useState([])
  const [editing, setEditing] = useState(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    seedIfEmpty()
    setKols(loadKols()); setWorks(loadWorks()); setVideos(loadVideos())
    setTemplates(loadTemplates()); setLogs(loadLogs())
  }, [])

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 1800) }

  function persistKols(next, a, d) { setKols(next); saveKols(next); if (a) setLogs(addLog(a, d)) }
  function persistWorks(next, a, d) { setWorks(next); saveWorks(next); if (a) setLogs(addLog(a, d)) }
  function persistVideos(next, a, d) { setVideos(next); saveVideos(next); if (a) setLogs(addLog(a, d)) }
  function persistTemplates(next, a, d) { setTemplates(next); saveTemplates(next); if (a) setLogs(addLog(a, d)) }

  function upsertKol(kol) {
    const exists = kols.some((k) => k.id === kol.id)
    const next = exists ? kols.map((k) => (k.id === kol.id ? kol : k)) : [kol, ...kols]
    persistKols(next, exists ? 'Sửa KOL' : 'Thêm KOL', kol.name || '(chưa tên)')
    // đồng bộ tên/follow vào các work liên quan
    if (exists) {
      const w2 = works.map((w) => (w.kolId === kol.id ? { ...w, kolName: kol.name, followers: kol.followers } : w))
      persistWorks(w2)
    }
    flash(exists ? 'Đã lưu thay đổi' : 'Đã thêm KOL')
    setEditing(null)
  }
  function removeKol(kol) {
    if (!confirm(`Xoá KOL "${kol.name}"? Các dòng làm việc liên quan vẫn giữ lại.`)) return
    persistKols(kols.filter((k) => k.id !== kol.id), 'Xoá KOL', kol.name)
    flash('Đã xoá KOL'); setEditing(null)
  }

  const nav = [
    ['dashboard', '◍', 'Tổng quan'],
    ['list', '☰', 'Danh sách KOL'],
    ['pipeline', '⊞', 'Pipeline'],
    ['videos', '▶', 'Thư viện video'],
    ['templates', '✎', 'Mẫu liên hệ'],
    ['logs', '≡', 'Log'],
  ]

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><span className="mark">K</span> KOL Manager</div>
        <nav className="nav">
          {nav.map(([key, ico, label]) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              <span className="ico">{ico}</span> {label}
            </button>
          ))}
        </nav>
        <div className="actions">
          <button className="btn primary block" onClick={() => setEditing(emptyKol())}>+ Thêm KOL</button>
          <DataMenu
            onExport={doExport}
            onExportCsv={() => exportCsv(kols, works)}
            onImport={(data) => { importAll(data); setKols(loadKols()); setWorks(loadWorks()); setVideos(loadVideos()); setTemplates(loadTemplates()); setLogs(loadLogs()); flash('Đã nhập dữ liệu') }}
          />
        </div>
      </aside>

      <main className="content">
        {tab === 'dashboard' && <Dashboard kols={kols} works={works} onOpenKol={setEditing} goTo={setTab} />}
        {tab === 'list' && <KolList kols={kols} works={works} onOpen={setEditing} />}
        {tab === 'pipeline' && (
          <Pipeline kols={kols} works={works} templates={templates}
            onChange={(next, a, d) => persistWorks(next, a, d)}
            onOpenKol={(id) => { const k = kols.find((x) => x.id === id); if (k) setEditing(k) }}
            flash={flash} />
        )}
        {tab === 'videos' && (
          <VideoLibrary kols={kols} videos={videos} works={works}
            onChange={(next, a, d) => persistVideos(next, a, d)} flash={flash} />
        )}
        {tab === 'templates' && (
          <Templates templates={templates} onSave={(t) => persistTemplates(t, null)}
            onLog={(a, d) => setLogs(addLog(a, d))} flash={flash} />
        )}
        {tab === 'logs' && <Logs logs={logs} onClear={() => { if (confirm('Xoá toàn bộ log?')) { clearLogs(); setLogs([]) } }} />}
      </main>

      {editing && (
        <KolDrawer kol={editing} templates={templates} works={works}
          onClose={() => setEditing(null)} onSave={upsertKol} onDelete={removeKol} flash={flash} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )

  function doExport() {
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = `kol-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    URL.revokeObjectURL(url); flash('Đã xuất backup')
  }
}

function exportCsv(kols, works) {
  const headers = ['Tên', 'SĐT', 'Email', 'TikTok', 'Chủ đề', 'Follow', 'Số lần làm việc', 'Tổng phí']
  const rows = kols.map((k) => {
    const ws = works.filter((w) => w.kolId === k.id)
    const fee = ws.reduce((s, w) => s + (Number(w.fee) || 0), 0)
    return [k.name, k.phone, k.email, k.tiktok, k.topic, k.followers, ws.length, fee]
  })
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a')
  a.href = url; a.download = 'kol-list.csv'; a.click(); URL.revokeObjectURL(url)
}

// ============================ DataMenu ============================
function DataMenu({ onExport, onExportCsv, onImport }) {
  const [open, setOpen] = useState(false)
  const fileRef = useRef(null)
  return (
    <div style={{ position: 'relative' }}>
      <button className="btn block" onClick={() => setOpen((o) => !o)}>⇅ Dữ liệu</button>
      {open && (
        <div className="panel" style={{ position: 'absolute', bottom: 46, left: 0, width: 220, padding: 8, zIndex: 60, boxShadow: '0 8px 28px rgba(0,0,0,.12)' }}>
          <button className="btn ghost block" style={{ justifyContent: 'flex-start' }} onClick={() => { onExport(); setOpen(false) }}>⬇ Xuất backup (.json)</button>
          <button className="btn ghost block" style={{ justifyContent: 'flex-start' }} onClick={() => { onExportCsv(); setOpen(false) }}>⬇ Xuất danh sách (.csv)</button>
          <button className="btn ghost block" style={{ justifyContent: 'flex-start' }} onClick={() => fileRef.current?.click()}>⬆ Nhập backup (.json)</button>
          <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { onImport(JSON.parse(r.result)) } catch { alert('File không hợp lệ') } setOpen(false) }; r.readAsText(f) }} />
        </div>
      )}
    </div>
  )
}

// ============================ KOL name autocomplete ============================
function KolAutocomplete({ value, kols, onPick, onType, placeholder }) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const wrapRef = useRef(null)
  const matches = useMemo(() => {
    const q = (value || '').toLowerCase().trim()
    if (!q) return kols.slice(0, 8)
    return kols.filter((k) => (k.name || '').toLowerCase().includes(q)).slice(0, 8)
  }, [value, kols])

  useEffect(() => {
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div className="ac" ref={wrapRef}>
      <input type="text" value={value} placeholder={placeholder || 'Gõ tên KOL…'}
        onChange={(e) => { onType(e.target.value); setOpen(true); setHi(0) }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, matches.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
          else if (e.key === 'Enter' && matches[hi]) { e.preventDefault(); onPick(matches[hi]); setOpen(false) }
          else if (e.key === 'Escape') setOpen(false)
        }} />
      {open && matches.length > 0 && (
        <div className="ac-list">
          {matches.map((k, i) => (
            <div key={k.id} className={`ac-item ${i === hi ? 'active' : ''}`}
              onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); onPick(k); setOpen(false) }}>
              <span>{k.name || '(chưa tên)'}</span>
              <span className="sub">{fmtFollow(k.followers)} · {k.topic || '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
// ============================ Dashboard ============================
function Dashboard({ kols, works, onOpenKol, goTo }) {
  const stats = useMemo(() => {
    const byStatus = {}; WORK_STATUS.forEach((s) => (byStatus[s.key] = 0))
    let fee = 0
    works.forEach((w) => { byStatus[w.status] = (byStatus[w.status] || 0) + 1; fee += Number(w.fee) || 0 })
    return { byStatus, fee }
  }, [works])

  const waiting = useMemo(() =>
    works.filter((w) => w.status === 'cho_video' || (w.status === 'da_gui_hang' && !w.videoLink))
      .map((w) => ({ w, days: daysSince(w.shipDate) }))
      .sort((a, b) => (b.days || 0) - (a.days || 0)), [works])
  const overdue = waiting.filter((x) => x.days !== null && x.days >= 7)

  return (
    <div>
      <div className="page-head"><h1>Tổng quan</h1></div>
      {overdue.length > 0 && (
        <div className="alert warn">⚠ Có <b style={{ margin: '0 4px' }}>{overdue.length}</b> đơn đã gửi quá 7 ngày chưa có video.</div>
      )}
      <div className="stats">
        <div className="stat"><div className="num">{fmtNum(kols.length)}</div><div className="lbl">Tổng KOL</div></div>
        <div className="stat"><div className="num">{fmtNum(works.length)}</div><div className="lbl">Lượt làm việc</div></div>
        <div className="stat"><div className="num" style={{ color: 'var(--ok)' }}>{fmtNum(stats.byStatus.hoan_thanh)}</div><div className="lbl">Hoàn thành</div></div>
        <div className="stat"><div className="num" style={{ color: 'var(--purple)' }}>{fmtNum(waiting.length)}</div><div className="lbl">Chờ video</div></div>
        <div className="stat"><div className="num mono" style={{ fontSize: 19 }}>{fmtMoney(stats.fee)}</div><div className="lbl">Tổng chi phí</div></div>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <h3 style={{ marginTop: 0, fontSize: 14 }}>Phân bố trạng thái làm việc</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {WORK_STATUS.map((s) => (
            <div key={s.key} onClick={() => goTo('pipeline')} style={{ cursor: 'pointer', flex: '1 1 130px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 9, padding: '12px 13px' }}>
              <div className="mono" style={{ fontSize: 22, fontWeight: 600 }}>{fmtNum(stats.byStatus[s.key] || 0)}</div>
              <div style={{ marginTop: 4 }}><span className={`pill ${s.pill}`}>{s.label}</span></div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0, fontSize: 14 }}>Đơn đang chờ trả video</h3>
        {waiting.length === 0 ? <div className="muted" style={{ padding: '12px 0' }}>Không có đơn nào đang chờ. 🎉</div> : (
          <div className="table-wrap" style={{ border: 'none' }}>
            <table>
              <thead><tr><th>KOL</th><th>Mã đơn</th><th>Ngày gửi</th><th className="right">Đã chờ</th></tr></thead>
              <tbody>
                {waiting.slice(0, 15).map(({ w, days }) => (
                  <tr key={w.id}>
                    <td className="cell-name">{w.kolName || '—'}</td>
                    <td className="mono">{w.orderCode || '—'}</td>
                    <td>{fmtDateShort(w.shipDate)}</td>
                    <td className="right mono" style={{ color: days >= 7 ? 'var(--danger)' : 'var(--warn)', fontWeight: 600 }}>{days === null ? '—' : days + ' ngày'}</td>
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
function KolList({ kols, works, onOpen }) {
  const [q, setQ] = useState('')
  const [fTier, setFTier] = useState('')
  const [sortKey, setSortKey] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')

  // video mới nhất cho mỗi KOL, lấy từ works
  const videosByKol = useMemo(() => {
    const m = {}
    works.forEach((w) => {
      if (w.videoLink && w.kolId) (m[w.kolId] || (m[w.kolId] = [])).push(w.videoLink)
    })
    return m
  }, [works])

  const filtered = useMemo(() => {
    let arr = kols.filter((k) => {
      if (fTier && autoTier(k.followers) !== fTier) return false
      if (q) { const hay = `${k.name} ${k.phone} ${k.email} ${k.topic} ${k.tiktok}`.toLowerCase(); if (!hay.includes(q.toLowerCase())) return false }
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
  }, [kols, q, fTier, sortKey, sortDir])

  const toggleSort = (k) => { if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSortKey(k); setSortDir('asc') } }
  const arrow = (k) => (sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '')

  return (
    <div>
      <div className="page-head"><h1>Danh sách KOL</h1><span className="mono muted">{filtered.length}/{kols.length}</span></div>
      <div className="toolbar">
        <input className="search" type="text" placeholder="Tìm tên, SĐT, email, chủ đề…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select style={{ width: 'auto' }} value={fTier} onChange={(e) => setFTier(e.target.value)}>
          <option value="">Mọi hạng</option>
          {TIERS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>
      {filtered.length === 0 ? <div className="empty"><div className="big">∅</div>Chưa có KOL nào khớp.</div> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggleSort('name')}>KOL{arrow('name')}</th>
                <th className="sortable" onClick={() => toggleSort('topic')}>Chủ đề{arrow('topic')}</th>
                <th className="sortable right" onClick={() => toggleSort('followers')}>Follow{arrow('followers')}</th>
                <th>Hạng</th>
                <th>Đánh giá</th>
                <th>Video đã thực hiện</th>
                <th className="right">Liên hệ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((k) => {
                const vids = videosByKol[k.id] || []
                return (
                  <tr key={k.id} onClick={() => onOpen(k)} style={{ cursor: 'pointer' }}>
                    <td><div className="cell-name">{k.name || '(chưa tên)'}</div><div className="cell-sub">{k.tiktok || '—'}</div></td>
                    <td>{k.topic || '—'}</td>
                    <td className="right mono">{fmtFollow(k.followers)}</td>
                    <td><span className="tag">{tierLabel(autoTier(k.followers))}</span></td>
                    <td><Stars value={k.rating} readOnly /></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {vids.length === 0 ? <span className="muted">—</span> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {vids.slice(0, 3).map((v, i) => (
                            <a key={i} className="linkout" href={v} target="_blank" rel="noreferrer">▶ Video {i + 1}</a>
                          ))}
                          {vids.length > 3 && <span className="cell-sub">+{vids.length - 3} nữa</span>}
                        </div>
                      )}
                    </td>
                    <td className="right nowrap mono cell-sub">{k.phone || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ============================ Pipeline (editable table) ============================
function Pipeline({ kols, works, templates, onChange, onOpenKol, flash }) {
  const [filter, setFilter] = useState('')

  function update(id, key, val) {
    onChange(works.map((w) => (w.id === id ? { ...w, [key]: val } : w)))
  }
  function pickKol(id, kol) {
    onChange(works.map((w) => (w.id === id ? { ...w, kolId: kol.id, kolName: kol.name, followers: kol.followers } : w)),
      'Gán KOL vào Pipeline', kol.name)
  }
  function addRow() {
    onChange([emptyWork(null), ...works])
  }
  function delRow(w) {
    if (!confirm('Xoá dòng làm việc này?')) return
    onChange(works.filter((x) => x.id !== w.id), 'Xoá dòng Pipeline', w.kolName || '—')
    flash('Đã xoá dòng')
  }
  function commit() { onChange(works, 'Cập nhật Pipeline', `${works.length} dòng`); flash('Đã lưu') }

  const rows = useMemo(() =>
    works.filter((w) => !filter || w.kolName.toLowerCase().includes(filter.toLowerCase())), [works, filter])

  return (
    <div>
      <div className="page-head">
        <h1>Pipeline</h1>
        <span className="muted" style={{ fontSize: 13 }}>Bảng theo dõi từng lần làm việc — nhập trực tiếp vào ô</span>
        <div className="spacer" />
        <input type="text" placeholder="Lọc theo tên…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 180 }} />
        <button className="btn" onClick={commit}>Lưu</button>
        <button className="btn primary" onClick={addRow}>+ Dòng mới</button>
      </div>

      {rows.length === 0 ? <div className="empty"><div className="big">⊞</div>Chưa có lần làm việc nào. Bấm “+ Dòng mới”.</div> : (
        <div className="table-wrap">
          <table className="pipe-table">
            <thead>
              <tr>
                <th style={{ minWidth: 170 }}>Tên KOL</th>
                <th>Follow</th>
                <th>Thông tin</th>
                <th style={{ minWidth: 130 }}>Trạng thái</th>
                <th>Reup</th>
                <th>Phí</th>
                <th>Kênh gửi</th>
                <th>Mã đơn</th>
                <th>Ngày gửi</th>
                <th style={{ minWidth: 160 }}>Ghi chú</th>
                <th style={{ minWidth: 170 }}>Link video</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id}>
                  <td>
                    <KolAutocomplete value={w.kolName} kols={kols}
                      onType={(v) => update(w.id, 'kolName', v)}
                      onPick={(k) => pickKol(w.id, k)} />
                  </td>
                  <td className="mono nowrap">{fmtFollow(w.followers)}</td>
                  <td className="center">
                    {w.kolId ? <button className="btn sm" onClick={() => onOpenKol(w.kolId)}>Xem</button> : <span className="muted">—</span>}
                  </td>
                  <td>
                    <select value={w.status} onChange={(e) => update(w.id, 'status', e.target.value)}
                      className={`pill ${statusOf(w.status).pill}`} style={{ border: 'none', fontWeight: 600, cursor: 'pointer', appearance: 'none', paddingRight: 8 }}>
                      {WORK_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={w.canReup} onChange={(e) => update(w.id, 'canReup', e.target.value)} style={{ width: 78 }}>
                      <option value="">—</option><option value="co">Có</option><option value="khong">Không</option>
                    </select>
                  </td>
                  <td><input type="number" value={w.fee} onChange={(e) => update(w.id, 'fee', Number(e.target.value))} style={{ width: 90 }} /></td>
                  <td><input type="text" value={w.shipChannel} onChange={(e) => update(w.id, 'shipChannel', e.target.value)} placeholder="GHTK…" style={{ width: 100 }} /></td>
                  <td><input type="text" value={w.orderCode} onChange={(e) => update(w.id, 'orderCode', e.target.value)} style={{ width: 110 }} /></td>
                  <td><input type="date" value={w.shipDate} onChange={(e) => update(w.id, 'shipDate', e.target.value)} style={{ width: 140 }} /></td>
                  <td><input type="text" value={w.note} onChange={(e) => update(w.id, 'note', e.target.value)} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input type="url" value={w.videoLink} onChange={(e) => update(w.id, 'videoLink', e.target.value)} placeholder="https://…" />
                      {w.videoLink && <a className="linkout" href={w.videoLink} target="_blank" rel="noreferrer">▶</a>}
                    </div>
                  </td>
                  <td><button className="btn danger sm" onClick={() => delRow(w)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
        Mẹo: gõ tên ở cột “Tên KOL” để chọn KOL có sẵn (tự điền follow). Link video nhập ở đây sẽ tự hiện trong Danh sách KOL.
      </p>
    </div>
  )
}

// ============================ Video Library ============================
function VideoLibrary({ kols, videos, works, onChange, flash }) {
  function update(id, key, val) { onChange(videos.map((v) => (v.id === id ? { ...v, [key]: val } : v))) }
  function pickKol(id, kol) { onChange(videos.map((v) => (v.id === id ? { ...v, kolId: kol.id, kolName: kol.name } : v))) }
  function addRow() { onChange([{ id: uid(), kolId: '', kolName: '', downloadLink: '', createdAt: new Date().toISOString() }, ...videos]) }
  function delRow(v) { if (!confirm('Xoá dòng này?')) return; onChange(videos.filter((x) => x.id !== v.id), 'Xoá video thư viện', v.kolName || '—'); flash('Đã xoá') }
  function commit() { onChange(videos, 'Cập nhật thư viện video', `${videos.length} dòng`); flash('Đã lưu') }

  // gợi ý: kéo video từ Pipeline vào nếu chưa có
  const pipelineVideos = useMemo(() =>
    works.filter((w) => w.videoLink).map((w) => ({ kolName: w.kolName, kolId: w.kolId, link: w.videoLink })), [works])

  return (
    <div>
      <div className="page-head">
        <h1>Thư viện video</h1>
        <span className="muted" style={{ fontSize: 13 }}>Lưu link tải video của từng KOL</span>
        <div className="spacer" />
        <button className="btn" onClick={commit}>Lưu</button>
        <button className="btn primary" onClick={addRow}>+ Dòng mới</button>
      </div>

      {videos.length === 0 ? <div className="empty"><div className="big">▶</div>Chưa có video nào. Bấm “+ Dòng mới”.</div> : (
        <div className="table-wrap">
          <table className="pipe-table" style={{ minWidth: 600 }}>
            <thead><tr><th style={{ minWidth: 220 }}>Tên KOL</th><th>Link tải video</th><th></th></tr></thead>
            <tbody>
              {videos.map((v) => (
                <tr key={v.id}>
                  <td><KolAutocomplete value={v.kolName} kols={kols} onType={(val) => update(v.id, 'kolName', val)} onPick={(k) => pickKol(v.id, k)} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input type="url" value={v.downloadLink} onChange={(e) => update(v.id, 'downloadLink', e.target.value)} placeholder="https://… link tải" />
                      {v.downloadLink && <a className="linkout" href={v.downloadLink} target="_blank" rel="noreferrer">⬇</a>}
                    </div>
                  </td>
                  <td><button className="btn danger sm" onClick={() => delRow(v)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pipelineVideos.length > 0 && (
        <div className="panel" style={{ marginTop: 18 }}>
          <h3 style={{ marginTop: 0, fontSize: 14 }}>Video có sẵn trong Pipeline</h3>
          <p className="muted" style={{ fontSize: 12.5, marginTop: -4 }}>Bấm “+ Lưu” để thêm nhanh vào thư viện.</p>
          <div className="table-wrap" style={{ border: 'none' }}>
            <table>
              <thead><tr><th>KOL</th><th>Link video</th><th className="right"></th></tr></thead>
              <tbody>
                {pipelineVideos.map((pv, i) => (
                  <tr key={i}>
                    <td className="cell-name">{pv.kolName || '—'}</td>
                    <td><a className="linkout" href={pv.link} target="_blank" rel="noreferrer">{pv.link.slice(0, 50)}{pv.link.length > 50 ? '…' : ''}</a></td>
                    <td className="right"><button className="btn sm" onClick={() => { onChange([{ id: uid(), kolId: pv.kolId, kolName: pv.kolName, downloadLink: pv.link, createdAt: new Date().toISOString() }, ...videos]); flash('Đã thêm vào thư viện') }}>+ Lưu</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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

// ============================ KOL Drawer ============================
function KolDrawer({ kol, templates, works, onClose, onSave, onDelete, flash }) {
  const [f, setF] = useState(() => JSON.parse(JSON.stringify(kol)))
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))
  const setVal = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const tier = tierLabel(autoTier(f.followers))
  const myWorks = works.filter((w) => w.kolId === kol.id)

  function toggleTag(t) {
    setF((p) => { const has = (p.tags || []).includes(t); return { ...p, tags: has ? p.tags.filter((x) => x !== t) : [...(p.tags || []), t] } })
  }
  function copyTemplate(t) {
    const txt = t.body.replaceAll('{ten}', f.name || '').replaceAll('{chude}', f.topic || '')
    navigator.clipboard.writeText(txt).then(() => flash('Đã copy mẫu liên hệ'))
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target.classList.contains('overlay')) onClose() }}>
      <div className="drawer">
        <div className="drawer-head"><h2>{f.name || 'Thêm KOL mới'}</h2><span className="tag">{tier} · {fmtFollow(f.followers)}</span><button className="btn ghost" onClick={onClose}>✕</button></div>
        <div className="drawer-body">
          <div className="section-title">Thông tin cá nhân</div>
          <div className="form-grid">
            <div className="form-row full"><label>Tên KOL</label><input type="text" value={f.name} onChange={set('name')} /></div>
            <div className="form-row"><label>Số điện thoại</label><input type="tel" value={f.phone} onChange={set('phone')} /></div>
            <div className="form-row"><label>Email</label><input type="email" value={f.email} onChange={set('email')} /></div>
            <div className="form-row full"><label>Địa chỉ</label><input type="text" value={f.address} onChange={set('address')} /></div>
          </div>
          <div className="section-title">Kênh & nội dung</div>
          <div className="form-grid">
            <div className="form-row"><label>TikTok</label><input type="text" value={f.tiktok} onChange={set('tiktok')} placeholder="@username / link" /></div>
            <div className="form-row"><label>Instagram</label><input type="text" value={f.instagram} onChange={set('instagram')} /></div>
            <div className="form-row"><label>YouTube</label><input type="text" value={f.youtube} onChange={set('youtube')} /></div>
            <div className="form-row"><label>Facebook</label><input type="text" value={f.facebook} onChange={set('facebook')} /></div>
            <div className="form-row"><label>Chủ đề kênh</label><input type="text" value={f.topic} onChange={set('topic')} placeholder="Làm đẹp, Ẩm thực…" /></div>
            <div className="form-row"><label>Lượt follow</label><input type="number" value={f.followers} onChange={(e) => setVal('followers', Number(e.target.value))} /></div>
          </div>
          <div className="section-title">Đánh giá</div>
          <div className="form-grid">
            <div className="form-row"><label>Chấm điểm</label><div style={{ paddingTop: 4 }}><Stars value={f.rating} onChange={(n) => setVal('rating', n)} /></div></div>
            <div className="form-row full"><label>Tag</label>
              <div>{RATING_TAGS.map((t) => (
                <span key={t} className="tag" onClick={() => toggleTag(t)} style={{ cursor: 'pointer', borderColor: (f.tags || []).includes(t) ? 'var(--brand)' : 'var(--line-2)', color: (f.tags || []).includes(t) ? 'var(--brand)' : 'var(--txt-dim)' }}>
                  {(f.tags || []).includes(t) ? '✓ ' : ''}{t}</span>
              ))}</div>
            </div>
            <div className="form-row full"><label>Ghi chú chung</label><textarea value={f.note} onChange={set('note')} /></div>
          </div>
          {templates.length > 0 && (
            <>
              <div className="section-title">Copy nhanh mẫu liên hệ</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {templates.map((t) => <button key={t.id} className="btn sm" onClick={() => copyTemplate(t)}>📋 {t.name}</button>)}
              </div>
            </>
          )}
          <div className="section-title">Lịch sử làm việc ({myWorks.length})</div>
          {myWorks.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>Chưa có lần làm việc nào. Thêm ở tab Pipeline.</div> : (
            myWorks.map((w) => (
              <div key={w.id} className="hist">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span className={`pill ${statusOf(w.status).pill}`}>{statusOf(w.status).label}</span>
                  {w.shipDate && <span className="cell-sub">Gửi {fmtDateShort(w.shipDate)}</span>}
                  {w.fee > 0 && <span className="mono cell-sub">{fmtMoney(w.fee)}</span>}
                </div>
                <div className="cell-sub">
                  {w.orderCode && <>Mã đơn: {w.orderCode} · </>}
                  {w.shipChannel && <>Kênh: {w.shipChannel} · </>}
                  Reup: {w.canReup === 'co' ? 'Có' : w.canReup === 'khong' ? 'Không' : '—'}
                </div>
                {w.note && <div style={{ marginTop: 4 }}>{w.note}</div>}
                {w.videoLink && <a className="linkout" href={w.videoLink} target="_blank" rel="noreferrer" style={{ marginTop: 4, display: 'inline-block' }}>▶ Mở video</a>}
              </div>
            ))
          )}
        </div>
        <div className="drawer-foot">
          <button className="btn primary" onClick={() => onSave(f)}>Lưu</button>
          <button className="btn ghost" onClick={onClose}>Huỷ</button>
          <div style={{ flex: 1 }} />
          {kol.createdAt && <button className="btn danger" onClick={() => onDelete(kol)}>Xoá KOL</button>}
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
    onSave(exists ? templates.map((x) => (x.id === t.id ? t : x)) : [...templates, t])
    onLog(exists ? 'Sửa mẫu liên hệ' : 'Thêm mẫu liên hệ', t.name); setEdit(null); flash('Đã lưu mẫu')
  }
  function del(t) { if (!confirm(`Xoá mẫu "${t.name}"?`)) return; onSave(templates.filter((x) => x.id !== t.id)); onLog('Xoá mẫu liên hệ', t.name); flash('Đã xoá mẫu') }
  function copy(t) { navigator.clipboard.writeText(t.body).then(() => flash('Đã copy vào clipboard')) }
  return (
    <div>
      <div className="page-head"><h1>Mẫu liên hệ</h1><div className="spacer" /><button className="btn primary" onClick={() => setEdit({ id: uid(), name: '', body: '' })}>+ Thêm mẫu</button></div>
      <p className="muted" style={{ fontSize: 13, marginTop: -8 }}>Dùng biến <code className="mono">{'{ten}'}</code>, <code className="mono">{'{chude}'}</code> — khi copy từ hồ sơ KOL sẽ tự điền.</p>
      {templates.length === 0 ? <div className="empty"><div className="big">✎</div>Chưa có mẫu nào.</div> : (
        <div className="tmpl-grid">
          {templates.map((t) => (
            <div key={t.id} className="tmpl">
              <h3>{t.name}</h3><div className="body">{t.body}</div>
              <div className="actions"><button className="btn primary sm" onClick={() => copy(t)}>📋 Copy</button><button className="btn sm" onClick={() => setEdit(t)}>Sửa</button><button className="btn danger sm" onClick={() => del(t)}>Xoá</button></div>
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
      {logs.length === 0 ? <div className="empty"><div className="big">≡</div>Chưa có hoạt động nào.</div> : (
        <div className="panel">
          {logs.map((l) => (
            <div key={l.id} className="log-line"><span className="log-time">{fmtDate(l.time)}</span><span className="log-action">{l.action}</span><span className="log-detail">{l.detail}</span></div>
          ))}
        </div>
      )}
    </div>
  )
}

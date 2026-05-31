import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  loadKols, saveKols, loadWorks, saveWorks, loadVideos, saveVideos,
  loadTemplates, saveTemplates, loadLogs, addLog, clearLogs, uid,
  seedIfEmpty, exportAll, importAll,
  loadAll, signInWithPassword, signOut, getSession,
} from './lib/storage'
import { hasSupabaseConfig, FIXED_EMAIL, supabase } from './lib/supabaseClient'
import { WORK_STATUS, statusOf, TIERS, autoTier, tierLabel, RATING_TAGS, KOL_STATUS, kolStatusOf } from './lib/constants'

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

// màu badge cho cột Review
function reviewPill(v) {
  if (v === 'da_review') return 'green'
  if (v === 'chua_review') return 'yellow'
  if (v === 'mau_mien_phi') return 'blue'
  return 'gray'
}
const reviewLabel = (v) => ({ da_review: 'Đã review', chua_review: 'Chưa review', mau_mien_phi: 'Mẫu miễn phí' }[v] || '—')

function emptyKol() {
  return {
    id: uid(), name: '', phone: '', email: '', address: '',
    tiktok: '', instagram: '', youtube: '', facebook: '',
    topic: '', followers: 0, rating: 0, tags: [], note: '',
    product: '',          // sản phẩm (nhập tay)
    kolStatus: '',        // trạng thái KOL: chua_lien_he, da_lien_he, dang_hop_tac, da_hop_tac, tu_choi
    createdAt: new Date().toISOString(),
  }
}
function emptyWork(kol) {
  return {
    id: uid(),
    kolId: kol ? kol.id : '',
    kolName: kol ? kol.name : '',
    followers: kol ? kol.followers : 0,
    product: '',          // sản phẩm
    sampleQty: '',        // số lượng mẫu
    status: 'da_lien_he',
    review: '',           // '', 'da_review', 'chua_review', 'mau_mien_phi'
    canReup: '',          // '', 'co', 'khong'
    fee: 0,
    shipChannel: '',      // kênh gửi hàng
    orderCode: '',
    sparkAds: '',         // mã spark ads
    shipDate: '',
    note: '',
    videoLink: '',
    createdAt: new Date().toISOString(),
  }
}

// ============================ App ============================
function AppInner({ onSignOut }) {
  const [tab, setTab] = useState('dashboard')
  const [kols, setKols] = useState([])
  const [works, setWorks] = useState([])
  const [videos, setVideos] = useState([])
  const [templates, setTemplates] = useState([])
  const [logs, setLogs] = useState([])
  const [editing, setEditing] = useState(null)
  const [toast, setToast] = useState('')

  // độ rộng + ẩn/hiện sidebar (lưu cục bộ trong trình duyệt cho tiện, không lên DB)
  const [sidebarW, setSidebarW] = useState(() => Number(localStorage.getItem('kolmgr_sidebar_w')) || 220)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('kolmgr_sidebar_collapsed') === '1')
  useEffect(() => { localStorage.setItem('kolmgr_sidebar_w', String(sidebarW)) }, [sidebarW])
  useEffect(() => { localStorage.setItem('kolmgr_sidebar_collapsed', sidebarCollapsed ? '1' : '0') }, [sidebarCollapsed])

  // kéo mép sidebar để đổi rộng
  function startSidebarDrag(e) {
    e.preventDefault()
    const onMove = (ev) => {
      const x = (ev.touches ? ev.touches[0].clientX : ev.clientX)
      setSidebarW(Math.min(360, Math.max(170, x)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp)
      document.body.style.userSelect = ''
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove); window.addEventListener('touchend', onUp)
  }

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
      {sidebarCollapsed ? (
        <button className="sidebar-reopen" title="Hiện menu" onClick={() => setSidebarCollapsed(false)}>☰</button>
      ) : (
        <aside className="sidebar" style={{ width: sidebarW }}>
          <div className="brand">
            <span className="mark">K</span>
            <span className="brand-text">KOL Manager</span>
            <button className="sidebar-hide" title="Ẩn menu" onClick={() => setSidebarCollapsed(true)}>«</button>
          </div>
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
              onImport={async (data) => { await importAll(data); setKols(loadKols()); setWorks(loadWorks()); setVideos(loadVideos()); setTemplates(loadTemplates()); setLogs(loadLogs()); flash('Đã nhập dữ liệu') }}
            />
            {onSignOut && <button className="btn ghost block" style={{ fontSize: 12.5 }} onClick={onSignOut}>↩ Đăng xuất</button>}
          </div>
          <div className="sidebar-resizer" onMouseDown={startSidebarDrag} onTouchStart={startSidebarDrag} title="Kéo để đổi rộng" />
        </aside>
      )}

      <main className="content">
        {tab === 'dashboard' && <Dashboard kols={kols} works={works} onOpenKol={setEditing} goTo={setTab} />}
        {tab === 'list' && <KolList kols={kols} works={works} onOpen={setEditing}
          onUpdateKol={(id, patch) => { const next = kols.map((k) => (k.id === id ? { ...k, ...patch } : k)); persistKols(next, 'Sửa KOL (nhanh)', (next.find((k) => k.id === id) || {}).name || '') }} />}
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

// textarea tự giãn cao theo nội dung
function AutoTextarea({ value, onChange, ...rest }) {
  const ref = useRef(null)
  const resize = () => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }
  useEffect(() => { resize() }, [value])
  return <textarea ref={ref} value={value} onChange={(e) => { onChange(e); resize() }} {...rest} />
}

// ============================ KOL name autocomplete ============================
function KolAutocomplete({ value, kols, onPick, onType, placeholder }) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const [pos, setPos] = useState(null) // {left, top, width} cho dropdown fixed
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  const matches = useMemo(() => {
    const q = (value || '').toLowerCase().trim()
    if (!q) return kols.slice(0, 8)
    return kols.filter((k) => (k.name || '').toLowerCase().includes(q)).slice(0, 8)
  }, [value, kols])

  // tính vị trí dropdown ngay dưới input (dùng fixed để không bị overflow của bảng cắt)
  function place() {
    const el = inputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ left: r.left, top: r.bottom + 2, width: Math.max(r.width, 200) })
  }
  function show() { place(); setOpen(true) }

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    const reposition = () => place()
    document.addEventListener('mousedown', onDoc)
    // đóng/định vị lại khi cuộn bảng hoặc trang, khi resize
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  return (
    <div className="ac" ref={wrapRef}>
      <input ref={inputRef} type="text" value={value} placeholder={placeholder || 'Gõ tên KOL…'}
        onChange={(e) => { onType(e.target.value); show(); setHi(0) }}
        onFocus={show}
        onKeyDown={(e) => {
          if (!open) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, matches.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
          else if (e.key === 'Enter' && matches[hi]) { e.preventDefault(); onPick(matches[hi]); setOpen(false) }
          else if (e.key === 'Escape') setOpen(false)
        }} />
      {open && matches.length > 0 && pos && (
        <div className="ac-list" style={{ position: 'fixed', left: pos.left, top: pos.top, width: pos.width, margin: 0 }}>
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
    works.filter((w) => (w.status === 'da_gui_hang' || w.status === 'cho_video') && !w.videoLink)
      .map((w) => ({ w, days: daysSince(w.shipDate) }))
      .sort((a, b) => (b.days || 0) - (a.days || 0)), [works])
  const overdue = waiting.filter((x) => x.days !== null && x.days >= 7)

  return (
    <div>
      <div className="page-head"><h1>Tổng quan</h1></div>
      {waiting.length > 0 && (
        <div className="alert warn">
          🔔 Có <b style={{ margin: '0 4px' }}>{waiting.length}</b> đơn “Đã gửi hàng” đang chờ trả video{overdue.length > 0 && <> — trong đó <b style={{ margin: '0 4px' }}>{overdue.length}</b> đơn đã quá 7 ngày</>}.
        </div>
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
        <h3 style={{ marginTop: 0, fontSize: 14 }}>Đơn đang chờ trả video <span className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}>— các đơn “Đã gửi hàng” nhưng chưa có link video</span></h3>
        {waiting.length === 0 ? <div className="muted" style={{ padding: '12px 0' }}>Không có đơn nào đang chờ. 🎉</div> : (
          <div className="table-wrap" style={{ border: 'none' }}>
            <table>
              <thead><tr><th>KOL</th><th>Sản phẩm</th><th>Mã đơn</th><th>Ngày gửi</th><th className="right">Đã chờ</th></tr></thead>
              <tbody>
                {waiting.slice(0, 20).map(({ w, days }) => (
                  <tr key={w.id}>
                    <td className="cell-name">{w.kolName || '—'}</td>
                    <td>{w.product || '—'}</td>
                    <td className="mono">{w.orderCode || '—'}</td>
                    <td>{fmtDateShort(w.shipDate)}</td>
                    <td className="right mono" style={{ color: days !== null && days >= 7 ? 'var(--danger)' : 'var(--warn)', fontWeight: 600 }}>{days === null ? 'chưa có ngày' : days + ' ngày'}</td>
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
function KolList({ kols, works, onOpen, onUpdateKol }) {
  const [q, setQ] = useState('')
  const [fTier, setFTier] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [sortKey, setSortKey] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')

  // video + số lần hợp tác cho mỗi KOL, lấy từ works
  const videosByKol = useMemo(() => {
    const m = {}
    works.forEach((w) => { if (w.videoLink && w.kolId) (m[w.kolId] || (m[w.kolId] = [])).push(w.videoLink) })
    return m
  }, [works])
  const collabCount = useMemo(() => {
    const m = {}
    works.forEach((w) => { if (w.kolId) m[w.kolId] = (m[w.kolId] || 0) + 1 })
    return m
  }, [works])

  const filtered = useMemo(() => {
    let arr = kols.filter((k) => {
      if (fTier && autoTier(k.followers) !== fTier) return false
      if (fStatus && (k.kolStatus || '') !== fStatus) return false
      if (q) { const hay = `${k.name} ${k.phone} ${k.email} ${k.topic} ${k.tiktok} ${k.product || ''}`.toLowerCase(); if (!hay.includes(q.toLowerCase())) return false }
      return true
    })
    arr = [...arr].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey]
      if (sortKey === 'followers') { av = Number(av) || 0; bv = Number(bv) || 0 }
      if (sortKey === 'collab') { av = collabCount[a.id] || 0; bv = collabCount[b.id] || 0 }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [kols, q, fTier, fStatus, sortKey, sortDir, collabCount])

  const toggleSort = (k) => { if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSortKey(k); setSortDir('asc') } }
  const arrow = (k) => (sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '')

  return (
    <div>
      <div className="page-head"><h1>Danh sách KOL</h1><span className="mono muted">{filtered.length}/{kols.length}</span></div>
      <div className="toolbar">
        <input className="search" type="text" placeholder="Tìm tên, SĐT, email, chủ đề, sản phẩm…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select style={{ width: 'auto' }} value={fTier} onChange={(e) => setFTier(e.target.value)}>
          <option value="">Mọi hạng</option>
          {TIERS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <select style={{ width: 'auto' }} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">Mọi trạng thái</option>
          {KOL_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
      {filtered.length === 0 ? <div className="empty"><div className="big">∅</div>Chưa có KOL nào khớp.</div> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggleSort('name')}>KOL{arrow('name')}</th>
                <th className="sortable" onClick={() => toggleSort('topic')}>Chủ đề{arrow('topic')}</th>
                <th style={{ minWidth: 130 }}>Trạng thái</th>
                <th className="sortable right" onClick={() => toggleSort('followers')}>Follow{arrow('followers')}</th>
                <th>Hạng</th>
                <th>Sản phẩm</th>
                <th className="sortable center" onClick={() => toggleSort('collab')}>Số lần HT{arrow('collab')}</th>
                <th>Đánh giá</th>
                <th>Video đã thực hiện</th>
                <th>Ghi chú</th>
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
                    <td onClick={(e) => e.stopPropagation()}>
                      <select value={k.kolStatus || ''} onChange={(e) => onUpdateKol(k.id, { kolStatus: e.target.value })}
                        className={`pill ${(kolStatusOf(k.kolStatus) || {}).pill || 'gray'}`}
                        style={{ border: 'none', fontWeight: 600, cursor: 'pointer', appearance: 'none', paddingRight: 8, minWidth: 120 }}>
                        <option value="">— Chọn —</option>
                        {KOL_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="right mono">{fmtFollow(k.followers)}</td>
                    <td><span className="tag">{tierLabel(autoTier(k.followers))}</span></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="text" value={k.product || ''} placeholder="—"
                        onChange={(e) => onUpdateKol(k.id, { product: e.target.value })}
                        style={{ width: 130, padding: '5px 8px', fontSize: 12.5 }} />
                    </td>
                    <td className="center mono">{collabCount[k.id] || 0}</td>
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
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="text" value={k.note || ''} placeholder="—"
                        onChange={(e) => onUpdateKol(k.id, { note: e.target.value })}
                        style={{ width: 150, padding: '5px 8px', fontSize: 12.5 }} />
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
// Định nghĩa các cột Pipeline (key + nhãn + rộng mặc định)
const PIPE_COLS = [
  ['kol', 'Tên KOL', 180],
  ['follow', 'Follow', 80],
  ['info', 'Thông tin', 80],
  ['product', 'Sản phẩm', 140],
  ['sampleQty', 'SL mẫu', 80],
  ['status', 'Trạng thái', 140],
  ['review', 'Review', 130],
  ['reup', 'Reup', 90],
  ['fee', 'Phí', 100],
  ['shipChannel', 'Kênh gửi', 110],
  ['orderCode', 'Mã đơn', 120],
  ['sparkAds', 'Mã spark ads', 130],
  ['shipDate', 'Ngày gửi', 150],
  ['note', 'Ghi chú', 170],
  ['videoLink', 'Link video', 180],
  ['del', '', 50],
]

function Pipeline({ kols, works, templates, onChange, onOpenKol, flash }) {
  const [filter, setFilter] = useState('')
  // độ rộng cột (lưu cục bộ trong trình duyệt)
  const [colW, setColW] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('kolmgr_pipe_cols')); if (s) return s } catch {}
    const init = {}; PIPE_COLS.forEach(([k, , w]) => (init[k] = w)); return init
  })
  useEffect(() => { localStorage.setItem('kolmgr_pipe_cols', JSON.stringify(colW)) }, [colW])

  function startColDrag(key, e) {
    e.preventDefault(); e.stopPropagation()
    const startX = e.clientX
    const startW = colW[key] || 100
    const onMove = (ev) => { setColW((c) => ({ ...c, [key]: Math.max(50, startW + (ev.clientX - startX)) })) }
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); document.body.style.userSelect = '' }
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

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

  // Ẩn dòng đã xong: Trạng thái "Hoàn thành" + Review là "Mẫu miễn phí"/"Đã review" + đã điền Link video
  const isDone = (w) =>
    w.status === 'hoan_thanh' &&
    (w.review === 'mau_mien_phi' || w.review === 'da_review') &&
    !!(w.videoLink && w.videoLink.trim())

  const rows = useMemo(() =>
    works.filter((w) => !isDone(w) && (!filter || w.kolName.toLowerCase().includes(filter.toLowerCase()))), [works, filter])

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
            <colgroup>
              {PIPE_COLS.map(([k]) => <col key={k} style={{ width: colW[k] }} />)}
            </colgroup>
            <thead>
              <tr>
                {PIPE_COLS.map(([k, label]) => (
                  <th key={k} style={{ position: 'relative' }}>
                    {label}
                    {k !== 'del' && <span className="col-resizer" onMouseDown={(e) => startColDrag(k, e)} title="Kéo để đổi rộng cột" />}
                  </th>
                ))}
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
                  <td><input type="text" value={w.product || ''} onChange={(e) => update(w.id, 'product', e.target.value)} placeholder="Sản phẩm…" style={{ width: '100%' }} /></td>
                  <td><input type="text" value={w.sampleQty || ''} onChange={(e) => update(w.id, 'sampleQty', e.target.value)} placeholder="SL" style={{ width: '100%' }} /></td>
                  <td>
                    <select value={w.status} onChange={(e) => update(w.id, 'status', e.target.value)}
                      className={`pill ${statusOf(w.status).pill}`} style={{ border: 'none', fontWeight: 600, cursor: 'pointer', appearance: 'none', paddingRight: 8 }}>
                      {WORK_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={w.review || ''} onChange={(e) => update(w.id, 'review', e.target.value)}
                      className={`pill ${reviewPill(w.review)}`} style={{ border: 'none', fontWeight: 600, cursor: 'pointer', appearance: 'none', paddingRight: 8, minWidth: 110 }}>
                      <option value="">— Review —</option>
                      <option value="da_review">Đã review</option>
                      <option value="chua_review">Chưa review</option>
                      <option value="mau_mien_phi">Mẫu miễn phí</option>
                    </select>
                  </td>
                  <td>
                    <select value={w.canReup} onChange={(e) => update(w.id, 'canReup', e.target.value)} style={{ width: '100%' }}>
                      <option value="">—</option><option value="co">Có</option><option value="khong">Không</option>
                    </select>
                  </td>
                  <td><input type="number" value={w.fee} onChange={(e) => update(w.id, 'fee', Number(e.target.value))} style={{ width: '100%' }} /></td>
                  <td><input type="text" value={w.shipChannel} onChange={(e) => update(w.id, 'shipChannel', e.target.value)} placeholder="GHTK…" style={{ width: '100%' }} /></td>
                  <td><input type="text" value={w.orderCode} onChange={(e) => update(w.id, 'orderCode', e.target.value)} style={{ width: '100%' }} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input type="text" value={w.sparkAds || ''} onChange={(e) => update(w.id, 'sparkAds', e.target.value)} placeholder="mã…" style={{ flex: 1, minWidth: 40 }} title={w.sparkAds || ''} />
                      <button className="btn sm" disabled={!w.sparkAds} title="Copy mã spark ads"
                        onClick={() => { navigator.clipboard.writeText(w.sparkAds || '').then(() => flash('Đã copy mã spark ads')) }}>📋</button>
                    </div>
                  </td>
                  <td><input type="date" value={w.shipDate} onChange={(e) => update(w.id, 'shipDate', e.target.value)} style={{ width: '100%' }} /></td>
                  <td className="note-cell"><AutoTextarea value={w.note} onChange={(e) => update(w.id, 'note', e.target.value)} rows={1} className="cell-note" /></td>
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

  // Link video tự lấy từ Pipeline: tìm các work có videoLink của đúng KOL
  function pipelineLinksFor(v) {
    return works
      .filter((w) => w.videoLink && (v.kolId ? w.kolId === v.kolId : w.kolName === v.kolName))
      .map((w) => w.videoLink)
  }

  return (
    <div>
      <div className="page-head">
        <h1>Thư viện video</h1>
        <span className="muted" style={{ fontSize: 13 }}>Link video tự lấy từ Pipeline theo KOL · điền thêm link tải</span>
        <div className="spacer" />
        <button className="btn" onClick={commit}>Lưu</button>
        <button className="btn primary" onClick={addRow}>+ Dòng mới</button>
      </div>

      {videos.length === 0 ? <div className="empty"><div className="big">▶</div>Chưa có video nào. Bấm “+ Dòng mới”.</div> : (
        <div className="table-wrap">
          <table className="pipe-table" style={{ minWidth: 800 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 110 }}>Ngày</th>
                <th style={{ minWidth: 200 }}>KOL</th>
                <th style={{ minWidth: 230 }}>Link video (từ Pipeline)</th>
                <th style={{ minWidth: 230 }}>Link tải video</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => {
                const links = pipelineLinksFor(v)
                return (
                  <tr key={v.id}>
                    <td className="mono nowrap muted">{fmtDateShort(v.createdAt)}</td>
                    <td><KolAutocomplete value={v.kolName} kols={kols} onType={(val) => update(v.id, 'kolName', val)} onPick={(k) => pickKol(v.id, k)} /></td>
                    <td>
                      {links.length === 0 ? <span className="muted">— chưa có trong Pipeline —</span> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {links.map((l, i) => <a key={i} className="linkout" href={l} target="_blank" rel="noreferrer">▶ {l.slice(0, 38)}{l.length > 38 ? '…' : ''}</a>)}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input type="url" value={v.downloadLink} onChange={(e) => update(v.id, 'downloadLink', e.target.value)} placeholder="https://… link tải" />
                        {v.downloadLink && <a className="linkout" href={v.downloadLink} target="_blank" rel="noreferrer">⬇</a>}
                      </div>
                    </td>
                    <td><button className="btn danger sm" onClick={() => delRow(v)}>✕</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
        Cột “Link video” tự hiện link bạn đã nhập ở Pipeline cho KOL tương ứng. Cột “Link tải video” bạn tự dán link tải về.
      </p>
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
            <div className="form-row"><label>Sản phẩm</label><input type="text" value={f.product || ''} onChange={set('product')} placeholder="Sản phẩm hợp tác" /></div>
            <div className="form-row"><label>Trạng thái</label>
              <select value={f.kolStatus || ''} onChange={set('kolStatus')}>
                <option value="">— Chọn —</option>
                {KOL_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span className={`pill ${statusOf(w.status).pill}`}>{statusOf(w.status).label}</span>
                  {w.review && <span className={`pill ${reviewPill(w.review)}`}>{reviewLabel(w.review)}</span>}
                  {w.shipDate && <span className="cell-sub">Gửi {fmtDateShort(w.shipDate)}</span>}
                  {w.fee > 0 && <span className="mono cell-sub">{fmtMoney(w.fee)}</span>}
                </div>
                <div className="cell-sub">
                  {w.orderCode && <>Mã đơn: {w.orderCode} · </>}
                  {w.sparkAds && <>Spark ads: {w.sparkAds} · </>}
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

// ============================ Root: cấu hình + đăng nhập + loading ============================
export default function Root() {
  const [phase, setPhase] = useState('checking') // checking | config | login | loading | ready
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!hasSupabaseConfig) { setPhase('config'); return }
    getSession().then((session) => {
      if (session) bootData()
      else setPhase('login')
    }).catch(() => setPhase('login'))
  }, [])

  async function bootData() {
    setPhase('loading')
    try {
      await loadAll()
      seedIfEmpty()
      setPhase('ready')
    } catch (e) {
      setErr('Không tải được dữ liệu: ' + (e.message || e))
      setPhase('login')
    }
  }

  async function doLogin() {
    if (!pw) return
    setBusy(true); setErr('')
    try {
      await signInWithPassword(FIXED_EMAIL, pw)
      await bootData()
    } catch (e) {
      setErr('Sai mật khẩu hoặc chưa tạo tài khoản. Xem lại hướng dẫn cài đặt.')
    } finally { setBusy(false) }
  }

  async function doLogout() {
    await signOut()
    setPw(''); setPhase('login')
  }

  if (phase === 'checking' || phase === 'loading') {
    return <div className="login-wrap"><div className="login-box"><div className="login-logo"><span className="mark">K</span></div><p className="muted" style={{ textAlign: 'center' }}>{phase === 'loading' ? 'Đang tải dữ liệu…' : 'Đang kiểm tra…'}</p></div></div>
  }

  if (phase === 'config') {
    return (
      <div className="login-wrap">
        <div className="login-box">
          <div className="login-logo"><span className="mark">K</span></div>
          <h2 style={{ textAlign: 'center', margin: '4px 0 6px' }}>Chưa kết nối Supabase</h2>
          <p className="muted" style={{ fontSize: 13 }}>
            App chưa có khoá kết nối tới Supabase. Hãy mở file <code className="mono">HUONG_DAN_SUPABASE.md</code> và làm theo: tạo bảng dữ liệu, tạo tài khoản, rồi dán hai biến <code className="mono">VITE_SUPABASE_URL</code> và <code className="mono">VITE_SUPABASE_ANON_KEY</code> vào Vercel (hoặc file <code className="mono">.env</code>).
          </p>
        </div>
      </div>
    )
  }

  // phase === 'login'
  if (phase === 'login') {
    return (
      <div className="login-wrap">
        <div className="login-box">
          <div className="login-logo"><span className="mark">K</span></div>
          <h2>KOL Manager</h2>
          <p className="muted">Nhập mật khẩu để truy cập</p>
          <input type="password" autoFocus value={pw} placeholder="Mật khẩu"
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doLogin() }} />
          {err && <div className="login-err">{err}</div>}
          <button className="btn primary block" disabled={busy} onClick={doLogin}>
            {busy ? 'Đang vào…' : 'Đăng nhập'}
          </button>
        </div>
      </div>
    )
  }

  return <AppInner onSignOut={doLogout} />
}

// ====================================================================
// storage.js — lưu trữ trong localStorage trình duyệt.
// Collections: kols, works (lần làm việc / dòng Pipeline), videos
//              (thư viện video), templates, logs.
// ====================================================================

const KEYS = {
  kols: 'kolmgr_kols',
  works: 'kolmgr_works',
  videos: 'kolmgr_videos',
  templates: 'kolmgr_templates',
  logs: 'kolmgr_logs',
}

function read(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback }
  catch { return fallback }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) }
  catch (e) { console.error('Không lưu được dữ liệu:', e) }
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export const loadKols = () => read(KEYS.kols, [])
export const saveKols = (v) => write(KEYS.kols, v)

export const loadWorks = () => read(KEYS.works, [])
export const saveWorks = (v) => write(KEYS.works, v)

export const loadVideos = () => read(KEYS.videos, [])
export const saveVideos = (v) => write(KEYS.videos, v)

export const loadTemplates = () => read(KEYS.templates, [])
export const saveTemplates = (v) => write(KEYS.templates, v)

export const loadLogs = () => read(KEYS.logs, [])
export function addLog(action, detail) {
  const logs = read(KEYS.logs, [])
  logs.unshift({ id: uid(), time: new Date().toISOString(), action, detail })
  write(KEYS.logs, logs.slice(0, 1000))
  return logs
}
export function clearLogs() { write(KEYS.logs, []) }

export function exportAll() {
  return {
    exportedAt: new Date().toISOString(),
    kols: loadKols(), works: loadWorks(), videos: loadVideos(),
    templates: loadTemplates(), logs: loadLogs(),
  }
}
export function importAll(data) {
  if (data.kols) saveKols(data.kols)
  if (data.works) saveWorks(data.works)
  if (data.videos) saveVideos(data.videos)
  if (data.templates) saveTemplates(data.templates)
  if (data.logs) write(KEYS.logs, data.logs)
}

export function seedIfEmpty() {
  if (loadTemplates().length === 0 && loadKols().length === 0) {
    saveTemplates([
      { id: uid(), name: 'Lời chào hợp tác lần đầu', body: 'Chào {ten}, mình là [Tên brand]. Bên mình rất thích nội dung kênh của bạn về {chude}. Mình muốn mời bạn trải nghiệm và review sản phẩm [Tên sản phẩm]. Bạn quan tâm không ạ? Cảm ơn bạn nhiều!' },
      { id: uid(), name: 'Nhắc trả video', body: 'Chào {ten}, sản phẩm bên mình gửi chắc bạn đã nhận rồi đúng không ạ? Bạn dự kiến khi nào lên video giúp mình nhé? Cảm ơn bạn nhiều!' },
      { id: uid(), name: 'Cảm ơn sau hợp tác', body: 'Cảm ơn {ten} đã hợp tác cùng bên mình! Video rất tuyệt. Mong được tiếp tục đồng hành trong các sản phẩm tới nhé.' },
    ])
  }
}

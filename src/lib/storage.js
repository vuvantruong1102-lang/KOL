// ====================================================================
// storage.js — Lớp lưu trữ dữ liệu trong localStorage trình duyệt.
// Toàn bộ dữ liệu (KOL, mẫu liên hệ, log) được lưu cục bộ trên máy.
// ====================================================================

const KEYS = {
  kols: 'kolmgr_kols',
  templates: 'kolmgr_templates',
  logs: 'kolmgr_logs',
  campaigns: 'kolmgr_campaigns',
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error('Không lưu được dữ liệu:', e)
  }
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ---------- KOL ----------
export const loadKols = () => read(KEYS.kols, [])
export const saveKols = (kols) => write(KEYS.kols, kols)

// ---------- Mẫu liên hệ ----------
export const loadTemplates = () => read(KEYS.templates, [])
export const saveTemplates = (t) => write(KEYS.templates, t)

// ---------- Chiến dịch ----------
export const loadCampaigns = () => read(KEYS.campaigns, [])
export const saveCampaigns = (c) => write(KEYS.campaigns, c)

// ---------- Log chỉnh sửa ----------
export const loadLogs = () => read(KEYS.logs, [])

export function addLog(action, detail) {
  const logs = read(KEYS.logs, [])
  logs.unshift({
    id: uid(),
    time: new Date().toISOString(),
    action,
    detail,
  })
  // giữ tối đa 1000 dòng log
  write(KEYS.logs, logs.slice(0, 1000))
  return logs
}

export function clearLogs() {
  write(KEYS.logs, [])
}

// ---------- Xuất / nhập toàn bộ dữ liệu ----------
export function exportAll() {
  return {
    exportedAt: new Date().toISOString(),
    kols: loadKols(),
    templates: loadTemplates(),
    campaigns: loadCampaigns(),
    logs: loadLogs(),
  }
}

export function importAll(data) {
  if (data.kols) saveKols(data.kols)
  if (data.templates) saveTemplates(data.templates)
  if (data.campaigns) saveCampaigns(data.campaigns)
  if (data.logs) write(KEYS.logs, data.logs)
}

// ---------- Dữ liệu mẫu lần đầu chạy ----------
export function seedIfEmpty() {
  if (loadKols().length === 0 && loadTemplates().length === 0) {
    saveTemplates([
      {
        id: uid(),
        name: 'Lời chào hợp tác lần đầu',
        body: 'Chào {ten}, mình là [Tên brand]. Bên mình rất thích nội dung kênh của bạn về {chude}. Mình muốn mời bạn trải nghiệm và review sản phẩm [Tên sản phẩm]. Bạn quan tâm không ạ? Cảm ơn bạn nhiều!',
      },
      {
        id: uid(),
        name: 'Nhắc trả video',
        body: 'Chào {ten}, sản phẩm bên mình gửi chắc bạn đã nhận rồi đúng không ạ? Bạn dự kiến khi nào lên video giúp mình nhé? Cảm ơn bạn nhiều!',
      },
      {
        id: uid(),
        name: 'Cảm ơn sau hợp tác',
        body: 'Cảm ơn {ten} đã hợp tác cùng bên mình! Video rất tuyệt. Mong được tiếp tục đồng hành trong các sản phẩm tới nhé.',
      },
    ])
  }
}

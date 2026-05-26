// Các giai đoạn trong phễu làm việc với KOL (pipeline / kanban)
export const STAGES = [
  { key: 'tiem_nang',   label: 'Tiềm năng',     color: '#9aa0a6' },
  { key: 'da_lien_he',  label: 'Đã liên hệ',    color: '#4f8cff' },
  { key: 'dam_phan',    label: 'Đang đàm phán', color: '#a78bfa' },
  { key: 'da_chot',     label: 'Đã chốt',       color: '#22b8cf' },
  { key: 'da_gui_hang', label: 'Đã gửi hàng',   color: '#fab005' },
  { key: 'cho_video',   label: 'Chờ video',     color: '#ff922b' },
  { key: 'hoan_thanh',  label: 'Hoàn thành',    color: '#37b24d' },
  { key: 'tu_choi',     label: 'Từ chối',       color: '#fa5252' },
]

export const stageOf = (key) => STAGES.find((s) => s.key === key) || STAGES[0]

// Phân hạng KOL theo lượng follow
export const TIERS = [
  { key: 'koc',   label: 'KOC (< 10k)' },
  { key: 'nano',  label: 'Nano (10k–50k)' },
  { key: 'micro', label: 'Micro (50k–200k)' },
  { key: 'macro', label: 'Macro (200k–1M)' },
  { key: 'mega',  label: 'Mega (> 1M)' },
]

export function autoTier(followers) {
  const f = Number(followers) || 0
  if (f >= 1_000_000) return 'mega'
  if (f >= 200_000) return 'macro'
  if (f >= 50_000) return 'micro'
  if (f >= 10_000) return 'nano'
  return 'koc'
}

export const tierLabel = (key) =>
  (TIERS.find((t) => t.key === key) || {}).label || '—'

// Tag đánh giá nhanh
export const RATING_TAGS = [
  'Uy tín',
  'Đăng đúng hạn',
  'Tương tác tốt',
  'Hay quên',
  'Trễ deadline',
  'Giá tốt',
]

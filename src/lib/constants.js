// Trạng thái của mỗi LẦN làm việc với KOL (dùng cho Pipeline + Danh sách)
// pill class quyết định màu badge.
export const WORK_STATUS = [
  { key: 'da_lien_he',  label: 'Đã liên hệ',  pill: 'blue'   },
  { key: 'da_gui_hang', label: 'Đã gửi hàng', pill: 'yellow' },
  { key: 'hoan_thanh',  label: 'Hoàn thành',  pill: 'green'  },
  { key: 'tu_choi',     label: 'Từ chối',     pill: 'red'    },
]
export const statusOf = (key) => {
  // dữ liệu cũ có thể còn 'cho_video' — quy về 'Đã gửi hàng'
  if (key === 'cho_video') return WORK_STATUS.find((s) => s.key === 'da_gui_hang')
  return WORK_STATUS.find((s) => s.key === key) || WORK_STATUS[0]
}

// Phân hạng KOL theo follow
export const TIERS = [
  { key: 'koc',   label: 'KOC' },
  { key: 'nano',  label: 'Nano' },
  { key: 'micro', label: 'Micro' },
  { key: 'macro', label: 'Macro' },
  { key: 'mega',  label: 'Mega' },
]
export function autoTier(followers) {
  const f = Number(followers) || 0
  if (f >= 1_000_000) return 'mega'
  if (f >= 200_000) return 'macro'
  if (f >= 50_000) return 'micro'
  if (f >= 10_000) return 'nano'
  return 'koc'
}
export const tierLabel = (key) => (TIERS.find((t) => t.key === key) || {}).label || '—'

export const RATING_TAGS = ['Uy tín', 'Đăng đúng hạn', 'Tương tác tốt', 'Hay quên', 'Trễ deadline', 'Giá tốt']

// Trạng thái tổng của một KOL (ở Danh sách KOL) — khác với trạng thái từng lần làm việc
export const KOL_STATUS = [
  { key: 'chua_lien_he', label: 'Chưa liên hệ', pill: 'gray'   },
  { key: 'da_lien_he',   label: 'Đã liên hệ',   pill: 'blue'   },
  { key: 'dang_hop_tac', label: 'Đang hợp tác', pill: 'yellow' },
  { key: 'da_hop_tac',   label: 'Đã hợp tác',   pill: 'green'  },
  { key: 'tu_choi',      label: 'Từ chối',      pill: 'red'    },
]
export const kolStatusOf = (key) => KOL_STATUS.find((s) => s.key === key)

// ====================================================================
// scoring.js — Chấm điểm KOL dựa trên lịch sử cộng tác.
//
// Nguồn dữ liệu:
//   - works:  các lần làm việc (Pipeline) — để biết uy tín (hoàn thành, có review)
//   - videos: số liệu nhập tay theo từng video (khớp works qua workId)
//             { workId, views, engagement, orders }
//
// Ưu tiên (trọng số) theo yêu cầu:
//   1. Số đơn hàng mang về   (orders)      — 40%
//   2. Lượt xem video        (views)       — 30%
//   3. Tương tác like/comment(engagement)  — 18%
//   4. Mức độ uy tín         (reliability) — 12%
//
// Điểm trả về thang 0–100, kèm quy đổi sao 1–5.
// ====================================================================

export const SCORE_WEIGHTS = {
  orders: 0.40,
  views: 0.30,
  engagement: 0.18,
  reliability: 0.12,
}

// Mốc "đạt 100 điểm thành phần" — số trung bình mỗi video coi là rất tốt.
// Đặt mức hợp lý cho TikTok Shop VN; có thể chỉnh nếu thị trường khác.
const TARGET_PER_VIDEO = {
  orders: 50,        // ~50 đơn/video = xuất sắc
  views: 100_000,    // ~100k view/video = xuất sắc
  engagement: 5_000, // ~5k like+comment/video = xuất sắc
}

// chuẩn hoá 1 giá trị trung bình về 0..100 theo mốc target, dùng sqrt để
// không "ăn" hết điểm ở mức quá cao và vẫn thưởng cho mức trung bình.
function normalize(avg, target) {
  if (!avg || avg <= 0) return 0
  const ratio = avg / target
  const scaled = Math.sqrt(Math.min(ratio, 1)) * 100
  return Math.max(0, Math.min(100, scaled))
}

// Điểm uy tín 0..100 từ các lần làm việc của KOL:
//   - tỷ lệ hoàn thành (status = hoan_thanh)
//   - tỷ lệ có review thực sự (da_review / mau_mien_phi)
//   - có nộp link video
function reliabilityScore(works) {
  if (!works.length) return 0
  const n = works.length
  const done = works.filter((w) => w.status === 'hoan_thanh').length
  const reviewed = works.filter((w) => w.review === 'da_review' || w.review === 'mau_mien_phi').length
  const hasVideo = works.filter((w) => w.videoLink && w.videoLink.trim()).length
  const rejected = works.filter((w) => w.status === 'tu_choi').length
  const pos = (done / n) * 55 + (reviewed / n) * 25 + (hasVideo / n) * 20
  const penalty = (rejected / n) * 25 // từ chối nhiều thì trừ
  return Math.max(0, Math.min(100, pos - penalty))
}

// Tính điểm cho 1 KOL.
// works: mảng work của riêng KOL đó. statsByWork: map workId -> {views, engagement, orders}
export function scoreKol(works, statsByWork) {
  const vids = works
    .map((w) => statsByWork[w.id])
    .filter(Boolean)

  const sum = (key) => vids.reduce((s, v) => s + (Number(v[key]) || 0), 0)
  const totalOrders = sum('orders')
  const totalViews = sum('views')
  const totalEng = sum('engagement')

  // dùng trung bình mỗi video để KOL ít video không bị thiệt so với KOL nhiều video
  const nVid = vids.length || 1
  const avgOrders = totalOrders / nVid
  const avgViews = totalViews / nVid
  const avgEng = totalEng / nVid

  const cOrders = normalize(avgOrders, TARGET_PER_VIDEO.orders)
  const cViews = normalize(avgViews, TARGET_PER_VIDEO.views)
  const cEng = normalize(avgEng, TARGET_PER_VIDEO.engagement)
  const cRel = reliabilityScore(works)

  const score =
    cOrders * SCORE_WEIGHTS.orders +
    cViews * SCORE_WEIGHTS.views +
    cEng * SCORE_WEIGHTS.engagement +
    cRel * SCORE_WEIGHTS.reliability

  const hasData = vids.length > 0 || works.length > 0
  const rounded = Math.round(score)

  return {
    score: rounded,                 // 0..100
    stars: scoreToStars(rounded),   // 1..5
    hasData,
    breakdown: {
      orders: Math.round(cOrders),
      views: Math.round(cViews),
      engagement: Math.round(cEng),
      reliability: Math.round(cRel),
    },
    totals: { orders: totalOrders, views: totalViews, engagement: totalEng, videos: vids.length },
  }
}

// Quy đổi 0..100 -> sao 1..5 (mỗi sao 20 điểm, tối thiểu 1 sao nếu có dữ liệu)
export function scoreToStars(score) {
  if (score <= 0) return 0
  return Math.max(1, Math.min(5, Math.round(score / 20)))
}

// Nhãn xếp loại nhanh
export function scoreLabel(score) {
  if (score >= 80) return 'Xuất sắc'
  if (score >= 60) return 'Tốt'
  if (score >= 40) return 'Khá'
  if (score >= 20) return 'Trung bình'
  if (score > 0) return 'Yếu'
  return 'Chưa đủ dữ liệu'
}

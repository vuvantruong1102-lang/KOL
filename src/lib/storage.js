// ====================================================================
// storage.js — lưu trữ dữ liệu trên Supabase (bảng kol_app_data dạng
// key-value JSON). Có cache trong bộ nhớ để giao diện phản hồi nhanh,
// và ghi xuống Supabase ở chế độ nền (debounce).
//
// Mỗi loại dữ liệu là 1 dòng trong bảng kol_app_data:
//   k = 'kols' | 'works' | 'videos' | 'templates' | 'logs'
//   v = mảng JSON tương ứng
// ====================================================================
import { supabase } from './supabaseClient'

// Tên bảng trên Supabase (đặt riêng để dùng chung project với app khác mà không đụng nhau)
const TABLE = 'kol_app_data'

const COLLECTIONS = ['kols', 'works', 'videos', 'templates', 'logs']

// cache trong RAM, là nguồn dữ liệu cho UI đọc đồng bộ
const cache = { kols: [], works: [], videos: [], templates: [], logs: [] }
let loaded = false

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ---- tải toàn bộ dữ liệu 1 lần khi mở app ----
export async function loadAll() {
  if (!supabase) throw new Error('Chưa cấu hình Supabase')
  const { data, error } = await supabase.from(TABLE).select('k, v')
  if (error) throw error
  COLLECTIONS.forEach((k) => { cache[k] = [] })
  ;(data || []).forEach((row) => {
    if (COLLECTIONS.includes(row.k)) cache[row.k] = Array.isArray(row.v) ? row.v : []
  })
  loaded = true
  return { ...cache }
}

export const isLoaded = () => loaded

// ---- ghi 1 collection xuống Supabase (debounce gộp nhiều lần gõ) ----
const timers = {}
function scheduleSave(key) {
  clearTimeout(timers[key])
  timers[key] = setTimeout(() => { saveNow(key) }, 600)
}
async function saveNow(key) {
  if (!supabase) return
  const { error } = await supabase.from(TABLE).upsert({ k: key, v: cache[key] }, { onConflict: 'k' })
  if (error) console.error('Lưu Supabase lỗi:', error.message)
}
// ép lưu ngay (dùng khi đăng xuất hoặc nhập backup)
export async function flushAll() {
  for (const k of COLLECTIONS) { clearTimeout(timers[k]); await saveNow(k) }
}

// ---- getter đồng bộ (UI đọc từ cache) ----
export const loadKols = () => cache.kols
export const loadWorks = () => cache.works
export const loadVideos = () => cache.videos
export const loadTemplates = () => cache.templates
export const loadLogs = () => cache.logs

// ---- setter: cập nhật cache + lên lịch ghi nền ----
export function saveKols(v) { cache.kols = v; scheduleSave('kols') }
export function saveWorks(v) { cache.works = v; scheduleSave('works') }
export function saveVideos(v) { cache.videos = v; scheduleSave('videos') }
export function saveTemplates(v) { cache.templates = v; scheduleSave('templates') }

export function addLog(action, detail) {
  cache.logs = [{ id: uid(), time: new Date().toISOString(), action, detail }, ...cache.logs].slice(0, 1000)
  scheduleSave('logs')
  return cache.logs
}
export function clearLogs() { cache.logs = []; scheduleSave('logs') }

// ---- xuất / nhập backup ----
export function exportAll() {
  return { exportedAt: new Date().toISOString(), kols: cache.kols, works: cache.works, videos: cache.videos, templates: cache.templates, logs: cache.logs }
}
export async function importAll(data) {
  if (data.kols) cache.kols = data.kols
  if (data.works) cache.works = data.works
  if (data.videos) cache.videos = data.videos
  if (data.templates) cache.templates = data.templates
  if (data.logs) cache.logs = data.logs
  await flushAll()
}

// ---- seed mẫu liên hệ lần đầu (khi DB trống) ----
export function seedIfEmpty() {
  if (cache.templates.length === 0 && cache.kols.length === 0) {
    cache.templates = [
      { id: uid(), name: 'Lời chào hợp tác lần đầu', body: 'Chào {ten}, mình là [Tên brand]. Bên mình rất thích nội dung kênh của bạn về {chude}. Mình muốn mời bạn trải nghiệm và review sản phẩm [Tên sản phẩm]. Bạn quan tâm không ạ? Cảm ơn bạn nhiều!' },
      { id: uid(), name: 'Nhắc trả video', body: 'Chào {ten}, sản phẩm bên mình gửi chắc bạn đã nhận rồi đúng không ạ? Bạn dự kiến khi nào lên video giúp mình nhé? Cảm ơn bạn nhiều!' },
      { id: uid(), name: 'Cảm ơn sau hợp tác', body: 'Cảm ơn {ten} đã hợp tác cùng bên mình! Video rất tuyệt. Mong được tiếp tục đồng hành trong các sản phẩm tới nhé.' },
    ]
    scheduleSave('templates')
  }
}

// ---- auth ----
export async function signInWithPassword(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}
export async function signOut() {
  await flushAll()
  await supabase.auth.signOut()
}
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

import { createClient } from '@supabase/supabase-js'

// Hai giá trị này lấy từ Supabase (xem HUONG_DAN_SUPABASE.md).
// Đặt trong file .env (chạy máy) hoặc trong Environment Variables của Vercel.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Email cố định dùng cho đăng nhập "chỉ nhập mật khẩu".
// Màn login chỉ hỏi mật khẩu; app tự ghép email này để đăng nhập Supabase.
export const FIXED_EMAIL = 'admin@kol.app'

export const hasSupabaseConfig = Boolean(url && key)

export const supabase = hasSupabaseConfig
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null

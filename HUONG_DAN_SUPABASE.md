# Hướng dẫn kết nối KOL Manager với Supabase

Làm lần lượt theo 5 bước. Tất cả đều làm trên trình duyệt. Mất khoảng 20–30 phút.

> Cần làm theo đúng thứ tự. Bước 4 (tạo tài khoản) phải làm SAU bước 1 (tạo project).

---

## Bước 1 — Tạo project Supabase

1. Vào https://supabase.com → đăng nhập tài khoản của bạn.
2. Bấm **New project**.
3. Đặt tên (vd `kol-manager`), chọn **Region** gần Việt Nam (vd *Southeast Asia / Singapore*), đặt một **Database Password** (lưu lại phòng khi cần, nhưng app KHÔNG dùng mật khẩu này).
4. Bấm **Create new project**, đợi khoảng 2 phút cho project khởi tạo xong.

---

## Bước 2 — Tạo bảng dữ liệu (chạy SQL)

1. Trong project vừa tạo, ở menu trái chọn **SQL Editor**.
2. Bấm **New query**.
3. Mở file `supabase_setup.sql` (đi kèm trong thư mục này), copy **toàn bộ** nội dung, dán vào ô SQL.
4. Bấm **Run** (hoặc Ctrl+Enter). Thấy báo *Success* là xong.

> Bước này tạo bảng `kol_app_data` (đặt tên riêng để dùng chung project với các app khác mà không đụng nhau) và bật bảo mật để chỉ người đăng nhập mới đọc/ghi được dữ liệu.

---

## Bước 3 — Lấy 2 khoá kết nối

1. Menu trái → **Project Settings** (biểu tượng bánh răng) → **API Keys** (hoặc **Data API**).
2. Bạn cần copy 2 giá trị:
   - **Project URL** — dạng `https://xxxxxxxx.supabase.co`
   - **API key**: lấy khoá **Publishable** (dạng `sb_publishable_...`). Nếu chưa có thì bấm tạo. (Project cũ có thể chỉ có khoá tên **anon / public** — dùng khoá đó cũng được.)
3. Giữ lại 2 giá trị này cho bước 5. Đừng đóng tab vội.

> Hai khoá này là loại "công khai" (publishable/anon), an toàn để đặt trong app chạy trên trình duyệt. KHÔNG bao giờ dùng khoá **secret / service_role** trong app này.

---

## Bước 4 — Tạo tài khoản đăng nhập (email cố định)

App đăng nhập bằng **một email cố định** là `admin@kol.app`, còn bạn chỉ cần nhớ **mật khẩu**. Tạo tài khoản đó như sau:

1. Menu trái → **Authentication** → **Users**.
2. Bấm **Add user** → **Create new user**.
3. Điền:
   - **Email**: `admin@kol.app`  ← phải gõ ĐÚNG y hệt
   - **Password**: đặt mật khẩu bạn muốn dùng để vào app (đây chính là mật khẩu màn login sẽ hỏi).
   - Tích **Auto Confirm User** (để không cần xác nhận email).
4. Bấm **Create user**.

> Muốn đổi mật khẩu sau này: vào đúng mục này, mở user `admin@kol.app`, chọn đổi mật khẩu.
> Nếu muốn đổi email cố định sang email khác, sửa dòng `FIXED_EMAIL` trong file `src/lib/supabaseClient.js` cho khớp.
> Dùng chung project: nếu `admin@kol.app` đã tồn tại sẵn (do app khác), không cần tạo lại — chỉ cần biết đúng mật khẩu của nó. Muốn tách riêng thì đặt email khác, vd `kol-admin@kol.app`, và sửa `FIXED_EMAIL` cho khớp.

---

## Bước 5 — Dán 2 khoá vào app rồi deploy

### Nếu deploy bằng Vercel (khuyến nghị)
1. Vào vercel.com → mở project KOL Manager của bạn → **Settings** → **Environment Variables**.
2. Thêm 2 biến (bấm Add cho từng cái):
   - Name: `VITE_SUPABASE_URL` — Value: dán **Project URL** ở bước 3.
   - Name: `VITE_SUPABASE_ANON_KEY` — Value: dán **Publishable/anon key** ở bước 3.
3. Vào tab **Deployments** → mở bản mới nhất → bấm **Redeploy** (để Vercel build lại với khoá vừa thêm).
4. Xong! Mở app, sẽ thấy màn nhập mật khẩu. Gõ mật khẩu đã đặt ở bước 4.

### Nếu chạy thử trên máy
1. Trong thư mục project, tạo file tên `.env` (copy từ `.env.example`).
2. Điền 2 dòng:
   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_...
   ```
3. Chạy `npm install` rồi `npm run dev`.

---

## Chuyển dữ liệu cũ (đang nằm trong trình duyệt) sang Supabase

Dữ liệu bạn đã nhập trước đây nằm trong trình duyệt (bản localStorage cũ). Để mang sang:
1. Trước khi cập nhật app: mở app bản cũ, bấm **Dữ liệu → Xuất backup (.json)**, lưu file lại.
2. Sau khi app mới (Supabase) chạy được và đã đăng nhập: bấm **Dữ liệu → Nhập backup (.json)**, chọn đúng file đó. Dữ liệu sẽ được đẩy lên Supabase.

> Nếu bản cũ của bạn trên Vercel chưa có nút Xuất/Nhập, hãy mở bản cũ đó (trước khi redeploy) để xuất trước, hoặc nhập tay lại.

---

## Vài lưu ý quan trọng

- **Bảo mật**: đây là kiểu "một mật khẩu chung". Đủ chặn người lạ tình cờ, nhưng không phải bảo mật cấp cao (xem giải thích đã trao đổi). Đặt mật khẩu dài, khó đoán.
- **Quên/đổi mật khẩu**: làm ở Authentication → Users như bước 4.
- **Dữ liệu giờ nằm trên Supabase** (đám mây), vào từ máy nào / trình duyệt nào cũng thấy, không lo mất khi xoá cache. Vẫn nên thỉnh thoảng Xuất backup cho chắc.
- **Lỗi "Sai mật khẩu hoặc chưa tạo tài khoản"** khi đăng nhập: kiểm tra lại đã tạo user `admin@kol.app` ở bước 4 và đã tích Auto Confirm chưa.
- **Màn báo "Chưa kết nối Supabase"**: nghĩa là chưa thêm/redeploy 2 biến môi trường ở bước 5.

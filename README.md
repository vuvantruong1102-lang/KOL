# KOL Manager

Webapp quản lý danh sách KOL và theo dõi việc làm việc cùng KOL. Có **đăng nhập bằng mật khẩu** và lưu dữ liệu trên **Supabase** (đám mây) — vào từ máy/trình duyệt nào cũng thấy, không lo mất khi xoá cache.

> ⚙️ **Lần đầu dùng phải làm theo `HUONG_DAN_SUPABASE.md`** để kết nối Supabase (tạo bảng, tạo tài khoản, dán khoá). Chưa làm bước này app sẽ hiện màn "Chưa kết nối Supabase".

## Tính năng

- **Thông tin KOL**: SĐT, địa chỉ, email, kênh TikTok / Instagram / YouTube / Facebook, chủ đề kênh, lượt follow (cập nhật được), tự động phân hạng (KOC → Mega).
- **Lịch sử làm việc**: từng lần hợp tác, sản phẩm, link video, phí, giá vốn, doanh thu và lợi nhuận ước tính, ghi chú.
- **Pipeline (Kanban)**: Tiềm năng → Đã liên hệ → Đàm phán → Đã chốt → Đã gửi hàng → Chờ video → Hoàn thành / Từ chối. Kéo thả để đổi trạng thái.
- **Gửi hàng**: ngày gửi, mã đơn hàng, sản phẩm, hạn trả video, đánh dấu đã nhắc.
- **Nhắc trả video**: dashboard tự cảnh báo đơn đã gửi quá 7 ngày chưa có video.
- **Mẫu liên hệ**: soạn sẵn để copy-paste, có biến `{ten}` và `{chude}` tự điền theo từng KOL.
- **Đánh giá**: chấm sao + tag (Uy tín, Đăng đúng hạn, Hay quên…).
- **Tìm kiếm & lọc**: theo tên/SĐT/email/chủ đề, theo trạng thái, theo hạng. Sắp xếp theo cột.
- **Log**: ghi lại mọi thao tác thêm/sửa/xoá dữ liệu.
- **Xuất/nhập dữ liệu**: backup `.json` và xuất danh sách `.csv`.

## Cách đưa lên GitHub (làm hoàn toàn trên trình duyệt)

1. Vào https://github.com/new tạo một repository mới (ví dụ tên `kol-manager`), để **Public**, **không** tích "Add a README".
2. Ở trang repo trống, bấm dòng chữ **"uploading an existing file"** (hoặc tab **Add file → Upload files**).
3. **Giải nén file zip** này ra trên máy, rồi **kéo toàn bộ nội dung bên trong thư mục `kol-manager`** (các file `package.json`, `index.html`, thư mục `src`, `public`, `.github`…) thả vào ô upload. Lưu ý: kéo phần *bên trong* thư mục, đừng kéo nguyên thư mục `kol-manager` lồng vào.
4. Bấm **Commit changes**.

## Cách chạy / deploy

### Cách 1 — Vercel (khuyến nghị, giống Autorep của bạn)
1. Vào https://vercel.com → **Add New → Project** → chọn repo vừa tạo.
2. Vercel tự nhận diện Vite. Cứ để mặc định, bấm **Deploy**. Xong.

### Cách 2 — GitHub Pages (miễn phí, không cần dịch vụ ngoài)
1. Trong repo, vào **Settings → Pages → Build and deployment → Source** chọn **GitHub Actions**.
2. File `.github/workflows/deploy.yml` có sẵn sẽ tự build và deploy mỗi khi bạn push. Đợi tab **Actions** chạy xong là có link.

### Chạy thử trên máy (nếu cần)
```bash
npm install
npm run dev
```

## Lưu ý về dữ liệu
Dữ liệu lưu trên **Supabase** (đám mây), bảo vệ bằng đăng nhập mật khẩu — vào từ máy nào cũng thấy, không mất khi xoá cache trình duyệt. Vẫn nên thỉnh thoảng **Dữ liệu → Xuất backup** cho chắc. Đổi mật khẩu / quản lý tài khoản: xem `HUONG_DAN_SUPABASE.md`.

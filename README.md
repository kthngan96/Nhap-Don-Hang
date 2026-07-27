# Nhập Đơn Hàng

Ứng dụng web dành cho nhân viên bán hàng nhập đơn, theo dõi doanh số, chốt
báo cáo ngày và tổng hợp KPI theo tháng.

## Chức năng chính

- Đăng nhập bằng tài khoản Supabase do quản trị viên cung cấp.
- Dữ liệu cấu hình, đơn hàng và báo cáo tách biệt theo từng tài khoản bằng RLS.
- Lấy GPS và tự động điền địa chỉ thông qua Google Maps Geocoding.
- Theo dõi doanh số ngày/tháng, khách hàng mới và doanh số gia vị.
- Hiển thị hồ sơ NVBH và lưu ảnh đại diện riêng tư trong Supabase Storage.
- Sao chép hoặc chia sẻ mẫu đơn và báo cáo.
- Nhập dữ liệu cũ từ bộ nhớ trình duyệt vào tài khoản trong lần đăng nhập đầu.

## Cấu trúc

- `index.html`: cấu trúc giao diện.
- `styles.css`: design system và responsive layout.
- `app.js`: trạng thái, nghiệp vụ và kết nối Supabase.
- `config.js`: Supabase Project URL và publishable key dành cho trình duyệt.
- `supabase/migrations/`: schema database, Storage bucket và chính sách Row Level Security.
- `supabase/functions/reverse-geocode/`: Edge Function đổi GPS thành địa chỉ.
- `bang_gia.md` và `bang_gia.jpg`: bảng giá tham khảo.

## Chạy ứng dụng

Phục vụ thư mục này bằng một HTTP server; không mở trực tiếp bằng `file://`.

```powershell
python -m http.server 3000
```

Sau đó truy cập `http://localhost:3000`.

## Cấu hình backend

Xem [SUPABASE_SETUP.md](SUPABASE_SETUP.md) để chạy migration, tạo tài khoản,
cấu hình Google Maps secret và deploy Edge Function.

Google Maps API key chỉ được lưu trong `supabase/functions/.env` khi phát triển
local hoặc trong Supabase Secrets khi triển khai. File `.env` đã được Git ignore
và không được commit.

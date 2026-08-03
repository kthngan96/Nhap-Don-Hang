# Thiết lập Supabase và Google Maps

1. Tạo một Supabase project và áp dụng toàn bộ migration:

   ```powershell
   supabase db push
   ```
   Migration avatar tạo private bucket `avatars`, thêm `user_settings.avatar_path`
   và các policy Storage để mỗi người dùng chỉ đọc/ghi
   `{auth.uid()}/avatar.webp`. Phải chạy migration này trước khi triển khai
   frontend có chức năng đổi ảnh đại diện.

   Migration `202607270002_monthly_report_openings.sql` tạo số dư báo cáo theo
   tháng với RLS và nhập số dư 20–25/07/2026 cho tài khoản Hữu Thi. Migration
   này phải được áp dụng trước frontend release `20260727.10`; nó không tạo đơn
   hàng hoặc báo cáo ngày giả.

   Migration `202607270003_delete_nhanhtv234_account.sql` xóa tài khoản username
   `nhanhtv234` khỏi Supabase Auth. Các bản ghi liên quan được xóa theo khóa
   ngoại `on delete cascade`; migration có kiểm tra email nội bộ và quyền quản
   trị trước khi xóa để không thể nhầm tài khoản Hữu Thi.

   Migration `202607270004_vietnam_holidays.sql` tạo bảng lịch nghỉ Việt Nam
   chỉ đọc đối với người dùng đã đăng nhập và seed idempotent lịch chính thức
   năm 2025–2026. Frontend release `20260727.13` cần migration này để hiển thị
   tên lễ/Tết và ngày nghỉ bù; nếu bảng chưa sẵn sàng, lịch vẫn cho chọn ngày
   và chỉ đánh dấu Chủ nhật.
   Migration `202608030001_monthly_payroll_inputs.sql` t?o b?ng nh?p ng?y c?ng
   ???c duy?t theo t?i kho?n v? th?ng, c? RLS. Ph?i ?p d?ng migration n?y tr??c
   frontend release `20260803.2`; n?u ch?a ?p d?ng, ph?n T?m t?nh l??ng th?ng
   kh?ng th? t?i ho?c l?u ng?y c?ng.

2. Trong **Authentication > URL Configuration**:
   - đặt Site URL bằng URL triển khai ứng dụng;
   - thêm URL triển khai và URL localhost vào Redirect URLs.
3. Tài khoản email được tạo trong **Authentication > Users** bằng **Invite user**
   hoặc **Create user**. Tài khoản tên đăng nhập được quản trị viên tạo qua Edge
   Function `create-username-account`. Ứng dụng không cho người dùng tự đăng ký.
4. Sao chép Project URL và anon/public key vào `config.js`.
5. Trong Google Cloud:
   - bật **Geocoding API**;
   - tạo API key và giới hạn key chỉ được gọi Geocoding API;
   - bật billing theo yêu cầu của Google Maps Platform.
6. Cài Supabase CLI, đăng nhập và liên kết project:

   ```powershell
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase secrets set GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
   supabase functions deploy reverse-geocode
   supabase functions deploy create-username-account --no-verify-jwt
   ```

   Khi chạy local, key được đọc từ file đã git-ignore
   `supabase/functions/.env`:

   ```powershell
   supabase functions serve reverse-geocode --env-file supabase/functions/.env
   ```

7. Phục vụ ứng dụng qua HTTPS. Geolocation chỉ hoạt động trong secure context
   (HTTPS; `localhost` được trình duyệt cho phép khi phát triển).

`SUPABASE_ANON_KEY` được phép xuất hiện ở trình duyệt. Việc cô lập dữ liệu được
thực thi bởi Row Level Security trong migration. Không đưa service-role key hoặc
Google Maps API key vào `index.html` hay `config.js`.

Ảnh nguồn được trình duyệt cắt vuông, thu tối đa 512×512 và nén WebP trước khi
upload. Bucket `avatars` là private; ứng dụng chỉ hiển thị ảnh bằng signed URL
có thời hạn và không lưu signed URL vào database.

Tài khoản tên đăng nhập có thể dùng mật khẩu ngắn theo yêu cầu nghiệp vụ. Trình
duyệt và Edge Function cùng chuyển mật khẩu đó thành chuỗi xác thực SHA-256 trước
khi gửi Supabase Auth. Edge Function vẫn kiểm tra phiên và chỉ cho người có tên
trong bảng `app_admins` tạo hoặc đặt lại tài khoản. Tài khoản tên đăng nhập không
có email nhận thư, vì vậy việc đặt lại mật khẩu phải do quản trị viên thực hiện.

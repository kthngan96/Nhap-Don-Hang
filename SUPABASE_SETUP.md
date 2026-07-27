# Thiết lập Supabase và Google Maps

1. Tạo một Supabase project và áp dụng toàn bộ migration:

   ```powershell
   supabase db push
   ```
   Migration avatar tạo private bucket `avatars`, thêm `user_settings.avatar_path`
   và các policy Storage để mỗi người dùng chỉ đọc/ghi
   `{auth.uid()}/avatar.webp`. Phải chạy migration này trước khi triển khai
   frontend có chức năng đổi ảnh đại diện.
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

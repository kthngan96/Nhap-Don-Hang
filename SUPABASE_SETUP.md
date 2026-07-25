# Thiết lập Supabase và Google Maps

1. Tạo một Supabase project, mở **SQL Editor** và chạy file
   `supabase/migrations/202607250001_auth_and_account_data.sql`.
2. Trong **Authentication > URL Configuration**:
   - đặt Site URL bằng URL triển khai ứng dụng;
   - thêm URL triển khai và URL localhost vào Redirect URLs.
3. Trong **Authentication > Users**, dùng **Invite user** hoặc **Create user**.
   Ứng dụng không cho người dùng tự đăng ký.
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

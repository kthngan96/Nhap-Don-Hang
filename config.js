/*
 * Cấu hình công khai cho trình duyệt.
 * Thay hai giá trị bên dưới bằng Project URL và anon/public key trong
 * Supabase Dashboard > Project Settings > API.
 *
 * SUPABASE_ANON_KEY là khóa công khai, được bảo vệ bằng Row Level Security.
 * Không đặt GOOGLE_MAPS_API_KEY trong file này.
 */
window.APP_CONFIG = Object.freeze({
  SUPABASE_URL: "https://pxnzxjgqkdibiekkdvnv.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_IiMq9qffJZxWXc4bOwSM3w_XHTqaICY"
});

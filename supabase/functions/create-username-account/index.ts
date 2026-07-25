import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function normalizeUsername(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

async function derivePassword(username: string, password: string) {
  const input = new TextEncoder().encode(`nhap-don-hang:v1:${username}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json(405, { error: "METHOD_NOT_ALLOWED" });
  }

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authorization) return json(401, { error: "UNAUTHORIZED" });
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Missing required Supabase secrets");
    return json(500, { error: "SERVER_NOT_CONFIGURED" });
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) return json(401, { error: "UNAUTHORIZED" });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: admin, error: adminError } = await adminClient
    .from("app_admins")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (adminError) {
    console.error("Admin lookup failed", adminError);
    return json(500, { error: "ADMIN_CHECK_FAILED" });
  }
  if (!admin) return json(403, { error: "FORBIDDEN" });

  let payload: {
    username?: unknown;
    password?: unknown;
    displayName?: unknown;
    replaceExisting?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: "INVALID_JSON" });
  }

  const username = normalizeUsername(payload.username);
  const password = String(payload.password ?? "");
  const displayName = String(payload.displayName ?? "").trim();
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return json(400, { error: "INVALID_USERNAME" });
  }
  if (!password.length || password.length > 128) {
    return json(400, { error: "INVALID_PASSWORD" });
  }
  if (!displayName.length || displayName.length > 120) {
    return json(400, { error: "INVALID_DISPLAY_NAME" });
  }

  const { data: existing, error: existingError } = await adminClient
    .from("username_accounts")
    .select("user_id")
    .eq("username", username)
    .maybeSingle();
  if (existingError) {
    console.error("Username lookup failed", existingError);
    return json(500, { error: "USERNAME_CHECK_FAILED" });
  }
  const derivedPassword = await derivePassword(username, password);
  if (existing) {
    if (payload.replaceExisting !== true) {
      return json(409, { error: "USERNAME_EXISTS" });
    }
    const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(
      existing.user_id,
      {
        password: derivedPassword,
        user_metadata: { username, display_name: displayName, account_type: "username" },
      },
    );
    const { error: updateAccountError } = updateAuthError
      ? { error: null }
      : await adminClient
          .from("username_accounts")
          .update({ display_name: displayName })
          .eq("user_id", existing.user_id);
    const { error: updateSettingsError } = updateAuthError || updateAccountError
      ? { error: null }
      : await adminClient
          .from("user_settings")
          .update({ nvbh: displayName })
          .eq("user_id", existing.user_id);
    if (updateAuthError || updateAccountError || updateSettingsError) {
      console.error(
        "Existing account update failed",
        updateAuthError || updateAccountError || updateSettingsError,
      );
      return json(500, { error: "ACCOUNT_UPDATE_FAILED" });
    }
    return json(200, {
      userId: existing.user_id,
      username,
      displayName,
      updated: true,
    });
  }

  const internalEmail = `${username}@nhap-don-hang.local`;
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: internalEmail,
    password: derivedPassword,
    email_confirm: true,
    user_metadata: { username, display_name: displayName, account_type: "username" },
  });
  if (createError || !created.user) {
    console.error("Auth user creation failed", createError);
    return json(createError?.message?.toLowerCase().includes("already") ? 409 : 500, {
      error: createError?.message?.toLowerCase().includes("already")
        ? "USERNAME_EXISTS"
        : "CREATE_USER_FAILED",
    });
  }

  const userId = created.user.id;
  const { error: accountError } = await adminClient.from("username_accounts").insert({
    username,
    user_id: userId,
    display_name: displayName,
    created_by: userData.user.id,
  });
  const { error: settingsError } = accountError
    ? { error: null }
    : await adminClient.from("user_settings").upsert({
        user_id: userId,
        npp: "Thuận Lợi - Trà Vinh",
        nvbh: displayName,
        target_daily: 3426000,
        target_monthly: 90000000,
        target_aso: 50,
        target_gia_vi: 20000000,
        work_days: 26,
        prices: {},
      });

  if (accountError || settingsError) {
    console.error("Account provisioning failed", accountError || settingsError);
    await adminClient.auth.admin.deleteUser(userId);
    return json(500, { error: "ACCOUNT_PROVISION_FAILED" });
  }

  return json(201, { userId, username, displayName });
});

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

const districts = [
  "Huyện Càng Long",
  "Huyện Cầu Kè",
  "Huyện Tiểu Cần",
  "Huyện Châu Thành",
  "Huyện Cầu Ngang",
  "Huyện Trà Cú",
  "Huyện Duyên Hải",
  "Thành phố Trà Vinh",
];

function normalizePlace(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function canonicalDistrict(result: {
  address_components?: Array<{ long_name?: string; types?: string[] }>;
}) {
  const candidates = (result.address_components ?? [])
    .filter((component) =>
      component.types?.includes("administrative_area_level_2") ||
      component.types?.includes("locality")
    )
    .map((component) => normalizePlace(component.long_name ?? ""));

  for (const district of districts) {
    const canonical = normalizePlace(district);
    const shortName = canonical
      .replace(/^huyen /, "")
      .replace(/^thanh pho /, "");
    if (candidates.some((candidate) =>
      candidate === canonical ||
      candidate === shortName ||
      candidate.endsWith(` ${shortName}`)
    )) {
      return district;
    }
  }
  return null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json(405, { error: "METHOD_NOT_ALLOWED" });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return json(401, { error: "UNAUTHORIZED" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const googleMapsApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!supabaseUrl || !anonKey || !googleMapsApiKey) {
    console.error("Missing required Edge Function secrets");
    return json(500, { error: "SERVER_NOT_CONFIGURED" });
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) {
    return json(401, { error: "UNAUTHORIZED" });
  }

  let payload: { latitude?: unknown; longitude?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: "INVALID_JSON" });
  }

  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return json(400, { error: "INVALID_COORDINATES" });
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${latitude},${longitude}`);
  url.searchParams.set("language", "vi");
  url.searchParams.set("region", "vn");
  url.searchParams.set("key", googleMapsApiKey);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Google Maps HTTP error", response.status);
      return json(502, { error: "GEOCODER_UNAVAILABLE" });
    }

    const result = await response.json();
    if (result.status === "ZERO_RESULTS") {
      return json(404, { error: "ADDRESS_NOT_FOUND" });
    }
    if (result.status !== "OK" || !result.results?.[0]?.formatted_address) {
      console.error("Google Maps API error", result.status, result.error_message);
      return json(502, { error: "GEOCODER_UNAVAILABLE" });
    }

    const bestResult = result.results[0];
    return json(200, {
      address: bestResult.formatted_address,
      district: canonicalDistrict(bestResult),
      placeId: bestResult.place_id ?? null,
    });
  } catch (error) {
    console.error("Reverse geocoding failed", error);
    return json(502, { error: "GEOCODER_UNAVAILABLE" });
  }
});

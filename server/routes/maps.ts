import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Session tokens for Places API billing optimization
const sessionTokens = new Map<string, { token: string; createdAt: number }>();
const SESSION_TIMEOUT = 3 * 60 * 1000; // 3 minutes

function getOrCreateSessionToken(userId: string): string {
  const existing = sessionTokens.get(userId);
  const now = Date.now();
  
  if (existing && now - existing.createdAt < SESSION_TIMEOUT) {
    return existing.token;
  }
  
  const token = `${userId}-${now}-${Math.random().toString(36).slice(2)}`;
  sessionTokens.set(userId, { token, createdAt: now });
  return token;
}

function clearSessionToken(userId: string): void {
  sessionTokens.delete(userId);
}

// Rate limiting per user
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(userId);
  
  if (!limit || now > limit.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  
  if (limit.count >= RATE_LIMIT) {
    return false;
  }
  
  limit.count++;
  return true;
}

// All routes require authentication
router.use(authenticateToken);

// ====================================================
// POST /api/maps/autocomplete
// Google Places Autocomplete (for address search)
// ====================================================
const autocompleteSchema = z.object({
  input: z.string().min(2).max(200),
  sessionToken: z.string().optional(),
  types: z.array(z.string()).optional(),
  components: z.string().optional(),
});

router.post("/autocomplete", async (req: AuthRequest, res) => {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(503).json({ error: "Maps service not configured" });
    }

    const userId = req.user!.userId;
    
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: "Too many requests. Please slow down." });
    }

    const validation = autocompleteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid input", details: validation.error.errors });
    }

    const { input, types, components } = validation.data;
    const sessionToken = getOrCreateSessionToken(userId);

    // Build Google Places Autocomplete URL
    const params = new URLSearchParams({
      input,
      key: GOOGLE_MAPS_API_KEY,
      sessiontoken: sessionToken,
      language: "en",
    });

    // Default to address types for ride booking
    if (types && types.length > 0) {
      params.append("types", types.join("|"));
    } else {
      params.append("types", "geocode|establishment");
    }

    // Restrict to USA by default for ride booking
    if (components) {
      params.append("components", components);
    } else {
      params.append("components", "country:us");
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`
    );

    if (!response.ok) {
      console.error("[Maps] Autocomplete API error:", response.status);
      return res.status(502).json({ error: "Maps service error" });
    }

    const data = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("[Maps] Autocomplete status:", data.status, data.error_message);
      return res.status(502).json({ error: "Maps service error" });
    }

    // Transform predictions to our format
    const predictions = (data.predictions || []).map((p: any) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting?.main_text || p.description.split(",")[0],
      secondaryText: p.structured_formatting?.secondary_text || "",
      types: p.types || [],
    }));

    res.json({ predictions, sessionToken });
  } catch (error) {
    console.error("[Maps] Autocomplete error:", error);
    res.status(500).json({ error: "Failed to search locations" });
  }
});

// ====================================================
// POST /api/maps/place-details
// Get place details including coordinates
// ====================================================
const placeDetailsSchema = z.object({
  placeId: z.string().min(1),
  sessionToken: z.string().optional(),
});

router.post("/place-details", async (req: AuthRequest, res) => {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(503).json({ error: "Maps service not configured" });
    }

    const userId = req.user!.userId;
    
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: "Too many requests. Please slow down." });
    }

    const validation = placeDetailsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid input", details: validation.error.errors });
    }

    const { placeId, sessionToken } = validation.data;

    // Build Google Place Details URL
    const params = new URLSearchParams({
      place_id: placeId,
      key: GOOGLE_MAPS_API_KEY,
      fields: "formatted_address,geometry,address_components,name,place_id",
      language: "en",
    });

    if (sessionToken) {
      params.append("sessiontoken", sessionToken);
      // Clear session token after place selection (billing optimization)
      clearSessionToken(userId);
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`
    );

    if (!response.ok) {
      console.error("[Maps] Place Details API error:", response.status);
      return res.status(502).json({ error: "Maps service error" });
    }

    const data = await response.json();

    if (data.status !== "OK") {
      console.error("[Maps] Place Details status:", data.status, data.error_message);
      return res.status(502).json({ error: "Maps service error" });
    }

    const result = data.result;
    const location = result.geometry?.location;

    // Parse address components
    const components: Record<string, string> = {};
    (result.address_components || []).forEach((comp: any) => {
      if (comp.types.includes("street_number")) components.streetNumber = comp.long_name;
      if (comp.types.includes("route")) components.street = comp.long_name;
      if (comp.types.includes("locality")) components.city = comp.long_name;
      if (comp.types.includes("administrative_area_level_1")) {
        components.state = comp.short_name;
        components.stateLong = comp.long_name;
      }
      if (comp.types.includes("postal_code")) components.postalCode = comp.long_name;
      if (comp.types.includes("country")) {
        components.country = comp.short_name;
        components.countryLong = comp.long_name;
      }
    });

    res.json({
      placeId: result.place_id,
      name: result.name,
      formattedAddress: result.formatted_address,
      lat: location?.lat,
      lng: location?.lng,
      addressComponents: components,
    });
  } catch (error) {
    console.error("[Maps] Place Details error:", error);
    res.status(500).json({ error: "Failed to get place details" });
  }
});

// ====================================================
// POST /api/maps/reverse-geocode
// Reverse geocode coordinates to address
// ====================================================
const reverseGeocodeSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

router.post("/reverse-geocode", async (req: AuthRequest, res) => {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(503).json({ error: "Maps service not configured" });
    }

    const userId = req.user!.userId;
    
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: "Too many requests. Please slow down." });
    }

    const validation = reverseGeocodeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid coordinates", details: validation.error.errors });
    }

    const { lat, lng } = validation.data;

    const params = new URLSearchParams({
      latlng: `${lat},${lng}`,
      key: GOOGLE_MAPS_API_KEY,
      language: "en",
      result_type: "street_address|route|locality",
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
    );

    if (!response.ok) {
      console.error("[Maps] Reverse Geocode API error:", response.status);
      return res.status(502).json({ error: "Maps service error" });
    }

    const data = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("[Maps] Reverse Geocode status:", data.status, data.error_message);
      return res.status(502).json({ error: "Maps service error" });
    }

    const result = data.results?.[0];
    if (!result) {
      return res.json({
        formattedAddress: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        lat,
        lng,
        addressComponents: {},
      });
    }

    // Parse address components
    const components: Record<string, string> = {};
    (result.address_components || []).forEach((comp: any) => {
      if (comp.types.includes("street_number")) components.streetNumber = comp.long_name;
      if (comp.types.includes("route")) components.street = comp.long_name;
      if (comp.types.includes("locality")) components.city = comp.long_name;
      if (comp.types.includes("administrative_area_level_1")) {
        components.state = comp.short_name;
        components.stateLong = comp.long_name;
      }
      if (comp.types.includes("postal_code")) components.postalCode = comp.long_name;
      if (comp.types.includes("country")) {
        components.country = comp.short_name;
        components.countryLong = comp.long_name;
      }
    });

    res.json({
      placeId: result.place_id,
      formattedAddress: result.formatted_address,
      lat,
      lng,
      addressComponents: components,
    });
  } catch (error) {
    console.error("[Maps] Reverse Geocode error:", error);
    res.status(500).json({ error: "Failed to reverse geocode" });
  }
});

// ====================================================
// POST /api/maps/directions
// Get route directions with distance, duration, polyline
// ====================================================
const directionsSchema = z.object({
  origin: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  destination: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  mode: z.enum(["driving", "walking", "bicycling"]).optional(),
});

router.post("/directions", async (req: AuthRequest, res) => {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(503).json({ error: "Maps service not configured" });
    }

    const userId = req.user!.userId;
    
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: "Too many requests. Please slow down." });
    }

    const validation = directionsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid input", details: validation.error.errors });
    }

    const { origin, destination, mode = "driving" } = validation.data;

    const params = new URLSearchParams({
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      key: GOOGLE_MAPS_API_KEY,
      mode,
      units: "imperial", // For miles
      language: "en",
      departure_time: "now", // For traffic-aware ETA
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`
    );

    if (!response.ok) {
      console.error("[Maps] Directions API error:", response.status);
      return res.status(502).json({ error: "Maps service error" });
    }

    const data = await response.json();

    if (data.status !== "OK") {
      console.error("[Maps] Directions status:", data.status, data.error_message);
      
      if (data.status === "ZERO_RESULTS") {
        return res.status(404).json({ error: "No route found between these locations" });
      }
      return res.status(502).json({ error: "Maps service error" });
    }

    const route = data.routes?.[0];
    const leg = route?.legs?.[0];

    if (!leg) {
      return res.status(404).json({ error: "No route found" });
    }

    // Distance in meters, convert to miles
    const distanceMeters = leg.distance?.value || 0;
    const distanceMiles = Math.round((distanceMeters / 1609.344) * 10) / 10;

    // Duration in seconds, convert to minutes
    const durationSeconds = leg.duration_in_traffic?.value || leg.duration?.value || 0;
    const durationMinutes = Math.ceil(durationSeconds / 60);

    res.json({
      distanceMiles,
      durationMinutes,
      distanceText: leg.distance?.text || `${distanceMiles} mi`,
      durationText: leg.duration_in_traffic?.text || leg.duration?.text || `${durationMinutes} min`,
      polyline: route.overview_polyline?.points || "",
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      // Raw values for backend storage
      rawDistanceMeters: distanceMeters,
      rawDurationSeconds: durationSeconds,
      providerSource: "google_maps",
    });
  } catch (error) {
    console.error("[Maps] Directions error:", error);
    res.status(500).json({ error: "Failed to calculate route" });
  }
});

// ====================================================
// POST /api/maps/distance-matrix
// Get distance/duration for multiple origins/destinations
// ====================================================
const distanceMatrixSchema = z.object({
  origins: z.array(z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })).min(1).max(10),
  destinations: z.array(z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })).min(1).max(10),
});

router.post("/distance-matrix", async (req: AuthRequest, res) => {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(503).json({ error: "Maps service not configured" });
    }

    const userId = req.user!.userId;
    
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: "Too many requests. Please slow down." });
    }

    const validation = distanceMatrixSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid input", details: validation.error.errors });
    }

    const { origins, destinations } = validation.data;

    const originsStr = origins.map(o => `${o.lat},${o.lng}`).join("|");
    const destinationsStr = destinations.map(d => `${d.lat},${d.lng}`).join("|");

    const params = new URLSearchParams({
      origins: originsStr,
      destinations: destinationsStr,
      key: GOOGLE_MAPS_API_KEY,
      mode: "driving",
      units: "imperial",
      language: "en",
      departure_time: "now",
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`
    );

    if (!response.ok) {
      console.error("[Maps] Distance Matrix API error:", response.status);
      return res.status(502).json({ error: "Maps service error" });
    }

    const data = await response.json();

    if (data.status !== "OK") {
      console.error("[Maps] Distance Matrix status:", data.status, data.error_message);
      return res.status(502).json({ error: "Maps service error" });
    }

    // Transform results
    const results = data.rows.map((row: any, originIndex: number) => ({
      origin: origins[originIndex],
      elements: row.elements.map((element: any, destIndex: number) => {
        if (element.status !== "OK") {
          return {
            destination: destinations[destIndex],
            status: element.status,
            distanceMiles: null,
            durationMinutes: null,
          };
        }

        const distanceMeters = element.distance?.value || 0;
        const distanceMiles = Math.round((distanceMeters / 1609.344) * 10) / 10;
        const durationSeconds = element.duration_in_traffic?.value || element.duration?.value || 0;
        const durationMinutes = Math.ceil(durationSeconds / 60);

        return {
          destination: destinations[destIndex],
          status: "OK",
          distanceMiles,
          durationMinutes,
          distanceText: element.distance?.text,
          durationText: element.duration_in_traffic?.text || element.duration?.text,
        };
      }),
    }));

    res.json({ results });
  } catch (error) {
    console.error("[Maps] Distance Matrix error:", error);
    res.status(500).json({ error: "Failed to calculate distances" });
  }
});

export default router;

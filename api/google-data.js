// /api/health-data.js
const BASE = "https://health.googleapis.com/v4";

async function getAccessToken(refreshToken) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await r.json();
  if (!data.access_token) throw new Error("Refresh fehlgeschlagen: " + JSON.stringify(data));
  return data.access_token;
}

export default async function handler(req, res) {
  const refresh = (req.headers.cookie || "")
    .split(";").map(c => c.trim())
    .find(c => c.startsWith("gh_refresh="))?.split("=")[1];
  if (!refresh) return res.status(401).json({ error: "not_connected" });

  const token = await getAccessToken(refresh);
  const H = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  // --- Schritte pro Tag (letzte 7 Tage) ---
  const today = new Date();
  const from  = new Date(today.getTime() - 6 * 864e5);
  const civil = d => ({
    date: { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() },
    time: { hours: 0, minutes: 0, seconds: 0, nanos: 0 },
  });

  const stepsRes = await fetch(
    `${BASE}/users/me/dataTypes/steps/dataPoints:dailyRollUp`,
    {
      method: "POST",
      headers: { ...H, "Content-Type": "application/json" },
      body: JSON.stringify({
        range: { start: civil(from), end: civil(today) },
        windowSizeDays: 1,
      }),
    }
  ).then(r => r.json());

  // --- Schlaf: nur Wearable-Quelle, ab einem Datum ---
  const iso = from.toISOString().slice(0, 10);
  const sleepRes = await fetch(
    `${BASE}/users/me/dataTypes/sleep/dataPoints:reconcile` +
    `?dataSourceFamily=users/me/dataSourceFamilies/google-wearables` +
    `&filter=${encodeURIComponent(`sleep.interval.civil_end_time >= "${iso}"`)}`,
    { headers: H }
  ).then(r => r.json());

  res.status(200).json({ steps: stepsRes, sleep: sleepRes });
}

// /api/google-callback.js
export default async function handler(req, res) {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(`OAuth-Fehler: ${error}`);

  // CSRF-Schutz: state gegen Cookie prüfen
  const cookieState = (req.headers.cookie || "")
    .split(";").map(c => c.trim())
    .find(c => c.startsWith("oauth_state="))?.split("=")[1];
  if (!state || state !== cookieState) return res.status(400).send("Ungültiger state");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokens.refresh_token) {
    return res.status(400).send("Kein Refresh Token erhalten – access_type/prompt prüfen.");
  }

  // Refresh Token nur im HttpOnly-Cookie -> nie im JS erreichbar
  res.setHeader("Set-Cookie", [
    `gh_refresh=${tokens.refresh_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
    `oauth_state=; HttpOnly; Secure; Path=/; Max-Age=0`,
  ]);
  res.redirect(302, "/health.html?connected=1");
}

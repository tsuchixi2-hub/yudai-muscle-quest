import { clearCookie, createSession, json, normalizeUser, parseCookies, sessionCookie } from "../../_auth.js";

export async function onRequestGet({ request, env }) {
  if (!env.LINE_CHANNEL_ID || !env.LINE_CHANNEL_SECRET || !env.LINE_CALLBACK_URL) {
    return json({
      error:"line_not_configured",
      message:"LINE DevelopersのChannel ID/Secret/Callback URLを設定すると本番LINEログインに接続できます。"
    }, 501);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookies = parseCookies(request);
  if (!code || !state || state !== cookies.ymq_line_state) return json({ error:"invalid_line_state" }, 400);

  const tokenBody = new URLSearchParams();
  tokenBody.set("grant_type", "authorization_code");
  tokenBody.set("code", code);
  tokenBody.set("redirect_uri", env.LINE_CALLBACK_URL);
  tokenBody.set("client_id", env.LINE_CHANNEL_ID);
  tokenBody.set("client_secret", env.LINE_CHANNEL_SECRET);

  const tokenResponse = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method:"POST",
    headers:{ "content-type":"application/x-www-form-urlencoded" },
    body:tokenBody
  });
  if (!tokenResponse.ok) return json({ error:"line_token_failed" }, 502);
  const token = await tokenResponse.json();

  const profileResponse = await fetch("https://api.line.me/v2/profile", {
    headers:{ "authorization":`Bearer ${token.access_token}` }
  });
  if (!profileResponse.ok) return json({ error:"line_profile_failed" }, 502);
  const profile = await profileResponse.json();
  if (!profile.userId) return json({ error:"line_profile_missing" }, 502);

  const now = new Date().toISOString();
  let user = await env.DB.prepare(
    `SELECT id, display_name, public_name, picture_url
     FROM users
     WHERE line_user_id = ?`
  ).bind(profile.userId).first();

  if (!user) {
    const id = `user-${crypto.randomUUID()}`;
    const displayName = String(profile.displayName || "LINEユーザー").slice(0, 32);
    await env.DB.prepare(
      `INSERT INTO users (id, line_user_id, demo_key, display_name, public_name, picture_url, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`
    ).bind(id, profile.userId, displayName, "LINEユーザー", profile.pictureUrl || "", now, now).run();
    user = await env.DB.prepare(
      `SELECT id, display_name, public_name, picture_url
       FROM users
       WHERE id = ?`
    ).bind(id).first();
  } else {
    await env.DB.prepare(
      `UPDATE users
       SET display_name = ?, picture_url = ?, updated_at = ?
       WHERE id = ?`
    ).bind(String(profile.displayName || user.display_name).slice(0, 32), profile.pictureUrl || "", now, user.id).run();
    user = { ...user, display_name:String(profile.displayName || user.display_name).slice(0, 32), picture_url:profile.pictureUrl || "" };
  }

  const session = await createSession(env, user.id);
  const returnTo = cookies.ymq_line_return || "/";
  const redirectUrl = new URL(returnTo, url.origin);
  redirectUrl.searchParams.set("nickname", "1");

  const headers = new Headers({ "location":redirectUrl.pathname + redirectUrl.search + redirectUrl.hash });
  headers.append("set-cookie", sessionCookie(session.id, session.expiresAt, request));
  headers.append("set-cookie", clearCookie("ymq_line_state", request));
  headers.append("set-cookie", clearCookie("ymq_line_return", request));
  return new Response(null, { status:302, headers });
}

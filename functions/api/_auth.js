export const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const sessionCookieName = "ymq_session";
const sessionDays = 30;

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers:{ ...jsonHeaders, ...headers } });
}

export function isDateText(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  return Object.fromEntries(header.split(";").map(item => {
    const index = item.indexOf("=");
    if (index === -1) return ["", ""];
    return [item.slice(0, index).trim(), decodeURIComponent(item.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function cookieAttributes(request) {
  const url = request ? new URL(request.url) : null;
  const localHttp = url?.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  return `Path=/; HttpOnly; ${localHttp ? "" : "Secure; "}SameSite=Lax`;
}

export function sessionCookie(sessionId, expiresAt, request) {
  const maxAge = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  return `${sessionCookieName}=${encodeURIComponent(sessionId)}; Max-Age=${maxAge}; ${cookieAttributes(request)}`;
}

export function clearSessionCookie(request) {
  return `${sessionCookieName}=; Max-Age=0; ${cookieAttributes(request)}`;
}

export function temporaryCookie(name, value, maxAge = 600, request) {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; ${cookieAttributes(request)}`;
}

export function clearCookie(name, request) {
  return `${name}=; Max-Age=0; ${cookieAttributes(request)}`;
}

export async function getSessionUser(request, env) {
  const sessionId = parseCookies(request)[sessionCookieName];
  if (!sessionId) return null;

  const row = await env.DB.prepare(
    `SELECT users.id, users.display_name, users.public_name, users.picture_url, sessions.id AS session_id, sessions.expires_at
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.id = ?`
  ).bind(sessionId).first();

  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
    return null;
  }

  return { ...normalizeUser(row), sessionId:row.session_id };
}

export async function requireUser(request, env) {
  const user = await getSessionUser(request, env);
  if (!user) return { response:json({ error:"unauthorized" }, 401) };
  return { user };
}

export async function createSession(env, userId) {
  const now = new Date();
  const expires = new Date(now);
  expires.setDate(now.getDate() + sessionDays);
  const session = {
    id:`sess-${crypto.randomUUID()}`,
    userId,
    createdAt:now.toISOString(),
    expiresAt:expires.toISOString()
  };
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?)`
  ).bind(session.id, session.userId, session.expiresAt, session.createdAt).run();
  return session;
}

export function normalizeUser(row) {
  return {
    id:row.id,
    displayName:row.display_name,
    publicName:row.public_name,
    pictureUrl:row.picture_url || ""
  };
}

export function safeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 32);
}

export function demoKeyFor(name) {
  if (name === "優大" || name.toLowerCase() === "yudai") return "demo:yudai";
  return `demo:${name.toLowerCase()}`;
}

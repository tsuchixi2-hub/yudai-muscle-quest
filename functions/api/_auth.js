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

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[char]));
}

export function authErrorPage(request, { title, message, returnTo, code, status = 400 }) {
  const url = new URL(request.url);
  const safeReturnTo = returnTo || "/";
  const retryUrl = `/api/auth/line/start?mode=web&returnTo=${encodeURIComponent(safeReturnTo)}`;
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif; background:#f5f5f7; color:#1c1c1e; margin:0; padding:24px 16px; display:flex; align-items:center; justify-content:center; min-height:100vh; box-sizing:border-box; }
  .card { background:#fff; border-radius:16px; padding:28px 24px; max-width:420px; width:100%; box-shadow:0 2px 12px rgba(0,0,0,0.08); text-align:center; }
  h1 { font-size:18px; margin:0 0 12px; }
  p { font-size:14px; line-height:1.6; color:#3a3a3c; margin:0 0 20px; }
  a.button { display:block; background:#06c755; color:#fff; text-decoration:none; font-weight:bold; padding:12px 16px; border-radius:10px; margin-bottom:12px; }
  a.link { display:block; color:#636366; text-decoration:none; font-size:13px; margin-bottom:16px; }
  .code { font-size:11px; color:#aeaeb2; }
</style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <a class="button" href="${retryUrl}">LINEのWeb画面でログインをやり直す</a>
    <a class="link" href="/">トップへ戻る</a>
    <div class="code">${escapeHtml(code || "")}</div>
  </div>
</body>
</html>`;
  return new Response(html, {
    status,
    headers:{ "content-type":"text/html; charset=utf-8", "cache-control":"no-store" }
  });
}

export async function logAuthEvent(env, stage, detail, request) {
  try {
    if (!env.DB) return;
    const id = crypto.randomUUID();
    const userAgent = (request && request.headers.get("user-agent")) || "";
    const createdAt = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO auth_events (id, stage, detail, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(id, stage, detail || "", userAgent, createdAt).run();
  } catch (err) {
    // ログ失敗が認証フローを壊さないようにする
  }
}

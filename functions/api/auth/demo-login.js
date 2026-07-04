import { createSession, demoKeyFor, json, normalizeUser, safeName, sessionCookie } from "../_auth.js";

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error:"invalid_json" }, 400);
  }

  const name = safeName(body.displayName) || "LINEユーザー";
  const now = new Date().toISOString();
  const demoKey = safeName(body.demoKey) ? `demo:${safeName(body.demoKey)}` : demoKeyFor(name);
  const publicName = safeName(body.publicName) || name;
  let user = await env.DB.prepare(
    `SELECT id, display_name, public_name, picture_url
     FROM users
     WHERE demo_key = ?`
  ).bind(demoKey).first();

  if (!user) {
    const id = `user-${crypto.randomUUID()}`;
    await env.DB.prepare(
      `INSERT INTO users (id, line_user_id, demo_key, display_name, public_name, picture_url, created_at, updated_at)
       VALUES (?, NULL, ?, ?, ?, '', ?, ?)`
    ).bind(id, demoKey, name, publicName, now, now).run();
    user = await env.DB.prepare(
      `SELECT id, display_name, public_name, picture_url
       FROM users
       WHERE id = ?`
    ).bind(id).first();
  } else {
    await env.DB.prepare(
      `UPDATE users
       SET display_name = ?, updated_at = ?
       WHERE id = ?`
    ).bind(name, now, user.id).run();
    user = { ...user, display_name:name };
  }

  const session = await createSession(env, user.id);
  return json({ user:normalizeUser(user), needsNickname:Boolean(body.needsNickname) }, 200, { "set-cookie":sessionCookie(session.id, session.expiresAt, request) });
}

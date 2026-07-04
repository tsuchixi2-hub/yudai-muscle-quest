import { json, normalizeUser, requireUser, safeName } from "../_auth.js";

export async function onRequestPost({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error:"invalid_json" }, 400);
  }

  const nickname = safeName(body.nickname);
  if (!nickname) return json({ error:"invalid_nickname" }, 400);

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE users
     SET public_name = ?, updated_at = ?
     WHERE id = ?`
  ).bind(nickname, now, auth.user.id).run();

  const user = await env.DB.prepare(
    `SELECT id, display_name, public_name, picture_url
     FROM users
     WHERE id = ?`
  ).bind(auth.user.id).first();

  return json({ user:normalizeUser(user) });
}

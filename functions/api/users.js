import { json, normalizeUser, requireUser } from "./_auth.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;

  const { results } = await env.DB.prepare(
    `SELECT id, display_name, public_name, picture_url
     FROM users
     ORDER BY created_at ASC`
  ).all();

  return json({
    currentUserId:auth.user.id,
    users:results.map(row => ({
      ...normalizeUser(row),
      isCurrent:row.id === auth.user.id
    }))
  });
}

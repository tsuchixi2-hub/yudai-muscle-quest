import { clearSessionCookie, getSessionUser, json } from "../_auth.js";

export async function onRequestPost({ request, env }) {
  const user = await getSessionUser(request, env);
  if (user?.sessionId) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(user.sessionId).run();
  }
  return json({ ok:true }, 200, { "set-cookie":clearSessionCookie() });
}

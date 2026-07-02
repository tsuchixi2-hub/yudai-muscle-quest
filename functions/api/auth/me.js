import { getSessionUser, json } from "../_auth.js";

export async function onRequestGet({ request, env }) {
  const user = await getSessionUser(request, env);
  if (!user) return json({ user:null });
  const { sessionId, ...publicUser } = user;
  return json({ user:publicUser });
}

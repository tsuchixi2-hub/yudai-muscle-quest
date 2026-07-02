import { json, requireUser } from "./_auth.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return json({ error:"missing_id" }, 400);

  const record = await env.DB.prepare(
    `SELECT object_key, image_data, content_type
     FROM photo_records
     WHERE id = ? AND user_id = ?`
  ).bind(id, auth.user.id).first();

  if (!record) return json({ error:"not_found" }, 404);
  if (!record.object_key && record.image_data) {
    const match = String(record.image_data).match(/^data:(image\/jpe?g);base64,(.+)$/);
    if (!match) return json({ error:"invalid_legacy_photo" }, 500);
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Response(bytes, {
      headers:{
        "content-type":"image/jpeg",
        "cache-control":"private, no-store"
      }
    });
  }
  if (!env.PHOTOS) return json({ error:"r2_not_configured" }, 500);

  const object = await env.PHOTOS.get(record.object_key);
  if (!object) return json({ error:"not_found" }, 404);
  return new Response(object.body, {
    headers:{
      "content-type":record.content_type || "image/jpeg",
      "cache-control":"private, no-store"
    }
  });
}

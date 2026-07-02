import { isDateText, json, requireUser } from "./_auth.js";

function normalizeRow(row) {
  return {
    id: row.id,
    date: row.date,
    memo: row.memo || "",
    fileName: row.file_name || "photo",
    image: row.object_key ? `/api/photo?id=${encodeURIComponent(row.id)}` : row.image_data,
    isPublic: Boolean(row.is_public),
    createdAt: row.created_at,
    userId: row.user_id || ""
  };
}

function dataUrlToBytes(dataUrl) {
  const match = dataUrl.match(/^data:(image\/jpe?g);base64,(.+)$/);
  if (!match) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { bytes, contentType:"image/jpeg" };
}

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;

  const { results } = await env.DB.prepare(
    `SELECT id, user_id, date, memo, file_name, image_data, object_key, is_public, created_at
     FROM photo_records
     WHERE user_id = ?
     ORDER BY date DESC, created_at DESC`
  ).bind(auth.user.id).all();

  return json({ records: results.map(normalizeRow) });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;
  if (!env.PHOTOS) return json({ error: "r2_not_configured" }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const date = body.date;
  const memo = String(body.memo || "").trim().slice(0, 280);
  const fileName = String(body.fileName || "photo").trim().slice(0, 120) || "photo";
  const image = String(body.image || "");
  const isPublic = body.isPublic === true ? 1 : 0;
  const imageBytes = dataUrlToBytes(image);

  if (!isDateText(date) || !imageBytes) {
    return json({ error: "invalid_photo" }, 400);
  }

  if (imageBytes.bytes.byteLength > 1100000) {
    return json({ error: "photo_too_large" }, 413);
  }

  const id = `photo-${Date.now()}-${crypto.randomUUID()}`;
  const objectKey = `${auth.user.id}/${id}.jpg`;
  const record = {
    id,
    userId: auth.user.id,
    date,
    memo,
    fileName,
    image: `/api/photo?id=${encodeURIComponent(id)}`,
    objectKey,
    isPublic: Boolean(isPublic),
    createdAt: new Date().toISOString()
  };

  await env.PHOTOS.put(objectKey, imageBytes.bytes, {
    httpMetadata:{ contentType:imageBytes.contentType }
  });

  await env.DB.prepare(
    `INSERT INTO photo_records (id, user_id, date, memo, file_name, image_data, object_key, content_type, is_public, created_at)
     VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?)`
  ).bind(record.id, record.userId, record.date, record.memo, record.fileName, record.objectKey, imageBytes.contentType, isPublic, record.createdAt).run();

  return json({ record }, 201);
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const all = url.searchParams.get("all") === "1";

  if (all) {
    const { results } = await env.DB.prepare("SELECT object_key FROM photo_records WHERE user_id = ? AND object_key IS NOT NULL").bind(auth.user.id).all();
    if (env.PHOTOS) {
      await Promise.all(results.map(row => env.PHOTOS.delete(row.object_key)));
    }
    await env.DB.prepare("DELETE FROM photo_records WHERE user_id = ?").bind(auth.user.id).run();
    return json({ ok: true });
  }

  if (!id) return json({ error: "missing_id" }, 400);
  const record = await env.DB.prepare("SELECT object_key FROM photo_records WHERE id = ? AND user_id = ?").bind(id, auth.user.id).first();
  if (record?.object_key && env.PHOTOS) await env.PHOTOS.delete(record.object_key);
  await env.DB.prepare("DELETE FROM photo_records WHERE id = ? AND user_id = ?").bind(id, auth.user.id).run();
  return json({ ok: true });
}

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

function isDateText(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeRow(row) {
  return {
    id: row.id,
    date: row.date,
    memo: row.memo || "",
    fileName: row.file_name || "photo",
    image: row.image_data,
    createdAt: row.created_at
  };
}

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT id, date, memo, file_name, image_data, created_at
     FROM photo_records
     ORDER BY date DESC, created_at DESC`
  ).all();

  return json({ records: results.map(normalizeRow) });
}

export async function onRequestPost({ request, env }) {
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

  if (!isDateText(date) || !image.startsWith("data:image/jpeg;base64,")) {
    return json({ error: "invalid_photo" }, 400);
  }

  if (image.length > 1300000) {
    return json({ error: "photo_too_large" }, 413);
  }

  const record = {
    id: `photo-${Date.now()}-${crypto.randomUUID()}`,
    date,
    memo,
    fileName,
    image,
    createdAt: new Date().toISOString()
  };

  await env.DB.prepare(
    `INSERT INTO photo_records (id, date, memo, file_name, image_data, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(record.id, record.date, record.memo, record.fileName, record.image, record.createdAt).run();

  return json({ record }, 201);
}

export async function onRequestDelete({ request, env }) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const all = url.searchParams.get("all") === "1";

  if (all) {
    await env.DB.prepare("DELETE FROM photo_records").run();
    return json({ ok: true });
  }

  if (!id) return json({ error: "missing_id" }, 400);
  await env.DB.prepare("DELETE FROM photo_records WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

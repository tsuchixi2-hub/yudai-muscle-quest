const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const validParts = new Set(["胸", "背中", "肩", "腕", "脚", "腹", "全身"]);

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
    part: row.part,
    exercise: row.exercise,
    weight: Number(row.weight),
    reps: Number(row.reps),
    sets: Number(row.sets || 3),
    createdAt: row.created_at
  };
}

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT id, date, part, exercise, weight, reps, sets, created_at
     FROM workout_logs
     ORDER BY date ASC, created_at ASC`
  ).all();

  return json({ logs: results.map(normalizeRow) });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const date = body.date;
  const part = String(body.part || "");
  const exercise = String(body.exercise || "").trim().slice(0, 80);
  const weight = Number(body.weight);
  const reps = Number(body.reps);
  const sets = Number(body.sets || 3);

  if (!isDateText(date) || !validParts.has(part) || !exercise || !Number.isFinite(weight) || !Number.isFinite(reps) || !Number.isFinite(sets)) {
    return json({ error: "invalid_workout" }, 400);
  }

  if (weight < 0 || weight > 400 || reps < 1 || reps > 200 || sets < 1 || sets > 20) {
    return json({ error: "invalid_range" }, 400);
  }

  const log = {
    id: `log-${Date.now()}-${crypto.randomUUID()}`,
    date,
    part,
    exercise,
    weight,
    reps: Math.round(reps),
    sets: Math.round(sets),
    createdAt: new Date().toISOString()
  };

  await env.DB.prepare(
    `INSERT INTO workout_logs (id, date, part, exercise, weight, reps, sets, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(log.id, log.date, log.part, log.exercise, log.weight, log.reps, log.sets, log.createdAt).run();

  return json({ log }, 201);
}

export async function onRequestDelete({ request, env }) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const all = url.searchParams.get("all") === "1";

  if (all) {
    await env.DB.prepare("DELETE FROM workout_logs").run();
    return json({ ok: true });
  }

  if (!id) return json({ error: "missing_id" }, 400);
  await env.DB.prepare("DELETE FROM workout_logs WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

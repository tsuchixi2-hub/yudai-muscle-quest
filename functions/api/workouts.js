import { isDateText, json, requireUser } from "./_auth.js";

const validParts = new Set(["胸", "背中", "肩", "腕", "脚", "腹", "全身"]);

function normalizeRow(row) {
  return {
    id: row.id,
    date: row.date,
    part: row.part,
    exercise: row.exercise,
    weight: Number(row.weight),
    reps: Number(row.reps),
    sets: Number(row.sets || 3),
    createdAt: row.created_at,
    userId: row.user_id || ""
  };
}

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;

  const { results } = await env.DB.prepare(
    `SELECT id, user_id, date, part, exercise, weight, reps, sets, created_at
     FROM workout_logs
     WHERE user_id = ?
     ORDER BY date ASC, created_at ASC`
  ).bind(auth.user.id).all();

  return json({ logs: results.map(normalizeRow) });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;

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
    userId: auth.user.id,
    date,
    part,
    exercise,
    weight,
    reps: Math.round(reps),
    sets: Math.round(sets),
    createdAt: new Date().toISOString()
  };

  await env.DB.prepare(
    `INSERT INTO workout_logs (id, user_id, date, part, exercise, weight, reps, sets, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(log.id, log.userId, log.date, log.part, log.exercise, log.weight, log.reps, log.sets, log.createdAt).run();

  return json({ log }, 201);
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const all = url.searchParams.get("all") === "1";

  if (all) {
    await env.DB.prepare("DELETE FROM workout_logs WHERE user_id = ?").bind(auth.user.id).run();
    return json({ ok: true });
  }

  if (!id) return json({ error: "missing_id" }, 400);
  await env.DB.prepare("DELETE FROM workout_logs WHERE id = ? AND user_id = ?").bind(id, auth.user.id).run();
  return json({ ok: true });
}

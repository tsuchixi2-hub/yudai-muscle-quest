import { json, normalizeUser, requireUser } from "../../_auth.js";
import { levelFor, pointBreakdown } from "../../_metrics.js";

function normalizeLog(row) {
  return {
    id:row.id,
    date:row.date,
    part:row.part,
    exercise:row.exercise,
    weight:Number(row.weight),
    reps:Number(row.reps),
    sets:Number(row.sets || 3),
    createdAt:row.created_at,
    userId:row.user_id || ""
  };
}

export async function onRequestGet({ request, env, params }) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;

  const user = await env.DB.prepare(
    `SELECT id, display_name, public_name, picture_url
     FROM users
     WHERE id = ?`
  ).bind(params.id).first();
  if (!user) return json({ error:"not_found" }, 404);

  const { results } = await env.DB.prepare(
    `SELECT id, user_id, date, part, exercise, weight, reps, sets, created_at
     FROM workout_logs
     WHERE user_id = ?
     ORDER BY date ASC, created_at ASC`
  ).bind(params.id).all();
  const logs = results.map(normalizeLog);
  const breakdown = pointBreakdown(logs);
  const level = levelFor(breakdown.total);

  return json({
    user:{ ...normalizeUser(user), isCurrent:user.id === auth.user.id },
    logs,
    summary:{
      points:breakdown.total,
      level:level.level,
      levelName:level.name,
      weekDone:breakdown.weekDone,
      bestIntervalCount:breakdown.bestIntervalCount,
      okIntervalCount:breakdown.okIntervalCount,
      staleParts:breakdown.staleParts,
      sevenDayRhythm:breakdown.sevenDayRhythm,
      streak:breakdown.streak
    }
  });
}

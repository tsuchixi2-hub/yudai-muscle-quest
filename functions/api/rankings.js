import { json, requireUser } from "./_auth.js";
import { levelFor, pointBreakdown } from "./_metrics.js";

function normalizeLog(row) {
  return {
    date:row.date,
    part:row.part,
    exercise:row.exercise,
    weight:Number(row.weight),
    reps:Number(row.reps),
    sets:Number(row.sets || 3),
    createdAt:row.created_at,
    userId:row.user_id
  };
}

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.response) return auth.response;

  const usersResult = await env.DB.prepare(
    `SELECT id, display_name, public_name, picture_url, created_at
     FROM users
     ORDER BY created_at ASC`
  ).all();
  const logsResult = await env.DB.prepare(
    `SELECT user_id, date, part, exercise, weight, reps, sets, created_at
     FROM workout_logs
     ORDER BY date ASC, created_at ASC`
  ).all();
  const logsByUser = new Map();
  logsResult.results.forEach(row => {
    if (!logsByUser.has(row.user_id)) logsByUser.set(row.user_id, []);
    logsByUser.get(row.user_id).push(normalizeLog(row));
  });

  const ranking = usersResult.results.map(user => {
    const logs = logsByUser.get(user.id) || [];
    const breakdown = pointBreakdown(logs);
    const level = levelFor(breakdown.total);
    return {
      userId:user.id,
      publicName:user.public_name,
      pictureUrl:user.picture_url || "",
      isCurrent:user.id === auth.user.id,
      points:breakdown.total,
      level:level.level,
      levelName:level.name,
      weekDone:breakdown.weekDone,
      bestIntervalCount:breakdown.bestIntervalCount,
      okIntervalCount:breakdown.okIntervalCount,
      staleParts:breakdown.staleParts,
      sevenDayRhythm:breakdown.sevenDayRhythm,
      streak:breakdown.streak,
      totalLogs:logs.length
    };
  }).sort((a,b) => (
    b.points - a.points ||
    b.weekDone - a.weekDone ||
    b.bestIntervalCount - a.bestIntervalCount ||
    b.streak - a.streak ||
    a.publicName.localeCompare(b.publicName, "ja")
  )).map((item,index) => ({ rank:index + 1, ...item }));

  return json({ ranking });
}

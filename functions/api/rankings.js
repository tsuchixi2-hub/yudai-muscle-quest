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

function dateToISO(date) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

function todayInJapan() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone:"Asia/Tokyo",
    year:"numeric",
    month:"2-digit",
    day:"2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateText, amount) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return dateToISO(date);
}

function weekStart(dateText) {
  const date = new Date(`${dateText}T00:00:00`);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return dateToISO(date);
}

function sortRanking(a, b) {
  return (
    b.points - a.points ||
    b.weekDone - a.weekDone ||
    b.bestIntervalCount - a.bestIntervalCount ||
    b.streak - a.streak ||
    a.publicName.localeCompare(b.publicName, "ja")
  );
}

function buildRanking(users, logsByUser, authUserId, options = {}) {
  const { today = dateToISO(new Date()), filterLogs = logs => logs } = options;
  return users.map(user => {
    const sourceLogs = logsByUser.get(user.id) || [];
    const logs = filterLogs(sourceLogs);
    const breakdown = pointBreakdown(logs, today);
    const level = levelFor(breakdown.total);
    return {
      userId:user.id,
      publicName:user.public_name || user.display_name || "ユーザー",
      pictureUrl:user.picture_url || "",
      isCurrent:user.id === authUserId,
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
  }).sort(sortRanking).map((item,index) => ({ rank:index + 1, ...item }));
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

  const users = usersResult.results;
  const today = todayInJapan();
  const yesterday = addDays(today, -1);
  const startOfWeek = weekStart(today);
  const ranking = buildRanking(users, logsByUser, auth.user.id, { today });
  const previousRanking = buildRanking(users, logsByUser, auth.user.id, {
    today:yesterday,
    filterLogs:logs => logs.filter(log => log.date <= yesterday)
  });
  const previousRankByUser = new Map(previousRanking.map(item => [item.userId, item.rank]));
  const previousPointsByUser = new Map(previousRanking.map(item => [item.userId, item.points]));
  const rankingWithChange = ranking.map(item => {
    const previousRank = previousRankByUser.get(item.userId) || null;
    const previousPoints = previousPointsByUser.get(item.userId) ?? null;
    const rankChange = previousRank ? previousRank - item.rank : 0;
    const pointChange = previousPoints === null ? item.points : item.points - previousPoints;
    const rankTrend = rankChange > 0 ? "up" : rankChange < 0 ? "down" : "same";
    return { ...item, previousRank, previousPoints, rankChange, pointChange, rankTrend };
  });
  const weeklyRanking = buildRanking(users, logsByUser, auth.user.id, {
    today,
    filterLogs:logs => logs.filter(log => log.date >= startOfWeek && log.date <= today)
  });

  return json({
    ranking:rankingWithChange,
    weeklyRanking,
    updatedAt:new Date().toISOString(),
    today,
    startOfWeek
  });
}

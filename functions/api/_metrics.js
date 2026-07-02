const parts = ["胸","背中","肩","腕","脚","腹","全身"];
const levels = [
  { level:1, points:0, name:"リズム開始" },
  { level:2, points:80, name:"休息メモ係" },
  { level:3, points:180, name:"週リズム見習い" },
  { level:4, points:320, name:"部位ローテーター" },
  { level:5, points:500, name:"継続ビルダー" },
  { level:6, points:720, name:"休息マスター" },
  { level:7, points:980, name:"7日リズム職人" },
  { level:8, points:1280, name:"習慣アスリート" },
  { level:9, points:1620, name:"部位管理プロ" },
  { level:10, points:2000, name:"筋肉クエスト王" }
];

function todayISO() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function addDays(dateText, amount) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + amount);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function weekDates(today = todayISO()) {
  const base = new Date(`${today}T00:00:00`);
  const mondayOffset = (base.getDay() + 6) % 7;
  const monday = new Date(base);
  monday.setDate(base.getDate() - mondayOffset);
  return Array.from({ length:7 }, (_,index) => addDays(monday.toISOString().slice(0, 10), index));
}

function dateDiffDays(later, earlier) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(`${later}T00:00:00`) - new Date(`${earlier}T00:00:00`)) / oneDay);
}

function trainingDatesForPart(logs, part) {
  return [...new Set(logs.filter(log => log.part === part).map(log => log.date))].sort();
}

function longestStreak(dates) {
  const unique = [...new Set(dates)].sort();
  if (!unique.length) return 0;
  let best = 1;
  let current = 1;
  for (let index = 1; index < unique.length; index += 1) {
    if (dateDiffDays(unique[index], unique[index - 1]) === 1) current += 1;
    else current = 1;
    best = Math.max(best, current);
  }
  return best;
}

export function pointBreakdown(logs, today = todayISO()) {
  const bodyParts = parts.filter(part => part !== "全身");
  const week = weekDates(today);
  const weekDone = week.filter(date => logs.some(log => log.date === date));
  const partIntervals = bodyParts.flatMap(part => {
    const dates = trainingDatesForPart(logs, part).filter(date => date <= today);
    return dates.slice(1).map((date,index) => ({ part, interval:dateDiffDays(date, dates[index]) }));
  });
  const bestIntervals = partIntervals.filter(item => item.interval === 2);
  const okIntervals = partIntervals.filter(item => item.interval === 3);
  const tooShortIntervals = partIntervals.filter(item => item.interval === 1);
  const staleParts = bodyParts.filter(part => {
    const dates = trainingDatesForPart(logs, part).filter(date => date <= today);
    if (!dates.length) return false;
    return dateDiffDays(today, dates.at(-1)) >= 4;
  });
  const weekPartsByDay = week.map(date => logs.filter(log => log.date === date).map(log => log.part).filter(part => part !== "全身"));
  const everyDayDone = weekPartsByDay.every(day => day.length > 0);
  const noSamePartNextDay = weekPartsByDay.slice(1).every((day,index) => {
    const prev = weekPartsByDay[index];
    return day.every(part => !prev.includes(part));
  });
  const sevenDayRhythm = everyDayDone && noSamePartNextDay;
  const base = logs.length * 6;
  const activeDayBonus = weekDone.length * 8;
  const intervalBonus = bestIntervals.length * 18 + okIntervals.length * 10;
  const varietyBonus = new Set(logs.map(log => log.part).filter(part => part !== "全身")).size * 10;
  const sevenDayBonus = sevenDayRhythm ? 120 : 0;
  const shortPenalty = tooShortIntervals.length * 8;
  const stalePenalty = staleParts.length * 15;
  const total = Math.max(0, base + activeDayBonus + intervalBonus + varietyBonus + sevenDayBonus - shortPenalty - stalePenalty);
  return {
    total,
    weekDone:weekDone.length,
    bestIntervalCount:bestIntervals.length,
    okIntervalCount:okIntervals.length,
    staleParts,
    sevenDayRhythm,
    streak:longestStreak(logs.map(log => log.date))
  };
}

export function levelFor(points) {
  let current = levels[0];
  levels.forEach(level => {
    if (points >= level.points) current = level;
  });
  return current;
}

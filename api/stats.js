// Отдаёт статистику для страницы /stats. Защищено паролем из переменной STATS_PASSWORD.
// GET /api/stats?days=7   (заголовок Authorization: Bearer <пароль>)

const crypto = require('crypto');
const { redis, hasRedis, day, sendJson, BUTTONS } = require('./_lib');

const MAX_DAYS = 90;

function passwordOk(req) {
  const expected = process.env.STATS_PASSWORD || '';
  const given = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return expected.length > 0 && crypto.timingSafeEqual(a, b);
}

// Список дат за последние N дней, от сегодняшней назад
function lastDays(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(day(new Date(Date.now() - i * 86400000)));
  return out;
}

// HGETALL через REST приходит плоским массивом [поле, значение, поле, значение...]
function toObject(flat) {
  const o = {};
  if (Array.isArray(flat)) for (let i = 0; i < flat.length; i += 2) o[flat[i]] = Number(flat[i + 1]) || 0;
  else if (flat && typeof flat === 'object') for (const k in flat) o[k] = Number(flat[k]) || 0;
  return o;
}

// { views: 0, vpn: 0, love: 0, site: 0 }
function emptyRow() {
  const row = { views: 0 };
  BUTTONS.forEach((b) => { row[b] = 0; });
  return row;
}

module.exports = async function handler(req, res) {
  if (!process.env.STATS_PASSWORD) {
    return sendJson(res, 503, { error: 'Не задан пароль: добавь переменную STATS_PASSWORD в Vercel и сделай Redeploy' });
  }
  if (!passwordOk(req)) return sendJson(res, 401, { error: 'Неверный пароль' });
  if (!hasRedis()) {
    return sendJson(res, 503, { error: 'Не подключена база: Vercel → Storage → Upstash Redis → Connect to project, затем Redeploy' });
  }

  const n = Math.min(MAX_DAYS, Math.max(1, parseInt(new URL(req.url, 'http://local').searchParams.get('days'), 10) || 7));
  const dates = lastDays(n);

  const commands = [];
  dates.forEach((d) => {
    commands.push(['HGETALL', 'stats:' + d]);
    commands.push(['PFCOUNT', 'uv:' + d]);
  });
  // Уникальные за весь период: PFCOUNT по нескольким ключам считает объединение
  commands.push(['PFCOUNT'].concat(dates.map((d) => 'uv:' + d)));
  BUTTONS.forEach((b) => commands.push(['PFCOUNT'].concat(dates.map((d) => 'uc:' + b + ':' + d))));

  let results;
  try {
    results = await redis(commands);
  } catch (e) {
    return sendJson(res, 502, { error: 'Ошибка базы: ' + e.message });
  }

  const days = [];
  const countries = {};
  const totals = emptyRow();

  dates.forEach((d, i) => {
    const counters = toObject(results[i * 2]);
    const row = Object.assign({ date: d, unique: Number(results[i * 2 + 1]) || 0 }, emptyRow());
    for (const field in counters) {
      const parts = field.split('|');
      const value = counters[field];
      let metric, c;
      if (parts[0] === 'v') { metric = 'views'; c = parts[1]; }
      else if (parts[0] === 'c' && BUTTONS.includes(parts[1])) { metric = parts[1]; c = parts[2]; }
      else continue;
      row[metric] += value;
      totals[metric] += value;
      countries[c] = countries[c] || emptyRow();
      countries[c][metric] += value;
    }
    days.push(row);
  });

  const tail = results.slice(dates.length * 2);
  totals.unique = Number(tail[0]) || 0;
  // Уникальные кликнувшие по каждой кнопке: { vpn: 3, love: 1, site: 2 }
  totals.uniqueClicks = {};
  BUTTONS.forEach((b, i) => { totals.uniqueClicks[b] = Number(tail[i + 1]) || 0; });

  sendJson(res, 200, { days: n, from: dates[dates.length - 1], to: dates[0], buttons: BUTTONS, totals, countries, byDay: days });
};

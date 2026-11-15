// Отдаёт ссылку на сайт в зависимости от страны посетителя.
// Страну определяет Vercel по IP и кладёт в заголовок x-vercel-ip-country.
// Ссылки нет в HTML: её получают только посетители из стран ниже, остальные не видят кнопку вовсе.

// Код страны (ISO, две буквы) → ссылка. Чтобы добавить страну, допиши строку.
const SITE_BY_COUNTRY = {
  BY: 'https://lksi.pro/461612', // Беларусь
  RU: 'https://lkdq.cc/e39c',    // Россия
  UA: 'https://lkan.pro/c010c1', // Украина
  UZ: 'https://lkmv.cc/c5208044', // Узбекистан
};

module.exports = function handler(req, res) {
  const country = String(req.headers['x-vercel-ip-country'] || '').toUpperCase();
  const site = SITE_BY_COUNTRY[country];

  // Ответ зависит от IP, поэтому его нельзя кэшировать ни в CDN, ни в браузере
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = 200;
  res.end(JSON.stringify(site ? { site } : {}));
};

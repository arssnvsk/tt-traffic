// Отдаёт ссылку на сайт в зависимости от страны посетителя.
// Страну определяет Vercel по IP и кладёт в заголовок x-vercel-ip-country.
// Ссылки нет в HTML: её получают только посетители из стран ниже, остальные не видят кнопку вовсе.
// Страница вызывает этот адрес при каждом открытии, поэтому тут же считаем заход.

const { country, track, sendJson } = require('./_lib');

// Код страны (ISO, две буквы) → ссылка. Чтобы добавить страну, допиши строку.
const SITE_BY_COUNTRY = {
  BY: 'https://lksi.pro/461612', // Беларусь
  RU: 'https://lkdq.cc/e39c',    // Россия
  UA: 'https://lkan.pro/c010c1', // Украина
  UZ: 'https://lkmv.cc/c5208044', // Узбекистан
};

module.exports = async function handler(req, res) {
  const site = SITE_BY_COUNTRY[country(req)];
  await track(req, null);
  // Ответ зависит от IP, поэтому sendJson запрещает кэширование
  sendJson(res, 200, site ? { site } : {});
};

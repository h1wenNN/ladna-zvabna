/* ==========================================================================
   Спільний запуск браузера для всіх перевірок.

   Шлях до playwright і до самого Chromium відрізняється на різних машинах,
   тому шукаємо по черзі, а не прибиваємо цвяхом. Якщо нічого не знайдено —
   кажемо людині, що робити, а не падаємо зі стеком.
   ========================================================================== */
const fs = require('fs');
const path = require('path');

function loadPlaywright() {
  const tries = [
    'playwright',
    path.join(__dirname, '..', '..', 'node_modules', 'playwright'),
    path.join(__dirname, '..', '..', '..', 'node_modules', 'playwright'),
    '/home/claude/lz/node_modules/playwright',
  ];
  for (const t of tries) { try { return require(t); } catch (e) {} }
  console.error('Не знайшов playwright. Встановіть його:  npm i -D playwright');
  process.exit(2);
}

function chromiumPath() {
  if (process.env.PW_CHROMIUM && fs.existsSync(process.env.PW_CHROMIUM)) return process.env.PW_CHROMIUM;
  if (fs.existsSync('/opt/pw-browsers/chromium')) return '/opt/pw-browsers/chromium';
  return undefined;   // хай playwright бере свій завантажений браузер
}

const { chromium } = loadPlaywright();

module.exports = {
  chromium,
  /* Однаковий запуск для всіх перевірок. */
  launch: (opts) => chromium.launch(Object.assign({ executablePath: chromiumPath() }, opts || {})),
  URL: process.env.LZ_URL || 'http://localhost:8899/index.html',
};

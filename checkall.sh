#!/bin/bash
# ==========================================================================
# ЛАДНА-ЗВАБНА · повна перевірка сайту
#
# Запускати після БУДЬ-ЯКОЇ правки:   bash checkall.sh
#
# Кожен скрипт друкує підсумковий рядок «ПРОБЛЕМ: N» / «РАЗОМ: N».
# Скрипти живуть у _dev/checks/ — у папку хостингу вони не потрапляють.
#
#   layoutcheck   накладання, обрізаний текст, вихід за вікно, зони дотику
#                 на 16 ширинах від 320 до 2560
#   statecheck    те саме у СТАНАХ: меню відкрите, квіз розкритий,
#                 повзунок у крайніх положеннях, шрифт +30%,
#                 короткі екрани (телефон у горизонталі)
#   revealcheck   чи не лишається щось невидимим після різких переходів
#   qualitycheck  розмітка, посилання, доступність, фокус, без JS, reduced-motion
#   menucheck     мобільне меню: закриття, Esc, фокус-трап, перехід за пунктом
#   mediacheck    відео, повзунок «до/після», вхід за адресою з якорем
#   hitcheck      реальні зони натискання пальцем
#   bandcheck     розтушовані краї темних сцен не накривають текст
#   typocheck     висячі короткі слова в кінці рядків
#   fullcheck     контраст КОЖНОГО тексту, зокрема поверх кадрів — по пікселях
#   audit         без JS · reduced-motion · 3G · тільки клавіатура
# ==========================================================================
cd "$(dirname "$0")"
D=_dev/checks
pgrep -f "http.server 8899" >/dev/null || { nohup python3 -m http.server 8899 >/dev/null 2>&1 & sleep 2; }
pgrep -f gzsrv >/dev/null || { (cd "$D" && nohup python3 gzsrv.py >/dev/null 2>&1 &) ; sleep 2; }   # 8901: gzip і кеш
bash build.sh
FAIL=0
for f in layoutcheck statecheck revealcheck qualitycheck menucheck mediacheck hitcheck bandcheck typocheck fullcheck; do
  printf '\n══════ %s\n' "$f"
  out=$(node "$D/$f.js" 2>&1)
  echo "$out" | tail -8
  n=$(echo "$out" | grep -oE '(ПРОБЛЕМ|РАЗОМ|невидимих блоків усього|усього): *[0-9]+' | grep -oE '[0-9]+$' | tail -1)
  if [ "${n:-x}" = "x" ]; then echo "  ⚠ скрипт не дав підсумку"; FAIL=$((FAIL+1));
  elif [ "$n" != "0" ]; then FAIL=$((FAIL+1)); fi
done
printf '\n══════ audit (без JS · reduced · 3G · клавіатура)\n'
node "$D/audit.js" 2>&1 | tail -14
printf '\n─────────────────────────────────\nскриптів із проблемами: %s\n' "$FAIL"

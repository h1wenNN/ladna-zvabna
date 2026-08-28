#!/bin/bash
# ==========================================================================
# ЛАДНА-ЗВАБНА · збірка продакшн-файлів
#
# Джерела в assets/css/*.css та assets/js/*.js лишаються читабельними,
# з коментарями — саме їх правлять. Цей скрипт склеює й стискає їх
# у site.min.css та site.min.js, на які й посилається index.html.
#
# ЗАПУСКАТИ ПІСЛЯ БУДЬ-ЯКОЇ ПРАВКИ CSS АБО JS:
#     bash build.sh
#
# Ціни й тексти живуть в index.html — його правки збірки не потребують.
# ==========================================================================
set -e
R="$(cd "$(dirname "$0")" && pwd)"
NB="$R/../node_modules/.bin"
[ -x "$NB/cleancss" ] || NB="$(npm root -g)/../bin"

cat "$R/assets/css/base.css" "$R/assets/css/layout.css" \
    "$R/assets/css/components.css" "$R/assets/css/motion.css" \
  | npx cleancss -O2 --format keep-breaks:off -o "$R/assets/css/site.min.css"

npx terser "$R/assets/js/main.js" "$R/assets/js/ui.js" "$R/assets/js/media.js" \
  --compress --mangle --toplevel -o "$R/assets/js/site.min.js"

printf "site.min.css  %6d B  (gzip %5d B)\n" \
  "$(stat -c%s "$R/assets/css/site.min.css")" \
  "$(gzip -c9 "$R/assets/css/site.min.css" | wc -c)"
printf "site.min.js   %6d B  (gzip %5d B)\n" \
  "$(stat -c%s "$R/assets/js/site.min.js")" \
  "$(gzip -c9 "$R/assets/js/site.min.js" | wc -c)"

@echo off
chcp 65001 >nul
title Ладна-Звабна — локальний перегляд
cd /d "%~dp0"

echo.
echo   ЛАДНА-ЗВАБНА — локальний перегляд
echo   ---------------------------------
echo.

set PORT=8080
set SRV=

where py >/dev/null 2>/dev/null && set "SRV=py -3 -m http.server %PORT%"
if not defined SRV where python >/dev/null 2>/dev/null && set "SRV=python -m http.server %PORT%"
if not defined SRV where npx >/dev/null 2>/dev/null && set "SRV=npx --yes serve -l %PORT% ."

if not defined SRV goto NOSERVER

echo   Сервер запускається на http://localhost:%PORT%
echo   Браузер відкриється сам за пару секунд.
echo.
echo   Щоб зупинити — закрийте це вікно або натисніть Ctrl+C
echo.

start "" /b cmd /c "timeout /t 2 >/dev/null && start http://localhost:%PORT%/index.html"
%SRV%
goto END

:NOSERVER
echo   Не знайдено ні Python, ні Node.js.
echo.
echo   Варіант 1: встановіть Python з https://python.org
echo              (при встановленні позначте "Add Python to PATH")
echo   Варіант 2: просто відкрийте index.html подвійним кліком —
echo              сайт працює і так, лише в консолі браузера
echo              буде кілька попереджень про шрифти.
echo.
pause

:END

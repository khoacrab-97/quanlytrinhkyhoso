@echo off
rem Run the app (called by Task Scheduler "QLTK - Ung dung" at startup).
rem   %1 = port, %2 = full path of node.exe
setlocal
cd /d "%~dp0..\.."
if not exist logs mkdir logs
echo [%date% %time%] Start app on port %1 >> logs\app.log
"%~2" "%CD%\node_modules\next\dist\bin\next" start -p %1 >> logs\app.log 2>&1

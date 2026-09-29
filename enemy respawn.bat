@echo off
cd /d "%~dp0"

echo Updating enemies...
python update_enemies.py
if errorlevel 1 goto error

echo Updating players...
python update_players.py
if errorlevel 1 goto error

echo Opening site...
start "" "%~dp0index.html"

exit /b 0

:error
echo.
echo ERROR: update failed.
pause
exit /b 1
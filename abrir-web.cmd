@echo off
powershell.exe -NoProfile -File "%~dp0iniciar-web.ps1"
if errorlevel 1 pause

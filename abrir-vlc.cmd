@echo off
cd /d "%~dp0"
node cli.mjs %*
if errorlevel 1 pause

@echo off
setlocal
title Summer '94
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-experience.ps1"
if errorlevel 1 pause
endlocal

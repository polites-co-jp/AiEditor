@echo off
rem Stand-in "editor" for trial runs of scripts\measure.ps1 and scripts\netaudit.ps1.
rem Use with -ProcessName cmd.exe -SkipTaskCheck. It ignores its arguments, except that a
rem second call with -r (the "open files" step) exits at once, like a real CLI hand-off.
if "%~5"=="-r" exit /b 0
ping -n 300 127.0.0.1 >nul

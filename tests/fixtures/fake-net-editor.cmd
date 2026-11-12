@echo off
rem Stand-in "editor" that holds one TCP connection to example.com:443 for 40 s.
rem Trial of scripts\netaudit.ps1: use with -ProcessName powershell.exe.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0fake-net-editor.ps1" %*

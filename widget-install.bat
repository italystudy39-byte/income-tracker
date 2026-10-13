@echo off
rem Road to 120M: creates a desktop shortcut and an autostart shortcut for the widget, then opens it.
set "TARGET=%~dp0widget-start.bat"
set "ICONDIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s = New-Object -ComObject WScript.Shell;" ^
  "foreach ($dir in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Startup'))) {" ^
  "  $l = $s.CreateShortcut((Join-Path $dir 'Road to 120M.lnk'));" ^
  "  $l.TargetPath = $env:TARGET; $l.WorkingDirectory = $env:ICONDIR; $l.WindowStyle = 7;" ^
  "  $l.IconLocation = '%SystemRoot%\System32\imageres.dll,109'; $l.Save() }"
call "%TARGET%"
echo.
echo Done: "Road to 120M" shortcut is on your desktop and the widget will open at Windows startup.
echo To disable autostart, delete "Road to 120M" from shell:startup.
timeout /t 6 >nul

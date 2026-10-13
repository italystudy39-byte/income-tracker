@echo off
rem Road to 120M: opens widget.html as a small app window (Chrome, otherwise Edge).
set "W=%~dp0widget.html"
set "URL=file:///%W:\=/%"
set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if defined CHROME (
  start "" "%CHROME%" --app="%URL%" --window-size=360,240 --window-position=20,20
) else (
  start "" msedge --app="%URL%" --window-size=360,240 --window-position=20,20
)

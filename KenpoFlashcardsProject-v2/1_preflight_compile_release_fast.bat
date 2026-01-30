@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "PROJ_DIR=%~dp0"
if "%PROJ_DIR:~-1%"=="\" set "PROJ_DIR=%PROJ_DIR:~0,-1%"

if not exist "%PROJ_DIR%\gradlew.bat" (
  echo [ERROR] gradlew.bat not found. Put this BAT in the project root.
  exit /b 1
)

set "LOG_DIR=%PROJ_DIR%\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TS=%%i"
set "LOG=%LOG_DIR%\compile_release_fast_%TS%.log"

call :banner "Compile Release Kotlin (FAST)"
call :progress 10 "gradlew --version"
call :run ".\gradlew.bat --version" || goto :fail

call :progress 35 "compileReleaseKotlin"
call :run ".\gradlew.bat :app:compileReleaseKotlin --stacktrace" || goto :fail

call :progress 100 "DONE"
echo ✅ Success
echo Log: "%LOG%"
exit /b 0

:fail
call :progress 100 "FAILED"
echo ❌ Failed
echo Log: "%LOG%"
echo.
echo ---- Last 120 lines ----
powershell -NoProfile -Command "Get-Content -LiteralPath '%LOG%' -Tail 120"
exit /b 1

:banner
set "TITLE=%~1"
> "%LOG%" echo ============================================================
>>"%LOG%" echo %TITLE%
>>"%LOG%" echo Started: %DATE% %TIME%
>>"%LOG%" echo Folder : %PROJ_DIR%
>>"%LOG%" echo Log    : %LOG%
>>"%LOG%" echo ============================================================
cls
echo ============================================================
echo %TITLE%
echo Log: "%LOG%"
echo ============================================================
echo.
exit /b 0

:run
set "CMD=%~1"
>>"%LOG%" echo.
>>"%LOG%" echo ------------------------------------------------------------
>>"%LOG%" echo [%DATE% %TIME%] CMD: %CMD%
>>"%LOG%" echo ------------------------------------------------------------
pushd "%PROJ_DIR%" >nul
cmd /c "%CMD%" >> "%LOG%" 2>&1
set "RC=%ERRORLEVEL%"
popd >nul
>>"%LOG%" echo [ExitCode=%RC%]
exit /b %RC%

:progress
set /a PCT=%~1
set "MSG=%~2"
set /a FILLED=PCT/3
set "BAR="
for /l %%i in (1,1,33) do (
  if %%i LEQ !FILLED! (set "BAR=!BAR!#") else (set "BAR=!BAR!-")
)
echo [!BAR!] !PCT!%% - !MSG!
>>"%LOG%" echo [PROGRESS] !PCT!%% - !MSG!
exit /b 0

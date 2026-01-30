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
set "LOG=%LOG_DIR%\final_release_build_%TS%.log"

set "OUT_DIR=%PROJ_DIR%\output\release"
if not exist "%OUT_DIR%" mkdir "%OUT_DIR%" >nul 2>&1

call :banner "FINAL Release Build (APK + AAB)"
call :progress 10 "gradlew --version"
call :run ".\gradlew.bat --version" || goto :fail

call :progress 25 "clean"
call :run ".\gradlew.bat clean" || goto :fail

call :progress 45 "compileReleaseKotlin"
call :run ".\gradlew.bat :app:compileReleaseKotlin --stacktrace" || goto :fail

call :progress 70 "assembleRelease (APK)"
call :run ".\gradlew.bat :app:assembleRelease --stacktrace" || goto :fail

call :progress 82 "bundleRelease (AAB)"
call :run ".\gradlew.bat :app:bundleRelease --stacktrace" || goto :fail

call :progress 90 "copy outputs to .\output\release"
call :copy_outputs || goto :fail

call :progress 100 "DONE"
echo ✅ Final build complete
echo Output folder: "%OUT_DIR%"
echo Log: "%LOG%"
exit /b 0

:fail
call :progress 100 "FAILED"
echo ❌ Final build failed
echo Log: "%LOG%"
echo.
echo ---- Last 120 lines ----
powershell -NoProfile -Command "Get-Content -LiteralPath '%LOG%' -Tail 120"
exit /b 1

:copy_outputs
set "APK_DIR=%PROJ_DIR%\app\build\outputs\apk\release"
set "AAB_DIR=%PROJ_DIR%\app\build\outputs\bundle\release"

>>"%LOG%" echo.
>>"%LOG%" echo ------------------------------------------------------------
>>"%LOG%" echo [%DATE% %TIME%] Copy outputs
>>"%LOG%" echo ------------------------------------------------------------

if exist "%APK_DIR%" (
  for %%F in ("%APK_DIR%\*.apk") do (
    copy /y "%%~fF" "%OUT_DIR%\%%~nxF" >>"%LOG%" 2>&1
  )
)

if exist "%AAB_DIR%" (
  for %%F in ("%AAB_DIR%\*.aab") do (
    copy /y "%%~fF" "%OUT_DIR%\%%~nxF" >>"%LOG%" 2>&1
  )
)

rem List what we copied
dir "%OUT_DIR%" >>"%LOG%" 2>&1
exit /b 0

:banner
set "TITLE=%~1"
> "%LOG%" echo ============================================================
>>"%LOG%" echo %TITLE%
>>"%LOG%" echo Started: %DATE% %TIME%
>>"%LOG%" echo Folder : %PROJ_DIR%
>>"%LOG%" echo Output : %OUT_DIR%
>>"%LOG%" echo Log    : %LOG%
>>"%LOG%" echo ============================================================
cls
echo ============================================================
echo %TITLE%
echo Output: "%OUT_DIR%"
echo Log   : "%LOG%"
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

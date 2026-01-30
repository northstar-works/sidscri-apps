@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ============================================================
rem preflight_android_release.bat
rem - Runs a clean, reproducible "GitHub-like" preflight locally
rem - Shows clean progress to console
rem - Writes full logs to .\logs\preflight_release_YYYYMMDD_HHMMSS.log
rem - Detects missing Gradle Wrapper JAR (common cause of GradleWrapperMain error)
rem ============================================================

set "PROJ_DIR=%~dp0"
if "%PROJ_DIR:~-1%"=="\" set "PROJ_DIR=%PROJ_DIR:~0,-1%"

set "LOG_DIR=%PROJ_DIR%\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TS=%%i"
if not defined TS set "TS=%date:~-4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "TS=%TS: =0%"

set "MASTER_LOG=%LOG_DIR%\preflight_release_%TS%.log"

call :log "============================================================"
call :log "Preflight Release Build"
call :log "Started: %date% %time%"
call :log "Folder : %PROJ_DIR%"
call :log "Log    : %MASTER_LOG%"
call :log "============================================================"
echo.

call :progress 0  "Starting..."

rem ------------------------------------------------------------
rem STEP 0: Sanity checks
rem ------------------------------------------------------------
call :progress 5  "STEP 0/5: Sanity checks (gradlew, wrapper props)"
if not exist "%PROJ_DIR%\gradlew.bat" (
  call :log "[ERROR] gradlew.bat not found in: %PROJ_DIR%"
  call :console_fail "You're not in the project root (where gradlew.bat lives)."
  goto :fail
)

if not exist "%PROJ_DIR%\gradle\wrapper\gradle-wrapper.properties" (
  call :log "[ERROR] Missing gradle-wrapper.properties under gradle\wrapper"
  call :console_fail "gradle\wrapper\gradle-wrapper.properties is missing."
  goto :fail
)

call :log ""
call :log "------------------------------------------------------------"
call :log "[%date% %time%] Wrapper properties"
call :log "CMD: type gradle\wrapper\gradle-wrapper.properties"
call :log "------------------------------------------------------------"
type "%PROJ_DIR%\gradle\wrapper\gradle-wrapper.properties" >> "%MASTER_LOG%" 2>&1

call :progress 20 "STEP 1/5: Verify Gradle wrapper JAR exists"

rem ------------------------------------------------------------
rem STEP 1: Fix/verify gradle-wrapper.jar
rem ------------------------------------------------------------
set "WRAPPER_JAR=%PROJ_DIR%\gradle\wrapper\gradle-wrapper.jar"
if not exist "%WRAPPER_JAR%" (
  call :log ""
  call :log "[WARN] gradle-wrapper.jar is missing: %WRAPPER_JAR%"
  call :log "This causes: Could not find or load main class org.gradle.wrapper.GradleWrapperMain"

  call :progress 25 "Attempting to repair wrapper jar (download Gradle dist, extract wrapper jar)"

  call :repair_wrapper
  set "RC=%ERRORLEVEL%"
  if not "%RC%"=="0" (
    call :log "[ERROR] Wrapper repair failed (ExitCode=%RC%)."
    call :console_fail "Wrapper jar is missing and auto-repair failed. See log for details."
    goto :fail
  )
)

if not exist "%WRAPPER_JAR%" (
  call :log "[ERROR] gradle-wrapper.jar still missing after repair attempts."
  call :console_fail "gradle-wrapper.jar is still missing. See log for details."
  goto :fail
)

call :progress 35 "STEP 2/5: gradlew --version (confirm wrapper works)"
call :run ".\gradlew.bat --version"
if not "%ERRORLEVEL%"=="0" goto :fail

call :progress 50 "STEP 3/5: Clean"
call :run ".\gradlew.bat clean"
if not "%ERRORLEVEL%"=="0" goto :fail

call :progress 70 "STEP 4/5: Kotlin compile (Release) + stacktrace"
call :run ".\gradlew.bat :app:compileReleaseKotlin --stacktrace"
if not "%ERRORLEVEL%"=="0" goto :fail

call :progress 90 "STEP 5/5: Assemble Release (optional but useful)"
call :run ".\gradlew.bat :app:assembleRelease --stacktrace"
if not "%ERRORLEVEL%"=="0" goto :fail

call :progress 100 "ALL DONE"
call :log ""
call :log "PRECHECK SUCCESS: %date% %time%"
echo.
echo ✅ Preflight SUCCESS
echo Log: "%MASTER_LOG%"
exit /b 0

:fail
call :progress 100 "FAILED"
call :log ""
call :log "PRECHECK FAILED: %date% %time%"
echo.
echo ❌ Preflight FAILED
echo Log: "%MASTER_LOG%"
echo.
echo Showing last 80 lines of log to help you spot the first real error:
powershell -NoProfile -Command ^
  "$p='%MASTER_LOG%'; if(Test-Path $p){Get-Content -Path $p -Tail 80} else {Write-Host 'Log not found.'}" 
exit /b 1

rem ============================================================
rem Helpers
rem ============================================================
:run
set "CMD=%~1"
call :log ""
call :log "------------------------------------------------------------"
call :log "[%date% %time%] %CMD%"
call :log "------------------------------------------------------------"
pushd "%PROJ_DIR%" >nul
cmd /c %CMD% >> "%MASTER_LOG%" 2>&1
set "RC=%ERRORLEVEL%"
popd >nul
call :log "[ExitCode=%RC%]"
if not "%RC%"=="0" (
  echo    -> FAILED (see log)
) else (
  echo    -> OK
)
exit /b %RC%

:log
rem Write a line to master log; allow true blank lines.
if "%~1"=="" (
  >> "%MASTER_LOG%" echo(
) else (
  >> "%MASTER_LOG%" echo %~1
)
exit /b 0

:progress
set /a PCT=%~1
set "MSG=%~2"
set /a FILLED=PCT/3
set "BAR="
for /l %%i in (1,1,33) do (
  if %%i LEQ !FILLED! (set "BAR=!BAR!#") else set "BAR=!BAR!-"
)
echo [!BAR!] !PCT!%% - !MSG!
>> "%MASTER_LOG%" echo [PROGRESS] !PCT!%% - !MSG!
exit /b 0

:console_fail
echo    -> FAILED: %~1
exit /b 0

:repair_wrapper
rem Attempts to reconstruct gradle\wrapper\gradle-wrapper.jar using the distributionUrl in gradle-wrapper.properties.
rem This is best-effort. The REAL fix is to commit gradle-wrapper.jar into your repo.

set "PROPS=%PROJ_DIR%\gradle\wrapper\gradle-wrapper.properties"
set "DIST_URL="
for /f "usebackq tokens=1,* delims==" %%A in ("%PROPS%") do (
  if /I "%%A"=="distributionUrl" set "DIST_URL=%%B"
)

if not defined DIST_URL (
  call :log "[ERROR] Could not find distributionUrl in gradle-wrapper.properties"
  exit /b 2
)

rem Normalize: properties often contain escaped ':' like https\://...
set "DIST_URL=%DIST_URL:\=/%"
set "DIST_URL=%DIST_URL: =%"

call :log "distributionUrl=%DIST_URL%"

set "TMP_DIR=%TEMP%\gradle_wrapper_fix_%TS%"
if exist "%TMP_DIR%" rmdir /s /q "%TMP_DIR%" >nul 2>&1
mkdir "%TMP_DIR%" >nul 2>&1

set "ZIP=%TMP_DIR%\gradle.zip"
call :log "Downloading Gradle dist to: %ZIP%"

powershell -NoProfile -Command ^
  "$u='%DIST_URL%'; $o='%ZIP%'; try { (New-Object Net.WebClient).DownloadFile($u,$o); exit 0 } catch { Write-Host $_; exit 3 }" ^
  >> "%MASTER_LOG%" 2>&1

if not "%ERRORLEVEL%"=="0" (
  call :log "[ERROR] Failed to download Gradle distribution."
  exit /b 3
)

call :log "Extracting Gradle dist..."
powershell -NoProfile -Command ^
  "Expand-Archive -Path '%ZIP%' -DestinationPath '%TMP_DIR%' -Force" ^
  >> "%MASTER_LOG%" 2>&1

if not "%ERRORLEVEL%"=="0" (
  call :log "[ERROR] Failed to extract Gradle distribution zip."
  exit /b 4
)

rem Find a wrapper jar inside the extracted Gradle distribution
set "FOUND_WRAPPER_JAR="

for /f "delims=" %%F in ('powershell -NoProfile -Command ^
  "$root='%TMP_DIR%'; $candidates = Get-ChildItem -Path $root -Recurse -Filter 'gradle-wrapper-*.jar' -ErrorAction SilentlyContinue; ^
   if($candidates){ $candidates | Sort-Object FullName | ForEach-Object { $_.FullName } }"') do (
  if not defined FOUND_WRAPPER_JAR set "FOUND_WRAPPER_JAR=%%F"
)

if not defined FOUND_WRAPPER_JAR (
  call :log "[ERROR] Could not locate gradle-wrapper-*.jar inside extracted Gradle distribution."
  call :log "Tip: The safest fix is to restore/commit gradle\wrapper\gradle-wrapper.jar from a known-good Android Studio project."
  exit /b 5
)

call :log "Found candidate wrapper jar: %FOUND_WRAPPER_JAR%"
call :log "Copying to: %WRAPPER_JAR%"

copy /y "%FOUND_WRAPPER_JAR%" "%WRAPPER_JAR%" >> "%MASTER_LOG%" 2>&1
if not "%ERRORLEVEL%"=="0" (
  call :log "[ERROR] Failed to copy wrapper jar into gradle\wrapper."
  exit /b 6
)

rem Cleanup temp (optional)
rmdir /s /q "%TMP_DIR%" >> "%MASTER_LOG%" 2>&1

exit /b 0

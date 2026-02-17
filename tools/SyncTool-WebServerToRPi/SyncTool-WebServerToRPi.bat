@echo off
setlocal enabledelayedexpansion
REM ============================================================
REM SyncTool-WebServerToRPi.bat
REM Push WebServer code and/or data from Windows dev to RPi.
REM
REM Place in: sidscri-apps\tools\SyncTool-WebServerToRPi\
REM Expects:  sidscri-apps\KenpoFlashcardsWebServer\ to exist
REM
REM Usage:
REM   SyncTool-WebServerToRPi.bat [rpi-ip] [options]
REM   (Double-click with no args: prompts for IP interactively)
REM
REM Options:
REM   --code       Push code only (default)
REM   --data       Push data only
REM   --all        Push code + data
REM   --status     Show RPi service status (no push)
REM   --restart    Just restart RPi service
REM   --version    Show versions (local + RPi)
REM   --dry-run    Show what would be synced (no push)
REM   --save-ip    Save IP to rpi_config.txt for future runs
REM   --user <u>   RPi SSH user (default: pi)
REM   --port <p>   RPi SSH port (default: 22)
REM ============================================================

set "TOOL_VER=1.1.0"
set "TOOL_BUILD=2"

REM ── Resolve paths ──────────────────────────────────────────
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

REM Expect: sidscri-apps\tools\SyncTool-WebServerToRPi\
REM So monorepo root = ..\..
set "MONO_ROOT=%SCRIPT_DIR%\..\.."
pushd "%MONO_ROOT%" >nul
set "MONO_ROOT=%CD%"
popd >nul

set "WS_DIR=%MONO_ROOT%\KenpoFlashcardsWebServer"
set "CONFIG_FILE=%SCRIPT_DIR%\rpi_config.txt"

REM RPi defaults
set "RPI_IP="
set "RPI_HOST="
set "RPI_WEB_PORT=8009"
set "RPI_WEB_URL="
set "RPI_USER=pi"
set "RPI_PORT=22"
set "RPI_INSTALL=/opt/advanced-flashcards"
set "RPI_SERVICE=advanced-flashcards"

REM Mode flags
set "MODE=code"
set "DRY_RUN=0"
set "SAVE_IP=0"

REM ── Parse arguments ────────────────────────────────────────
:parse_args
if "%~1"=="" goto :args_done

REM First positional arg that doesn't start with - is the IP/hostname
if "%RPI_IP%"=="" (
    echo %~1 | findstr /r "^-" >nul 2>&1
    if !errorlevel!==1 (
        set "RPI_IP=%~1"
        shift
        goto :parse_args
    )
)

if /i "%~1"=="--code"    ( set "MODE=code"    & shift & goto :parse_args )
if /i "%~1"=="--data"    ( set "MODE=data"    & shift & goto :parse_args )
if /i "%~1"=="--all"     ( set "MODE=all"     & shift & goto :parse_args )
if /i "%~1"=="--status"  ( set "MODE=status"  & shift & goto :parse_args )
if /i "%~1"=="--restart" ( set "MODE=restart" & shift & goto :parse_args )
if /i "%~1"=="--version" ( set "MODE=version" & shift & goto :parse_args )
if /i "%~1"=="--dry-run" ( set "DRY_RUN=1"   & shift & goto :parse_args )
if /i "%~1"=="--save-ip" ( set "SAVE_IP=1"   & shift & goto :parse_args )
if /i "%~1"=="--user"    ( set "RPI_USER=%~2" & shift & shift & goto :parse_args )
if /i "%~1"=="--port"    ( set "RPI_PORT=%~2" & shift & shift & goto :parse_args )
if /i "%~1"=="--help" goto :show_help
if /i "%~1"=="-h"     goto :show_help

echo [WARN] Unknown option ignored: %~1
shift
goto :parse_args

:args_done

REM ── If no IP given: try saved config, then prompt ───────────
if "%RPI_IP%"=="" (
    if exist "%CONFIG_FILE%" (
        set /p RPI_IP=<"%CONFIG_FILE%"
        REM Strip any trailing CR/spaces
        for /f "tokens=* delims= " %%a in ("!RPI_IP!") do set "RPI_IP=%%a"
        if not "!RPI_IP!"=="" (
            echo.
            echo  [CONFIG] Using saved RPi IP: !RPI_IP!
        ) else (
            set "RPI_IP="
        )
    )
)

if "%RPI_IP%"=="" (
    echo.
    echo  ====================================================
    echo   SyncTool: WebServer to RPi  ^(v%TOOL_VER% build %TOOL_BUILD%^)
    echo  ====================================================
    echo.
    echo   No RPi IP address found.
    echo   Tip: run once with --save-ip to skip this prompt.
    echo.
    set /p RPI_IP="  Enter RPi IP address: "
    if "!RPI_IP!"=="" (
        echo.
        echo  [ERROR] No IP entered. Exiting.
        pause
        exit /b 1
    )
    echo.
    set /p SAVE_Q="  Save this IP for future runs? (y/N): "
    if /i "!SAVE_Q!"=="y" set "SAVE_IP=1"
    echo.
)

REM ── Normalize RPi host input (strip http://, :8009, /path) ──
call :normalize_rpi_input

REM ── Save IP if requested ───────────────────────────────────
if "%SAVE_IP%"=="1" (
    echo %RPI_HOST%>"%CONFIG_FILE%"
    echo  [CONFIG] Saved host '%RPI_HOST%' to %CONFIG_FILE%
    echo.
)

REM ── Validate source ────────────────────────────────────────
if not exist "%WS_DIR%\app.py" (
    echo.
    echo  [ERROR] KenpoFlashcardsWebServer not found at:
    echo    %WS_DIR%
    echo.
    echo  This tool expects the monorepo layout:
    echo    sidscri-apps\tools\SyncTool-WebServerToRPi\  ^(this bat^)
    echo    sidscri-apps\KenpoFlashcardsWebServer\       ^(source^)
    pause
    exit /b 1
)

REM ── Banner ─────────────────────────────────────────────────
echo.
echo  ====================================================
echo   SyncTool: WebServer to RPi  ^(v%TOOL_VER% build %TOOL_BUILD%^)
echo  ====================================================
echo.
echo   WebServer:  %WS_DIR%
echo   RPi target: %RPI_USER%@%RPI_HOST%:%RPI_INSTALL%
echo   Web UI:     %RPI_WEB_URL%
echo   Mode:       %MODE%
if "%DRY_RUN%"=="1" echo   ** DRY RUN - no changes will be made **
echo.

REM ── Dispatch ───────────────────────────────────────────────
if "%MODE%"=="status"  goto :do_status
if "%MODE%"=="restart" goto :do_restart
if "%MODE%"=="version" goto :do_version
if "%MODE%"=="code"    goto :do_code
if "%MODE%"=="data"    goto :do_data
if "%MODE%"=="all"     goto :do_all
goto :show_help

REM ════════════════════════════════════════════════════════════
REM  STATUS
REM ════════════════════════════════════════════════════════════
:do_status
echo  [INFO] Checking RPi service status...
echo.
ssh -p %RPI_PORT% "%RPI_USER%@%RPI_HOST%" "systemctl status %RPI_SERVICE% --no-pager -l 2>/dev/null; echo; echo '--- Version ---'; cat %RPI_INSTALL%/version.json 2>/dev/null || echo 'version.json not found'; echo; echo '--- Data size ---'; du -sh %RPI_INSTALL%/data 2>/dev/null || echo 'data dir not found'; echo '--- Uptime ---'; uptime"
echo.
goto :done

REM ════════════════════════════════════════════════════════════
REM  RESTART
REM ════════════════════════════════════════════════════════════
:do_restart
echo  [INFO] Restarting RPi service...
ssh -p %RPI_PORT% "%RPI_USER%@%RPI_HOST%" "sudo systemctl restart %RPI_SERVICE% && sleep 2; systemctl is-active %RPI_SERVICE% && echo [OK] Service running || echo [FAIL] Service not running"
goto :done

REM ════════════════════════════════════════════════════════════
REM  VERSION
REM ════════════════════════════════════════════════════════════
:do_version
echo  --- Local WebServer ---
if exist "%WS_DIR%\version.json" (
    type "%WS_DIR%\version.json"
) else (
    echo  version.json not found locally
)
echo.
echo  --- RPi WebServer ---
ssh -p %RPI_PORT% "%RPI_USER%@%RPI_HOST%" "cat %RPI_INSTALL%/version.json 2>/dev/null || echo 'Not found on RPi'"
echo.
echo  --- RPi Package ---
ssh -p %RPI_PORT% "%RPI_USER%@%RPI_HOST%" "cat %RPI_INSTALL%/repo/AdvancedFlashcardsWebServer_RPi/version.json 2>/dev/null || echo 'Not found on RPi'"
echo.
goto :done

REM ════════════════════════════════════════════════════════════
REM  PUSH CODE
REM ════════════════════════════════════════════════════════════
:do_code
echo  [INFO] Pushing WebServer CODE to RPi...
echo.

if "%DRY_RUN%"=="1" (
    echo  [DRY-RUN] Source:  %WS_DIR%\
    echo  [DRY-RUN] Target:  %RPI_USER%@%RPI_HOST%:%RPI_INSTALL%/
    echo  [DRY-RUN] Exclude: data\, logs\, .venv\, __pycache__\, *.bat, *.pyc, .env.rpi
    echo  [DRY-RUN] Service: stop ^> push ^> restart
    goto :done
)

echo  [1/4] Stopping RPi service...
ssh -p %RPI_PORT% "%RPI_USER%@%RPI_HOST%" "sudo systemctl stop %RPI_SERVICE% || true"

echo  [2/4] Staging code...
set "STAGE=%TEMP%\_synctool_rpi_stage_%RANDOM%"
if exist "%STAGE%" rmdir /s /q "%STAGE%"
mkdir "%STAGE%"

robocopy "%WS_DIR%" "%STAGE%" /E /R:1 /W:1 /NFL /NDL /NP /NJH /NJS ^
    /XD "data" "logs" ".venv" "__pycache__" ".git" /XF "*.bat" "*.pyc" ".env.rpi" >nul 2>&1

echo  [3/4] Uploading code to RPi...
scp -P %RPI_PORT% -r "%STAGE%\." "%RPI_USER%@%RPI_HOST%:%RPI_INSTALL%/"

if errorlevel 1 (
    echo.
    echo  [ERROR] Upload failed. Check SSH access:
    echo    ssh -p %RPI_PORT% "%RPI_USER%@%RPI_HOST%" "echo ok"
    rmdir /s /q "%STAGE%" >nul 2>&1
    goto :fail
)
rmdir /s /q "%STAGE%" >nul 2>&1

echo  [3b/4] Ensuring Python dependencies...
ssh -p %RPI_PORT% "%RPI_USER%@%RPI_HOST%" "cd %RPI_INSTALL% && if [ -f requirements.txt ] && [ -x %RPI_INSTALL%/.venv/bin/pip ]; then %RPI_INSTALL%/.venv/bin/pip install -r requirements.txt -q || %RPI_INSTALL%/.venv/bin/pip install -r requirements.txt; else echo [WARN] venv/pip not found at %RPI_INSTALL%/.venv ^(run setup_rpi.sh first^); fi"

echo  [4/4] Restarting RPi service...
ssh -p %RPI_PORT% "%RPI_USER%@%RPI_HOST%" "sudo systemctl start %RPI_SERVICE% && sleep 2; systemctl is-active %RPI_SERVICE% && echo [OK] Service running || echo [FAIL] Service not running"

echo.
echo  [DONE] Code pushed to RPi.
goto :done

REM ════════════════════════════════════════════════════════════
REM  PUSH DATA
REM ════════════════════════════════════════════════════════════
:do_data
echo  [INFO] Pushing WebServer DATA to RPi...
echo.

set "LOCAL_DATA=%WS_DIR%\data"
if not exist "%LOCAL_DATA%\" (
    echo  [ERROR] Local data dir not found: %LOCAL_DATA%
    goto :fail
)

set "FILE_COUNT=0"
for /r "%LOCAL_DATA%" %%f in (*) do set /a FILE_COUNT+=1
echo   Source:  %LOCAL_DATA%
echo   Target:  %RPI_USER%@%RPI_HOST%:%RPI_INSTALL%/data/
echo   Files:   %FILE_COUNT%
echo.

if "%DRY_RUN%"=="1" (
    echo  [DRY-RUN] Would push %FILE_COUNT% files to RPi data/
    echo  [DRY-RUN] RPi backup would be created first
    goto :done
)

set /p CONFIRM="  Push data to RPi? This OVERWRITES RPi data. (y/N): "
if /i not "%CONFIRM%"=="y" ( echo  Cancelled. & goto :done )

echo  [1/3] Stopping RPi service...
ssh -p %RPI_PORT% "%RPI_USER%@%RPI_HOST%" "sudo systemctl stop %RPI_SERVICE% || true"

echo  [2/3] Creating backup on RPi...
ssh -p %RPI_PORT% "%RPI_USER%@%RPI_HOST%" "mkdir -p %RPI_INSTALL%/backups && cd %RPI_INSTALL% && tar -czf backups/data_pre_sync_$(date +%%Y%%m%%d_%%H%%M%%S).tar.gz data/ 2>/dev/null; echo backup_done"

echo  [3/3] Uploading data...
scp -P %RPI_PORT% -r "%LOCAL_DATA%\." "%RPI_USER%@%RPI_HOST%:%RPI_INSTALL%/data/"

if errorlevel 1 (
    echo  [ERROR] Upload failed!
    ssh -p %RPI_PORT% "%RPI_USER%@%RPI_HOST%" "sudo systemctl start %RPI_SERVICE%"
    goto :fail
)

echo  [INFO] Restarting RPi service...
ssh -p %RPI_PORT% "%RPI_USER%@%RPI_HOST%" "sudo systemctl start %RPI_SERVICE% && sleep 2; systemctl is-active %RPI_SERVICE% && echo [OK] Service running || echo [FAIL] Service not running"

echo.
echo  [DONE] Data pushed to RPi.
goto :done

REM ════════════════════════════════════════════════════════════
REM  PUSH ALL
REM ════════════════════════════════════════════════════════════
:do_all
echo  [INFO] Pushing CODE + DATA to RPi...
echo.

if "%DRY_RUN%"=="1" (
    echo  [DRY-RUN] Would push code from: %WS_DIR%\
    echo  [DRY-RUN] Would push data from: %WS_DIR%\data\
    echo  [DRY-RUN] RPi backup would be created first
    goto :done
)

set /p CONFIRM="  Push CODE + DATA to RPi? This OVERWRITES RPi data. (y/N): "
if /i not "%CONFIRM%"=="y" ( echo  Cancelled. & goto :done )

echo  [1/6] Stopping RPi service...
ssh -p %RPI_PORT% "%RPI_USER%@%RPI_HOST%" "sudo systemctl stop %RPI_SERVICE% || true"

echo  [2/6] Creating backup on RPi...
ssh -p %RPI_PORT% "%RPI_USER%@%RPI_HOST%" "mkdir -p %RPI_INSTALL%/backups && cd %RPI_INSTALL% && tar -czf backups/data_pre_sync_$(date +%%Y%%m%%d_%%H%%M%%S).tar.gz data/ 2>/dev/null; echo backup_done"

echo  [3/6] Staging code...
set "STAGE=%TEMP%\_synctool_rpi_stage_%RANDOM%"
if exist "%STAGE%" rmdir /s /q "%STAGE%"
mkdir "%STAGE%"
robocopy "%WS_DIR%" "%STAGE%" /E /R:1 /W:1 /NFL /NDL /NP /NJH /NJS ^
    /XD "data" "logs" ".venv" "__pycache__" ".git" /XF "*.bat" "*.pyc" ".env.rpi" >nul 2>&1

echo  [4/6] Uploading code...
scp -P %RPI_PORT% -r "%STAGE%\." "%RPI_USER%@%RPI_HOST%:%RPI_INSTALL%/"
rmdir /s /q "%STAGE%" >nul 2>&1

echo  [4b/6] Ensuring Python dependencies...
ssh -p %RPI_PORT% "%RPI_USER%@%RPI_HOST%" "cd %RPI_INSTALL% && if [ -f requirements.txt ] && [ -x %RPI_INSTALL%/.venv/bin/pip ]; then %RPI_INSTALL%/.venv/bin/pip install -r requirements.txt -q || %RPI_INSTALL%/.venv/bin/pip install -r requirements.txt; else echo [WARN] venv/pip not found at %RPI_INSTALL%/.venv ^(run setup_rpi.sh first^); fi"

echo  [5/6] Uploading data...
scp -P %RPI_PORT% -r "%WS_DIR%\data\." "%RPI_USER%@%RPI_HOST%:%RPI_INSTALL%/data/"

if errorlevel 1 (
    echo  [ERROR] Upload failed!
    ssh -p %RPI_PORT% "%RPI_USER%@%RPI_HOST%" "sudo systemctl start %RPI_SERVICE%"
    goto :fail
)

echo  [6/6] Restarting RPi service...
ssh -p %RPI_PORT% "%RPI_USER%@%RPI_HOST%" "sudo systemctl start %RPI_SERVICE% && sleep 2; systemctl is-active %RPI_SERVICE% && echo [OK] Service running || echo [FAIL] Service not running"

echo.
echo  [DONE] Code + Data pushed to RPi.
goto :done

REM ════════════════════════════════════════════════════════════
REM  HELP
REM ════════════════════════════════════════════════════════════
:show_help
echo.
echo  SyncTool: WebServer to RPi  ^(v%TOOL_VER% build %TOOL_BUILD%^)
echo.
echo  Push WebServer code and/or data from your Windows dev
echo  machine to a Raspberry Pi running Advanced Flashcards.
echo.
echo  Usage:
echo    SyncTool-WebServerToRPi.bat [rpi-ip] [options]
echo.
echo    Double-click with no args: prompts for IP interactively.
echo    Run once with --save-ip to store IP in rpi_config.txt.
echo.
echo  Sync Modes (pick one):
echo    --code       Push code only (default)
echo    --data       Push data only (with confirmation)
echo    --all        Push code + data (with confirmation)
echo.
echo  Info Modes:
echo    --status     Show RPi service status
echo    --restart    Restart RPi service
echo    --version    Compare local vs RPi versions
echo.
echo  Options:
echo    --dry-run    Preview what would be synced
echo    --save-ip    Save IP to rpi_config.txt for future runs
echo    --user ^<u^>   RPi SSH user (default: pi)
echo    --port ^<p^>   RPi SSH port (default: 22)
echo    -h, --help   Show this help
echo.
echo  Examples:
echo    SyncTool-WebServerToRPi.bat                         (prompts^)
echo    SyncTool-WebServerToRPi.bat 192.168.1.50 --save-ip  (save IP^)
echo    SyncTool-WebServerToRPi.bat 192.168.1.50
echo    SyncTool-WebServerToRPi.bat 192.168.1.50 --all
echo    SyncTool-WebServerToRPi.bat 192.168.1.50 --data
echo    SyncTool-WebServerToRPi.bat 192.168.1.50 --status
echo    SyncTool-WebServerToRPi.bat 192.168.1.50 --version --user admin
echo    SyncTool-WebServerToRPi.bat 192.168.1.50 --code --dry-run
echo.
echo  Saved config:
echo    rpi_config.txt in same folder as this bat.
echo    Delete it to clear the saved IP.
echo.
echo  Prerequisites:
echo    - SSH enabled on the RPi (sudo raspi-config)
echo    - SSH key or password auth configured
echo    - scp available (built into Windows 10+)
echo.
pause
exit /b 0

:done
echo.
echo  RPi server: http://%RPI_IP%:8009
echo.
pause
exit /b 0

:fail
echo.
echo  [FAILED] See errors above.
pause
exit /b 1

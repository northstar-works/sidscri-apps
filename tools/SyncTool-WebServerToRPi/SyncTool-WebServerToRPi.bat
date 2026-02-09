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
REM   SyncTool-WebServerToRPi.bat <rpi-ip> [options]
REM
REM Options:
REM   --code       Push code only (default)
REM   --data       Push data only
REM   --all        Push code + data
REM   --status     Show RPi service status (no push)
REM   --restart    Just restart RPi service
REM   --version    Show versions (local + RPi)
REM   --dry-run    Show what would be synced (no push)
REM   --user <u>   RPi SSH user (default: pi)
REM   --port <p>   RPi SSH port (default: 22)
REM
REM Examples:
REM   SyncTool-WebServerToRPi.bat 192.168.1.50
REM   SyncTool-WebServerToRPi.bat 192.168.1.50 --all
REM   SyncTool-WebServerToRPi.bat 192.168.1.50 --data --user mypi
REM   SyncTool-WebServerToRPi.bat 192.168.1.50 --status
REM   SyncTool-WebServerToRPi.bat 192.168.1.50 --version
REM ============================================================

set "TOOL_VER=1.0.0"
set "TOOL_BUILD=1"

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
set "RPI_PROJ_DIR=%MONO_ROOT%\AdvancedFlashcardsWebServer_RPi"

REM RPi defaults
set "RPI_IP="
set "RPI_USER=pi"
set "RPI_PORT=22"
set "RPI_INSTALL=/opt/advanced-flashcards"
set "RPI_SERVICE=advanced-flashcards"

REM Mode flags
set "MODE=code"
set "DRY_RUN=0"

REM ── Parse arguments ────────────────────────────────────────
:parse_args
if "%~1"=="" goto :args_done

REM First positional arg = IP
if "%RPI_IP%"=="" (
    echo %~1 | findstr /r "^[0-9]" >nul 2>&1
    if !errorlevel!==0 (
        set "RPI_IP=%~1"
        shift
        goto :parse_args
    )
    REM Also accept hostname
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
if /i "%~1"=="--user"    ( set "RPI_USER=%~2" & shift & shift & goto :parse_args )
if /i "%~1"=="--port"    ( set "RPI_PORT=%~2" & shift & shift & goto :parse_args )
if /i "%~1"=="--help" goto :show_help
if /i "%~1"=="-h"     goto :show_help

echo [ERROR] Unknown option: %~1
goto :show_help

:args_done

REM ── Validate ───────────────────────────────────────────────
if "%RPI_IP%"=="" (
    echo.
    echo  [ERROR] Missing RPi IP address.
    goto :show_help
)

if not exist "%WS_DIR%\app.py" (
    echo [ERROR] KenpoFlashcardsWebServer not found at:
    echo   %WS_DIR%
    echo.
    echo  Make sure this tool is in: sidscri-apps\tools\SyncTool-WebServerToRPi\
    pause
    exit /b 1
)

REM ── Banner ─────────────────────────────────────────────────
echo.
echo  ====================================================
echo   SyncTool: WebServer to RPi  (v%TOOL_VER% build %TOOL_BUILD%)
echo  ====================================================
echo.
echo   WebServer:  %WS_DIR%
echo   RPi target: %RPI_USER%@%RPI_IP%:%RPI_INSTALL%
echo   Mode:       %MODE%
if "%DRY_RUN%"=="1" echo   ** DRY RUN — no changes will be made **
echo.

REM ── Dispatch by mode ───────────────────────────────────────
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
ssh -p %RPI_PORT% %RPI_USER%@%RPI_IP% "systemctl status %RPI_SERVICE% --no-pager -l 2>/dev/null; echo; echo '--- Version ---'; cat %RPI_INSTALL%/version.json 2>/dev/null || echo 'version.json not found'; echo; echo '--- Data ---'; du -sh %RPI_INSTALL%/data 2>/dev/null || echo 'data dir not found'; echo '--- Uptime ---'; uptime"
echo.
goto :done

REM ════════════════════════════════════════════════════════════
REM  RESTART
REM ════════════════════════════════════════════════════════════
:do_restart
echo  [INFO] Restarting RPi service...
ssh -p %RPI_PORT% %RPI_USER%@%RPI_IP% "sudo systemctl restart %RPI_SERVICE%; sleep 2; systemctl is-active %RPI_SERVICE% && echo '[OK] Service running' || echo '[FAIL] Service not running'"
goto :done

REM ════════════════════════════════════════════════════════════
REM  VERSION
REM ════════════════════════════════════════════════════════════
:do_version
echo  --- Local WebServer ---
if exist "%WS_DIR%\version.json" (
    type "%WS_DIR%\version.json"
) else (
    echo  version.json not found
)
echo.
echo  --- RPi WebServer ---
ssh -p %RPI_PORT% %RPI_USER%@%RPI_IP% "cat %RPI_INSTALL%/version.json 2>/dev/null || echo 'Not found'"
echo.
echo  --- RPi Package ---
ssh -p %RPI_PORT% %RPI_USER%@%RPI_IP% "cat %RPI_INSTALL%/repo/AdvancedFlashcardsWebServer_RPi/version.json 2>/dev/null || echo 'Not found'"
echo.
goto :done

REM ════════════════════════════════════════════════════════════
REM  PUSH CODE
REM ════════════════════════════════════════════════════════════
:do_code
echo  [INFO] Pushing WebServer CODE to RPi...
echo.

if "%DRY_RUN%"=="1" (
    echo  [DRY-RUN] Would sync: %WS_DIR%\ -^> %RPI_INSTALL%/
    echo  [DRY-RUN] Excludes: data/, logs/, .venv/, __pycache__/, .git, .bat files
    echo  [DRY-RUN] Would restart: %RPI_SERVICE%
    goto :done
)

REM Stop service before code push
echo  [1/4] Stopping RPi service...
ssh -p %RPI_PORT% %RPI_USER%@%RPI_IP% "sudo systemctl stop %RPI_SERVICE% 2>/dev/null; echo stopped"

REM Use scp to push code (exclude data/logs/.venv by creating a temp staging dir)
echo  [2/4] Staging code for transfer...
set "STAGE=%TEMP%\_synctool_rpi_stage"
if exist "%STAGE%" rmdir /s /q "%STAGE%"
mkdir "%STAGE%"

REM robocopy code excluding data/logs/venv/git/bat
robocopy "%WS_DIR%" "%STAGE%" /E /R:1 /W:1 /NFL /NDL /NP /NJH /NJS ^
    /XD "data" "logs" ".venv" "__pycache__" ".git" /XF "*.bat" "*.pyc" ".env.rpi" >nul 2>&1

echo  [3/4] Uploading code to RPi...
scp -P %RPI_PORT% -r "%STAGE%\*" %RPI_USER%@%RPI_IP%:%RPI_INSTALL%/

if errorlevel 1 (
    echo  [ERROR] scp failed! Check SSH connectivity.
    echo    Test: ssh -p %RPI_PORT% %RPI_USER%@%RPI_IP% "echo ok"
    rmdir /s /q "%STAGE%" >nul 2>&1
    goto :fail
)

rmdir /s /q "%STAGE%" >nul 2>&1

echo  [4/4] Restarting RPi service...
ssh -p %RPI_PORT% %RPI_USER%@%RPI_IP% "sudo systemctl start %RPI_SERVICE%; sleep 2; systemctl is-active %RPI_SERVICE% && echo '[OK] Service running' || echo '[FAIL] Service not running'"

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
echo   Source:     %LOCAL_DATA%
echo   Target:     %RPI_USER%@%RPI_IP%:%RPI_INSTALL%/data/
echo   Files:      %FILE_COUNT%
echo.

if "%DRY_RUN%"=="1" (
    echo  [DRY-RUN] Would push %FILE_COUNT% files to RPi data/
    goto :done
)

set /p CONFIRM="  Push data to RPi? (y/N): "
if /i not "%CONFIRM%"=="y" (
    echo  Cancelled.
    goto :done
)

echo  [1/3] Stopping RPi service...
ssh -p %RPI_PORT% %RPI_USER%@%RPI_IP% "sudo systemctl stop %RPI_SERVICE% 2>/dev/null; echo stopped"

echo  [2/3] Creating backup on RPi...
ssh -p %RPI_PORT% %RPI_USER%@%RPI_IP% "cd %RPI_INSTALL% && tar -czf backups/data_pre_sync_$(date +%%Y%%m%%d_%%H%%M%%S).tar.gz data/ 2>/dev/null; echo backup_done"

echo  [3/3] Uploading data...
scp -P %RPI_PORT% -r "%LOCAL_DATA%\*" %RPI_USER%@%RPI_IP%:%RPI_INSTALL%/data/

if errorlevel 1 (
    echo  [ERROR] scp failed!
    ssh -p %RPI_PORT% %RPI_USER%@%RPI_IP% "sudo systemctl start %RPI_SERVICE%"
    goto :fail
)

echo  [INFO] Restarting RPi service...
ssh -p %RPI_PORT% %RPI_USER%@%RPI_IP% "sudo systemctl start %RPI_SERVICE%; sleep 2; systemctl is-active %RPI_SERVICE% && echo '[OK] Service running' || echo '[FAIL] Service not running'"

echo.
echo  [DONE] Data pushed to RPi.
goto :done

REM ════════════════════════════════════════════════════════════
REM  PUSH ALL (code + data)
REM ════════════════════════════════════════════════════════════
:do_all
echo  [INFO] Pushing CODE + DATA to RPi...
echo.

if "%DRY_RUN%"=="1" (
    echo  [DRY-RUN] Would push code from: %WS_DIR%\
    echo  [DRY-RUN] Would push data from: %WS_DIR%\data\
    echo  [DRY-RUN] Target: %RPI_USER%@%RPI_IP%:%RPI_INSTALL%/
    goto :done
)

set /p CONFIRM="  Push CODE + DATA to RPi? This overwrites RPi data. (y/N): "
if /i not "%CONFIRM%"=="y" (
    echo  Cancelled.
    goto :done
)

echo  [1/6] Stopping RPi service...
ssh -p %RPI_PORT% %RPI_USER%@%RPI_IP% "sudo systemctl stop %RPI_SERVICE% 2>/dev/null; echo stopped"

echo  [2/6] Creating backup on RPi...
ssh -p %RPI_PORT% %RPI_USER%@%RPI_IP% "mkdir -p %RPI_INSTALL%/backups && cd %RPI_INSTALL% && tar -czf backups/data_pre_sync_$(date +%%Y%%m%%d_%%H%%M%%S).tar.gz data/ 2>/dev/null; echo backup_done"

REM Stage code (no data/logs/venv)
echo  [3/6] Staging code...
set "STAGE=%TEMP%\_synctool_rpi_stage"
if exist "%STAGE%" rmdir /s /q "%STAGE%"
mkdir "%STAGE%"

robocopy "%WS_DIR%" "%STAGE%" /E /R:1 /W:1 /NFL /NDL /NP /NJH /NJS ^
    /XD "data" "logs" ".venv" "__pycache__" ".git" /XF "*.bat" "*.pyc" ".env.rpi" >nul 2>&1

echo  [4/6] Uploading code...
scp -P %RPI_PORT% -r "%STAGE%\*" %RPI_USER%@%RPI_IP%:%RPI_INSTALL%/
rmdir /s /q "%STAGE%" >nul 2>&1

echo  [5/6] Uploading data...
scp -P %RPI_PORT% -r "%WS_DIR%\data\*" %RPI_USER%@%RPI_IP%:%RPI_INSTALL%/data/

if errorlevel 1 (
    echo  [ERROR] Data upload failed!
    ssh -p %RPI_PORT% %RPI_USER%@%RPI_IP% "sudo systemctl start %RPI_SERVICE%"
    goto :fail
)

echo  [6/6] Restarting RPi service...
ssh -p %RPI_PORT% %RPI_USER%@%RPI_IP% "sudo systemctl start %RPI_SERVICE%; sleep 2; systemctl is-active %RPI_SERVICE% && echo '[OK] Service running' || echo '[FAIL] Service not running'"

echo.
echo  [DONE] Code + Data pushed to RPi.
goto :done

REM ════════════════════════════════════════════════════════════
REM  HELP
REM ════════════════════════════════════════════════════════════
:show_help
echo.
echo  SyncTool: WebServer to RPi  (v%TOOL_VER% build %TOOL_BUILD%)
echo.
echo  Push WebServer code and/or data from your Windows dev
echo  machine to a Raspberry Pi running Advanced Flashcards.
echo.
echo  Usage:
echo    SyncTool-WebServerToRPi.bat ^<rpi-ip^> [options]
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
echo    --user ^<u^>   RPi SSH user (default: pi)
echo    --port ^<p^>   RPi SSH port (default: 22)
echo    -h, --help   Show this help
echo.
echo  Examples:
echo    SyncTool-WebServerToRPi.bat 192.168.1.50
echo    SyncTool-WebServerToRPi.bat 192.168.1.50 --all
echo    SyncTool-WebServerToRPi.bat 192.168.1.50 --data
echo    SyncTool-WebServerToRPi.bat 192.168.1.50 --status
echo    SyncTool-WebServerToRPi.bat 192.168.1.50 --version --user admin
echo    SyncTool-WebServerToRPi.bat 192.168.1.50 --code --dry-run
echo.
echo  Prerequisites:
echo    - SSH enabled on the RPi (sudo raspi-config)
echo    - SSH key or password auth configured
echo    - scp available (built into Windows 10+)
echo.
pause
exit /b 1

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

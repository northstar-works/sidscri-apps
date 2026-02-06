@echo off
REM ============================================================
REM  WebServer → Android Sync Tool  (FORCED SYNCED OUTPUT)
REM  - Always writes to:  <repo_root>\kenpoflashcardsproject-v2_synced\
REM  - Logs to:           <repo_root>\logs\Sync\WebServerToAndroid\
REM ============================================================
setlocal EnableExtensions EnableDelayedExpansion

REM Get the directory where this script is located (tool folder)
set "TOOLS_DIR=%~dp0"
set "TOOLS_DIR=%TOOLS_DIR:~0,-1%"

REM Defaults (repo-root sibling folders)
set "DEFAULT_WEBSERVER=%TOOLS_DIR%\..\..\KenpoFlashcardsWebServer"
set "DEFAULT_ANDROID=%TOOLS_DIR%\..\..\kenpoflashcardsproject-v2"

REM Check Python
where python >nul 2>&1
if %errorlevel% neq 0 (
  echo.
  echo ERROR: Python not found in PATH
  echo Please install Python 3.8+ and add it to PATH
  echo.
  goto :fail
)

REM Show help
if "%~1"=="--help" goto :show_help
if "%~1"=="-h" goto :show_help

REM Parse args
set "WEBSERVER_FOLDER="
set "ANDROID_FOLDER="
set "DRY_RUN="
set "LEVEL="

:parse_args
if "%~1"=="" goto :done_parsing

if /I "%~1"=="--dry-run" ( set "DRY_RUN=--dry-run" & shift & goto :parse_args )
if /I "%~1"=="-n"       ( set "DRY_RUN=--dry-run" & shift & goto :parse_args )

if /I "%~1"=="--level" (
  if "%~2"=="" goto :done_parsing
  set "LEVEL=--level %~2"
  shift & shift
  goto :parse_args
)
if /I "%~1"=="-l" (
  if "%~2"=="" goto :done_parsing
  set "LEVEL=--level %~2"
  shift & shift
  goto :parse_args
)

REM Ignore any output/inplace/synced args (we force synced)
if /I "%~1"=="--output" ( shift & shift & goto :parse_args )
if /I "%~1"=="--inplace" ( shift & goto :parse_args )
if /I "%~1"=="--synced"  ( shift & goto :parse_args )

if "%WEBSERVER_FOLDER%"=="" ( set "WEBSERVER_FOLDER=%~1" & shift & goto :parse_args )
if "%ANDROID_FOLDER%"==""   ( set "ANDROID_FOLDER=%~1"   & shift & goto :parse_args )

shift
goto :parse_args

:done_parsing

if "%WEBSERVER_FOLDER%"=="" set "WEBSERVER_FOLDER=%DEFAULT_WEBSERVER%"
if "%ANDROID_FOLDER%"==""   set "ANDROID_FOLDER=%DEFAULT_ANDROID%"

REM Validate folders exist (deeper validation is done inside Python, with auto-detect)
if not exist "%WEBSERVER_FOLDER%" (
  echo.
  echo ERROR: WebServer folder not found: %WEBSERVER_FOLDER%
  echo.
  goto :fail
)
if not exist "%ANDROID_FOLDER%" (
  echo.
  echo ERROR: Android folder not found: %ANDROID_FOLDER%
  echo.
  goto :fail
)

echo.
echo ============================================================
echo  Starting WebServer to Android Sync...
echo ============================================================
echo.
echo  Tool:      %TOOLS_DIR%
echo  WebServer: %WEBSERVER_FOLDER%
echo  Android:   %ANDROID_FOLDER%
echo  Output:    FORCED --output synced
echo.

python "%TOOLS_DIR%\sync_webserver_to_android.py" "%WEBSERVER_FOLDER%" "%ANDROID_FOLDER%" %DRY_RUN% %LEVEL% --output synced

if %errorlevel% neq 0 (
  echo.
  echo ============================================================
echo  Sync FAILED (exit code: %errorlevel%)
echo ============================================================
  echo.
  goto :fail
)

echo.
pause
exit /b 0

:fail
echo.
pause
exit /b 1

:show_help
echo.
echo ============================================================
echo  WebServer to Android Sync Tool (FORCED SYNCED OUTPUT)
echo ============================================================
echo.
echo Usage: sync_android.bat [webserver_folder] [android_folder] [options]
echo.
echo Options:
echo   --dry-run, -n       Preview changes without applying
echo   --level N, -l N     Upgrade level: 1=patch, 2=minor, 3=major
echo   --help, -h          Show this help
echo.
echo NOTE: Output is ALWAYS synced. Any --output/--inplace flags are ignored.
echo.
pause
exit /b 0

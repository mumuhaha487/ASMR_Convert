@echo off
echo ====================================================================
echo                GPT-SoVITS Web UI Launcher (Windows)
echo ====================================================================
echo.

REM Create required directories
if not exist uploads mkdir uploads
if not exist uploads\lrc mkdir uploads\lrc
if not exist uploads\ref_audio mkdir uploads\ref_audio
if not exist uploads\background_music mkdir uploads\background_music
if not exist wav_file mkdir wav_file
if not exist merged_audio mkdir merged_audio

REM Check if virtual environment exists
if not exist .venv (
    echo [INFO] Virtual environment not found. Creating now...
    python -m venv .venv
    echo [INFO] Installing required packages...
    .venv\Scripts\pip install -r requirements.txt
    echo [INFO] Setup complete!
    echo.
)

REM Launch GPT-SoVITS WebUI
echo [INFO] Starting GPT-SoVITS Web UI...
echo [INFO] When the server starts, access it at: http://127.0.0.1:5000
echo.
echo [TIP] Press Ctrl+C to stop the server
echo.

.venv\Scripts\python.exe app.py

REM Handle Python exit
echo.
echo [INFO] Server stopped
pause 
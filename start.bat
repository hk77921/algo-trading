@echo off
echo Starting Trading Dashboard Application...
echo.

REM Starting Backend (FastAPI) with auto-reload
cd backend
start "Backend" cmd /k "uvicorn main:app --reload --host 0.0.0.0 --port 8000"
cd ..

echo.
echo Starting Frontend (React)...
cd frontend
start "Frontend" cmd /k "npm start"
cd ..

echo.
echo Application starting...
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo.
echo Press any key to exit this window...
pause >nul

@echo off
cd /d "%~dp0"
if not exist "node_modules" npm install
start "" http://localhost:5173
npm run dev
pause

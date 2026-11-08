@echo off
title Actualizar y Ejecutar - Sorteo PS5 + Gaming Pro
color 0A
echo =====================================================================
echo    ACTUALIZANDO Y EJECUTANDO EN E:\Proyectos\PS5 SORTEO
echo =====================================================================
echo.

set "TARGET_DIR=E:\Proyectos\PS5 SORTEO"
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
cd /d "%TARGET_DIR%"

echo [1/4] Descargando la ultima version del codigo (conservando tus 4 PDFs)...
where git >nul 2>nul
if %ERRORLEVEL% equ 0 (
    git init
    git remote remove origin >nul 2>nul
    git remote add origin https://github.com/ignaperna/ps5-sorteo-platform.git
    git fetch --all
    git reset --hard origin/main
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://github.com/ignaperna/ps5-sorteo-platform/archive/refs/heads/main.zip' -OutFile 'update_pkg.zip'; Expand-Archive -Path 'update_pkg.zip' -DestinationPath 'temp_extract' -Force; Copy-Item -Path 'temp_extract\ps5-sorteo-platform-main\*' -Destination '.' -Recurse -Force; Remove-Item 'temp_extract', 'update_pkg.zip' -Recurse -Force"
)

if not exist ".env" (
    copy .env.example .env >nul
)

echo.
echo [2/4] Deteniendo contenedores anteriores...
docker compose down

echo.
echo [3/4] Reconstruyendo imagenes con el nuevo diseno Dark Gamer PS5...
docker compose build --no-cache frontend backend

echo.
echo [4/4] Iniciando contenedores en Docker Desktop...
docker compose up -d --force-recreate

echo.
echo =====================================================================
echo    ACTUALIZACION COMPLETA!
echo =====================================================================
echo  - Abre en tu navegador: http://localhost:3000 (Presiona Ctrl + F5)
echo  - API Backend Docs:     http://localhost:8000/docs
echo =====================================================================
start http://localhost:3000
pause

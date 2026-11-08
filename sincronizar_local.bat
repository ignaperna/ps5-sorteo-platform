@echo off
title Sincronizador Local Directo - PS5 Sorteo
color 0B
echo =====================================================================
echo    APLICANDO TODOS LOS CAMBIOS DIRECTAMENTE EN E:\Proyectos\PS5 SORTEO
echo =====================================================================
echo.

set "TARGET_DIR=E:\Proyectos\PS5 SORTEO"
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
cd /d "%TARGET_DIR%"

echo [1/3] Descargando y sobrescribiendo archivos de codigo con la version final...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ProgressPreference = 'SilentlyContinue'; " ^
    "Invoke-WebRequest -Uri 'https://github.com/ignaperna/ps5-sorteo-platform/archive/refs/heads/main.zip' -OutFile 'update_local.zip'; " ^
    "Expand-Archive -Path 'update_local.zip' -DestinationPath 'tmp_sync' -Force; " ^
    "Copy-Item -Path 'tmp_sync\ps5-sorteo-platform-main\*' -Destination '.' -Recurse -Force; " ^
    "Remove-Item 'tmp_sync', 'update_local.zip' -Recurse -Force"

if not exist ".env" (
    echo Creando archivo .env local...
    copy .env.example .env >nul
)

echo.
echo [2/3] Reiniciando y reconstruyendo contenedores en Docker Desktop...
docker compose down
docker compose build --no-cache
docker compose up -d --force-recreate

echo.
echo [3/3] Abriendo navegador...
timeout /t 3 >nul
start http://localhost:3000

echo.
echo =====================================================================
echo    CAMBIOS APLICADOS EXITOSAMENTE EN TU COMPUTADORA!
echo    - Frontend Dark Gamer: http://localhost:3000
echo    - Backend & Webhooks:  http://localhost:8000/docs
echo =====================================================================
pause

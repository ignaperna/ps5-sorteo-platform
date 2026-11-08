@echo off
REM Script de inicio rapido para Windows
echo ======================================================
echo Iniciando Plataforma Sorteo eBooks con Docker Compose
echo ======================================================

IF NOT EXIST .env (
    echo Creando archivo .env a partir de .env.example...
    copy .env.example .env
)

echo Construyendo e iniciando contenedores: PostgreSQL, FastAPI y Next.js...
docker compose up --build -d

echo.
echo ======================================================
echo Servicios iniciados con exito!
echo - Frontend Next.js:    http://localhost:3000
echo - Backend FastAPI:     http://localhost:8000
echo - Documentacion API:   http://localhost:8000/docs
echo - Base de datos:       localhost:5432
echo ======================================================
echo Para ver los logs: docker compose logs -f
pause

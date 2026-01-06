@echo off
REM ============================================================
REM Script de Backup Automático para Windows
REM Sistema: Mi Turno - Municipalidad de Coronel Dorrego
REM ============================================================

REM Configuración
set DB_USER=root
set DB_PASSWORD=TU_PASSWORD_AQUI
set DB_NAME=ProyectoTurnos
set BACKUP_DIR=C:\backups\mi_turno

REM Crear directorio de backup si no existe
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM Obtener fecha y hora en formato YYYYMMDD_HHMMSS
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set fecha=%datetime:~0,8%_%datetime:~8,6%

REM Nombre del archivo de backup
set BACKUP_FILE=%BACKUP_DIR%\backup_%DB_NAME%_%fecha%.sql

REM Ejecutar mysqldump
echo Creando backup: %BACKUP_FILE%
mysqldump -u %DB_USER% -p%DB_PASSWORD% %DB_NAME% > "%BACKUP_FILE%"

if %ERRORLEVEL% EQU 0 (
    echo Backup creado exitosamente: %BACKUP_FILE%
    
    REM Comprimir el backup (opcional, requiere 7-Zip o WinRAR)
    REM "C:\Program Files\7-Zip\7z.exe" a "%BACKUP_FILE%.zip" "%BACKUP_FILE%"
    REM del "%BACKUP_FILE%"
    
    REM Eliminar backups antiguos (mantener solo los últimos 30 días)
    forfiles /p "%BACKUP_DIR%" /m backup_*.sql /d -30 /c "cmd /c del @path"
) else (
    echo ERROR: No se pudo crear el backup
    exit /b 1
)


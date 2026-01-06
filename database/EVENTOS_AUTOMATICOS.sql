-- ============================================================
-- CONFIGURACIÓN DE EVENTOS AUTOMÁTICOS
-- Sistema: Mi Turno - Municipalidad de Coronel Dorrego
-- ============================================================
-- Este script activa el event scheduler y crea los eventos automáticos
-- para actualización de estados y backups

USE ProyectoTurnos;

-- ============================================================
-- 1. ACTIVAR EVENT SCHEDULER
-- ============================================================
SET GLOBAL event_scheduler = ON;

-- Verificar que se activó correctamente
SELECT @@event_scheduler AS EstadoEventScheduler;

-- ============================================================
-- 2. PROCEDIMIENTO PARA ACTUALIZAR ESTADOS DE TURNOS
-- ============================================================
DELIMITER $$

DROP PROCEDURE IF EXISTS ActualizarEstadosTurnos$$

CREATE PROCEDURE ActualizarEstadosTurnos()
BEGIN
    -- Actualizar turnos que ya pasaron su fecha y hora
    -- Solo actualizar turnos que estén en estado "Reservado"
    UPDATE turnos
    SET status = 'Pendiente de Confirmación'
    WHERE status = 'Reservado'
    AND start_datetime < NOW()
    AND DATE_ADD(start_datetime, INTERVAL 1 DAY) > NOW(); -- Solo turnos del día actual o anteriores recientes
    
    -- Marcar como "Pendiente de Confirmación" turnos de más de 1 día atrás
    -- que aún estén en "Reservado" (por si se saltó alguna ejecución)
    UPDATE turnos
    SET status = 'Pendiente de Confirmación'
    WHERE status = 'Reservado'
    AND start_datetime < DATE_SUB(NOW(), INTERVAL 1 DAY);
END$$

DELIMITER ;

-- ============================================================
-- 3. PROCEDIMIENTO PARA CREAR BACKUP
-- ============================================================
DELIMITER $$

DROP PROCEDURE IF EXISTS CrearBackupBaseDatos$$

CREATE PROCEDURE CrearBackupBaseDatos()
BEGIN
    DECLARE backup_path VARCHAR(255);
    DECLARE backup_file VARCHAR(255);
    DECLARE fecha_backup VARCHAR(20);
    
    -- Obtener la fecha actual en formato YYYYMMDD_HHMMSS
    SET fecha_backup = DATE_FORMAT(NOW(), '%Y%m%d_%H%M%S');
    
    -- Definir la ruta del backup (ajustar según tu configuración)
    -- En Windows, usar rutas como: 'C:/backups/'
    -- En Linux, usar rutas como: '/var/backups/mysql/'
    SET backup_path = 'C:/backups/mi_turno/';
    SET backup_file = CONCAT(backup_path, 'backup_ProyectoTurnos_', fecha_backup, '.sql');
    
    -- Crear el backup usando mysqldump (esto requiere permisos de sistema)
    -- Nota: Este comando debe ejecutarse desde el sistema operativo, no desde MySQL
    -- Por eso aquí solo registramos la intención en una tabla de logs
    
    -- Crear tabla de logs de backup si no existe
    CREATE TABLE IF NOT EXISTS backup_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fecha_backup DATETIME DEFAULT CURRENT_TIMESTAMP,
        archivo_backup VARCHAR(255),
        estado VARCHAR(50) DEFAULT 'Programado',
        mensaje TEXT,
        INDEX idx_fecha (fecha_backup)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    
    -- Registrar el intento de backup
    INSERT INTO backup_logs (fecha_backup, archivo_backup, estado, mensaje)
    VALUES (NOW(), backup_file, 'Programado', 
            CONCAT('Backup programado para: ', backup_file, 
                   '. Ejecutar manualmente: mysqldump -u root -p ProyectoTurnos > ', backup_file));
    
    -- Nota: Para automatizar completamente el backup, se recomienda usar:
    -- 1. Un script de shell (bash/batch) que llame a mysqldump
    -- 2. Un cron job o tarea programada del sistema operativo
    -- 3. O usar herramientas como MySQL Workbench, phpMyAdmin, etc.
    
END$$

DELIMITER ;

-- ============================================================
-- 4. EVENTO AUTOMÁTICO: ACTUALIZAR ESTADOS (cada hora)
-- ============================================================
DROP EVENT IF EXISTS evento_actualizar_estados_turnos;

CREATE EVENT evento_actualizar_estados_turnos
ON SCHEDULE EVERY 1 HOUR
STARTS CURRENT_TIMESTAMP
DO
    CALL ActualizarEstadosTurnos();

-- ============================================================
-- 5. EVENTO AUTOMÁTICO: BACKUP DIARIO (cada día a las 2:00 AM)
-- ============================================================
DROP EVENT IF EXISTS evento_backup_diario;

CREATE EVENT evento_backup_diario
ON SCHEDULE EVERY 1 DAY
STARTS DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '%Y-%m-%d 02:00:00')
DO
    CALL CrearBackupBaseDatos();

-- ============================================================
-- 6. VERIFICACIÓN DE EVENTOS CREADOS
-- ============================================================
SELECT 'Eventos creados exitosamente' AS Mensaje;
SELECT 'Event Scheduler activado' AS Estado;

-- Mostrar eventos creados
SELECT 
    EVENT_NAME AS NombreEvento,
    EVENT_DEFINITION AS Definicion,
    INTERVAL_VALUE AS IntervaloValor,
    INTERVAL_FIELD AS IntervaloCampo,
    STATUS AS Estado
FROM INFORMATION_SCHEMA.EVENTS
WHERE EVENT_SCHEMA = 'ProyectoTurnos'
ORDER BY EVENT_NAME;

-- ============================================================
-- NOTAS IMPORTANTES
-- ============================================================
-- 
-- 1. BACKUP AUTOMÁTICO:
--    El procedimiento CrearBackupBaseDatos() registra la intención de backup
--    pero NO ejecuta mysqldump directamente desde MySQL.
--    
--    Para automatizar completamente el backup, crear un script externo:
--    
--    Windows (backup.bat):
--    @echo off
--    set fecha=%date:~-4,4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2%%time:~6,2%
--    set fecha=%fecha: =0%
--    mysqldump -u root -pTU_PASSWORD ProyectoTurnos > C:\backups\mi_turno\backup_%fecha%.sql
--    
--    Linux (backup.sh):
--    #!/bin/bash
--    fecha=$(date +%Y%m%d_%H%M%S)
--    mysqldump -u root -pTU_PASSWORD ProyectoTurnos > /var/backups/mi_turno/backup_$fecha.sql
--    
--    Luego programar el script con:
--    - Windows: Tareas Programadas (Task Scheduler)
--    - Linux: crontab (ej: 0 2 * * * /ruta/backup.sh)
--
-- 2. VERIFICAR EVENTOS:
--    SELECT * FROM INFORMATION_SCHEMA.EVENTS WHERE EVENT_SCHEMA = 'ProyectoTurnos';
--
-- 3. DESACTIVAR EVENTOS (si es necesario):
--    ALTER EVENT evento_actualizar_estados_turnos DISABLE;
--    ALTER EVENT evento_backup_diario DISABLE;
--
-- 4. ELIMINAR EVENTOS:
--    DROP EVENT IF EXISTS evento_actualizar_estados_turnos;
--    DROP EVENT IF EXISTS evento_backup_diario;


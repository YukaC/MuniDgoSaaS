-- ============================================================
-- PROCEDIMIENTO PARA ACTUALIZAR ESTADOS DE TURNOS AUTOMÁTICAMENTE
-- ============================================================
-- Este procedimiento actualiza los turnos que ya pasaron su fecha
-- y los marca como "Pendiente de Confirmación" en lugar de "Completado"
-- para evitar confusiones

USE ProyectoTurnos;

DELIMITER $$

CREATE PROCEDURE IF NOT EXISTS ActualizarEstadosTurnos()
BEGIN
    -- Actualizar turnos que ya pasaron su fecha y hora
    -- Solo actualizar turnos que estén en estado "Reservado"
    UPDATE turnos
    SET status = 'Pendiente de Confirmación'
    WHERE status = 'Reservado'
    AND start_datetime < NOW()
    AND DATE_ADD(start_datetime, INTERVAL 1 DAY) > NOW(); -- Solo turnos del día actual o anteriores recientes
    
    -- Opcional: Marcar como "Pendiente de Confirmación" turnos de más de 1 día atrás
    -- que aún estén en "Reservado" (por si se saltó alguna ejecución)
    UPDATE turnos
    SET status = 'Pendiente de Confirmación'
    WHERE status = 'Reservado'
    AND start_datetime < DATE_SUB(NOW(), INTERVAL 1 DAY);
END$$

DELIMITER ;

-- ============================================================
-- EVENTO AUTOMÁTICO (se ejecuta cada hora)
-- ============================================================
-- Nota: Para que los eventos funcionen, el event_scheduler debe estar activado
-- Ejecutar: SET GLOBAL event_scheduler = ON;

DROP EVENT IF EXISTS evento_actualizar_estados_turnos;

CREATE EVENT IF NOT EXISTS evento_actualizar_estados_turnos
ON SCHEDULE EVERY 1 HOUR
DO
    CALL ActualizarEstadosTurnos();

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
SELECT 'Procedimiento y evento creados exitosamente' AS Mensaje;
SELECT 'Para activar el event_scheduler, ejecuta: SET GLOBAL event_scheduler = ON;' AS Instruccion;


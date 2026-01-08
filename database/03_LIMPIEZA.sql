-- ============================================================
-- SCRIPT DE LIMPIEZA DE BASE DE DATOS
-- Sistema de Turnos - Municipalidad de Coronel Dorrego
-- ============================================================
-- IMPORTANTE: Ejecutar DESPUÉS de hacer un backup completo
-- Frecuencia recomendada: Cada 2 semanas
-- ============================================================

USE turnos_dorrego;

-- ============================================================
-- 1. VER CUÁNTOS REGISTROS SE VAN A ELIMINAR (PREVIEW)
-- ============================================================
SELECT 
    'Turnos a eliminar' as Tipo,
    COUNT(*) as Cantidad,
    status as Estado,
    MIN(start_datetime) as Mas_Antiguo,
    MAX(start_datetime) as Mas_Reciente
FROM turnos
WHERE status IN ('Completado', 'Cancelado')
  AND start_datetime < DATE_SUB(NOW(), INTERVAL 14 DAY)
GROUP BY status;

-- ============================================================
-- 2. ELIMINAR TURNOS ANTIGUOS
-- ============================================================
-- Elimina turnos 'Completado' y 'Cancelado' mayores a 14 días
-- Los turnos 'Reservado' y 'Pendiente de Confirmación' se mantienen
-- ============================================================

DELETE FROM turnos 
WHERE status IN ('Completado', 'Cancelado')
  AND start_datetime < DATE_SUB(NOW(), INTERVAL 14 DAY);

-- Mostrar cuántos se eliminaron
SELECT ROW_COUNT() as 'Turnos eliminados';

-- ============================================================
-- 3. OPTIMIZAR TABLAS (Opcional pero recomendado)
-- ============================================================
-- Recupera espacio en disco después de eliminar registros
-- ============================================================

OPTIMIZE TABLE turnos;

-- ============================================================
-- 4. VERIFICACIÓN FINAL
-- ============================================================
SELECT 
    'Turnos restantes' as Info,
    status as Estado,
    COUNT(*) as Cantidad
FROM turnos
GROUP BY status
ORDER BY Cantidad DESC;

-- ============================================================
-- NOTAS:
-- ============================================================
-- 
-- Para cambiar el período de retención, modificar INTERVAL 14 DAY
-- Ejemplos:
--   INTERVAL 7 DAY   = 1 semana
--   INTERVAL 14 DAY  = 2 semanas
--   INTERVAL 30 DAY  = 1 mes
--   INTERVAL 90 DAY  = 3 meses
--
-- FLUJO RECOMENDADO:
-- 1. Hacer backup: mysqldump -u root -p turnos_dorrego > backup.sql
-- 2. Ejecutar este script: mysql -u root -p < 03_LIMPIEZA.sql
--
-- ============================================================

-- ============================================================
-- MIGRACIÓN: Agregar Especialidad a Profesionales y Observaciones a Turnos
-- ============================================================
-- Este script agrega:
-- 1. Campo especialidad a la tabla profesionales
-- 2. Campo observaciones a la tabla turnos
-- 3. Hace servicio_id opcional en turnos (para consultas generales)
-- ============================================================

USE ProyectoTurnos;

-- ============================================================
-- 1. AGREGAR ESPECIALIDAD A PROFESIONALES
-- ============================================================
ALTER TABLE profesionales 
ADD COLUMN especialidad VARCHAR(255) DEFAULT 'Consulta General' 
COMMENT 'Especialidad o categoría del profesional (ej: Clínica General, Cardiología, etc.)' 
AFTER matricula;

-- Crear índice para búsquedas por especialidad
CREATE INDEX idx_especialidad ON profesionales(especialidad);

-- ============================================================
-- 2. AGREGAR OBSERVACIONES A TURNOS
-- ============================================================
ALTER TABLE turnos 
ADD COLUMN observaciones TEXT 
COMMENT 'Observaciones o consideraciones del turno (opcional)' 
AFTER cliente_name;

-- ============================================================
-- 3. HACER servicio_id OPCIONAL EN TURNOS
-- ============================================================
-- Primero eliminar la foreign key constraint
ALTER TABLE turnos 
DROP FOREIGN KEY turnos_ibfk_3;

-- Modificar la columna para permitir NULL
ALTER TABLE turnos 
MODIFY COLUMN servicio_id INT NULL 
COMMENT 'ID del servicio (NULL para consulta general automática)';

-- Recrear la foreign key con ON DELETE SET NULL para permitir NULLs
ALTER TABLE turnos 
ADD CONSTRAINT turnos_ibfk_servicio 
FOREIGN KEY (servicio_id) REFERENCES servicios(id) ON DELETE SET NULL;

-- ============================================================
-- 4. ACTUALIZAR TURNOS EXISTENTES SIN SERVICIO
-- ============================================================
-- Si hay turnos sin servicio_id, se mantienen como NULL
-- (Esto es válido ahora con el nuevo esquema)

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
SELECT 'Migración completada exitosamente' AS Mensaje;
SELECT 'Columnas agregadas:' AS Info;
SHOW COLUMNS FROM profesionales LIKE 'especialidad';
SHOW COLUMNS FROM turnos LIKE 'observaciones';
SHOW COLUMNS FROM turnos LIKE 'servicio_id';


-- -----------------------------------------------------
-- SEEDER PARA PROYECTOTURNOS
-- Ejecutar este script para poblar la BD con datos de prueba
-- -----------------------------------------------------

USE ProyectoTurnos;

-- Desactivar chequeo de claves foráneas para limpiar tablas sin errores
SET FOREIGN_KEY_CHECKS = 0;

-- 1. LIMPIEZA DE TABLAS (Orden inverso para evitar conflictos si no se desactivaran FKs)
DELETE FROM turnos;
DELETE FROM disponibilidades;
DELETE FROM servicios;
DELETE FROM profesionales;
DELETE FROM Empresas;

-- Reiniciar contadores de Auto Increment
ALTER TABLE turnos AUTO_INCREMENT = 1;
ALTER TABLE disponibilidades AUTO_INCREMENT = 1;
ALTER TABLE servicios AUTO_INCREMENT = 1;
ALTER TABLE profesionales AUTO_INCREMENT = 1;
ALTER TABLE Empresas AUTO_INCREMENT = 1;

-- Reactivar chequeo de claves foráneas
SET FOREIGN_KEY_CHECKS = 1;


-- -----------------------------------------------------
-- 2. INSERTAR EMPRESAS
-- Pass: '123456' (Hash de ejemplo pbkdf2:sha256)
-- -----------------------------------------------------
INSERT INTO Empresas (id, nombre, username, password, email, created_at) VALUES 
(1, 'Clínica Salud Total', 'clinica_salud', 'pbkdf2:sha256:1000000$YjWnF4lKWo8ak1XN$f2de68a3e89fba14b1e0edeebc1d95f2ad1daf25ed3cbf79f31beaf2c0e531d0', 'contacto@saludtotal.com', NOW()),
(2, 'Estética & Spa Zen', 'spa_zen', 'pbkdf2:sha256:1000000$YjWnF4lKWo8ak1XN$f2de68a3e89fba14b1e0edeebc1d95f2ad1daf25ed3cbf79f31beaf2c0e531d0', 'info@spazen.com', NOW());


-- -----------------------------------------------------
-- 3. INSERTAR PROFESIONALES
-- -----------------------------------------------------
-- Profesionales de la Clínica (Empresa 1)
INSERT INTO profesionales (id, empresa_id, name, surname, email, dni, matricula, created_at) VALUES
(1, 1, 'Gregory', 'House', 'house@clinic.com', '10101010', 'MED-001', NOW()),
(2, 1, 'Lisa', 'Cuddy', 'cuddy@clinic.com', '20202020', 'MED-002', NOW());

-- Profesionales del Spa (Empresa 2)
INSERT INTO profesionales (id, empresa_id, name, surname, email, dni, matricula, created_at) VALUES
(3, 2, 'Ana', 'Lopez', 'ana@spa.com', '30303030', 'EST-100', NOW());


-- -----------------------------------------------------
-- 4. INSERTAR SERVICIOS
-- -----------------------------------------------------
-- Servicios de la Clínica (Empresa 1)
INSERT INTO servicios (id, empresa_id, name, duration_minutes, price, description, created_at) VALUES
(1, 1, 'Consulta General', 30, 5000, 'Revisión clínica estándar para diagnóstico general', NOW()),
(2, 1, 'Cardiología', 45, 8000, 'Consulta con especialista y electrocardiograma simple', NOW());

-- Servicios del Spa (Empresa 2)
INSERT INTO servicios (id, empresa_id, name, duration_minutes, price, description, created_at) VALUES
(3, 2, 'Masaje Relajante', 60, 4500, 'Masaje de cuerpo completo con piedras calientes', NOW()),
(4, 2, 'Limpieza Facial', 45, 3500, 'Limpieza profunda, exfoliación e hidratación', NOW());


-- -----------------------------------------------------
-- 5. INSERTAR DISPONIBILIDADES
-- -----------------------------------------------------
-- Dr. House (Prof 1): Lunes y Miércoles de 9 a 13
INSERT INTO disponibilidades (profesional_id, empresa_id, day_of_week, start_time, end_time, created_at) VALUES
(1, 1, 0, '09:00:00', '13:00:00', NOW()), -- Lunes
(1, 1, 2, '09:00:00', '13:00:00', NOW()); -- Miércoles

-- Dra. Cuddy (Prof 2): Martes de 14 a 18
INSERT INTO disponibilidades (profesional_id, empresa_id, day_of_week, start_time, end_time, created_at) VALUES
(2, 1, 1, '14:00:00', '18:00:00', NOW());

-- Ana del Spa (Prof 3): Viernes todo el día
INSERT INTO disponibilidades (profesional_id, empresa_id, day_of_week, start_time, end_time, created_at) VALUES
(3, 2, 4, '10:00:00', '19:00:00', NOW());


-- -----------------------------------------------------
-- 6. INSERTAR TURNOS
-- -----------------------------------------------------
-- Turno 1: Dr. House, Consulta General, Completado (Pasado)
INSERT INTO turnos (empresa_id, profesional_id, servicio_id, cliente_name, start_datetime, status, created_at) VALUES
(1, 1, 1, 'Juan Paciente', '2024-05-20 09:30:00', 'Completado', NOW());

-- Turno 2: Dra. Cuddy, Cardiología, Pendiente (reservado - Futuro)
INSERT INTO turnos (empresa_id, profesional_id, servicio_id, cliente_name, start_datetime, status, created_at) VALUES
(1, 2, 2, 'Maria Corazón', '2024-12-21 15:00:00', 'Reservado', NOW());

-- Turno 3: Ana (Spa), Masaje, Cancelado
INSERT INTO turnos (empresa_id, profesional_id, servicio_id, cliente_name, start_datetime, status, created_at) VALUES
(2, 3, 3, 'Pedro Stress', '2024-05-24 11:00:00', 'Cancelado', NOW());

-- Turno 4: Dr. House, Consulta General, Pendiente (reservado - Futuro)
INSERT INTO turnos (empresa_id, profesional_id, servicio_id, cliente_name, start_datetime, status, created_at) VALUES
(1, 1, 1, 'Laura Diagnóstico', '2024-12-23 10:00:00', 'Reservado', NOW());
-- ============================================================
-- SEED PARA MUNICIPIO DE CORONEL DORREGO
-- Sistema de Turnos - Datos Actualizados
-- ============================================================
-- IMPORTANTE: Los IDs se asignan automáticamente (AUTO_INCREMENT)
-- No es necesario especificarlos en los INSERT
-- ============================================================

USE ProyectoTurnos;

-- Desactivar chequeo de claves foráneas para limpiar tablas sin errores
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 1. LIMPIEZA DE TABLAS (Orden inverso para evitar conflictos)
-- ============================================================
DELETE FROM turnos;
DELETE FROM disponibilidades;
DELETE FROM servicios;
DELETE FROM profesionales;
DELETE FROM clientes;
DELETE FROM Empresas;

-- Reiniciar contadores de Auto Increment
ALTER TABLE turnos AUTO_INCREMENT = 1;
ALTER TABLE disponibilidades AUTO_INCREMENT = 1;
ALTER TABLE servicios AUTO_INCREMENT = 1;
ALTER TABLE profesionales AUTO_INCREMENT = 1;
ALTER TABLE clientes AUTO_INCREMENT = 1;
ALTER TABLE Empresas AUTO_INCREMENT = 1;

-- Reactivar chequeo de claves foráneas
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 2. INSERTAR EMPRESAS (SECTORES DEL MUNICIPIO)
-- ============================================================
-- Password para todas: '123456'
-- Hash: pbkdf2:sha256:1000000$YjWnF4lKWo8ak1XN$f2de68a3e89fba14b1e0edeebc1d95f2ad1daf25ed3cbf79f31beaf2c0e531d0
-- ============================================================
INSERT INTO Empresas (nombre, username, password, email, created_at) VALUES 
('Hospital Municipal Coronel Dorrego', 'hospital_muni', 'pbkdf2:sha256:1000000$YjWnF4lKWo8ak1XN$f2de68a3e89fba14b1e0edeebc1d95f2ad1daf25ed3cbf79f31beaf2c0e531d0', 'hospital@coroneldorrego.gob.ar', NOW()),
('Dirección de Vialidad', 'vialidad_muni', 'pbkdf2:sha256:1000000$YjWnF4lKWo8ak1XN$f2de68a3e89fba14b1e0edeebc1d95f2ad1daf25ed3cbf79f31beaf2c0e531d0', 'vialidad@coroneldorrego.gob.ar', NOW()),
('Administración Pública', 'admin_muni', 'pbkdf2:sha256:1000000$YjWnF4lKWo8ak1XN$f2de68a3e89fba14b1e0edeebc1d95f2ad1daf25ed3cbf79f31beaf2c0e531d0', 'administracion@coroneldorrego.gob.ar', NOW()),
('Registro Civil', 'registro_civil', 'pbkdf2:sha256:1000000$YjWnF4lKWo8ak1XN$f2de68a3e89fba14b1e0edeebc1d95f2ad1daf25ed3cbf79f31beaf2c0e531d0', 'registrocivil@coroneldorrego.gob.ar', NOW());

-- ============================================================
-- 3. INSERTAR PROFESIONALES DEL HOSPITAL MUNICIPAL
-- ============================================================
-- Se asignan automáticamente IDs del 1 al 83
-- empresa_id = 1 (Hospital Municipal)
-- ============================================================

INSERT INTO profesionales (empresa_id, name, surname, email, dni, matricula, especialidad, created_at) VALUES
-- Cirugía (3 profesionales)
(1, 'Santiago', 'Braghero', 'santiago.braghero@coroneldorrego.gob.ar', '00000001', 'CIR-001', 'Cirugía', NOW()),
(1, 'Mauro', 'Sueldo', 'mauro.sueldo@coroneldorrego.gob.ar', '00000002', 'CIR-002', 'Cirugía', NOW()),
(1, 'Nicolas', 'Crego', 'nicolas.crego@coroneldorrego.gob.ar', '00000003', 'CIR-003', 'Cirugía', NOW()),

-- Otorrinolaringología (1 profesional)
(1, 'Andres', 'Gigon', 'andres.gigon@coroneldorrego.gob.ar', '00000004', 'OTO-004', 'Otorrinolaringología', NOW()),

-- Pediatría (5 profesionales)
(1, 'Nicolas Hernan', 'Testani', 'nicolas.testani@coroneldorrego.gob.ar', '00000005', 'PED-005', 'Pediatría', NOW()),
(1, 'Natacha Noemi', 'Sabarnik', 'natacha.sabarnik@coroneldorrego.gob.ar', '00000006', 'PED-006', 'Pediatría', NOW()),
(1, 'Florencia', 'Maydana', 'florencia.maydana@coroneldorrego.gob.ar', '00000021', 'PED-021', 'Pediatría', NOW()),
(1, 'Carolina', 'Bertazo', 'carolina.bertazo@coroneldorrego.gob.ar', '00000022', 'PED-022', 'Pediatría', NOW()),

-- Psicología (9 profesionales)
(1, 'Mariano', 'Minnaard', 'mariano.minnaard@coroneldorrego.gob.ar', '00000007', 'PSI-007', 'Psicología', NOW()),
(1, 'Natalia Gabriela', 'Peciña', 'natalia.pecina@coroneldorrego.gob.ar', '00000008', 'PSI-008', 'Psicología', NOW()),
(1, 'Maria Del Rosario', 'Martinez', 'maria.martinez@coroneldorrego.gob.ar', '00000009', 'PSI-009', 'Psicología', NOW()),
(1, 'Maria Silvina', 'Di Paolo', 'maria.dipaolo@coroneldorrego.gob.ar', '00000010', 'PSI-010', 'Psicología', NOW()),
(1, 'Cintia Eliana', 'Gette', 'cintia.gette@coroneldorrego.gob.ar', '00000011', 'PSI-011', 'Psicología', NOW()),
(1, 'Romina', 'Merlo', 'romina.merlo@coroneldorrego.gob.ar', '00000012', 'PSI-012', 'Psicología', NOW()),
(1, 'Monica Alejandra', 'Amado', 'monica.amado@coroneldorrego.gob.ar', '00000013', 'PSI-013', 'Psicología', NOW()),
(1, 'Ainara', 'Castell Madariaga', 'ainara.castell@coroneldorrego.gob.ar', '00000049', 'PSI-049', 'Psicología', NOW()),
(1, 'Maria Del Carmen', 'Codagnone', 'carmen.codagnone@coroneldorrego.gob.ar', '00000065', 'PSI-065', 'Psicología', NOW()),

-- Psiquiatría (3 profesionales)
(1, 'Maria Julieta', 'Mena', 'maria.mena@coroneldorrego.gob.ar', '00000014', 'PSQ-014', 'Psiquiatría', NOW()),
(1, 'Florencia', 'Schmit', 'florencia.schmit@coroneldorrego.gob.ar', '00000068', 'PSQ-068', 'Psiquiatría', NOW()),
(1, 'Ariel Cesar', 'Juarez', 'ariel.juarez@coroneldorrego.gob.ar', '00000081', 'PSQ-081', 'Psiquiatría', NOW()),

-- Clínica General (13 profesionales)
(1, 'Hugo', 'Abraham', 'hugo.abraham@coroneldorrego.gob.ar', '00000015', 'CLI-015', 'Clínica General', NOW()),
(1, 'Cesar Gabriel', 'Gigena', 'cesar.gigena@coroneldorrego.gob.ar', '00000017', 'CLI-017', 'Clínica General', NOW()),
(1, 'Paulina', 'Alonso', 'paulina.alonso@coroneldorrego.gob.ar', '00000018', 'CLI-018', 'Clínica General', NOW()),
(1, 'Maria De Los Angeles', 'Altuna', 'maria.altuna@coroneldorrego.gob.ar', '00000023', 'CLI-023', 'Clínica General', NOW()),
(1, 'Eduardo Bernabe', 'Gagna', 'eduardo.gagna@coroneldorrego.gob.ar', '00000037', 'CLI-037', 'Clínica General', NOW()),
(1, 'Juan Manuel', 'Cobian', 'juan.cobian@coroneldorrego.gob.ar', '00000040', 'CLI-040', 'Clínica General', NOW()),
(1, 'Fabian Andres', 'Zorzano', 'fabian.zorzano@coroneldorrego.gob.ar', '00000046', 'CLI-046', 'Clínica General', NOW()),
(1, 'Julian', 'Del Valle', 'julian.delvalle@coroneldorrego.gob.ar', '00000058', 'CLI-058', 'Clínica General', NOW()),
(1, 'Marcela', 'Mc Allister', 'marcela.mcallister@coroneldorrego.gob.ar', '00000066', 'CLI-066', 'Clínica General', NOW()),
(1, 'Claudia Mariel', 'Larsen', 'claudia.larsen@coroneldorrego.gob.ar', '00000070', 'CLI-070', 'Clínica General', NOW()),
(1, 'Oscar Eduardo', 'Mena', 'oscar.mena@coroneldorrego.gob.ar', '00000072', 'CLI-072', 'Clínica General', NOW()),
(1, 'Javier Luis', 'Falcon', 'javier.falcon@coroneldorrego.gob.ar', '00000075', 'CLI-075', 'Clínica General', NOW()),
(1, 'Claudio', 'Campagne', 'claudio.campagne@coroneldorrego.gob.ar', '00000079', 'CLI-079', 'Clínica General', NOW()),

-- Clínica Médica (3 profesionales)
(1, 'Javier', 'Cortez', 'javier.cortez@coroneldorrego.gob.ar', '00000016', 'CLM-016', 'Clínica Médica', NOW()),
(1, 'Maximiliano', 'Erro', 'maximiliano.erro@coroneldorrego.gob.ar', '00000054', 'CLM-054', 'Clínica Médica', NOW()),
(1, 'Hilda Mirca', 'Atala', 'hilda.atala@coroneldorrego.gob.ar', '00000074', 'CLM-074', 'Clínica Médica', NOW()),

-- Endocrinología (1 profesional)
(1, 'Lucrecia', 'La Petra', 'lucrecia.lapetra@coroneldorrego.gob.ar', '00000019', 'END-019', 'Endocrinología', NOW()),

-- Ginecología (2 profesionales)
(1, 'Maria Magdalena', 'Lorden', 'maria.lorden@coroneldorrego.gob.ar', '00000020', 'GIN-020', 'Ginecología', NOW()),
(1, 'Jessica Ines', 'Vulcano', 'jessica.vulcano@coroneldorrego.gob.ar', '00000029', 'GIN-029', 'Ginecología', NOW()),

-- Traumatología (4 profesionales)
(1, 'Felix Daniel', 'Pessio', 'felix.pessio@coroneldorrego.gob.ar', '00000024', 'TRA-024', 'Traumatología', NOW()),
(1, 'Luciano', 'Mutti', 'luciano.mutti@coroneldorrego.gob.ar', '00000028', 'TRA-028', 'Traumatología', NOW()),
(1, 'Jose Maria', 'Turienzo', 'jose.turienzo@coroneldorrego.gob.ar', '00000036', 'TRA-036', 'Traumatología', NOW()),

-- Neurología infantil (1 profesional)
(1, 'Juan', 'Donari', 'juan.donari@coroneldorrego.gob.ar', '00000025', 'NEI-025', 'Neurología infantil', NOW()),

-- Reumatología (1 profesional)
(1, 'Esteban', 'Castell', 'esteban.castell@coroneldorrego.gob.ar', '00000026', 'REU-026', 'Reumatología', NOW()),

-- Alergista (1 profesional)
(1, 'Lilian', 'Elosegui', 'lilian.elosegui@coroneldorrego.gob.ar', '00000027', 'ALE-027', 'Alergista', NOW()),

-- Obstetricia (4 profesionales)
(1, 'Cecilia', 'Alvarez', 'cecilia.alvarez@coroneldorrego.gob.ar', '00000030', 'OBS-030', 'Obstetricia', NOW()),
(1, 'Carina', 'Lorentzen', 'carina.lorentzen@coroneldorrego.gob.ar', '00000031', 'OBS-031', 'Obstetricia', NOW()),
(1, 'Andrea', 'Gerez', 'andrea.gerez@coroneldorrego.gob.ar', '00000032', 'OBS-032', 'Obstetricia', NOW()),
(1, 'Romina Paola', 'Latorre', 'romina.latorre@coroneldorrego.gob.ar', '00000033', 'OBS-033', 'Obstetricia', NOW()),

-- Odontología (3 profesionales)
(1, 'Julio', 'Di Luca', 'julio.diluca@coroneldorrego.gob.ar', '00000034', 'ODO-034', 'Odontología', NOW()),
(1, 'Fernando', 'Literio', 'fernando.literio@coroneldorrego.gob.ar', '00000035', 'ODO-035', 'Odontología', NOW()),
(1, 'Leoncio', 'Guerra', 'leoncio.guerra@coroneldorrego.gob.ar', '00000073', 'ODO-073', 'Odontología', NOW()),

-- Podología (1 profesional)
(1, 'Maria Alejandra', 'Vera', 'maria.vera@coroneldorrego.gob.ar', '00000038', 'POD-038', 'Podología', NOW()),

-- Nutricionista (2 profesionales)
(1, 'Andrea Valeria', 'Lipovsky', 'andrea.lipovsky@coroneldorrego.gob.ar', '00000039', 'NUT-039', 'Nutricionista', NOW()),
(1, 'Agostina', 'D Annunzio', 'agostina.dannunzio@coroneldorrego.gob.ar', '00000061', 'NUT-061', 'Nutricionista', NOW()),

-- Neurología adultos (1 profesional)
(1, 'Angel Ernesto', 'Orioli', 'angel.orioli@coroneldorrego.gob.ar', '00000041', 'NEA-041', 'Neurología adultos', NOW()),

-- Fonoaudiología (3 profesionales)
(1, 'Mari Carmen', 'Zarzoso', 'mari.zarzoso@coroneldorrego.gob.ar', '00000042', 'FON-042', 'Fonoaudiología', NOW()),
(1, 'Paula', 'Caneda', 'paula.caneda@coroneldorrego.gob.ar', '00000043', 'FON-043', 'Fonoaudiología', NOW()),
(1, 'Valentina', 'Mazzarini', 'valentina.mazzarini@coroneldorrego.gob.ar', '00000080', 'FON-080', 'Fonoaudiología', NOW()),

-- Gastroenterología (1 profesional)
(1, 'Alberto', 'Cuyeu', 'alberto.cuyeu@coroneldorrego.gob.ar', '00000044', 'GAS-044', 'Gastroenterología', NOW()),

-- Laboratorio (8 profesionales)
(1, 'Natalia', 'Iphar', 'natalia.iphar@coroneldorrego.gob.ar', '00000045', 'LAB-045', 'Laboratorio', NOW()),
(1, 'Maria Florencia', 'Caramelli', 'maria.caramelli@coroneldorrego.gob.ar', '00000047', 'LAB-047', 'Laboratorio', NOW()),
(1, 'Anabela', 'Napoleone', 'anabela.napoleone@coroneldorrego.gob.ar', '00000059', 'LAB-059', 'Laboratorio', NOW()),
(1, 'Soledad', 'Marquez', 'soledad.marquez@coroneldorrego.gob.ar', '00000062', 'LAB-062', 'Laboratorio', NOW()),
(1, 'Carolina', 'Duval', 'carolina.duval@coroneldorrego.gob.ar', '00000063', 'LAB-063', 'Laboratorio', NOW()),
(1, 'Tamara', 'Thiessen', 'tamara.thiessen@coroneldorrego.gob.ar', '00000064', 'LAB-064', 'Laboratorio', NOW()),
(1, 'Alejandra Cecilia', 'Acebedo', 'alejandra.acebedo@coroneldorrego.gob.ar', '00000067', 'LAB-067', 'Laboratorio', NOW()),

-- Rayos (5 profesionales)
(1, 'Luis Maria', 'Echeto', 'luis.echeto@coroneldorrego.gob.ar', '00000048', 'RAY-048', 'Rayos', NOW()),
(1, 'Ruben Dario', 'Colonna', 'ruben.colonna@coroneldorrego.gob.ar', '00000053', 'RAY-053', 'Rayos', NOW()),
(1, 'Luciana', 'Garcia', 'luciana.garcia@coroneldorrego.gob.ar', '00000057', 'RAY-057', 'Rayos', NOW()),
(1, 'Adriana Cristina', 'Benitez', 'adriana.benitez@coroneldorrego.gob.ar', '00000099', 'RAY-063B', 'Rayos', NOW()),

-- Trabajo Social (1 profesional - duplicado en lista original, se mantiene uno)
(1, 'Maria Isabel', 'Quintero', 'maria.quintero@coroneldorrego.gob.ar', '00000050', 'TRS-050', 'Trabajo Social', NOW()),

-- Oftalmología (1 profesional)
(1, 'Mauricio', 'Mussini', 'mauricio.mussini@coroneldorrego.gob.ar', '00000052', 'OFT-052', 'Oftalmología', NOW()),

-- Farmacéutica (1 profesional)
(1, 'Agustina Ayelen', 'Perez Medina', 'agustina.perez@coroneldorrego.gob.ar', '00000060', 'FAR-060', 'Farmacéutica', NOW()),

-- Cardiología (1 profesional)
(1, 'Daniela', 'Lissarrague Polinesi', 'daniela.lissarrague@coroneldorrego.gob.ar', '00000071', 'CAR-071', 'Cardiología', NOW()),

-- Patología (1 profesional)
(1, 'Patricia Andrea', 'Gomez', 'patricia.gomez@coroneldorrego.gob.ar', '00000076', 'PAT-076', 'Patología', NOW()),

-- Flebología (1 profesional)
(1, 'Josefina', 'Lopez Aguerri', 'josefina.lopez@coroneldorrego.gob.ar', '00000077', 'FLE-077', 'Flebología', NOW()),

-- Puericultura (1 profesional)
(1, 'Belen', 'Masanet', 'belen.masanet@coroneldorrego.gob.ar', '00000078', 'PUE-078', 'Puericultura', NOW()),

-- Nefrología (2 profesionales)
(1, 'Paula', 'Zorzano Osinalde', 'paula.zorzano@coroneldorrego.gob.ar', '00000082', 'NEF-082', 'Nefrología', NOW()),
(1, 'Hernan', 'Perez Teysseyre', 'hernan.perez@coroneldorrego.gob.ar', '00000083', 'NEF-083', 'Nefrología', NOW()),

-- Profesionales sin especialidad definida (3)
(1, 'Mariana', 'Crededio', 'mariana.crededio@coroneldorrego.gob.ar', '00000084', 'GEN-054B', 'Consulta General', NOW()),
(1, 'Carolina', 'Menna', 'carolina.menna@coroneldorrego.gob.ar', '00000056', 'GEN-056', 'Consulta General', NOW()),
(1, 'Daniela', 'Hubert', 'daniela.hubert@coroneldorrego.gob.ar', '00000069', 'GEN-069', 'Consulta General', NOW());

-- ============================================================
-- 4. INSERTAR PROFESIONALES DE OTROS SECTORES
-- ============================================================

-- Vialidad (Empresa 2) - 3 profesionales
INSERT INTO profesionales (empresa_id, name, surname, email, dni, matricula, especialidad, created_at) VALUES
(2, 'Carlos', 'Rodriguez', 'carlos.rodriguez@coroneldorrego.gob.ar', '20000001', 'VIA-001', 'Trámites Vialidad', NOW()),
(2, 'Laura', 'Fernandez', 'laura.fernandez@coroneldorrego.gob.ar', '20000002', 'VIA-002', 'Trámites Vialidad', NOW()),
(2, 'Roberto', 'Gomez', 'roberto.gomez@coroneldorrego.gob.ar', '20000003', 'VIA-003', 'Trámites Vialidad', NOW());

-- Administración Pública (Empresa 3) - 3 profesionales
INSERT INTO profesionales (empresa_id, name, surname, email, dni, matricula, especialidad, created_at) VALUES
(3, 'Ana', 'Lopez', 'ana.lopez@coroneldorrego.gob.ar', '30000001', 'ADM-001', 'Administración Pública', NOW()),
(3, 'Pedro', 'Martinez', 'pedro.martinez@coroneldorrego.gob.ar', '30000002', 'ADM-002', 'Administración Pública', NOW()),
(3, 'Sofia', 'Garcia', 'sofia.garcia@coroneldorrego.gob.ar', '30000003', 'ADM-003', 'Administración Pública', NOW());

-- Registro Civil (Empresa 4) - 2 profesionales
INSERT INTO profesionales (empresa_id, name, surname, email, dni, matricula, especialidad, created_at) VALUES
(4, 'Elena', 'Sanchez', 'elena.sanchez@coroneldorrego.gob.ar', '40000001', 'REG-001', 'Registro Civil', NOW()),
(4, 'Miguel', 'Torres', 'miguel.torres@coroneldorrego.gob.ar', '40000002', 'REG-002', 'Registro Civil', NOW());

-- ============================================================
-- 5. INSERTAR SERVICIOS
-- ============================================================

-- Hospital Municipal (Empresa 1) - Servicios ampliados
INSERT INTO servicios (empresa_id, name, duration_minutes, price, description, created_at) VALUES
(1, 'Consulta Cirugía', 45, 0, 'Consulta con cirujano general', NOW()),
(1, 'Consulta Otorrinolaringología', 30, 0, 'Consulta con especialista en ORL', NOW()),
(1, 'Consulta Pediatría', 30, 0, 'Consulta pediátrica', NOW()),
(1, 'Sesión Psicología', 45, 0, 'Sesión de psicología', NOW()),
(1, 'Consulta Psiquiatría', 45, 0, 'Consulta psiquiátrica', NOW()),
(1, 'Consulta Clínica General', 30, 0, 'Consulta médica general', NOW()),
(1, 'Consulta Clínica Médica', 30, 0, 'Consulta de clínica médica', NOW()),
(1, 'Consulta Endocrinología', 45, 0, 'Consulta con endocrinólogo', NOW()),
(1, 'Consulta Ginecología', 30, 0, 'Consulta ginecológica', NOW()),
(1, 'Consulta Traumatología', 30, 0, 'Consulta traumatológica', NOW()),
(1, 'Consulta Neurología Infantil', 45, 0, 'Consulta de neurología infantil', NOW()),
(1, 'Consulta Reumatología', 45, 0, 'Consulta reumatológica', NOW()),
(1, 'Consulta Alergista', 30, 0, 'Consulta con alergista', NOW()),
(1, 'Consulta Obstetricia', 30, 0, 'Consulta obstétrica', NOW()),
(1, 'Consulta Odontología', 30, 0, 'Consulta odontológica', NOW()),
(1, 'Consulta Podología', 30, 0, 'Consulta podológica', NOW()),
(1, 'Consulta Nutrición', 45, 0, 'Consulta nutricional', NOW()),
(1, 'Consulta Neurología Adultos', 45, 0, 'Consulta de neurología adultos', NOW()),
(1, 'Sesión Fonoaudiología', 45, 0, 'Sesión de fonoaudiología', NOW()),
(1, 'Consulta Gastroenterología', 45, 0, 'Consulta gastroenterológica', NOW()),
(1, 'Análisis de Laboratorio', 15, 0, 'Análisis de laboratorio', NOW()),
(1, 'Radiografía', 20, 0, 'Estudio de rayos X', NOW()),
(1, 'Consulta Trabajo Social', 30, 0, 'Consulta de trabajo social', NOW()),
(1, 'Consulta Oftalmología', 30, 0, 'Consulta oftalmológica', NOW()),
(1, 'Consulta Farmacéutica', 20, 0, 'Consulta farmacéutica', NOW()),
(1, 'Consulta Cardiología', 45, 0, 'Consulta cardiológica', NOW()),
(1, 'Consulta Patología', 30, 0, 'Consulta de patología', NOW()),
(1, 'Consulta Flebología', 30, 0, 'Consulta de flebología', NOW()),
(1, 'Consulta Puericultura', 30, 0, 'Consulta de puericultura', NOW()),
(1, 'Consulta Nefrología', 45, 0, 'Consulta nefrológica', NOW());

-- Vialidad (Empresa 2)
INSERT INTO servicios (empresa_id, name, duration_minutes, price, description, created_at) VALUES
(2, 'Trámite Licencia de Conducir', 30, 5000, 'Renovación o primera vez de licencia de conducir', NOW()),
(2, 'Consulta Vial', 20, 0, 'Consulta sobre trámites viales', NOW()),
(2, 'Inspección Vehicular', 45, 3000, 'Inspección técnica vehicular', NOW());

-- Administración Pública (Empresa 3)
INSERT INTO servicios (empresa_id, name, duration_minutes, price, description, created_at) VALUES
(3, 'Trámite Certificado de Domicilio', 15, 2000, 'Certificado de domicilio', NOW()),
(3, 'Trámite Constancia de CUIL', 15, 1500, 'Constancia de CUIL', NOW()),
(3, 'Consulta Administrativa', 20, 0, 'Consulta sobre trámites administrativos', NOW()),
(3, 'Trámite Habilitación Comercial', 60, 15000, 'Habilitación de comercio', NOW());

-- Registro Civil (Empresa 4)
INSERT INTO servicios (empresa_id, name, duration_minutes, price, description, created_at) VALUES
(4, 'Trámite Partida de Nacimiento', 20, 3000, 'Solicitud de partida de nacimiento', NOW()),
(4, 'Trámite Partida de Defunción', 20, 3000, 'Solicitud de partida de defunción', NOW()),
(4, 'Trámite Partida de Matrimonio', 20, 3000, 'Solicitud de partida de matrimonio', NOW()),
(4, 'Registro de Nacimiento', 30, 0, 'Registro de nacimiento de recién nacido', NOW());

-- ============================================================
-- 6. INSERTAR DISPONIBILIDADES (EJEMPLOS)
-- ============================================================
-- Nota: Con 83 profesionales del hospital, aquí incluimos ejemplos
-- Deberás ajustar estos horarios según la disponibilidad real de cada profesional
-- ============================================================

-- Cirujanos (IDs 1-3): Lunes a Viernes por la mañana
INSERT INTO disponibilidades (profesional_id, empresa_id, day_of_week, start_time, end_time, created_at) VALUES
(1, 1, 1, '09:00:00', '13:00:00', NOW()),
(1, 1, 3, '09:00:00', '13:00:00', NOW()),
(2, 1, 2, '08:00:00', '12:00:00', NOW()),
(2, 1, 4, '08:00:00', '12:00:00', NOW()),
(3, 1, 1, '08:00:00', '12:00:00', NOW()),
(3, 1, 2, '08:00:00', '12:00:00', NOW()),
(3, 1, 3, '08:00:00', '12:00:00', NOW()),
(3, 1, 4, '08:00:00', '12:00:00', NOW()),
(3, 1, 5, '08:00:00', '12:00:00', NOW());

-- Otorrino (ID 4): Martes y Viernes
INSERT INTO disponibilidades (profesional_id, empresa_id, day_of_week, start_time, end_time, created_at) VALUES
(4, 1, 2, '09:00:00', '13:00:00', NOW()),
(4, 1, 5, '09:00:00', '13:00:00', NOW());

-- Pediatras (IDs 5-8): Distribución variada
INSERT INTO disponibilidades (profesional_id, empresa_id, day_of_week, start_time, end_time, created_at) VALUES
(5, 1, 1, '14:00:00', '17:00:00', NOW()),
(5, 1, 3, '14:00:00', '17:00:00', NOW()),
(5, 1, 5, '14:00:00', '17:00:00', NOW()),
(6, 1, 2, '09:00:00', '12:00:00', NOW()),
(6, 1, 4, '09:00:00', '12:00:00', NOW()),
(7, 1, 1, '08:00:00', '13:00:00', NOW()),
(7, 1, 3, '08:00:00', '13:00:00', NOW()),
(8, 1, 2, '14:00:00', '18:00:00', NOW()),
(8, 1, 4, '14:00:00', '18:00:00', NOW());

-- Psicólogos (IDs 9-17): Horarios variados
INSERT INTO disponibilidades (profesional_id, empresa_id, day_of_week, start_time, end_time, created_at) VALUES
(9, 1, 1, '10:00:00', '14:00:00', NOW()),
(9, 1, 3, '10:00:00', '14:00:00', NOW()),
(10, 1, 2, '15:00:00', '19:00:00', NOW()),
(10, 1, 4, '15:00:00', '19:00:00', NOW()),
(11, 1, 1, '08:00:00', '12:00:00', NOW()),
(11, 1, 5, '08:00:00', '12:00:00', NOW()),
(12, 1, 2, '09:00:00', '13:00:00', NOW()),
(12, 1, 4, '09:00:00', '13:00:00', NOW()),
(13, 1, 3, '14:00:00', '18:00:00', NOW()),
(13, 1, 5, '14:00:00', '18:00:00', NOW()),
(14, 1, 1, '09:00:00', '13:00:00', NOW()),
(14, 1, 3, '09:00:00', '13:00:00', NOW()),
(15, 1, 2, '10:00:00', '14:00:00', NOW()),
(15, 1, 4, '10:00:00', '14:00:00', NOW()),
(16, 1, 1, '14:00:00', '18:00:00', NOW()),
(16, 1, 3, '14:00:00', '18:00:00', NOW()),
(17, 1, 2, '08:00:00', '12:00:00', NOW()),
(17, 1, 5, '08:00:00', '12:00:00', NOW());

-- Psiquiatras (IDs 18-20): Lunes a Viernes tarde
INSERT INTO disponibilidades (profesional_id, empresa_id, day_of_week, start_time, end_time, created_at) VALUES
(18, 1, 1, '14:00:00', '18:00:00', NOW()),
(18, 1, 3, '14:00:00', '18:00:00', NOW()),
(19, 1, 2, '14:00:00', '18:00:00', NOW()),
(19, 1, 4, '14:00:00', '18:00:00', NOW()),
(20, 1, 5, '14:00:00', '18:00:00', NOW());

-- Resto de profesionales del hospital: horarios genéricos
-- Clínica General (IDs 21-33)
INSERT INTO disponibilidades (profesional_id, empresa_id, day_of_week, start_time, end_time, created_at) VALUES
(21, 1, 1, '08:00:00', '12:00:00', NOW()),
(21, 1, 2, '08:00:00', '12:00:00', NOW()),
(21, 1, 3, '08:00:00', '12:00:00', NOW()),
(22, 1, 2, '14:00:00', '18:00:00', NOW()),
(22, 1, 4, '14:00:00', '18:00:00', NOW()),
(23, 1, 1, '09:00:00', '13:00:00', NOW()),
(23, 1, 3, '09:00:00', '13:00:00', NOW());

-- Vialidad (IDs según orden de inserción): Lunes a Viernes 8-16
INSERT INTO disponibilidades (profesional_id, empresa_id, day_of_week, start_time, end_time, created_at) 
SELECT p.id, p.empresa_id, d.day, '08:00:00', '16:00:00', NOW()
FROM profesionales p
CROSS JOIN (SELECT 1 as day UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) d
WHERE p.empresa_id = 2;

-- Administración Pública (IDs según orden): Lunes a Viernes 8-14
INSERT INTO disponibilidades (profesional_id, empresa_id, day_of_week, start_time, end_time, created_at)
SELECT p.id, p.empresa_id, d.day, '08:00:00', '14:00:00', NOW()
FROM profesionales p
CROSS JOIN (SELECT 1 as day UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) d
WHERE p.empresa_id = 3;

-- Registro Civil (IDs según orden): Lunes a Viernes 8-15
INSERT INTO disponibilidades (profesional_id, empresa_id, day_of_week, start_time, end_time, created_at)
SELECT p.id, p.empresa_id, d.day, '08:00:00', '15:00:00', NOW()
FROM profesionales p
CROSS JOIN (SELECT 1 as day UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) d
WHERE p.empresa_id = 4;

-- ============================================================
-- 7. INSERTAR CLIENTES DE PRUEBA
-- ============================================================
-- Password para todos: '123456'
-- Hash: pbkdf2:sha256:1000000$YjWnF4lKWo8ak1XN$f2de68a3e89fba14b1e0edeebc1d95f2ad1daf25ed3cbf79f31beaf2c0e531d0
-- ============================================================
INSERT INTO clientes (dni, nombre, apellido, email, telefono, password, activo, created_at) VALUES
('12345678', 'Juan', 'Perez', 'juan.perez@email.com', '2914123456', 'pbkdf2:sha256:1000000$YjWnF4lKWo8ak1XN$f2de68a3e89fba14b1e0edeebc1d95f2ad1daf25ed3cbf79f31beaf2c0e531d0', TRUE, NOW()),
('23456789', 'Maria', 'Gonzalez', 'maria.gonzalez@email.com', '2914234567', 'pbkdf2:sha256:1000000$YjWnF4lKWo8ak1XN$f2de68a3e89fba14b1e0edeebc1d95f2ad1daf25ed3cbf79f31beaf2c0e531d0', TRUE, NOW()),
('34567890', 'Carlos', 'Rodriguez', 'carlos.rodriguez@email.com', '2914345678', 'pbkdf2:sha256:1000000$YjWnF4lKWo8ak1XN$f2de68a3e89fba14b1e0edeebc1d95f2ad1daf25ed3cbf79f31beaf2c0e531d0', TRUE, NOW()),
('45678901', 'Ana', 'Martinez', 'ana.martinez@email.com', '2914456789', 'pbkdf2:sha256:1000000$YjWnF4lKWo8ak1XN$f2de68a3e89fba14b1e0edeebc1d95f2ad1daf25ed3cbf79f31beaf2c0e531d0', TRUE, NOW()),
('56789012', 'Pedro', 'Lopez', 'pedro.lopez@email.com', '2914567890', 'pbkdf2:sha256:1000000$YjWnF4lKWo8ak1XN$f2de68a3e89fba14b1e0edeebc1d95f2ad1daf25ed3cbf79f31beaf2c0e531d0', TRUE, NOW()),
('67890123', 'Laura', 'Fernandez', 'laura.fernandez@email.com', NULL, 'pbkdf2:sha256:1000000$YjWnF4lKWo8ak1XN$f2de68a3e89fba14b1e0edeebc1d95f2ad1daf25ed3cbf79f31beaf2c0e531d0', TRUE, NOW()),
('78901234', 'Roberto', 'Gomez', NULL, '2914789012', 'pbkdf2:sha256:1000000$YjWnF4lKWo8ak1XN$f2de68a3e89fba14b1e0edeebc1d95f2ad1daf25ed3cbf79f31beaf2c0e531d0', TRUE, NOW()),
('89012345', 'Sofia', 'Sanchez', 'sofia.sanchez@email.com', '2914890123', 'pbkdf2:sha256:1000000$YjWnF4lKWo8ak1XN$f2de68a3e89fba14b1e0edeebc1d95f2ad1daf25ed3cbf79f31beaf2c0e531d0', TRUE, NOW());

-- ============================================================
-- 8. INSERTAR TURNOS DE PRUEBA
-- ============================================================

-- Turnos del Hospital (algunos pasados, algunos futuros)
INSERT INTO turnos (empresa_id, profesional_id, servicio_id, cliente_name, start_datetime, status, created_at) VALUES
-- Turnos pasados (completados)
(1, 1, 1, 'Juan Perez', DATE_SUB(NOW(), INTERVAL 5 DAY) + INTERVAL 9 HOUR + INTERVAL 30 MINUTE, 'Completado', DATE_SUB(NOW(), INTERVAL 6 DAY)),
(1, 3, 6, 'Maria Gonzalez', DATE_SUB(NOW(), INTERVAL 3 DAY) + INTERVAL 10 HOUR, 'Completado', DATE_SUB(NOW(), INTERVAL 4 DAY)),
(1, 5, 3, 'Carlos Rodriguez', DATE_SUB(NOW(), INTERVAL 2 DAY) + INTERVAL 14 HOUR + INTERVAL 30 MINUTE, 'Completado', DATE_SUB(NOW(), INTERVAL 3 DAY)),

-- Turnos futuros (reservados)
(1, 1, 1, 'Ana Martinez', DATE_ADD(CURDATE(), INTERVAL 2 DAY) + INTERVAL 9 HOUR + INTERVAL 30 MINUTE, 'Reservado', NOW()),
(1, 2, 1, 'Pedro Lopez', DATE_ADD(CURDATE(), INTERVAL 3 DAY) + INTERVAL 14 HOUR, 'Reservado', NOW()),
(1, 3, 6, 'Laura Fernandez', DATE_ADD(CURDATE(), INTERVAL 1 DAY) + INTERVAL 10 HOUR + INTERVAL 30 MINUTE, 'Reservado', NOW()),
(1, 5, 3, 'Roberto Gomez', DATE_ADD(CURDATE(), INTERVAL 4 DAY) + INTERVAL 15 HOUR, 'Reservado', NOW()),
(1, 9, 4, 'Sofia Sanchez', DATE_ADD(CURDATE(), INTERVAL 2 DAY) + INTERVAL 10 HOUR, 'Reservado', NOW()),

-- Turno cancelado
(1, 4, 2, 'Juan Perez', DATE_SUB(NOW(), INTERVAL 1 DAY) + INTERVAL 10 HOUR, 'Cancelado', DATE_SUB(NOW(), INTERVAL 2 DAY));

-- Turnos de Vialidad
INSERT INTO turnos (empresa_id, profesional_id, servicio_id, cliente_name, start_datetime, status, created_at)
SELECT 2, p.id, 31, 'Maria Gonzalez', DATE_ADD(CURDATE(), INTERVAL 1 DAY) + INTERVAL 9 HOUR, 'Reservado', NOW()
FROM profesionales p WHERE p.empresa_id = 2 LIMIT 1;

INSERT INTO turnos (empresa_id, profesional_id, servicio_id, cliente_name, start_datetime, status, created_at)
SELECT 2, p.id, 31, 'Carlos Rodriguez', DATE_ADD(CURDATE(), INTERVAL 2 DAY) + INTERVAL 10 HOUR + INTERVAL 30 MINUTE, 'Reservado', NOW()
FROM profesionales p WHERE p.empresa_id = 2 LIMIT 1 OFFSET 1;

-- Turnos de Administración Pública
INSERT INTO turnos (empresa_id, profesional_id, servicio_id, cliente_name, start_datetime, status, created_at)
SELECT 3, p.id, 34, 'Pedro Lopez', DATE_ADD(CURDATE(), INTERVAL 1 DAY) + INTERVAL 8 HOUR + INTERVAL 30 MINUTE, 'Reservado', NOW()
FROM profesionales p WHERE p.empresa_id = 3 LIMIT 1;

INSERT INTO turnos (empresa_id, profesional_id, servicio_id, cliente_name, start_datetime, status, created_at)
SELECT 3, p.id, 35, 'Laura Fernandez', DATE_ADD(CURDATE(), INTERVAL 2 DAY) + INTERVAL 9 HOUR, 'Reservado', NOW()
FROM profesionales p WHERE p.empresa_id = 3 LIMIT 1 OFFSET 1;

-- Turnos de Registro Civil
INSERT INTO turnos (empresa_id, profesional_id, servicio_id, cliente_name, start_datetime, status, created_at)
SELECT 4, p.id, 38, 'Sofia Sanchez', DATE_ADD(CURDATE(), INTERVAL 1 DAY) + INTERVAL 9 HOUR, 'Reservado', NOW()
FROM profesionales p WHERE p.empresa_id = 4 LIMIT 1;

INSERT INTO turnos (empresa_id, profesional_id, servicio_id, cliente_name, start_datetime, status, created_at)
SELECT 4, p.id, 39, 'Juan Perez', DATE_ADD(CURDATE(), INTERVAL 2 DAY) + INTERVAL 10 HOUR, 'Reservado', NOW()
FROM profesionales p WHERE p.empresa_id = 4 LIMIT 1 OFFSET 1;

-- ============================================================
-- VERIFICACIÓN DE DATOS INSERTADOS
-- ============================================================
SELECT 'Empresas insertadas:' as Info, COUNT(*) as Cantidad FROM Empresas
UNION ALL
SELECT 'Profesionales insertados:', COUNT(*) FROM profesionales
UNION ALL
SELECT 'Servicios insertados:', COUNT(*) FROM servicios
UNION ALL
SELECT 'Disponibilidades insertadas:', COUNT(*) FROM disponibilidades
UNION ALL
SELECT 'Clientes insertados:', COUNT(*) FROM clientes
UNION ALL
SELECT 'Turnos insertados:', COUNT(*) FROM turnos;

-- Mostrar distribución de profesionales por especialidad
SELECT especialidad, COUNT(*) as Cantidad 
FROM profesionales 
WHERE empresa_id = 1 
GROUP BY especialidad 
ORDER BY Cantidad DESC;

-- ============================================================
-- NOTAS IMPORTANTES
-- ============================================================
-- 
-- CREDENCIALES DE EMPRESAS (SECTORES):
-- Todas las empresas tienen password: '123456'
-- 1. Hospital Municipal: username='hospital_muni'
-- 2. Vialidad: username='vialidad_muni'
-- 3. Administración Pública: username='admin_muni'
-- 4. Registro Civil: username='registro_civil'
--
-- CREDENCIALES DE CLIENTES:
-- Todos los clientes tienen password: '123456'
-- DNI de prueba:
-- - 12345678 (Juan Perez)
-- - 23456789 (Maria Gonzalez)
-- - 34567890 (Carlos Rodriguez)
-- - 45678901 (Ana Martinez)
-- - 56789012 (Pedro Lopez)
-- - 67890123 (Laura Fernandez)
-- - 78901234 (Roberto Gomez)
-- - 89012345 (Sofia Sanchez)
--
-- PROFESIONALES:
-- Total: 93 profesionales
-- - 83 en Hospital Municipal (todas las especialidades)
-- - 3 en Vialidad
-- - 3 en Administración Pública  
-- - 2 en Registro Civil
-- ============================================================INSERT INTO profesionales (empresa_id, name, surname, email, dni, matricula, especialidad, created_at) VALUES -- Cirugía (3 profesionales) (1, 'Santiago', 'Braghero', 'santiago.braghero@coroneldorrego.gob.ar', '00000001', 'CIR-001', 'Cirugía', NOW()), (1, 'Mauro', 'Sueldo', 'mauro.sueldo@coroneldorrego.gob.ar', '00000002', 'CIR-002', 'Cirugía', NOW()), (1, 'Nicolas', 'Crego', 'nicolas.crego@coroneldorrego.gob.ar', '00000003', 'CIR-003', 'Cirugía', NOW()),  -- Otorrinolaringología (1 profesional) (1, 'Andres', 'Gigon', 'andres.gigon@coroneldorrego.gob.ar', '00000004', 'OTO-004', 'Otorrinolaringología', NOW()),  -- Pediatría (5 profesionales) (1, 'Nicolas Hernan', 'Testani', 'nicolas.testani@coroneldorrego.gob.ar', '00000005', 'PED-005', 'Pediatría', NOW()), (1, 'Natacha Noemi', 'Sabarnik', 'natacha.sabarnik@coroneldorrego.gob.ar', '00000006', 'PED-006', 'Pediatría', NOW()), (1, 'Florencia', 'Maydana', 'florencia.maydana@coroneldorrego.gob.ar', '00000021', 'PED-021', 'Pediatría', NOW()), (1, 'Carolina', 'Bertazo', 'carolina.bertazo@coroneldorrego.gob.ar', '00000022', 'PED-022', 'Pediatría', NOW()),  -- Psicología (9 profesionales) (1, 'Mariano', 'Minnaard', 'mariano.minnaard@coroneldorrego.gob.ar', '00000007', 'PSI-007', 'Psicología', NOW()), (1, 'Natalia Gabriela', 'Peciña', 'natalia.pecina@coroneldorrego.gob.ar', '00000008', 'PSI-008', 'Psicología', NOW()), (1, 'Maria Del Rosario', 'Martinez', 'maria.martinez@coroneldorrego.gob.ar', '00000009', 'PSI-009', 'Psicología', NOW()), (1, 'Maria Silvina', 'Di Paolo', 'maria.dipaolo@coroneldorrego.gob.ar', '00000010', 'PSI-010', 'Psicología', NOW()), (1, 'Cintia Eliana', 'Gette', 'cintia.gette@coroneldorrego.gob.ar', '00000011', 'PSI-011', 'Psicología', NOW()), (1, 'Romina', 'Merlo', 'romina.merlo@coroneldorrego.gob.ar', '00000012', 'PSI-012', 'Psicología', NOW()), (1, 'Monica Alejandra', 'Amado', 'monica.amado@coroneldorrego.gob.ar', '00000013', 'PSI-013', 'Psicología', NOW()), (1, 'Ainara', 'Castell Madariaga', 'ainara.castell@coroneldorrego.gob.ar', '00000049', 'PSI-049', 'Psicología', NOW()), (1, 'Maria Del Carmen', 'Codagnone', 'carmen.codagnone@coroneldorrego.gob.ar', '00000065', 'PSI-065', 'Psicología', NOW()),  -- Psiquiatría (3 profesionales) (1, 'Maria Julieta', 'Mena', 'maria.mena@coroneldorrego.gob.ar', '00000014', 'PSQ-014', 'Psiquiatría', NOW()), (1, 'Florencia', 'Schmit', 'florencia.schmit@coroneldorrego.gob.ar', '00000068', 'PSQ-068', 'Psiquiatría', NOW()), (1, 'Ariel Cesar', 'Juarez', 'ariel.juarez@coroneldorrego.gob.ar', '00000081', 'PSQ-081', 'Psiquiatría', NOW()),  -- Clínica General (13 profesionales) (1, 'Hugo', 'Abraham', 'hugo.abraham@coroneldorrego.gob.ar', '00000015', 'CLI-015', 'Clínica General', NOW()), (1, 'Cesar Gabriel', 'Gigena', 'cesar.gigena@coroneldorrego.gob.ar', '00000017', 'CLI-017', 'Clínica General', NOW()), (1, 'Paulina', 'Alonso', 'paulina.alonso@coroneldorrego.gob.ar', '00000018', 'CLI-018', 'Clínica General', NOW()), (1, 'Maria De Los Angeles', 'Altuna', 'maria.altuna@coroneldorrego.gob.ar', '00000023', 'CLI-023', 'Clínica General', NOW()), (1, 'Eduardo Bernabe', 'Gagna', 'eduardo.gagna@coroneldorrego.gob.ar', '00000037', 'CLI-037', 'Clínica General', NOW()), (1, 'Juan Manuel', 'Cobian', 'juan.cobian@coroneldorrego.gob.ar', '00000040', 'CLI-040', 'Clínica General', NOW()), (1, 'Fabian Andres', 'Zorzano', 'fabian.zorzano@coroneldorrego.gob.ar', '00000046', 'CLI-046', 'Clínica General', NOW()), (1, 'Julian', 'Del Valle', 'julian.delvalle@coroneldorrego.gob.ar', '00000058', 'CLI-058', 'Clínica General', NOW()), (1, 'Marcela', 'Mc Allister', 'marcela.mcallister@coroneldorrego.gob.ar', '00000066', 'CLI-066', 'Clínica General', NOW()), (1, 'Claudia Mariel', 'Larsen', 'claudia.larsen@coroneldorrego.gob.ar', '00000070', 'CLI-070', 'Clínica General', NOW()), (1, 'Oscar Eduardo', 'Mena', 'oscar.mena@coroneldorrego.gob.ar', '00000072', 'CLI-072', 'Clínica General', NOW()), (1, 'Javier Luis', 'Falcon', 'javier.falcon@coroneldorrego.gob.ar', '00000075', 'CLI-075', 'Clínica General', NOW()), (1, 'Claudio', 'Camp...

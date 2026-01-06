-- ============================================================
-- SCRIPT DE INSTALACIÓN COMPLETA - SISTEMA DE TURNOS
-- Municipio de Coronel Dorrego
-- ============================================================
-- Este script crea la base de datos desde cero
-- Ejecutar con: mysql -u root -p < INSTALL.sql
-- ============================================================

-- ============================================================
-- BLOQUE 1: CREAR BASE DE DATOS
-- ============================================================
DROP DATABASE IF EXISTS ProyectoTurnos;
CREATE DATABASE ProyectoTurnos DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ProyectoTurnos;

-- ============================================================
-- BLOQUE 2: CREAR USUARIO Y PERMISOS (OPCIONAL)
-- ============================================================
-- Descomentar si necesitas crear un usuario específico para la API
-- CREATE USER IF NOT EXISTS 'user_api_1'@'localhost' IDENTIFIED BY 'pass_user_1';
-- GRANT ALL PRIVILEGES ON ProyectoTurnos.* TO 'user_api_1'@'localhost' WITH GRANT OPTION;
-- FLUSH PRIVILEGES;

-- ============================================================
-- BLOQUE 3: TABLA EMPRESAS (Tabla Maestra - Sin dependencias)
-- ============================================================
-- Representa los sectores del municipio (Hospital, Vialidad, etc.)
CREATE TABLE Empresas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL UNIQUE COMMENT 'Nombre del sector/empresa',
    username VARCHAR(150) NOT NULL UNIQUE COMMENT 'Usuario para login administrativo',
    password VARCHAR(255) NOT NULL COMMENT 'Contraseña hasheada',
    email VARCHAR(255) UNIQUE COMMENT 'Email de contacto',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación',
    INDEX idx_username (username),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- BLOQUE 4: TABLA CLIENTES (Sin dependencias)
-- ============================================================
-- Almacena los clientes que reservan turnos
CREATE TABLE clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dni VARCHAR(20) NOT NULL UNIQUE COMMENT 'DNI del cliente (identificador único)',
    nombre VARCHAR(255) NOT NULL COMMENT 'Nombre del cliente',
    apellido VARCHAR(255) NOT NULL COMMENT 'Apellido del cliente',
    email VARCHAR(255) UNIQUE COMMENT 'Email del cliente (opcional)',
    telefono VARCHAR(20) COMMENT 'Teléfono del cliente (opcional)',
    password VARCHAR(255) NOT NULL COMMENT 'Contraseña hasheada para login',
    activo BOOLEAN DEFAULT TRUE COMMENT 'Indica si la cuenta está activa',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de registro',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Última actualización',
    INDEX idx_dni (dni),
    INDEX idx_email (email),
    INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- BLOQUE 5: TABLA PROFESIONALES (Depende de Empresas)
-- ============================================================
-- Almacena los profesionales que atienden en cada sector
CREATE TABLE profesionales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL COMMENT 'ID del sector/empresa',
    name VARCHAR(255) NOT NULL COMMENT 'Nombre del profesional',
    surname VARCHAR(255) NOT NULL COMMENT 'Apellido del profesional',
    email VARCHAR(255) UNIQUE COMMENT 'Email del profesional',
    dni CHAR(8) UNIQUE NOT NULL COMMENT 'DNI del profesional',
    matricula VARCHAR(10) UNIQUE NOT NULL COMMENT 'Matrícula profesional',
    especialidad VARCHAR(255) DEFAULT 'Consulta General' COMMENT 'Especialidad o categoría (ej: Clínica General, Cardiología)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de registro',
    FOREIGN KEY (empresa_id) REFERENCES Empresas(id) ON DELETE CASCADE,
    INDEX idx_empresa (empresa_id),
    INDEX idx_dni (dni),
    INDEX idx_matricula (matricula),
    INDEX idx_especialidad (especialidad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- BLOQUE 6: TABLA SERVICIOS (Depende de Empresas)
-- ============================================================
-- Almacena los servicios que ofrece cada sector
CREATE TABLE servicios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL COMMENT 'ID del sector/empresa',
    name VARCHAR(255) NOT NULL COMMENT 'Nombre del servicio',
    duration_minutes INT DEFAULT 30 COMMENT 'Duración en minutos',
    price INT DEFAULT 0 COMMENT 'Precio del servicio',
    description VARCHAR(500) COMMENT 'Descripción del servicio',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación',
    FOREIGN KEY (empresa_id) REFERENCES Empresas(id) ON DELETE CASCADE,
    INDEX idx_empresa (empresa_id),
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- BLOQUE 7: TABLA DISPONIBILIDADES (Depende de Profesionales y Empresas)
-- ============================================================
-- Almacena los horarios de disponibilidad de cada profesional
-- day_of_week: 0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado
CREATE TABLE disponibilidades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profesional_id INT NOT NULL COMMENT 'ID del profesional',
    empresa_id INT NOT NULL COMMENT 'ID del sector/empresa',
    day_of_week TINYINT NOT NULL COMMENT 'Día de la semana (0=Domingo, 1=Lunes, ..., 6=Sábado)',
    start_time TIME NOT NULL COMMENT 'Hora de inicio',
    end_time TIME NOT NULL COMMENT 'Hora de fin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación',
    FOREIGN KEY (profesional_id) REFERENCES profesionales(id) ON DELETE CASCADE,
    FOREIGN KEY (empresa_id) REFERENCES Empresas(id) ON DELETE CASCADE,
    INDEX idx_profesional (profesional_id),
    INDEX idx_empresa (empresa_id),
    INDEX idx_dia (day_of_week),
    UNIQUE KEY unique_horario (profesional_id, day_of_week, start_time, end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- BLOQUE 8: TABLA TURNOS (Depende de Empresas, Profesionales y Servicios)
-- ============================================================
-- Almacena los turnos reservados
-- status: 'Reservado', 'Completado', 'Cancelado'
CREATE TABLE turnos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL COMMENT 'ID del sector/empresa',
    profesional_id INT NOT NULL COMMENT 'ID del profesional',
    servicio_id INT NULL COMMENT 'ID del servicio (NULL para consulta general automática)',
    cliente_name VARCHAR(255) NOT NULL COMMENT 'Nombre completo del cliente',
    observaciones TEXT COMMENT 'Observaciones o consideraciones del turno (opcional)',
    start_datetime DATETIME NOT NULL COMMENT 'Fecha y hora de inicio del turno',
    status VARCHAR(50) DEFAULT 'Reservado' COMMENT 'Estado: Reservado, Completado, Cancelado',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación del registro',
    FOREIGN KEY (empresa_id) REFERENCES Empresas(id) ON DELETE CASCADE,
    FOREIGN KEY (profesional_id) REFERENCES profesionales(id) ON DELETE CASCADE,
    FOREIGN KEY (servicio_id) REFERENCES servicios(id) ON DELETE SET NULL,
    INDEX idx_empresa (empresa_id),
    INDEX idx_profesional (profesional_id),
    INDEX idx_servicio (servicio_id),
    INDEX idx_cliente (cliente_name),
    INDEX idx_fecha (start_datetime),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- VERIFICACIÓN DE TABLAS CREADAS
-- ============================================================
SELECT 'Base de datos creada exitosamente' AS Mensaje;
SELECT 'Tablas creadas:' AS Info;
SHOW TABLES;

-- ============================================================
-- NOTAS IMPORTANTES
-- ============================================================
-- 
-- 1. ESTRUCTURA DE LA BASE DE DATOS:
--    - Empresas: Sectores del municipio (Hospital, Vialidad, etc.)
--    - Clientes: Usuarios que reservan turnos (autenticación por DNI)
--    - Profesionales: Personal que atiende en cada sector
--    - Servicios: Servicios ofrecidos por cada sector
--    - Disponibilidades: Horarios de atención de cada profesional
--    - Turnos: Turnos reservados por los clientes
--
-- 2. RELACIONES:
--    - Profesionales -> Empresas (muchos a uno)
--    - Servicios -> Empresas (muchos a uno)
--    - Disponibilidades -> Profesionales y Empresas (muchos a uno)
--    - Turnos -> Empresas, Profesionales y Servicios (muchos a uno)
--
-- 3. PRÓXIMOS PASOS:
--    - Ejecutar SEED MUNI.sql para poblar con datos de prueba
--    - Configurar el usuario de la API si es necesario
--    - Verificar que todas las tablas se crearon correctamente
--
-- ============================================================


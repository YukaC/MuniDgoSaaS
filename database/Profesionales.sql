USE ProyectoTurnos;

-- Añadir los servicios que pueden prestar cada profesional --
CREATE TABLE IF NOT EXISTS profesionales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    surname VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    dni CHAR(8) UNIQUE NOT NULL,
    matricula VARCHAR(10) UNIQUE NOT NULL,
    created_at DATETIME,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);
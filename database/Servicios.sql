USE ProyectoTurnos;

CREATE TABLE IF NOT EXISTS servicios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL,
    name VARCHAR(255) NOT NULL UNIQUE,
    duration_minutes INT DEFAULT 30,
    price INT DEFAULT 0,
    description VARCHAR(255),
    created_at DATETIME,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

# 📦 Scripts de Base de Datos - TurnosApp

## Archivos Principales

| Archivo | Descripción | Cuándo usar |
|---------|-------------|-------------|
| `01_INSTALL.sql` | Crea la BD y todas las tablas | Primera instalación |
| `02_SEED_MUNI.sql` | Datos de prueba (Municipio Dorrego) | Después de INSTALL |
| `03_LIMPIEZA.sql` | Elimina turnos antiguos (>14 días) | Cada 2 semanas (después del backup) |

## Instalación Completa

### Opción 1: MySQL CLI
```bash
mysql -u root -p < 01_INSTALL.sql
mysql -u root -p < 02_SEED_MUNI.sql
```

### Opción 2: MySQL Workbench
1. Abrir `01_INSTALL.sql`
2. Ejecutar (⚡)
3. Abrir `02_SEED_MUNI.sql`
4. Ejecutar (⚡)

---

## 🧹 Mantenimiento (Cada 2 semanas)

```bash
# 1. Primero hacer backup
mysqldump -u root -p turnos_dorrego > backup_$(date +%Y%m%d).sql

# 2. Ejecutar limpieza
mysql -u root -p turnos_dorrego < 03_LIMPIEZA.sql
```

El script de limpieza:
- Elimina turnos `Completado` y `Cancelado` mayores a 14 días
- Mantiene turnos `Reservado` y `Pendiente de Confirmación`
- Optimiza las tablas para recuperar espacio

---

### Opción 2: MySQL Workbench
1. Abrir `01_INSTALL.sql`
2. Ejecutar (⚡)
3. Abrir `02_SEED_MUNI.sql`
4. Ejecutar (⚡)

---

## ⚠️ Importante

- `01_INSTALL.sql` **elimina la BD existente** antes de crearla
- Los índices de optimización ya están incluidos en `01_INSTALL.sql`
- Los scripts de backup están en `backup_linux.sh` y `backup_windows.bat`

---

## Credenciales de Prueba

### Empresas (Admin)
| Username | Password | Sector |
|----------|----------|--------|
| `hospital_muni` | `123456` | Hospital Municipal |
| `vialidad_muni` | `123456` | Vialidad |
| `admin_muni` | `123456` | Administración Pública |
| `registro_civil` | `123456` | Registro Civil |

### Clientes (Portal Ciudadano)
| DNI | Password | Nombre |
|-----|----------|--------|
| `12345678` | `123456` | Juan Perez |
| `23456789` | `123456` | Maria Gonzalez |
| `34567890` | `123456` | Carlos Rodriguez |

---

## Scripts de Backup

### Windows
```cmd
backup_windows.bat
```

### Linux
```bash
chmod +x backup_linux.sh
./backup_linux.sh
```

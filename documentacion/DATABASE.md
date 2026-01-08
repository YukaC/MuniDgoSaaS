# 🗄️ Guía de Base de Datos - TurnosApp

El proyecto utiliza **MySQL 8.0+** como motor de base de datos. El nombre por defecto de la base es `turnos_dorrego`.

---

## 📂 Estructura de Scripts

Los scripts SQL se encuentran en la carpeta `database/` del proyecto.

| Archivo | Descripción | Uso |
|:--------|:------------|:----|
| `01_INSTALL.sql` | **Estructura**. Crea la BD, tablas, vistas, triggers y procedimientos almacenados. | **Obligatorio** al instalar. |
| `02_SEED_MUNI.sql` | **Datos de prueba**. Inserta usuarios, empresas, servicios y turnos de ejemplo. | *Opcional* (para desarrollo). |
| `03_LIMPIEZA.sql` | **Mantenimiento**. Elimina turnos viejos completados/cancelados. | Ejecutar periódicamente. |

---

## 🛠️ Instalación Manual

1. Acceder a MySQL:
   ```bash
   mysql -u root -p
   ```

2. Ejecutar los scripts en orden:
   ```sql
   SOURCE database/01_INSTALL.sql;
   SOURCE database/02_SEED_MUNI.sql;
   ```

   *Nota: Si estás usando MySQL Workbench, puedes abrir los archivos `.sql` y ejecutarlos con el icono del rayo.*

---

## 🧹 Mantenimiento de Datos

El script interactivo `03_LIMPIEZA.sql` permite limpiar la base de datos de información antigua para optimizar espacio y rendimiento.

**Reglas de limpieza:**
- Elimina turnos con estado `Completado` o `Cancelado`.
- Solo elimina turnos con antigüedad mayor a **14 días**.
- Mantiene todos los turnos `Reservado` o `Pendiente de Confirmación`.
- Ejecuta `OPTIMIZE TABLE` al finalizar para reclamar espacio en disco.

**Ejecución:**
Se recomienda automatizar este script con un Cron Job o Tarea Programada de Windows, o ejecutarlo manualmente antes de realizar backups.

---

## 💾 Backups

El sistema incluye scripts para realizar copias de seguridad automáticas en la carpeta `backups/`.

- **Windows**: Ejecutar `database/backup_windows.bat`
- **Linux**: Ejecutar `database/backup_linux.sh`

Recuerda configurar las credenciales correctas dentro de estos scripts si difieren de las credenciales por defecto.

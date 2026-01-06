# Pasos para Activar Eventos Automáticos - Mi Turno

## Sistema: Mi Turno - Municipalidad de Coronel Dorrego

Este documento describe los pasos necesarios para activar los eventos automáticos del sistema después del deploy.

---

## 📋 Requisitos Previos

- MySQL/MariaDB instalado y funcionando
- Acceso de administrador a la base de datos
- Base de datos `ProyectoTurnos` creada y poblada

---

## 🚀 Pasos para Activar Eventos Automáticos

### Paso 1: Conectarse a MySQL

Abre una terminal o consola y conéctate a MySQL con privilegios de administrador:

```bash
mysql -u root -p
```

O si usas un usuario específico:

```bash
mysql -u TU_USUARIO -p
```

### Paso 2: Seleccionar la Base de Datos

```sql
USE ProyectoTurnos;
```

### Paso 3: Ejecutar el Script de Eventos

Ejecuta el script que contiene todos los procedimientos y eventos:

```sql
source database/EVENTOS_AUTOMATICOS.sql;
```

**O si estás en Windows y el path es diferente:**

```sql
source D:/Proyectos/turnosApp/database/EVENTOS_AUTOMATICOS.sql;
```

**O copia y pega el contenido del archivo directamente en la consola de MySQL.**

### Paso 4: Verificar que los Eventos se Crearon Correctamente

```sql
SELECT 
    EVENT_NAME AS NombreEvento,
    EVENT_DEFINITION AS Definicion,
    INTERVAL_VALUE AS IntervaloValor,
    INTERVAL_FIELD AS IntervaloCampo,
    STATUS AS Estado,
    LAST_EXECUTED AS UltimaEjecucion,
    NEXT_EXECUTION_TIME AS ProximaEjecucion
FROM INFORMATION_SCHEMA.EVENTS
WHERE EVENT_SCHEMA = 'ProyectoTurnos'
ORDER BY EVENT_NAME;
```

Deberías ver dos eventos:
- `evento_actualizar_estados_turnos` (cada 1 HOUR)
- `evento_backup_diario` (cada 1 DAY)

### Paso 5: Verificar que el Event Scheduler está Activo

```sql
SELECT @@event_scheduler AS EstadoEventScheduler;
```

Debería mostrar `ON`. Si muestra `OFF`, ejecuta:

```sql
SET GLOBAL event_scheduler = ON;
```

---

## 🔄 Eventos Configurados

### 1. Actualización Automática de Estados de Turnos

**Evento:** `evento_actualizar_estados_turnos`  
**Frecuencia:** Cada 1 hora  
**Función:** Actualiza automáticamente los turnos que ya pasaron su fecha/hora y los marca como "Pendiente de Confirmación"

**Procedimiento:** `ActualizarEstadosTurnos()`

### 2. Backup Automático (Registro)

**Evento:** `evento_backup_diario`  
**Frecuencia:** Cada día a las 2:00 AM  
**Función:** Registra en la tabla `backup_logs` la intención de crear un backup

**Nota:** El backup real debe ejecutarse mediante scripts del sistema operativo (ver sección de Backups).

---

## 💾 Configuración de Backups Reales

El evento de backup solo registra la intención. Para crear backups reales, configura uno de los siguientes métodos:

### Opción A: Script de Windows

1. Edita el archivo `database/backup_windows.bat`
2. Configura las variables:
   ```batch
   set DB_USER=root
   set DB_PASSWORD=TU_PASSWORD_AQUI
   set DB_NAME=ProyectoTurnos
   set BACKUP_DIR=C:\backups\mi_turno
   ```
3. Crea el directorio de backups:
   ```batch
   mkdir C:\backups\mi_turno
   ```
4. Programa el script en Tareas Programadas de Windows:
   - Abre "Programador de tareas"
   - Crea una tarea básica
   - Configura para ejecutarse diariamente a las 2:00 AM
   - Acción: Iniciar programa → `backup_windows.bat`

### Opción B: Script de Linux

1. Edita el archivo `database/backup_linux.sh`
2. Configura las variables:
   ```bash
   DB_USER="root"
   DB_PASSWORD="TU_PASSWORD_AQUI"
   DB_NAME="ProyectoTurnos"
   BACKUP_DIR="/var/backups/mi_turno"
   ```
3. Da permisos de ejecución:
   ```bash
   chmod +x database/backup_linux.sh
   ```
4. Crea el directorio:
   ```bash
   sudo mkdir -p /var/backups/mi_turno
   sudo chown TU_USUARIO:TU_USUARIO /var/backups/mi_turno
   ```
5. Agrega a crontab:
   ```bash
   crontab -e
   ```
   Agrega esta línea:
   ```
   0 2 * * * /ruta/completa/database/backup_linux.sh >> /var/log/backup_mi_turno.log 2>&1
   ```

---

## 🔍 Verificación y Monitoreo

### Ver Logs de Backups

```sql
SELECT * FROM backup_logs 
ORDER BY fecha_backup DESC 
LIMIT 10;
```

### Ver Última Ejecución de Eventos

```sql
SELECT 
    EVENT_NAME,
    LAST_EXECUTED,
    NEXT_EXECUTION_TIME,
    STATUS
FROM INFORMATION_SCHEMA.EVENTS
WHERE EVENT_SCHEMA = 'ProyectoTurnos';
```

### Verificar Turnos Actualizados

```sql
SELECT COUNT(*) AS TurnosPendientesConfirmacion
FROM turnos
WHERE status = 'Pendiente de Confirmación'
AND DATE(start_datetime) < CURDATE();
```

---

## ⚠️ Solución de Problemas

### El Event Scheduler está Desactivado

Si después de reiniciar MySQL el event scheduler se desactiva, agrega esta línea al archivo `my.cnf` o `my.ini`:

```ini
[mysqld]
event_scheduler=ON
```

Luego reinicia MySQL.

### Los Eventos No se Ejecutan

1. Verifica que el event scheduler esté activo:
   ```sql
   SELECT @@event_scheduler;
   ```

2. Verifica el estado de los eventos:
   ```sql
   SELECT EVENT_NAME, STATUS FROM INFORMATION_SCHEMA.EVENTS 
   WHERE EVENT_SCHEMA = 'ProyectoTurnos';
   ```

3. Si están en estado `DISABLED`, actívalos:
   ```sql
   ALTER EVENT evento_actualizar_estados_turnos ENABLE;
   ALTER EVENT evento_backup_diario ENABLE;
   ```

### Error de Permisos

Asegúrate de que el usuario de MySQL tenga los permisos necesarios:

```sql
GRANT EVENT ON ProyectoTurnos.* TO 'TU_USUARIO'@'localhost';
FLUSH PRIVILEGES;
```

---

## 📝 Notas Importantes

1. **Backups Reales:** Los eventos de MySQL solo registran la intención de backup. Los backups reales deben ejecutarse mediante scripts del sistema operativo.

2. **Mantenimiento:** Revisa periódicamente los logs de backup y los eventos para asegurar que funcionan correctamente.

3. **Seguridad:** Nunca dejes las contraseñas en texto plano en los scripts de producción. Considera usar variables de entorno o archivos de configuración seguros.

4. **Espacio en Disco:** Los backups ocupan espacio. Configura la eliminación automática de backups antiguos (los scripts ya incluyen esta funcionalidad para backups de más de 30 días).

---

## ✅ Checklist Post-Deploy

- [ ] Event scheduler activado (`ON`)
- [ ] Eventos creados y habilitados
- [ ] Procedimientos almacenados creados
- [ ] Tabla `backup_logs` creada
- [ ] Script de backup configurado (Windows o Linux)
- [ ] Directorio de backups creado
- [ ] Tarea programada/cron configurada
- [ ] Verificación de primera ejecución exitosa

---

## 📞 Soporte

Si encuentras problemas al activar los eventos, verifica:
1. Los logs de MySQL
2. Los permisos del usuario
3. La configuración del event scheduler
4. La sintaxis de los procedimientos almacenados


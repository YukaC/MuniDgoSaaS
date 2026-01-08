#!/bin/bash
# ============================================================
# Script de Backup Automático para Linux
# Sistema: Mi Turno - Municipalidad de Coronel Dorrego
# ============================================================

# Configuración
DB_USER="root"
DB_PASSWORD="TU_PASSWORD_AQUI"
DB_NAME="turnos_dorrego"
BACKUP_DIR="/var/backups/mi_turno"

# Crear directorio de backup si no existe
mkdir -p "$BACKUP_DIR"

# Obtener fecha y hora en formato YYYYMMDD_HHMMSS
FECHA=$(date +%Y%m%d_%H%M%S)

# Nombre del archivo de backup
BACKUP_FILE="$BACKUP_DIR/backup_${DB_NAME}_${FECHA}.sql"

# Ejecutar mysqldump
echo "Creando backup: $BACKUP_FILE"
mysqldump -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "Backup creado exitosamente: $BACKUP_FILE"
    
    # Comprimir el backup
    gzip "$BACKUP_FILE"
    
    # Eliminar backups antiguos (mantener solo los últimos 30 días)
    find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +30 -delete
    
    echo "Backup completado y comprimido"
else
    echo "ERROR: No se pudo crear el backup"
    exit 1
fi


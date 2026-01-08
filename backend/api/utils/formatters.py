"""
Formateadores de Respuestas - Funciones para formatear datos de BD a JSON
Creado para aplicar principio DRY y estandarizar respuestas
"""

# Query estándar para obtener turnos con JOINs
TURNO_SELECT_QUERY = """
    SELECT 
        t.id, 
        t.empresa_id, 
        t.profesional_id, 
        t.servicio_id, 
        t.cliente_name, 
        t.observaciones,
        t.start_datetime, 
        t.status, 
        t.created_at,
        p.name AS profesional_nombre, 
        p.surname AS profesional_apellido,
        p.especialidad AS profesional_especialidad,
        s.name AS servicio_nombre, 
        s.price AS precio,
        e.nombre AS empresa_nombre
    FROM turnos t
    LEFT JOIN profesionales p ON t.profesional_id = p.id
    LEFT JOIN servicios s ON t.servicio_id = s.id
    LEFT JOIN empresas e ON t.empresa_id = e.id
"""


def format_turno_row(row):
    """
    Formatea una fila de turno (tupla) a diccionario.
    Espera el resultado de TURNO_SELECT_QUERY.
    
    Args:
        row: Tupla con los campos del turno
        
    Returns:
        dict: Turno formateado para JSON
    """
    if not row:
        return None
        
    return {
        "id": row[0],
        "empresa_id": row[1],
        "profesional_id": row[2],
        "servicio_id": row[3],
        "cliente_name": row[4],
        "observaciones": row[5],
        "start_datetime": str(row[6]) if row[6] else None,
        "status": row[7],
        "created_at": str(row[8]) if row[8] else None,
        "profesional_nombre": row[9],
        "profesional_apellido": row[10],
        "profesional_especialidad": row[11] or "Consulta General",
        "servicio_nombre": row[12] or row[11] or "Consulta General",
        "precio": row[13] or 0,
        "empresa_nombre": row[14] if len(row) > 14 else None
    }


def format_turno_list(rows):
    """
    Formatea una lista de filas de turnos.
    
    Args:
        rows: Lista de tuplas de turnos
        
    Returns:
        list: Lista de turnos formateados
    """
    return [format_turno_row(row) for row in rows if row]


def format_cliente_row(row):
    """
    Formatea una fila de cliente a diccionario.
    
    Args:
        row: Tupla (id, dni, nombre, apellido, email, telefono)
        
    Returns:
        dict: Cliente formateado para JSON
    """
    if not row:
        return None
        
    return {
        "id": row[0],
        "dni": row[1],
        "nombre": row[2],
        "apellido": row[3],
        "email": row[4],
        "telefono": row[5]
    }


def format_cliente_list(rows):
    """Formatea lista de clientes"""
    return [format_cliente_row(row) for row in rows if row]


def format_disponibilidad_resumen(rows):
    """
    Formatea el resumen de disponibilidades por profesional.
    
    Args:
        rows: Lista de tuplas (profesional_id, day_of_week)
        
    Returns:
        dict: {profesional_id: [dias]}
    """
    from api.utils.db_helpers import DIAS_SEMANA
    
    resumen = {}
    for pid, dia_num in rows:
        pid_str = str(pid)
        if pid_str not in resumen:
            resumen[pid_str] = []
        nombre_dia = DIAS_SEMANA.get(dia_num, "")
        if nombre_dia and nombre_dia not in resumen[pid_str]:
            resumen[pid_str].append(nombre_dia)
    return resumen


def format_horario_slot(hora_actual):
    """
    Formatea un slot de horario disponible.
    
    Args:
        hora_actual: datetime del slot
        
    Returns:
        dict: {"hora": "HH:MM", "datetime": "YYYY-MM-DD HH:MM:SS"}
    """
    return {
        "hora": hora_actual.strftime('%H:%M'),
        "datetime": hora_actual.strftime('%Y-%m-%d %H:%M:%S')
    }

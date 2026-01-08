"""
Helpers de Base de Datos - Funciones reutilizables para operaciones comunes
Usando Connection Pooling para alta concurrencia
"""
from contextlib import contextmanager
from api.db.db_config import get_db_cursor as db_cursor, execute_query, execute_insert, execute_update


# Re-exportar el context manager del pool
@contextmanager
def get_db_cursor(dictionary=False):
    """
    Context manager para conexión a BD con pooling.
    
    Uso:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM tabla")
            resultado = cursor.fetchall()
    """
    with db_cursor(dictionary=dictionary) as cursor:
        yield cursor


# ==================== HELPERS DE CLIENTE ====================

def get_cliente_name_by_id(cliente_id):
    """
    Obtiene el nombre completo del cliente por su ID.
    
    Args:
        cliente_id: ID del cliente
        
    Returns:
        str: "nombre apellido" o None si no existe
    """
    result = execute_query(
        "SELECT nombre, apellido FROM clientes WHERE id = %s",
        (cliente_id,),
        fetch_one=True
    )
    if result:
        return f"{result[0]} {result[1]}"
    return None


def get_cliente_by_id(cliente_id):
    """
    Obtiene todos los datos de un cliente por su ID.
    
    Returns:
        dict o None
    """
    result = execute_query(
        "SELECT id, dni, nombre, apellido, email, telefono FROM clientes WHERE id = %s",
        (cliente_id,),
        fetch_one=True
    )
    if result:
        return {
            "id": result[0],
            "dni": result[1],
            "nombre": result[2],
            "apellido": result[3],
            "email": result[4],
            "telefono": result[5]
        }
    return None


# ==================== HELPERS DE VALIDACIÓN ====================

def validate_profesional_empresa(profesional_id, empresa_id):
    """
    Valida que un profesional pertenezca a una empresa.
    
    Returns:
        dict con 'id' y 'especialidad' si existe, None si no
    """
    result = execute_query(
        "SELECT id, especialidad FROM profesionales WHERE id = %s AND empresa_id = %s",
        (profesional_id, empresa_id),
        fetch_one=True
    )
    if result:
        return {"id": result[0], "especialidad": result[1]}
    return None


def validate_servicio_empresa(servicio_id, empresa_id):
    """
    Valida que un servicio pertenezca a una empresa.
    
    Returns:
        dict con 'id' y 'duration_minutes' si existe, None si no
    """
    result = execute_query(
        "SELECT id, duration_minutes FROM servicios WHERE id = %s AND empresa_id = %s",
        (servicio_id, empresa_id),
        fetch_one=True
    )
    if result:
        return {"id": result[0], "duration_minutes": result[1]}
    return None


def cliente_exists(cliente_id):
    """Verifica si un cliente existe"""
    result = execute_query(
        "SELECT id FROM clientes WHERE id = %s",
        (cliente_id,),
        fetch_one=True
    )
    return result is not None


def profesional_exists(profesional_id, empresa_id=None):
    """Verifica si un profesional existe (opcionalmente en una empresa)"""
    if empresa_id:
        query = "SELECT id FROM profesionales WHERE id = %s AND empresa_id = %s"
        params = (profesional_id, empresa_id)
    else:
        query = "SELECT id FROM profesionales WHERE id = %s"
        params = (profesional_id,)
    
    result = execute_query(query, params, fetch_one=True)
    return result is not None


def servicio_exists(servicio_id, empresa_id=None):
    """Verifica si un servicio existe (opcionalmente en una empresa)"""
    if empresa_id:
        query = "SELECT id FROM servicios WHERE id = %s AND empresa_id = %s"
        params = (servicio_id, empresa_id)
    else:
        query = "SELECT id FROM servicios WHERE id = %s"
        params = (servicio_id,)
    
    result = execute_query(query, params, fetch_one=True)
    return result is not None


# ==================== HELPERS DE TURNOS ====================

def check_turno_overlap(profesional_id, start_datetime, duracion_minutos, exclude_turno_id=None):
    """
    Verifica si hay superposición de turnos para un profesional.
    
    Args:
        profesional_id: ID del profesional
        start_datetime: Fecha/hora del turno (formato 'YYYY-MM-DD HH:MM:SS')
        duracion_minutos: Duración del turno en minutos
        exclude_turno_id: ID de turno a excluir (para ediciones)
        
    Returns:
        bool: True si hay superposición, False si está libre
    """
    query = """
        SELECT t.id FROM turnos t
        LEFT JOIN servicios s ON t.servicio_id = s.id
        WHERE t.profesional_id = %s
        AND t.status != 'Cancelado'
        AND t.start_datetime < DATE_ADD(%s, INTERVAL %s MINUTE)
        AND DATE_ADD(t.start_datetime, INTERVAL COALESCE(s.duration_minutes, 30) MINUTE) > %s
    """
    params = [profesional_id, start_datetime, duracion_minutos, start_datetime]
    
    if exclude_turno_id:
        query += " AND t.id != %s"
        params.append(exclude_turno_id)
    
    result = execute_query(query, params, fetch_one=True)
    return result is not None


def get_turnos_profesional_fecha(profesional_id, fecha):
    """
    Obtiene todos los turnos de un profesional en una fecha.
    
    Returns:
        list: Lista de turnos
    """
    return execute_query(
        """SELECT start_datetime, 
           DATE_ADD(start_datetime, INTERVAL COALESCE(s.duration_minutes, 30) MINUTE) as end_datetime
           FROM turnos t
           LEFT JOIN servicios s ON t.servicio_id = s.id
           WHERE t.profesional_id = %s AND DATE(t.start_datetime) = %s AND t.status != 'Cancelado'""",
        (profesional_id, fecha)
    )


# ==================== CONSTANTES ====================

DIAS_SEMANA = {
    0: "Domingo",
    1: "Lunes",
    2: "Martes",
    3: "Miércoles",
    4: "Jueves",
    5: "Viernes",
    6: "Sábado"
}


def python_weekday_to_db(weekday):
    """
    Convierte weekday de Python a formato de BD.
    Python: 0=Lunes, 6=Domingo
    BD: 0=Domingo, 1=Lunes, ..., 6=Sábado
    """
    if weekday == 6:  # Domingo en Python
        return 0  # Domingo en BD
    return weekday + 1


def db_weekday_to_python(db_weekday):
    """
    Convierte weekday de BD a formato Python.
    """
    if db_weekday == 0:  # Domingo en BD
        return 6  # Domingo en Python
    return db_weekday - 1

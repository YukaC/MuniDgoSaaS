"""
Configuración de Base de Datos con Connection Pooling
Optimizado para alta concurrencia
"""
import os
import logging
from contextlib import contextmanager
from dotenv import load_dotenv
from mysql.connector import pooling, Error as MySQLError

load_dotenv()

# Configuración del logger
logger = logging.getLogger(__name__)

# ==================== CONFIGURACIÓN DEL POOL ====================

# Configuración de la base de datos
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT") or 3306),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME"),
    "charset": "utf8mb4",
    "use_unicode": True,
    "autocommit": False,
    "get_warnings": True,
    "raise_on_warnings": False,
    "connection_timeout": 10,
}

# Tamaño del pool según entorno
FLASK_ENV = os.getenv("FLASK_ENV", "development")
POOL_SIZE = 5 if FLASK_ENV == "development" else 20
POOL_NAME = "turnos_dorrego_pool"

# Variable global para el pool
_connection_pool = None


def init_connection_pool():
    """
    Inicializa el pool de conexiones a la base de datos.
    Debe llamarse al iniciar la aplicación.
    """
    global _connection_pool
    
    if _connection_pool is not None:
        return _connection_pool
    
    try:
        _connection_pool = pooling.MySQLConnectionPool(
            pool_name=POOL_NAME,
            pool_size=POOL_SIZE,
            pool_reset_session=True,
            **DB_CONFIG
        )
        logger.info(f"Pool de conexiones MySQL inicializado (tamaño: {POOL_SIZE})")
        return _connection_pool
    except MySQLError as e:
        logger.error(f"Error al crear pool de conexiones: {e}")
        raise


def get_db_connection():
    """
    Obtiene una conexión del pool.
    
    Returns:
        MySQLConnection: Conexión a la base de datos
        
    Raises:
        Exception: Si no hay conexiones disponibles
    """
    global _connection_pool
    
    # Inicializar pool si no existe
    if _connection_pool is None:
        init_connection_pool()
    
    try:
        connection = _connection_pool.get_connection()
        
        # Verificar que la conexión esté activa
        if not connection.is_connected():
            connection.reconnect(attempts=3, delay=1)
        
        return connection
        
    except MySQLError as e:
        logger.error(f"Error al obtener conexión del pool: {e}")
        raise


@contextmanager
def get_db_cursor(dictionary=False, buffered=True):
    """
    Context manager para obtener cursor con manejo automático de conexión.
    
    Args:
        dictionary: Si True, retorna resultados como diccionarios
        buffered: Si True, usa cursor buffered (recomendado para lecturas)
    
    Yields:
        cursor: Cursor de la base de datos
    
    Usage:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM tabla")
            resultados = cursor.fetchall()
    """
    connection = None
    cursor = None
    
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=dictionary, buffered=buffered)
        yield cursor
        connection.commit()
        
    except MySQLError as e:
        if connection:
            connection.rollback()
        logger.error(f"Error en operación de BD: {e}")
        raise
        
    finally:
        if cursor:
            try:
                cursor.close()
            except:
                pass
        if connection:
            try:
                # Devolver conexión al pool
                connection.close()
            except:
                pass


def check_db_health():
    """
    Verifica el estado de la conexión a la base de datos.
    
    Returns:
        dict: Estado de salud con detalles
    """
    health = {
        "connected": False,
        "pool_size": POOL_SIZE,
        "pool_name": POOL_NAME
    }
    
    try:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
            health["connected"] = True
            health["status"] = "healthy"
    except Exception as e:
        health["status"] = "unhealthy"
        health["error"] = str(e)
    
    return health


def close_pool():
    """
    Cierra el pool de conexiones.
    Llamar al cerrar la aplicación.
    """
    global _connection_pool
    
    if _connection_pool:
        # MySQL Connector no tiene método explícito para cerrar el pool
        # Las conexiones se cierran automáticamente
        _connection_pool = None
        logger.info("Pool de conexiones cerrado")


# ==================== QUERY HELPERS ====================

def execute_query(query, params=None, fetch_one=False, fetch_all=True):
    """
    Ejecuta una query SELECT y retorna resultados.
    
    Args:
        query: SQL query
        params: Parámetros para la query
        fetch_one: Si True, retorna solo un registro
        fetch_all: Si True, retorna todos los registros
    
    Returns:
        Resultados de la query
    """
    with get_db_cursor() as cursor:
        cursor.execute(query, params or ())
        
        if fetch_one:
            return cursor.fetchone()
        if fetch_all:
            return cursor.fetchall()
        return None


def execute_insert(query, params=None):
    """
    Ejecuta un INSERT y retorna el ID insertado.
    
    Returns:
        int: ID del registro insertado
    """
    with get_db_cursor() as cursor:
        cursor.execute(query, params or ())
        return cursor.lastrowid


def execute_update(query, params=None):
    """
    Ejecuta un UPDATE/DELETE y retorna filas afectadas.
    
    Returns:
        int: Número de filas afectadas
    """
    with get_db_cursor() as cursor:
        cursor.execute(query, params or ())
        return cursor.rowcount
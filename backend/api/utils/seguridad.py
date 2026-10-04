import jwt
import logging
from functools import wraps
from flask import jsonify, request
from api import app
from api.utils.db_helpers import get_db_cursor

logger = logging.getLogger(__name__)

def requiere_token(func):
    @wraps(func)
    def decorador(*args, **kwargs):
        # Log de debug (solo se muestra si DEBUG está habilitado)
        logger.debug(f"requiere_token: kwargs={kwargs}")

        # Verifica que exista el header 'x-access-token'
        if 'x-access-token' not in request.headers:
            return jsonify({"message": "No contiene el header x-access-token"}), 401
        
        # Obtiene el token del header
        token = request.headers["x-access-token"]

        # Verifica que el token no esté vacío
        if not token:
            return jsonify({"message": "Contiene el header x-access-token, pero esta vacio"}), 401

        # Intenta obtener el id_empresa desde los argumentos de la ruta
        id_empresa = None
        if 'id_empresa' in kwargs:
            id_empresa = kwargs['id_empresa']
        
        # Si no está en los argumentos, busca el header 'id-empresa'
        if id_empresa is None:
            if 'id-empresa' not in request.headers:
                return jsonify({"message": "No contiene el header id-empresa"}), 401
            
            id_empresa = request.headers["id-empresa"]

        # Verifica que id_empresa no esté vacío
        if not id_empresa:
            return jsonify({"message": "Contiene el header id-empresa, pero está vacio"}), 401
        
        # Decodifica el token JWT y verifica que el id coincida con id_empresa
        try:
            info = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            id_token = info["id"]

            # Si el id del token no coincide con id_empresa, devuelve error 401
            if int(id_token) != int(id_empresa):
                return jsonify({"message": "No coincide id del token con el del header"}), 401
        except Exception as e:
            # Si hay algún error al decodificar el token, devuelve error 401
            return jsonify({"message": e.args[0]}), 401

        # Si todo está correcto, ejecuta la función original
        return func(*args, **kwargs)
    return decorador

ALLOWED_TABLES = {"clientes", "profesionales", "servicios", "turnos", "disponibilidades", "empresas"}

def misma_empresa(tabla):
    """
    Decorador para validar que el recurso (id) pertenezca a la empresa del header.
    Asume que el parámetro en la URL siempre se llama 'id'.
    Usa el nombre de columna 'empresa_id' en la base de datos (según modelo Profesionales).
    """
    def decorador(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            logger.debug(f"misma_empresa({tabla}): kwargs={kwargs}")

            if tabla not in ALLOWED_TABLES:
                return jsonify({"message": "Nombre de tabla inválido"}), 400

            # Intenta obtener el id_empresa desde los argumentos de la ruta
            id_empresa = None
            if 'id_empresa' in kwargs:
                id_empresa = kwargs['id_empresa']
            
            # Si no está en los argumentos, busca el header 'id-empresa'
            if id_empresa is None:
                if 'id-empresa' not in request.headers:
                    return jsonify({"message": "No contiene el header id-empresa"}), 401
                
                id_empresa = request.headers["id-empresa"]

            # Verifica que id_empresa no esté vacío
            if not id_empresa:
                return jsonify({"message": "Contiene el header id-empresa, pero está vacio"}), 401

            # Busca el parámetro 'id' en los argumentos de la ruta
            id_recurso = None
            if 'id' in kwargs:
                id_recurso = kwargs['id']
            
            # Si no encuentra 'id' en la URL, devuelve error
            if not id_recurso:
                 return jsonify({"message": "No se encontró el parámetro 'id' en la URL"}), 400

            try:
                with get_db_cursor() as cursor:
                    # Consulta SQL dinámica para la tabla, pero segura en parámetros
                    query = f"SELECT 1 FROM {tabla} WHERE id = %s AND empresa_id = %s"
                    cursor.execute(query, (id_recurso, id_empresa))
                    resultado = cursor.fetchone()

                # Si no devuelve nada, el recurso no existe o no pertenece a la empresa
                if not resultado:
                    return jsonify({"message": "Recurso no encontrado o no autorizado"}), 404

            except Exception as e:
                logger.error(f"Error en misma_empresa: {e}")
                return jsonify({"message": "Error de base de datos"}), 500

            # Si todo está correcto, ejecuta la función original
            return func(*args, **kwargs)
        return wrapper
    return decorador

def validar_referencias(mapa_referencias):
    """
    Valida que los IDs enviados en el Body (JSON) pertenezcan a la empresa.
    
    :param mapa_referencias: Dict {'campo_json': 'tabla_bd'}
    Ejemplo: @validar_referencias({'profesional_id': 'profesionales', 'servicio_id': 'servicios'})
    """
    def decorador(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            logger.debug(f"validar_referencias: kwargs={kwargs}")

            # Intenta obtener el id_empresa desde los argumentos de la ruta
            id_empresa = None
            if 'id_empresa' in kwargs:
                id_empresa = kwargs['id_empresa']
            
            # Si no está en los argumentos, busca el header 'id-empresa'
            if id_empresa is None:
                if 'id-empresa' not in request.headers:
                    return jsonify({"message": "No contiene el header id-empresa"}), 401
                
                id_empresa = request.headers["id-empresa"]

            # Verifica que id_empresa no esté vacío
            if not id_empresa:
                return jsonify({"message": "Contiene el header id-empresa, pero está vacio"}), 401
            
            
            datos = request.get_json()

            if not datos:
                # Si no hay body y esperamos validar algo del body, es un error (o lo ignoramos)
                return jsonify({"message": "Se esperaba un cuerpo JSON para validar referencias"}), 400

            try:
                with get_db_cursor() as cursor:
                    for campo_json, tabla_bd in mapa_referencias.items():
                        # Solo validamos si el campo viene en el JSON
                        if campo_json in datos:
                            valor_id = datos[campo_json]
                            
                            # Si es None o 0, lo saltamos
                            if not valor_id: 
                                continue

                            if tabla_bd not in ALLOWED_TABLES:
                                return jsonify({"message": f"Nombre de tabla {tabla_bd} inválido"}), 400

                            # Validamos contra la BD: ¿Este ID foráneo es de mi empresa?
                            query = f"SELECT 1 FROM {tabla_bd} WHERE id = %s AND empresa_id = %s"
                            cursor.execute(query, (valor_id, id_empresa))
                            
                            if not cursor.fetchone():
                                return jsonify({
                                    "message": f"Acceso Denegado: El {campo_json} ({valor_id}) no pertenece a su empresa."
                                }), 403

            except Exception as e:
                logger.error(f"Error validando referencias: {e}")
                return jsonify({"message": "Error validando referencias"}), 500

            return func(*args, **kwargs)
        return wrapper
    return decorador
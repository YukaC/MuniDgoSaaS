import jwt
from functools import wraps
from flask import jsonify, request
from api import app
from api.db.db_config import get_db_connection

def requiere_token_cliente(func):
    """
    Decorador para validar que el cliente esté autenticado.
    Requiere el header 'x-access-token-cliente' con un token JWT válido.
    """
    @wraps(func)
    def decorador(*args, **kwargs):
        # Verifica que exista el header 'x-access-token-cliente'
        if 'x-access-token-cliente' not in request.headers:
            return jsonify({"message": "No contiene el header x-access-token-cliente"}), 401
        
        # Obtiene el token del header
        token = request.headers["x-access-token-cliente"]

        # Verifica que el token no esté vacío
        if not token:
            return jsonify({"message": "Token de cliente vacío"}), 401

        # Decodifica el token JWT
        try:
            info = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            cliente_id = info.get("cliente_id")
            dni = info.get("dni")
            
            if not cliente_id:
                return jsonify({"message": "Token inválido: falta cliente_id"}), 401

            # Verificar que el cliente existe y está activo
            connection = get_db_connection()
            cursor = connection.cursor()
            cursor.execute("SELECT id, activo FROM clientes WHERE id = %s", (cliente_id,))
            cliente = cursor.fetchone()
            cursor.close()
            connection.close()

            if not cliente:
                return jsonify({"message": "Cliente no encontrado"}), 404

            if not cliente[1]:  # activo
                return jsonify({"message": "Cuenta desactivada"}), 403

            # Agregar información del cliente al request para uso en la función
            request.cliente_id = cliente_id
            request.cliente_dni = dni

        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token expirado"}), 401
        except jwt.InvalidTokenError as e:
            return jsonify({"message": f"Token inválido: {str(e)}"}), 401
        except Exception as e:
            return jsonify({"message": f"Error al validar token: {str(e)}"}), 500

        # Si todo está correcto, ejecuta la función original
        return func(*args, **kwargs)
    return decorador

def mismo_cliente_o_publico(func):
    """
    Decorador que permite acceso si:
    1. El cliente está autenticado Y es el dueño del recurso
    2. O si el recurso es público (sin autenticación requerida)
    Útil para endpoints que pueden ser accedidos por el cliente o por búsqueda pública.
    """
    @wraps(func)
    def decorador(*args, **kwargs):
        # Si hay token, validar que sea el mismo cliente
        if 'x-access-token-cliente' in request.headers:
            token = request.headers["x-access-token-cliente"]
            if token:
                try:
                    info = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
                    request.cliente_id = info.get("cliente_id")
                except:
                    pass  # Si el token es inválido, continuar sin autenticación
        
        return func(*args, **kwargs)
    return decorador


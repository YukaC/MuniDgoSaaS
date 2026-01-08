from flask import request, jsonify
from api.models.Clientes import Cliente
from api.utils.rate_limit import rate_limit_registro, rate_limit_login
from api.utils.sanitizer import sanitize_string, sanitize_dni, sanitize_email, sanitize_telefono
from api import app

# ==================== AUTENTICACIÓN DE CLIENTES ====================

# ---------------------- REGISTRO DE CLIENTE ----------------------
@app.route('/cliente/registro', methods=['POST'])
@rate_limit_registro
def registrar_cliente():
    """Endpoint público para registro de nuevos clientes"""
    datos = request.get_json()
    
    if not datos:
        return jsonify({"message": "Se requiere un cuerpo JSON"}), 400

    try:
        # Sanitizar inputs antes de validar
        datos['dni'] = sanitize_dni(datos.get('dni'))
        datos['nombre'] = sanitize_string(datos.get('nombre'), max_length=100)
        datos['apellido'] = sanitize_string(datos.get('apellido'), max_length=100)
        datos['email'] = sanitize_email(datos.get('email')) if datos.get('email') else None
        datos['telefono'] = sanitize_telefono(datos.get('telefono')) if datos.get('telefono') else None
        
        # Validar campos requeridos
        if not datos.get("dni") or not datos.get("nombre") or not datos.get("apellido") or not datos.get("password"):
            return jsonify({"message": "DNI, nombre, apellido y contraseña son requeridos"}), 400

        # Validar formato de DNI (solo números, entre 7 y 8 dígitos)
        dni = datos["dni"]
        if not dni.isdigit() or len(dni) < 7 or len(dni) > 8:
            return jsonify({"message": "DNI inválido. Debe contener entre 7 y 8 dígitos numéricos"}), 400

        # Validar longitud mínima de contraseña
        if len(datos["password"]) < 6:
            return jsonify({"message": "La contraseña debe tener al menos 6 caracteres"}), 400

        nuevo_cliente = Cliente.register(datos)
        return jsonify({
            "message": "Cliente registrado exitosamente",
            "cliente": nuevo_cliente
        }), 201

    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": f"Error al registrar cliente: {str(e)}"}), 500


# ---------------------- LOGIN DE CLIENTE ----------------------
@app.route('/cliente/login', methods=['POST'])
@rate_limit_login
def login_cliente():
    """Endpoint público para login de clientes por DNI"""
    datos = request.get_json()
    
    if not datos:
        return jsonify({"message": "Se requiere un cuerpo JSON"}), 400

    dni = datos.get("dni", "").strip()
    password = datos.get("password", "")

    if not dni or not password:
        return jsonify({"message": "DNI y contraseña son requeridos"}), 400

    try:
        resultado = Cliente.login(dni, password)
        return jsonify(resultado), 200
    except ValueError as e:
        return jsonify({"message": str(e)}), 401
    except Exception as e:
        return jsonify({"message": f"Error al autenticar: {str(e)}"}), 500


# ---------------------- OBTENER PERFIL DE CLIENTE ----------------------
@app.route('/cliente/perfil', methods=['GET'])
def obtener_perfil_cliente():
    """Endpoint protegido para obtener el perfil del cliente autenticado"""
    from api.utils.seguridad_clientes import requiere_token_cliente
    
    @requiere_token_cliente
    def _obtener_perfil():
        try:
            cliente_id = request.cliente_id
            cliente = Cliente.get_cliente_by_id(cliente_id)
            
            if not cliente:
                return jsonify({"message": "Cliente no encontrado"}), 404
            
            return jsonify(cliente), 200
        except Exception as e:
            return jsonify({"message": str(e)}), 500
    
    return _obtener_perfil()


# ---------------------- ACTUALIZAR PERFIL DE CLIENTE ----------------------
@app.route('/cliente/perfil', methods=['PUT'])
def actualizar_perfil_cliente():
    """Endpoint protegido para actualizar el perfil del cliente autenticado"""
    from api.utils.seguridad_clientes import requiere_token_cliente
    
    @requiere_token_cliente
    def _actualizar_perfil():
        datos = request.get_json()
        
        if not datos:
            return jsonify({"message": "Se requiere un cuerpo JSON"}), 400

        try:
            cliente_id = request.cliente_id
            
            # No permitir cambiar el DNI (es el identificador único)
            if "dni" in datos:
                del datos["dni"]
            
            cliente_actualizado = Cliente.update_cliente(cliente_id, datos)
            return jsonify({
                "message": "Perfil actualizado exitosamente",
                "cliente": cliente_actualizado
            }), 200
        except ValueError as e:
            return jsonify({"message": str(e)}), 400
        except Exception as e:
            return jsonify({"message": str(e)}), 500
    
    return _actualizar_perfil()


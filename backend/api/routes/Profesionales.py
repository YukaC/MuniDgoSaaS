"""
Rutas de API para Profesionales - Refactorizado con DRY y Cache
"""
from flask import request, jsonify

from api import app
from api.models.Profesionales import Profesional
from api.utils.seguridad import requiere_token, misma_empresa
from api.utils.db_helpers import get_db_cursor, validate_profesional_empresa, DIAS_SEMANA
from api.cache.cache_manager import cache_manager
from api.cache.cache_keys import CacheKeys
from api.utils.sanitizer import sanitize_string, sanitize_dni, sanitize_email


# ---------------------- OBTENER TODOS ----------------------
@app.route('/profesionales', methods=['GET'])
@requiere_token
def obtener_profesionales():
    try:
        profesionales = Profesional.get_profesionales()
        return jsonify(profesionales), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- OBTENER POR EMPRESA ----------------------
@app.route('/empresa/<int:id_empresa>/profesionales', methods=['GET'])
@requiere_token
def obtener_profesionales_por_empresa(id_empresa):
    # Intentar obtener del cache
    cache_key = CacheKeys.profesionales_empresa(id_empresa)
    cached_result = cache_manager.get(cache_key)
    if cached_result is not None:
        return jsonify(cached_result), 200
    
    try:
        profesionales = Profesional.get_profesionales_by_idempresa(id_empresa)
        
        # Guardar en cache (5 minutos)
        cache_manager.set(cache_key, profesionales, CacheKeys.TTL_LONG)
        
        return jsonify(profesionales), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- OBTENER UNO POR ID ----------------------
@app.route('/empresa/<int:id_empresa>/profesional/<int:id>', methods=['GET'])
@requiere_token
@misma_empresa(tabla='profesionales')
def obtener_profesional(id, id_empresa):
    try:
        profesional = Profesional.get_profesional_by_id(id)
        if profesional is None:
            return jsonify({"message": "Profesional no encontrado"}), 404
        
        return jsonify(profesional), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- CREAR ----------------------
@app.route('/profesional', methods=['POST'])
@requiere_token
def crear_profesional():
    datos = request.get_json()
    datos['empresa_id'] = int(request.headers['id-empresa'])
    
    # Sanitizar inputs
    if 'name' in datos:
        datos['name'] = sanitize_string(datos.get('name'), max_length=100)
    if 'surname' in datos:
        datos['surname'] = sanitize_string(datos.get('surname'), max_length=100)
    if 'email' in datos:
        datos['email'] = sanitize_email(datos.get('email')) if datos.get('email') else None
    if 'dni' in datos:
        datos['dni'] = sanitize_dni(datos.get('dni'))
    if 'matricula' in datos:
        datos['matricula'] = sanitize_string(datos.get('matricula'), max_length=50)
    if 'especialidad' in datos:
        datos['especialidad'] = sanitize_string(datos.get('especialidad'), max_length=100)

    try:
        nuevo = Profesional.create_profesional(datos)
        
        # Invalidar cache
        cache_manager.invalidate(CacheKeys.invalidar_profesionales(datos['empresa_id']))
        
        return jsonify(nuevo), 201
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- ACTUALIZAR ----------------------
@app.route('/empresa/<int:id_empresa>/profesional/<int:id>', methods=['PUT'])
@requiere_token
@misma_empresa(tabla='profesionales')
def actualizar_profesional(id_empresa, id):
    datos = request.get_json()
    datos['empresa_id'] = int(id_empresa)
    
    # Sanitizar inputs
    if 'name' in datos:
        datos['name'] = sanitize_string(datos.get('name'), max_length=100)
    if 'surname' in datos:
        datos['surname'] = sanitize_string(datos.get('surname'), max_length=100)
    if 'email' in datos:
        datos['email'] = sanitize_email(datos.get('email')) if datos.get('email') else None
    if 'dni' in datos:
        datos['dni'] = sanitize_dni(datos.get('dni'))
    if 'matricula' in datos:
        datos['matricula'] = sanitize_string(datos.get('matricula'), max_length=50)
    if 'especialidad' in datos:
        datos['especialidad'] = sanitize_string(datos.get('especialidad'), max_length=100)

    try:
        actualizado = Profesional.update_profesional(id, datos)
        
        # Invalidar cache
        cache_manager.invalidate(CacheKeys.invalidar_profesionales(id_empresa))
        
        return jsonify(actualizado), 200
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- ELIMINAR ----------------------
@app.route('/empresa/<int:id_empresa>/profesional/<int:id>', methods=['DELETE'])
@requiere_token
@misma_empresa(tabla='profesionales')
def eliminar_profesional(id_empresa, id):
    try:
        eliminado = Profesional.delete_profesional(id)
        
        # Invalidar cache
        cache_manager.invalidate(CacheKeys.invalidar_profesionales(id_empresa))
        
        return jsonify(eliminado), 200
    except ValueError as e:
        return jsonify({"message": str(e)}), 404
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- OBTENER DÍAS DISPONIBLES DE UN PROFESIONAL ----------------------
@app.route('/empresa/<int:id_empresa>/profesional/<int:id_profesional>/dias-disponibles', methods=['GET'])
@requiere_token
def obtener_dias_disponibles_profesional_admin(id_empresa, id_profesional):
    """Endpoint que devuelve los días de la semana en que trabaja un profesional"""
    
    # Validar profesional
    if not validate_profesional_empresa(id_profesional, id_empresa):
        return jsonify({"message": "Profesional no encontrado"}), 404
    
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                SELECT DISTINCT day_of_week FROM disponibilidades 
                WHERE profesional_id = %s 
                ORDER BY day_of_week
            """, (id_profesional,))
            dias = [row[0] for row in cursor.fetchall()]
        
        dias_info = [
            {"dia_numero": dia, "dia_nombre": DIAS_SEMANA.get(dia, "Desconocido")} 
            for dia in dias
        ]
        
        return jsonify({"dias_disponibles": dias_info}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500

from flask import request, jsonify
from api.models.Disponibilidades import Disponibilidad
from api.utils.seguridad import requiere_token, misma_empresa, validar_referencias
from api import app

# ---------------------- OBTENER TODAS ----------------------
@app.route('/disponibilidades', methods=['GET'])
@requiere_token
def obtener_disponibilidades():
    try:
        disponibilidades = Disponibilidad.get_disponibilidades()
        return jsonify(disponibilidades), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- OBTENER POR EMPRESA ----------------------
@app.route('/empresa/<int:id_empresa>/disponibilidades', methods=['GET'])
@requiere_token
def obtener_disponibilidades_por_empresa(id_empresa):
    try:
        disponibilidades = Disponibilidad.get_disponibilidades_by_idempresa(id_empresa)
        return jsonify(disponibilidades), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- OBTENER RESUMEN DISPONIBILIDADES (BULK) ----------------------
@app.route('/empresa/<int:id_empresa>/profesionales/disponibilidades-resumen', methods=['GET'])
@requiere_token
def obtener_resumen_disponibilidades_empresa(id_empresa):
    """
    Devuelve un resumen de los días disponibles para TODOS los profesionales de la empresa.
    Formato: { profesional_id: ["Lunes", "Miércoles"], ... }
    Optimiza la carga en el frontend evitando N requests.
    """
    from api.utils.db_helpers import get_db_cursor, DIAS_SEMANA
    from api.cache.cache_manager import cache_manager
    from api.cache.cache_keys import CacheKeys
    
    # Intentar obtener del cache
    cache_key = CacheKeys.disponibilidades_resumen(id_empresa)
    cached_result = cache_manager.get(cache_key)
    if cached_result is not None:
        return jsonify(cached_result), 200
    
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                """SELECT d.profesional_id, d.day_of_week 
                   FROM disponibilidades d
                   JOIN profesionales p ON d.profesional_id = p.id
                   WHERE p.empresa_id = %s
                   ORDER BY d.profesional_id, d.day_of_week""",
                (id_empresa,)
            )
            filas = cursor.fetchall()
        
        resumen = {}
        for pid, dia_num in filas:
            if pid not in resumen:
                resumen[pid] = []
            nombre_dia = DIAS_SEMANA.get(dia_num, "")
            if nombre_dia not in resumen[pid]:
                resumen[pid].append(nombre_dia)
        
        # Guardar en cache (2 minutos)
        cache_manager.set(cache_key, resumen, CacheKeys.TTL_MEDIUM)
                
        return jsonify(resumen), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- OBTENER POR PROFESIONAL ----------------------
@app.route('/empresa/<int:id_empresa>/profesional/<int:id>/disponibilidades', methods=['GET'])
@requiere_token
@misma_empresa(tabla='profesionales')
def obtener_disponibilidades_por_profesional(id,id_empresa):
    try:
        disponibilidades = Disponibilidad.get_disponibilidades_by_idprofesional(id)
        return jsonify(disponibilidades), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- OBTENER UNA ----------------------
@app.route('/empresa/<int:id_empresa>/disponibilidad/<int:id>', methods=['GET'])
@requiere_token
@misma_empresa(tabla='disponibilidades')
def obtener_disponibilidad(id,id_empresa):
    try:
        disponibilidad = Disponibilidad.get_disponibilidad_by_id(id)
        if disponibilidad is None:
            return jsonify({"message": "Disponibilidad no encontrada"}), 404
        return jsonify(disponibilidad), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- CREAR ----------------------
@app.route('/disponibilidad', methods=['POST'])
@requiere_token
@validar_referencias({
    'profesional_id': 'profesionales',
})
def crear_disponibilidad():
    datos = request.get_json()

    datos['empresa_id'] = int(request.headers['id-empresa'])

    try:
        # El modelo ya valida duplicados y superposición de horarios, lanzando ValueError
        nueva = Disponibilidad.create_disponibilidad(datos)
        return jsonify(nueva), 201
    except ValueError as e:
        # Captura errores de validación o horarios superpuestos
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- ACTUALIZAR ----------------------
@app.route('/empresa/<int:id_empresa>/disponibilidad/<int:id>', methods=['PUT'])
@requiere_token
@misma_empresa(tabla='disponibilidades')
@validar_referencias({
    'profesional_id': 'profesionales',
})
def actualizar_disponibilidad(id,id_empresa):
    datos = request.get_json()

    datos['empresa_id'] = int(id_empresa)
    try:
        actualizada = Disponibilidad.update_disponibilidad(id, datos)
        return jsonify(actualizada), 200
    except ValueError as e:
        # Captura si la disponibilidad no existe o si la edición crea conflicto de horarios
        # Si el error es "No existe...", idealmente sería 404, pero generalizamos a 400
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- ELIMINAR ----------------------
@app.route('/empresa/<int:id_empresa>/disponibilidad/<int:id>', methods=['DELETE'])
@requiere_token
@misma_empresa(tabla='disponibilidades')
def eliminar_disponibilidad(id,id_empresa):
    try:
        eliminada = Disponibilidad.delete_disponibilidad(id)
        return jsonify(eliminada), 200
    except ValueError as e:
        # El modelo lanza ValueError si no encuentra el ID para borrar
        return jsonify({"message": str(e)}), 404
    except Exception as e:
        return jsonify({"message": str(e)}), 500
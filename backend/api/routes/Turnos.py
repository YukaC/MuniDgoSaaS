"""
Rutas de API para Turnos - Refactorizado con DRY y Cache
"""
from flask import request, jsonify
from datetime import datetime, timedelta

from api import app
from api.models.Turnos import Turno
from api.utils.seguridad import requiere_token, misma_empresa, validar_referencias
from api.utils.db_helpers import (
    get_db_cursor, validate_profesional_empresa, validate_servicio_empresa,
    python_weekday_to_db
)
from api.utils.formatters import format_horario_slot
from api.cache.cache_manager import cache_manager
from api.cache.cache_keys import CacheKeys
from api.utils.sanitizer import sanitize_string, sanitize_observaciones


# ---------------------- OBTENER TODOS ----------------------
@app.route('/turnos', methods=['GET'])
@requiere_token
def obtener_turnos():
    try:
        turnos = Turno.get_turnos()
        return jsonify(turnos), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- OBTENER POR EMPRESA ----------------------
@app.route('/empresa/<int:id_empresa>/turnos', methods=['GET'])
@requiere_token
def obtener_turnos_por_empresa(id_empresa):
    try:
        turnos = Turno.get_turnos_by_idempresa(id_empresa)
        return jsonify(turnos), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- OBTENER UNO ----------------------
@app.route('/empresa/<int:id_empresa>/turno/<int:id>', methods=['GET'])
@requiere_token
@misma_empresa(tabla='turnos')
def obtener_turno(id, id_empresa):
    try:
        turno = Turno.get_turno_by_id(id)
        if turno is None:
            return jsonify({"message": "Turno no encontrado"}), 404
        return jsonify(turno), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- CREAR ----------------------
@app.route('/turno', methods=['POST'])
@requiere_token
@validar_referencias({'profesional_id': 'profesionales'})
def crear_turno():
    datos = request.get_json()
    datos['empresa_id'] = int(request.headers['id-empresa'])
    
    # Sanitizar inputs
    if 'cliente_name' in datos:
        datos['cliente_name'] = sanitize_string(datos.get('cliente_name'), max_length=200)
    if 'observaciones' in datos:
        datos['observaciones'] = sanitize_observaciones(datos.get('observaciones'))

    try:
        nuevo = Turno.create_turno(datos)
        
        # Invalidar cache de horarios
        if datos.get('profesional_id') and datos.get('start_datetime'):
            fecha = datos['start_datetime'][:10]
            cache_manager.invalidate(
                CacheKeys.invalidar_turno(
                    datos['empresa_id'], 
                    datos['profesional_id'], 
                    fecha
                )
            )
        
        return jsonify(nuevo), 201
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- ACTUALIZAR ----------------------
@app.route('/empresa/<int:id_empresa>/turno/<int:id>', methods=['PUT'])
@requiere_token
@misma_empresa(tabla='turnos')
@validar_referencias({'profesional_id': 'profesionales'})
def actualizar_turno(id, id_empresa):
    datos = request.get_json()
    datos['empresa_id'] = int(id_empresa)
    
    # Sanitizar inputs
    if 'cliente_name' in datos:
        datos['cliente_name'] = sanitize_string(datos.get('cliente_name'), max_length=200)
    if 'observaciones' in datos:
        datos['observaciones'] = sanitize_observaciones(datos.get('observaciones'))
    
    # Validar servicio_id solo si se proporciona
    if datos.get('servicio_id'):
        if not validate_servicio_empresa(datos['servicio_id'], id_empresa):
            return jsonify({"message": "Servicio no encontrado o no pertenece a la empresa"}), 400

    try:
        actualizado = Turno.update_turno(id, datos)
        
        # Invalidar cache
        if datos.get('profesional_id') and datos.get('start_datetime'):
            fecha = datos['start_datetime'][:10]
            cache_manager.invalidate(
                CacheKeys.invalidar_turno(id_empresa, datos['profesional_id'], fecha)
            )
        
        return jsonify(actualizado), 200
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- ELIMINAR ----------------------
@app.route('/empresa/<int:id_empresa>/turno/<int:id>', methods=['DELETE'])
@requiere_token
@misma_empresa(tabla='turnos')
def eliminar_turno(id, id_empresa):
    try:
        # Obtener datos del turno antes de eliminar para invalidar cache
        turno = Turno.get_turno_by_id(id)
        
        eliminado = Turno.delete_turno(id)
        
        # Invalidar cache si teníamos datos
        if turno and turno.get('profesional_id') and turno.get('start_datetime'):
            fecha = turno['start_datetime'][:10]
            cache_manager.invalidate(
                CacheKeys.invalidar_turno(id_empresa, turno['profesional_id'], fecha)
            )
        
        return jsonify(eliminado), 200
    except ValueError as e:
        return jsonify({"message": str(e)}), 404
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- ACTUALIZAR ESTADOS AUTOMÁTICAMENTE ----------------------
@app.route('/actualizar-estados-turnos', methods=['POST'])
@requiere_token
def actualizar_estados_turnos():
    """
    Actualiza automáticamente los estados de turnos que ya pasaron su fecha.
    Usar con cron job o tarea programada.
    """
    try:
        with get_db_cursor() as cursor:
            # Turnos recientes (menos de 1 día)
            cursor.execute("""
                UPDATE turnos SET status = 'Pendiente de Confirmación'
                WHERE status = 'Reservado'
                AND start_datetime < NOW()
                AND DATE_ADD(start_datetime, INTERVAL 1 DAY) > NOW()
            """)
            recientes = cursor.rowcount
            
            # Turnos antiguos (más de 1 día)
            cursor.execute("""
                UPDATE turnos SET status = 'Pendiente de Confirmación'
                WHERE status = 'Reservado'
                AND start_datetime < DATE_SUB(NOW(), INTERVAL 1 DAY)
            """)
            antiguos = cursor.rowcount
        
        return jsonify({
            "message": "Estados actualizados exitosamente",
            "turnos_actualizados": recientes + antiguos,
            "recientes": recientes,
            "antiguos": antiguos
        }), 200
        
    except Exception as e:
        return jsonify({"message": f"Error al actualizar estados: {str(e)}"}), 500


# ---------------------- OBTENER HORARIOS DISPONIBLES (ADMIN) ----------------------
@app.route('/empresa/<int:id_empresa>/horarios-disponibles', methods=['GET'])
@requiere_token
def obtener_horarios_disponibles_admin(id_empresa):
    """
    Devuelve los horarios disponibles para un profesional en una fecha.
    Parámetros: profesional_id, fecha (YYYY-MM-DD), servicio_id (opcional)
    """
    try:
        profesional_id = request.args.get('profesional_id', type=int)
        fecha = request.args.get('fecha')
        servicio_id = request.args.get('servicio_id', type=int)
        
        if not profesional_id or not fecha:
            return jsonify({"message": "Se requiere profesional_id y fecha"}), 400
        
        # Validar profesional
        profesional = validate_profesional_empresa(profesional_id, id_empresa)
        if not profesional:
            return jsonify({"message": "Profesional no encontrado"}), 404
        
        # Intentar obtener del cache
        cache_key = CacheKeys.horarios_disponibles(id_empresa, profesional_id, fecha, servicio_id)
        cached_result = cache_manager.get(cache_key)
        if cached_result is not None:
            return jsonify({"horarios_disponibles": cached_result}), 200
        
        # Obtener duración del servicio
        duracion_servicio = _get_duracion_servicio(servicio_id, id_empresa, profesional['especialidad'])
        
        # Calcular horarios disponibles
        horarios = _calcular_horarios_disponibles(profesional_id, fecha, duracion_servicio)
        
        # Guardar en cache (30 segundos - cambia con cada reserva)
        cache_manager.set(cache_key, horarios, CacheKeys.TTL_SHORT)
        
        return jsonify({"horarios_disponibles": horarios}), 200
        
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- RESUMEN DE DISPONIBILIDADES (ADMIN) ----------------------
@app.route('/empresa/<int:id_empresa>/profesionales/disponibilidades-resumen', methods=['GET'])
@requiere_token
def obtener_resumen_disponibilidades_admin(id_empresa):
    """Devuelve resumen de días disponibles para todos los profesionales"""
    
    # Intentar obtener del cache
    cache_key = CacheKeys.disponibilidades_resumen(id_empresa)
    cached_result = cache_manager.get(cache_key)
    if cached_result is not None:
        return jsonify(cached_result), 200
    
    try:
        from api.utils.formatters import format_disponibilidad_resumen
        
        with get_db_cursor() as cursor:
            cursor.execute("""
                SELECT d.profesional_id, d.day_of_week 
                FROM disponibilidades d
                JOIN profesionales p ON d.profesional_id = p.id
                WHERE p.empresa_id = %s
                ORDER BY d.profesional_id, d.day_of_week
            """, (id_empresa,))
            filas = cursor.fetchall()
        
        resultado = format_disponibilidad_resumen(filas)
        
        # Guardar en cache (2 minutos)
        cache_manager.set(cache_key, resultado, CacheKeys.TTL_MEDIUM)
        
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ==================== FUNCIONES HELPER PRIVADAS ====================

def _get_duracion_servicio(servicio_id, empresa_id, especialidad=None):
    """Obtiene la duración del servicio o calcula por defecto"""
    if servicio_id:
        servicio = validate_servicio_empresa(servicio_id, empresa_id)
        if servicio:
            return servicio['duration_minutes']
    
    # Duración por defecto según especialidad
    if especialidad:
        if "Cardiología" in especialidad or "Psiquiatría" in especialidad:
            return 45
        elif "Cirugía" in especialidad:
            return 60
    
    return 30


def _calcular_horarios_disponibles(profesional_id, fecha, duracion_servicio):
    """Calcula los horarios disponibles para un profesional en una fecha"""
    fecha_obj = datetime.strptime(fecha, '%Y-%m-%d')
    dia_bd = python_weekday_to_db(fecha_obj.weekday())
    ahora = datetime.now()
    
    with get_db_cursor() as cursor:
        # Obtener disponibilidades del profesional
        cursor.execute(
            "SELECT start_time, end_time FROM disponibilidades WHERE profesional_id = %s AND day_of_week = %s",
            (profesional_id, dia_bd)
        )
        disponibilidades = cursor.fetchall()
        
        if not disponibilidades:
            return []
        
        # Obtener turnos ocupados
        cursor.execute("""
            SELECT start_datetime, 
                   DATE_ADD(start_datetime, INTERVAL COALESCE(s.duration_minutes, 30) MINUTE) as end_datetime
            FROM turnos t
            LEFT JOIN servicios s ON t.servicio_id = s.id
            WHERE t.profesional_id = %s AND DATE(t.start_datetime) = %s AND t.status != 'Cancelado'
        """, (profesional_id, fecha))
        turnos_ocupados = cursor.fetchall()
    
    horarios_disponibles = []
    hora_inicio_base = datetime.strptime(fecha, '%Y-%m-%d')
    
    for disp in disponibilidades:
        inicio_disp = _parse_time(str(disp[0]))
        fin_disp = _parse_time(str(disp[1]))
        
        hora_actual = datetime.combine(hora_inicio_base.date(), inicio_disp)
        fin_disponibilidad = datetime.combine(hora_inicio_base.date(), fin_disp)
        
        while hora_actual + timedelta(minutes=duracion_servicio) <= fin_disponibilidad:
            fin_slot = hora_actual + timedelta(minutes=duracion_servicio)
            
            # Verificar si está ocupado
            ocupado = any(
                hora_actual < turno[1] and fin_slot > turno[0]
                for turno in turnos_ocupados
            )
            
            if not ocupado:
                horarios_disponibles.append(format_horario_slot(hora_actual))
            
            hora_actual += timedelta(minutes=10)
    
    return horarios_disponibles


def _parse_time(time_str):
    """Parsea un string de tiempo a objeto time"""
    if ' ' in time_str:
        time_str = time_str.split(' ')[1]
    
    time_str = time_str.strip()
    
    try:
        if len(time_str.split(':')) == 3:
            return datetime.strptime(time_str, '%H:%M:%S').time()
        return datetime.strptime(time_str, '%H:%M').time()
    except:
        return datetime.strptime(time_str[:5], '%H:%M').time()

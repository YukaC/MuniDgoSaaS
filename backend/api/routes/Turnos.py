from flask import request, jsonify
from api.models.Turnos import Turno
from api.utils.seguridad import requiere_token, misma_empresa, validar_referencias
from api import app
from api.db.db_config import get_db_connection
from datetime import datetime, timedelta

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
def obtener_turno(id,id_empresa):
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
@validar_referencias({
    'profesional_id': 'profesionales',
    # servicio_id es opcional ahora, solo validar si se proporciona
})
def crear_turno():
    datos = request.get_json()

    datos['empresa_id'] = int(request.headers['id-empresa'])

    try:
        # El modelo valida datos, existencia de servicio y superposición de horarios
        nuevo = Turno.create_turno(datos)
        return jsonify(nuevo), 201
    except ValueError as e:
        # Captura errores de validación (servicio no existe, horario ocupado, datos inválidos)
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- ACTUALIZAR ----------------------
@app.route('/empresa/<int:id_empresa>/turno/<int:id>', methods=['PUT'])
@requiere_token
@misma_empresa(tabla='turnos')
@validar_referencias({
    'profesional_id': 'profesionales',
    # servicio_id es opcional ahora
})
def actualizar_turno(id,id_empresa):
    datos = request.get_json()

    datos['empresa_id'] = int(id_empresa)
    
    # Validar servicio_id solo si se proporciona
    if datos.get('servicio_id'):
        from api.db.db_config import get_db_connection
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT id FROM servicios WHERE id = %s AND empresa_id = %s", 
                      (datos['servicio_id'], id_empresa))
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            return jsonify({"message": "Servicio no encontrado o no pertenece a la empresa"}), 400
        cursor.close()
        connection.close()

    try:
        actualizado = Turno.update_turno(id, datos)
        return jsonify(actualizado), 200
    except ValueError as e:
        # Captura si el turno no existe o conflictos de horario al editar
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- ELIMINAR ----------------------
@app.route('/empresa/<int:id_empresa>/turno/<int:id>', methods=['DELETE'])
@requiere_token
@misma_empresa(tabla='turnos')
def eliminar_turno(id,id_empresa):
    try:
        eliminado = Turno.delete_turno(id)
        return jsonify(eliminado), 200
    except ValueError as e:
        # El modelo lanza ValueError si no encuentra el ID para borrar
        return jsonify({"message": str(e)}), 404
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- ACTUALIZAR ESTADOS AUTOMÁTICAMENTE ----------------------
@app.route('/actualizar-estados-turnos', methods=['POST'])
@requiere_token
def actualizar_estados_turnos():
    """
    Endpoint para actualizar automáticamente los estados de turnos que ya pasaron su fecha.
    Se puede llamar periódicamente mediante un cron job o tarea programada.
    """
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Actualizar turnos que ya pasaron su fecha y hora
        # Solo actualizar turnos que estén en estado "Reservado"
        cursor.execute(
            """UPDATE turnos
               SET status = 'Pendiente de Confirmación'
               WHERE status = 'Reservado'
               AND start_datetime < NOW()
               AND DATE_ADD(start_datetime, INTERVAL 1 DAY) > NOW()"""
        )
        turnos_actualizados_recientes = cursor.rowcount
        
        # Actualizar turnos de más de 1 día atrás que aún estén en "Reservado"
        cursor.execute(
            """UPDATE turnos
               SET status = 'Pendiente de Confirmación'
               WHERE status = 'Reservado'
               AND start_datetime < DATE_SUB(NOW(), INTERVAL 1 DAY)"""
        )
        turnos_actualizados_antiguos = cursor.rowcount
        
        connection.commit()
        cursor.close()
        connection.close()
        
        total_actualizados = turnos_actualizados_recientes + turnos_actualizados_antiguos
        
        return jsonify({
            "message": f"Estados actualizados exitosamente",
            "turnos_actualizados": total_actualizados,
            "recientes": turnos_actualizados_recientes,
            "antiguos": turnos_actualizados_antiguos
        }), 200
        
    except Exception as e:
        return jsonify({"message": f"Error al actualizar estados: {str(e)}"}), 500


# ---------------------- OBTENER HORARIOS DISPONIBLES (ADMIN) ----------------------
@app.route('/empresa/<int:id_empresa>/horarios-disponibles', methods=['GET'])
@requiere_token
def obtener_horarios_disponibles_admin(id_empresa):
    """
    Endpoint para el panel administrativo que devuelve los horarios disponibles.
    Recibe parámetros: profesional_id, fecha (YYYY-MM-DD), servicio_id (opcional)
    """
    try:
        profesional_id = request.args.get('profesional_id', type=int)
        fecha = request.args.get('fecha')  # Formato: YYYY-MM-DD
        servicio_id = request.args.get('servicio_id', type=int)
        
        if not profesional_id or not fecha:
            return jsonify({"message": "Se requiere profesional_id y fecha"}), 400
        
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Validar que el profesional pertenezca a la empresa
        cursor.execute("SELECT id FROM profesionales WHERE id = %s AND empresa_id = %s", (profesional_id, id_empresa))
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            return jsonify({"message": "Profesional no encontrado"}), 404
        
        # Obtener duración del servicio si se proporciona, sino usar duración por defecto según especialidad
        duracion_servicio = 30  # Por defecto
        if servicio_id:
            cursor.execute("SELECT duration_minutes FROM servicios WHERE id = %s AND empresa_id = %s", 
                          (servicio_id, id_empresa))
            servicio = cursor.fetchone()
            if servicio:
                duracion_servicio = servicio[0]
        else:
            # Obtener especialidad del profesional para duración por defecto
            cursor.execute("SELECT especialidad FROM profesionales WHERE id = %s AND empresa_id = %s", 
                          (profesional_id, id_empresa))
            prof = cursor.fetchone()
            if prof:
                especialidad = prof[0] or "Consulta General"
                if "Cardiología" in especialidad or "Psiquiatría" in especialidad:
                    duracion_servicio = 45
                elif "Cirugía" in especialidad:
                    duracion_servicio = 60
                else:
                    duracion_servicio = 30
        
        # Obtener disponibilidades del profesional para el día de la semana
        fecha_obj = datetime.strptime(fecha, '%Y-%m-%d')
        dia_semana = fecha_obj.weekday()  # 0=Lunes, 6=Domingo (Python)
        # Convertir a formato de BD: 0=Domingo, 1=Lunes, ..., 6=Sábado
        if dia_semana == 6:  # Domingo en Python
            dia_bd = 0  # Domingo en BD
        else:
            dia_bd = dia_semana + 1  # Lunes=1, Martes=2, ..., Sábado=6
        
        cursor.execute(
            """SELECT start_time, end_time FROM disponibilidades 
               WHERE profesional_id = %s AND day_of_week = %s""",
            (profesional_id, dia_bd)
        )
        disponibilidades = cursor.fetchall()
        
        if not disponibilidades:
            cursor.close()
            connection.close()
            return jsonify({"horarios_disponibles": []}), 200
        
        # Obtener turnos ya reservados para ese día
        cursor.execute(
            """SELECT start_datetime, 
               DATE_ADD(start_datetime, INTERVAL COALESCE(s.duration_minutes, 30) MINUTE) as end_datetime
               FROM turnos t
               LEFT JOIN servicios s ON t.servicio_id = s.id
               WHERE t.profesional_id = %s 
               AND DATE(t.start_datetime) = %s
               AND t.status != 'Cancelado'""",
            (profesional_id, fecha)
        )
        turnos_ocupados = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        # Generar horarios disponibles
        horarios_disponibles = []
        hora_inicio_base = datetime.strptime(fecha, '%Y-%m-%d')
        ahora = datetime.now()
        
        for disp in disponibilidades:
            # Manejar diferentes formatos de tiempo
            inicio_str = str(disp[0])
            fin_str = str(disp[1])
            
            # Si viene como datetime, extraer solo la parte de tiempo
            if ' ' in inicio_str:
                inicio_str = inicio_str.split(' ')[1]
            if ' ' in fin_str:
                fin_str = fin_str.split(' ')[1]
            
            # Parsear el tiempo
            try:
                if len(inicio_str.split(':')) == 3:
                    inicio_disp = datetime.strptime(inicio_str, '%H:%M:%S').time()
                else:
                    inicio_disp = datetime.strptime(inicio_str, '%H:%M').time()
            except:
                inicio_disp = datetime.strptime(inicio_str[:5], '%H:%M').time()
            
            try:
                if len(fin_str.split(':')) == 3:
                    fin_disp = datetime.strptime(fin_str, '%H:%M:%S').time()
                else:
                    fin_disp = datetime.strptime(fin_str, '%H:%M').time()
            except:
                fin_disp = datetime.strptime(fin_str[:5], '%H:%M').time()
            
            # Generar slots cada 10 minutos dentro del rango de disponibilidad
            hora_actual = datetime.combine(hora_inicio_base.date(), inicio_disp)
            fin_disponibilidad = datetime.combine(hora_inicio_base.date(), fin_disp)
            
            while hora_actual + timedelta(minutes=duracion_servicio) <= fin_disponibilidad:
                # Verificar si este slot está ocupado
                fin_slot = hora_actual + timedelta(minutes=duracion_servicio)
                ocupado = False
                
                for turno_ocupado in turnos_ocupados:
                    inicio_ocupado = turno_ocupado[0]
                    fin_ocupado = turno_ocupado[1]
                    
                    # Convertir a datetime si no lo son ya
                    if isinstance(inicio_ocupado, str):
                        inicio_ocupado = datetime.strptime(inicio_ocupado, '%Y-%m-%d %H:%M:%S')
                    if isinstance(fin_ocupado, str):
                        fin_ocupado = datetime.strptime(fin_ocupado, '%Y-%m-%d %H:%M:%S')
                    
                    # Verificar superposición
                    if (hora_actual < fin_ocupado and fin_slot > inicio_ocupado):
                        ocupado = True
                        break
                
                if not ocupado:
                    # Solo agregar horarios que no sean en el pasado
                    if hora_actual > ahora:
                        horarios_disponibles.append({
                            "hora": hora_actual.strftime('%H:%M'),
                            "datetime": hora_actual.strftime('%Y-%m-%d %H:%M:%S')
                        })
                
                # Avanzar 10 minutos
                hora_actual += timedelta(minutes=10)
        
        return jsonify({"horarios_disponibles": horarios_disponibles}), 200
        
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": str(e)}), 500

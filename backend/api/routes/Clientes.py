from flask import request, jsonify
from datetime import datetime, timedelta
from api.models.Servicios import Servicio
from api.models.Profesionales import Profesional
from api.models.Disponibilidades import Disponibilidad
from api.models.Turnos import Turno
from api.db.db_config import get_db_connection
from api.utils.seguridad_clientes import requiere_token_cliente
from api import app

# ==================== ENDPOINTS PARA CLIENTES AUTENTICADOS ====================
# Estos endpoints requieren autenticación de cliente (token)

# ---------------------- OBTENER SERVICIOS DE UNA EMPRESA ----------------------
@app.route('/cliente/empresa/<int:id_empresa>/servicios', methods=['GET'])
@requiere_token_cliente
def obtener_servicios_publicos(id_empresa):
    """Endpoint público para que los clientes vean los servicios disponibles"""
    try:
        servicios = Servicio.get_servicios_by_idempresa(id_empresa)
        return jsonify(servicios), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- OBTENER PROFESIONALES DE UNA EMPRESA ----------------------
@app.route('/cliente/empresa/<int:id_empresa>/profesionales', methods=['GET'])
@requiere_token_cliente
def obtener_profesionales_publicos(id_empresa):
    """Endpoint público para que los clientes vean los profesionales disponibles"""
    try:
        profesionales = Profesional.get_profesionales_by_idempresa(id_empresa)
        return jsonify(profesionales), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- OBTENER DISPONIBILIDADES DE UNA EMPRESA ----------------------
@app.route('/cliente/empresa/<int:id_empresa>/disponibilidades', methods=['GET'])
@requiere_token_cliente
def obtener_disponibilidades_publicas(id_empresa):
    """Endpoint público para que los clientes vean las disponibilidades"""
    try:
        disponibilidades = Disponibilidad.get_disponibilidades_by_idempresa(id_empresa)
        return jsonify(disponibilidades), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- OBTENER DISPONIBILIDADES DE UN PROFESIONAL ----------------------
@app.route('/cliente/empresa/<int:id_empresa>/profesional/<int:id_profesional>/disponibilidades', methods=['GET'])
@requiere_token_cliente
def obtener_disponibilidades_profesional_publico(id_empresa, id_profesional):
    """Endpoint público para ver disponibilidades de un profesional específico"""
    try:
        # Validar que el profesional pertenezca a la empresa
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT id FROM profesionales WHERE id = %s AND empresa_id = %s", (id_profesional, id_empresa))
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            return jsonify({"message": "Profesional no encontrado"}), 404
        
        disponibilidades = Disponibilidad.get_disponibilidades_by_idprofesional(id_profesional)
        cursor.close()
        connection.close()
        return jsonify(disponibilidades), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- OBTENER DÍAS DISPONIBLES DE UN PROFESIONAL ----------------------
@app.route('/cliente/empresa/<int:id_empresa>/profesional/<int:id_profesional>/dias-disponibles', methods=['GET'])
@requiere_token_cliente
def obtener_dias_disponibles_profesional(id_empresa, id_profesional):
    """Endpoint que devuelve los días de la semana en que trabaja un profesional"""
    try:
        # Validar que el profesional pertenezca a la empresa
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT id FROM profesionales WHERE id = %s AND empresa_id = %s", (id_profesional, id_empresa))
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            return jsonify({"message": "Profesional no encontrado"}), 404
        
        # Obtener días únicos de disponibilidad
        cursor.execute(
            """SELECT DISTINCT day_of_week FROM disponibilidades 
               WHERE profesional_id = %s 
               ORDER BY day_of_week""",
            (id_profesional,)
        )
        dias = [row[0] for row in cursor.fetchall()]
        
        cursor.close()
        connection.close()
        
        # Mapear días: 0=Domingo, 1=Lunes, ..., 6=Sábado
        nombres_dias = {
            0: "Domingo",
            1: "Lunes",
            2: "Martes",
            3: "Miércoles",
            4: "Jueves",
            5: "Viernes",
            6: "Sábado"
        }
        
        dias_info = [{"dia_numero": dia, "dia_nombre": nombres_dias.get(dia, "Desconocido")} for dia in dias]
        
        return jsonify({"dias_disponibles": dias_info}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- OBTENER HORARIOS DISPONIBLES PARA RESERVAR ----------------------
@app.route('/cliente/empresa/<int:id_empresa>/horarios-disponibles', methods=['GET'])
@requiere_token_cliente
def obtener_horarios_disponibles(id_empresa):
    """
    Endpoint que devuelve los horarios disponibles para reservar.
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
        
        # Obtener duración del servicio si se proporciona
        duracion_servicio = 60  # Default 60 minutos
        if servicio_id:
            cursor.execute("SELECT duration_minutes FROM servicios WHERE id = %s AND empresa_id = %s", 
                          (servicio_id, id_empresa))
            servicio = cursor.fetchone()
            if servicio:
                duracion_servicio = servicio[0]
        
        # Obtener disponibilidades del profesional para el día de la semana
        fecha_obj = datetime.strptime(fecha, '%Y-%m-%d')
        dia_semana = fecha_obj.weekday()  # 0=Lunes, 6=Domingo (Python)
        # Convertir a formato de BD: 0=Domingo, 1=Lunes, ..., 6=Sábado
        # Python weekday: 0=Lunes, 1=Martes, ..., 6=Domingo
        # BD formato: 0=Domingo, 1=Lunes, ..., 6=Sábado
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
            
            # Parsear el tiempo (puede venir como HH:MM:SS o HH:MM)
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


# ---------------------- RESERVAR TURNO ----------------------
@app.route('/cliente/empresa/<int:id_empresa>/reservar-turno', methods=['POST'])
@requiere_token_cliente
def reservar_turno_publico(id_empresa):
    """Endpoint público para que los clientes reserven turnos"""
    datos = request.get_json()
    
    if not datos:
        return jsonify({"message": "Se requiere un cuerpo JSON"}), 400
    
    # Validar campos requeridos (servicio_id es opcional ahora)
    campos_requeridos = ['profesional_id', 'start_datetime']
    for campo in campos_requeridos:
        if campo not in datos:
            return jsonify({"message": f"Campo requerido faltante: {campo}"}), 400
    
    # Validar que la fecha/hora no sea en el pasado
    try:
        fecha_hora_turno = datetime.strptime(datos['start_datetime'], '%Y-%m-%d %H:%M:%S')
        ahora = datetime.now()
        
        if fecha_hora_turno <= ahora:
            return jsonify({"message": "No se pueden agendar turnos en el pasado"}), 400
    except ValueError:
        return jsonify({"message": "Formato de fecha/hora inválido"}), 400
    
    # Obtener nombre del cliente desde el token
    cliente_id = request.cliente_id
    connection_temp = get_db_connection()
    cursor_temp = connection_temp.cursor()
    cursor_temp.execute("SELECT nombre, apellido FROM clientes WHERE id = %s", (cliente_id,))
    cliente_data = cursor_temp.fetchone()
    cursor_temp.close()
    connection_temp.close()
    
    if not cliente_data:
        return jsonify({"message": "Cliente no encontrado"}), 404
    
    cliente_name = f"{cliente_data[0]} {cliente_data[1]}"
    
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Validar que el profesional pertenezca a la empresa
        cursor.execute("SELECT id, especialidad FROM profesionales WHERE id = %s AND empresa_id = %s", 
                      (datos['profesional_id'], id_empresa))
        profesional = cursor.fetchone()
        if not profesional:
            cursor.close()
            connection.close()
            return jsonify({"message": "Profesional no encontrado"}), 404
        
        # Si se proporciona servicio_id, validarlo
        servicio_id = datos.get('servicio_id')
        if servicio_id:
            cursor.execute("SELECT id FROM servicios WHERE id = %s AND empresa_id = %s", 
                          (servicio_id, id_empresa))
            if not cursor.fetchone():
                cursor.close()
                connection.close()
                return jsonify({"message": "Servicio no encontrado"}), 404
        
        # Obtener duración (del servicio o por defecto según especialidad)
        duracion_servicio = 30  # Por defecto
        if servicio_id:
            cursor.execute("SELECT duration_minutes FROM servicios WHERE id = %s", (servicio_id,))
            servicio = cursor.fetchone()
            if servicio:
                duracion_servicio = servicio[0]
        else:
            # Duración por defecto según especialidad
            especialidad = profesional[1] or "Consulta General"
            if "Cardiología" in especialidad or "Psiquiatría" in especialidad:
                duracion_servicio = 45
            elif "Cirugía" in especialidad:
                duracion_servicio = 60
        
        # Validar que no haya superposición de turnos
        cursor.execute(
            """SELECT t.id FROM turnos t
               LEFT JOIN servicios s ON t.servicio_id = s.id
               WHERE t.profesional_id = %s
               AND t.status != 'Cancelado'
               AND t.start_datetime < DATE_ADD(%s, INTERVAL %s MINUTE)
               AND DATE_ADD(t.start_datetime, INTERVAL COALESCE(s.duration_minutes, 30) MINUTE) > %s""",
            (datos['profesional_id'], datos['start_datetime'], duracion_servicio, datos['start_datetime'])
        )
        
        if cursor.fetchone():
            cursor.close()
            connection.close()
            return jsonify({"message": "El profesional ya tiene un turno asignado en ese horario"}), 400
        
        # Crear el turno
        datos_turno = {
            'empresa_id': id_empresa,
            'profesional_id': datos['profesional_id'],
            'servicio_id': servicio_id,  # Puede ser None
            'cliente_name': cliente_name,
            'observaciones': datos.get('observaciones'),  # Opcional
            'start_datetime': datos['start_datetime'],
            'status': 'Reservado'
        }
        
        nuevo = Turno.create_turno(datos_turno)
        cursor.close()
        connection.close()
        
        return jsonify(nuevo), 201
        
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": f"Error interno del servidor: {str(e)}"}), 500


# ---------------------- CANCELAR TURNO (CLIENTE) ----------------------
@app.route('/cliente/empresa/<int:id_empresa>/turno/<int:id_turno>/cancelar', methods=['PUT'])
@requiere_token_cliente
def cancelar_turno_cliente(id_empresa, id_turno):
    """Endpoint para que los clientes cancelen sus turnos"""
    cliente_id = request.cliente_id
    
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Obtener nombre del cliente
        cursor.execute("SELECT nombre, apellido FROM clientes WHERE id = %s", (cliente_id,))
        cliente_data = cursor.fetchone()
        if not cliente_data:
            cursor.close()
            connection.close()
            return jsonify({"message": "Cliente no encontrado"}), 404
        
        cliente_name = f"{cliente_data[0]} {cliente_data[1]}"
        
        # Verificar que el turno pertenece al cliente y a la empresa
        cursor.execute(
            """SELECT id, status FROM turnos 
               WHERE id = %s AND empresa_id = %s AND cliente_name = %s""",
            (id_turno, id_empresa, cliente_name)
        )
        turno = cursor.fetchone()
        
        if not turno:
            cursor.close()
            connection.close()
            return jsonify({"message": "Turno no encontrado o no tienes permiso para cancelarlo"}), 404
        
        # Verificar que el turno no esté ya cancelado o completado
        if turno[1] == 'Cancelado':
            cursor.close()
            connection.close()
            return jsonify({"message": "El turno ya está cancelado"}), 400
        
        if turno[1] == 'Completado':
            cursor.close()
            connection.close()
            return jsonify({"message": "No se pueden cancelar turnos completados"}), 400
        
        # Cancelar el turno
        cursor.execute(
            "UPDATE turnos SET status = 'Cancelado' WHERE id = %s",
            (id_turno,)
        )
        connection.commit()
        
        # Obtener el turno actualizado
        cursor.execute(
            """SELECT t.id, t.empresa_id, t.profesional_id, t.servicio_id, t.cliente_name, 
                      t.observaciones, t.start_datetime, t.status, t.created_at,
                      p.name AS profesional_nombre, p.surname AS profesional_apellido,
                      p.especialidad AS profesional_especialidad,
                      s.name AS servicio_nombre, s.price AS precio
               FROM turnos t
               LEFT JOIN profesionales p ON t.profesional_id = p.id
               LEFT JOIN servicios s ON t.servicio_id = s.id
               WHERE t.id = %s""",
            (id_turno,)
        )
        turno_actualizado = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        # Formatear respuesta similar a consultar_turnos_cliente
        if turno_actualizado:
            return jsonify({
                "id": turno_actualizado[0],
                "empresa_id": turno_actualizado[1],
                "profesional_id": turno_actualizado[2],
                "servicio_id": turno_actualizado[3],
                "cliente_name": turno_actualizado[4],
                "observaciones": turno_actualizado[5],
                "start_datetime": str(turno_actualizado[6]),
                "status": turno_actualizado[7],
                "created_at": str(turno_actualizado[8]),
                "profesional_nombre": turno_actualizado[9],
                "profesional_apellido": turno_actualizado[10],
                "profesional_especialidad": turno_actualizado[11],
                "servicio_nombre": turno_actualizado[12],
                "precio": turno_actualizado[13]
            }), 200
        
        return jsonify({"message": "Turno cancelado exitosamente"}), 200
        
    except Exception as e:
        return jsonify({"message": f"Error interno del servidor: {str(e)}"}), 500


# ---------------------- MODIFICAR TURNO (CLIENTE) ----------------------
@app.route('/cliente/empresa/<int:id_empresa>/turno/<int:id_turno>/modificar', methods=['PUT'])
@requiere_token_cliente
def modificar_turno_cliente(id_empresa, id_turno):
    """Endpoint para que los clientes modifiquen sus turnos"""
    datos = request.get_json()
    cliente_id = request.cliente_id
    
    if not datos:
        return jsonify({"message": "Se requiere un cuerpo JSON"}), 400
    
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Obtener nombre del cliente
        cursor.execute("SELECT nombre, apellido FROM clientes WHERE id = %s", (cliente_id,))
        cliente_data = cursor.fetchone()
        if not cliente_data:
            cursor.close()
            connection.close()
            return jsonify({"message": "Cliente no encontrado"}), 404
        
        cliente_name = f"{cliente_data[0]} {cliente_data[1]}"
        
        # Verificar que el turno pertenece al cliente y a la empresa
        cursor.execute(
            """SELECT id, status, start_datetime FROM turnos 
               WHERE id = %s AND empresa_id = %s AND cliente_name = %s""",
            (id_turno, id_empresa, cliente_name)
        )
        turno = cursor.fetchone()
        
        if not turno:
            cursor.close()
            connection.close()
            return jsonify({"message": "Turno no encontrado o no tienes permiso para modificarlo"}), 404
        
        # Verificar que el turno no esté cancelado o completado
        if turno[1] == 'Cancelado':
            cursor.close()
            connection.close()
            return jsonify({"message": "No se pueden modificar turnos cancelados"}), 400
        
        if turno[1] == 'Completado':
            cursor.close()
            connection.close()
            return jsonify({"message": "No se pueden modificar turnos completados"}), 400
        
        # Validar fecha/hora si se proporciona
        nueva_fecha_hora = datos.get('start_datetime')
        if nueva_fecha_hora:
            try:
                fecha_hora_turno = datetime.strptime(nueva_fecha_hora, '%Y-%m-%d %H:%M:%S')
                ahora = datetime.now()
                
                if fecha_hora_turno <= ahora:
                    cursor.close()
                    connection.close()
                    return jsonify({"message": "No se pueden agendar turnos en el pasado"}), 400
            except ValueError:
                cursor.close()
                connection.close()
                return jsonify({"message": "Formato de fecha/hora inválido"}), 400
        
        # Actualizar solo los campos proporcionados
        campos_actualizar = []
        valores = []
        
        if 'profesional_id' in datos:
            # Validar que el profesional pertenezca a la empresa
            cursor.execute(
                "SELECT id FROM profesionales WHERE id = %s AND empresa_id = %s",
                (datos['profesional_id'], id_empresa)
            )
            if not cursor.fetchone():
                cursor.close()
                connection.close()
                return jsonify({"message": "Profesional no encontrado"}), 404
            campos_actualizar.append("profesional_id = %s")
            valores.append(datos['profesional_id'])
        
        if 'start_datetime' in datos:
            campos_actualizar.append("start_datetime = %s")
            valores.append(datos['start_datetime'])
        
        if 'observaciones' in datos:
            campos_actualizar.append("observaciones = %s")
            valores.append(datos.get('observaciones') or None)
        
        if not campos_actualizar:
            cursor.close()
            connection.close()
            return jsonify({"message": "No se proporcionaron campos para actualizar"}), 400
        
        # Ejecutar actualización
        valores.append(id_turno)
        query = f"UPDATE turnos SET {', '.join(campos_actualizar)} WHERE id = %s"
        cursor.execute(query, valores)
        connection.commit()
        
        # Obtener el turno actualizado
        cursor.execute(
            """SELECT t.id, t.empresa_id, t.profesional_id, t.servicio_id, t.cliente_name, 
                      t.observaciones, t.start_datetime, t.status, t.created_at,
                      p.name AS profesional_nombre, p.surname AS profesional_apellido,
                      p.especialidad AS profesional_especialidad,
                      s.name AS servicio_nombre, s.price AS precio
               FROM turnos t
               LEFT JOIN profesionales p ON t.profesional_id = p.id
               LEFT JOIN servicios s ON t.servicio_id = s.id
               WHERE t.id = %s""",
            (id_turno,)
        )
        turno_actualizado = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        if turno_actualizado:
            return jsonify({
                "id": turno_actualizado[0],
                "empresa_id": turno_actualizado[1],
                "profesional_id": turno_actualizado[2],
                "servicio_id": turno_actualizado[3],
                "cliente_name": turno_actualizado[4],
                "observaciones": turno_actualizado[5],
                "start_datetime": str(turno_actualizado[6]),
                "status": turno_actualizado[7],
                "created_at": str(turno_actualizado[8]),
                "profesional_nombre": turno_actualizado[9],
                "profesional_apellido": turno_actualizado[10],
                "profesional_especialidad": turno_actualizado[11],
                "servicio_nombre": turno_actualizado[12],
                "precio": turno_actualizado[13]
            }), 200
        
        return jsonify({"message": "Turno modificado exitosamente"}), 200
        
    except Exception as e:
        return jsonify({"message": f"Error interno del servidor: {str(e)}"}), 500


# ---------------------- CONSULTAR MIS TURNOS ----------------------
@app.route('/cliente/empresa/<int:id_empresa>/mis-turnos', methods=['GET'])
@requiere_token_cliente
def consultar_turnos_cliente(id_empresa):
    """Endpoint protegido para que los clientes consulten sus turnos"""
    # Obtener información del cliente autenticado
    cliente_id = request.cliente_id
    
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Obtener nombre del cliente autenticado
        cursor.execute("SELECT nombre, apellido FROM clientes WHERE id = %s", (cliente_id,))
        cliente_data = cursor.fetchone()
        
        if not cliente_data:
            cursor.close()
            connection.close()
            return jsonify({"message": "Cliente no encontrado"}), 404
        
        cliente_name = f"{cliente_data[0]} {cliente_data[1]}"
        
        query = """
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
                s.price AS precio
            FROM turnos t
            LEFT JOIN profesionales p ON t.profesional_id = p.id
            LEFT JOIN servicios s ON t.servicio_id = s.id
            WHERE t.empresa_id = %s
            AND t.cliente_name = %s
            ORDER BY t.start_datetime DESC
        """
        
        cursor.execute(query, (id_empresa, cliente_name))
        filas = cursor.fetchall()
        cursor.close()
        connection.close()
        
        resultados = []
        for fila in filas:
            turno_base = {
                "id": fila[0],
                "empresa_id": fila[1],
                "profesional_id": fila[2],
                "servicio_id": fila[3],
                "cliente_name": fila[4],
                "observaciones": fila[5] if len(fila) > 5 else None,
                "start_datetime": str(fila[6]) if len(fila) > 6 else str(fila[5]),
                "status": fila[7] if len(fila) > 7 else fila[6],
                "created_at": str(fila[8]) if len(fila) > 8 and fila[8] else (str(fila[7]) if len(fila) > 7 and fila[7] else None)
            }
            # Índices ajustados para incluir observaciones
            idx = 9 if len(fila) > 9 else 8
            turno_base["profesional_nombre"] = fila[idx] if len(fila) > idx else None
            turno_base["profesional_apellido"] = fila[idx+1] if len(fila) > idx+1 else None
            turno_base["profesional_especialidad"] = fila[idx+2] if len(fila) > idx+2 else "Consulta General"
            turno_base["servicio_nombre"] = fila[idx+3] if len(fila) > idx+3 else None
            turno_base["precio"] = fila[idx+4] if len(fila) > idx+4 else 0
            
            # Si no hay servicio, usar la especialidad como nombre
            if not turno_base["servicio_nombre"]:
                turno_base["servicio_nombre"] = turno_base["profesional_especialidad"] or "Consulta General"
            
            resultados.append(turno_base)
        
        return jsonify(resultados), 200
        
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- OBTENER LISTA DE EMPRESAS (PÚBLICO - SIN AUTENTICACIÓN) ----------------------
@app.route('/publico/empresas', methods=['GET'])
def obtener_empresas_publicas():
    """Endpoint público para listar empresas disponibles"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT id, nombre FROM empresas ORDER BY nombre")
        empresas = cursor.fetchall()
        cursor.close()
        connection.close()
        
        resultados = [{"id": emp[0], "nombre": emp[1]} for emp in empresas]
        return jsonify(resultados), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


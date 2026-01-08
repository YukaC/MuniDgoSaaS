"""
Rutas de API para Clientes - Refactorizado aplicando DRY
"""
from flask import request, jsonify
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash

from api.config import Config
from api.models.Servicios import Servicio
from api.models.Profesionales import Profesional
from api.models.Disponibilidades import Disponibilidad
from api.models.Turnos import Turno
from api.utils.db_helpers import (
    get_db_cursor, get_cliente_name_by_id, 
    validate_profesional_empresa, validate_servicio_empresa,
    check_turno_overlap, DIAS_SEMANA, python_weekday_to_db
)
from api.utils.formatters import (
    TURNO_SELECT_QUERY, format_turno_row, format_turno_list,
    format_cliente_row, format_cliente_list, format_disponibilidad_resumen,
    format_horario_slot
)
from api.utils.seguridad_clientes import requiere_token_cliente
from api.utils.seguridad import requiere_token as requiere_token_admin
from api.utils.sanitizer import sanitize_string, sanitize_email, sanitize_telefono
from api import app


# ==================== ENDPOINTS PARA CLIENTES AUTENTICADOS ====================


# ---------------------- PERFIL DEL CLIENTE (VER) ----------------------
@app.route('/cliente/perfil', methods=['GET'])
@requiere_token_cliente
def obtener_perfil_cliente():
    """Obtiene los datos del perfil del cliente autenticado"""
    cliente_id = request.cliente_id
    
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                "SELECT id, dni, nombre, apellido, email, telefono FROM clientes WHERE id = %s", 
                (cliente_id,)
            )
            cliente = cursor.fetchone()
            
            if not cliente:
                return jsonify({"message": "Cliente no encontrado"}), 404
            
            return jsonify(format_cliente_row(cliente)), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- PERFIL DEL CLIENTE (ACTUALIZAR) ----------------------
@app.route('/cliente/perfil', methods=['PATCH'])
@requiere_token_cliente
def actualizar_perfil_cliente():
    """Actualiza parcialmente el perfil del cliente autenticado"""
    cliente_id = request.cliente_id
    datos = request.get_json()
    
    try:
        # Sanitizar inputs
        if 'nombre' in datos:
            datos['nombre'] = sanitize_string(datos.get('nombre'), max_length=100)
        if 'apellido' in datos:
            datos['apellido'] = sanitize_string(datos.get('apellido'), max_length=100)
        if 'email' in datos:
            datos['email'] = sanitize_email(datos.get('email')) if datos.get('email') else None
        if 'telefono' in datos:
            datos['telefono'] = sanitize_telefono(datos.get('telefono'))
        
        with get_db_cursor() as cursor:
            # Validar e-mail único si se cambia
            if 'email' in datos and datos['email']:
                cursor.execute(
                    "SELECT id FROM clientes WHERE email = %s AND id != %s", 
                    (datos['email'], cliente_id)
                )
                if cursor.fetchone():
                    return jsonify({"message": "No se pudo actualizar. Verifique los datos ingresados."}), 400
            
            campos, valores = _build_update_fields(datos, ['nombre', 'apellido', 'email', 'telefono', 'password'])
            
            if not campos:
                return jsonify({"message": "No hay datos para actualizar"}), 400
                
            valores.append(cliente_id)
            cursor.execute(f"UPDATE clientes SET {', '.join(campos)} WHERE id = %s", valores)
            
        return jsonify({"message": "Perfil actualizado correctamente"}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500



# ---------------------- CRUD CLIENTES (ADMIN) ----------------------
@app.route('/empresa/<int:id_empresa>/cliente', methods=['POST'])
@requiere_token_admin
def crear_cliente_admin(id_empresa):
    """Endpoint para que el administrador registre un nuevo cliente"""
    datos = request.get_json()
    
    if not datos.get('dni') or not datos.get('nombre') or not datos.get('apellido'):
        return jsonify({"message": "Faltan datos obligatorios (DNI, Nombre, Apellido)"}), 400
        
    try:
        with get_db_cursor() as cursor:
            # Verificar duplicados
            if _check_cliente_duplicado(cursor, datos.get('dni'), datos.get('email')):
                return jsonify({"message": "No se pudo completar el registro. Verifique los datos ingresados."}), 400
            
            # Password por defecto es el DNI
            raw_password = datos.get('password') or datos['dni']
            hashed_password = generate_password_hash(raw_password, method='pbkdf2:sha256')
            
            cursor.execute(
                """INSERT INTO clientes (dni, nombre, apellido, email, telefono, password)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (datos['dni'], datos['nombre'], datos['apellido'], 
                 datos.get('email'), datos.get('telefono'), hashed_password)
            )
            cliente_id = cursor.lastrowid
            
        return jsonify({
            "message": "Cliente registrado exitosamente",
            "id": cliente_id,
            "nombre": f"{datos['nombre']} {datos['apellido']}"
        }), 201
        
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@app.route('/empresa/<int:id_empresa>/cliente/<int:id_cliente>', methods=['PUT'])
@requiere_token_admin
def modificar_cliente_admin(id_empresa, id_cliente):
    """Endpoint para que el administrador actualice los datos de un cliente"""
    datos = request.get_json()
    
    try:
        with get_db_cursor() as cursor:
            # Verificar existencia
            cursor.execute("SELECT id FROM clientes WHERE id = %s", (id_cliente,))
            if not cursor.fetchone():
                return jsonify({"message": "Cliente no encontrado"}), 404
            
            # Verificar duplicados (excluyendo cliente actual)
            error = _validate_cliente_update(cursor, id_cliente, datos)
            if error:
                return error
            
            # Hash password si se proporciona
            if 'password' in datos and datos['password']:
                datos['password'] = generate_password_hash(datos['password'], method='pbkdf2:sha256')
            
            campos, valores = _build_update_fields(datos, ['dni', 'nombre', 'apellido', 'email', 'telefono', 'password'])
            
            if not campos:
                return jsonify({"message": "No hay datos para actualizar"}), 400
            
            valores.append(id_cliente)
            cursor.execute(f"UPDATE clientes SET {', '.join(campos)} WHERE id = %s", valores)
            
        return jsonify({"message": "Cliente actualizado correctamente"}), 200
        
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@app.route('/empresa/<int:id_empresa>/cliente/<int:id_cliente>', methods=['DELETE'])
@requiere_token_admin
def eliminar_cliente_admin(id_empresa, id_cliente):
    """Endpoint para que el administrador elimine un cliente"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT id FROM clientes WHERE id = %s", (id_cliente,))
            if not cursor.fetchone():
                return jsonify({"message": "Cliente no encontrado"}), 404
            
            cursor.execute("DELETE FROM clientes WHERE id = %s", (id_cliente,))
            
        return jsonify({"message": "Cliente eliminado exitosamente"}), 200
        
    except Exception as e:
        return jsonify({"message": f"No se pudo eliminar el cliente: {str(e)}"}), 500


@app.route('/empresa/<int:id_empresa>/clientes-todos', methods=['GET'])
@requiere_token_admin
def obtener_clientes_admin(id_empresa):
    """Endpoint para que el administrador vea todos los clientes registrados"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                "SELECT id, dni, nombre, apellido, email, telefono FROM clientes ORDER BY apellido, nombre"
            )
            clientes = cursor.fetchall()
            
        return jsonify(format_cliente_list(clientes)), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- ENDPOINTS PÚBLICOS DE EMPRESA ----------------------
@app.route('/cliente/empresa/<int:id_empresa>/servicios', methods=['GET'])
@requiere_token_cliente
def obtener_servicios_publicos(id_empresa):
    """Endpoint para que los clientes vean los servicios disponibles"""
    try:
        servicios = Servicio.get_servicios_by_idempresa(id_empresa)
        return jsonify(servicios), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@app.route('/cliente/empresa/<int:id_empresa>/profesionales', methods=['GET'])
@requiere_token_cliente
def obtener_profesionales_publicos(id_empresa):
    """Endpoint para que los clientes vean los profesionales disponibles"""
    try:
        profesionales = Profesional.get_profesionales_by_idempresa(id_empresa)
        return jsonify(profesionales), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@app.route('/cliente/empresa/<int:id_empresa>/disponibilidades', methods=['GET'])
@requiere_token_cliente
def obtener_disponibilidades_publicas(id_empresa):
    """Endpoint para que los clientes vean las disponibilidades"""
    try:
        disponibilidades = Disponibilidad.get_disponibilidades_by_idempresa(id_empresa)
        return jsonify(disponibilidades), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@app.route('/cliente/empresa/<int:id_empresa>/profesional/<int:id_profesional>/disponibilidades', methods=['GET'])
@requiere_token_cliente
def obtener_disponibilidades_profesional_publico(id_empresa, id_profesional):
    """Endpoint para ver disponibilidades de un profesional específico"""
    try:
        if not validate_profesional_empresa(id_profesional, id_empresa):
            return jsonify({"message": "Profesional no encontrado"}), 404
        
        disponibilidades = Disponibilidad.get_disponibilidades_by_idprofesional(id_profesional)
        return jsonify(disponibilidades), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@app.route('/cliente/empresa/<int:id_empresa>/profesionales/disponibilidades-resumen', methods=['GET'])
@requiere_token_cliente
def obtener_resumen_disponibilidades_cliente(id_empresa):
    """Devuelve resumen de días disponibles para todos los profesionales"""
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
            
        return jsonify(format_disponibilidad_resumen(filas)), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@app.route('/cliente/empresa/<int:id_empresa>/profesional/<int:id_profesional>/dias-disponibles', methods=['GET'])
@requiere_token_cliente
def obtener_dias_disponibles_profesional(id_empresa, id_profesional):
    """Endpoint que devuelve los días de la semana en que trabaja un profesional"""
    try:
        if not validate_profesional_empresa(id_profesional, id_empresa):
            return jsonify({"message": "Profesional no encontrado"}), 404
        
        with get_db_cursor() as cursor:
            cursor.execute(
                """SELECT DISTINCT day_of_week FROM disponibilidades 
                   WHERE profesional_id = %s ORDER BY day_of_week""",
                (id_profesional,)
            )
            dias = [row[0] for row in cursor.fetchall()]
        
        dias_info = [{"dia_numero": dia, "dia_nombre": DIAS_SEMANA.get(dia, "Desconocido")} for dia in dias]
        return jsonify({"dias_disponibles": dias_info}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- HORARIOS DISPONIBLES ----------------------
@app.route('/cliente/empresa/<int:id_empresa>/horarios-disponibles', methods=['GET'])
@requiere_token_cliente
def obtener_horarios_disponibles(id_empresa):
    """Devuelve horarios disponibles para reservar"""
    try:
        profesional_id = request.args.get('profesional_id', type=int)
        fecha = request.args.get('fecha')
        servicio_id = request.args.get('servicio_id', type=int)
        
        if not profesional_id or not fecha:
            return jsonify({"message": "Se requiere profesional_id y fecha"}), 400
        
        if not validate_profesional_empresa(profesional_id, id_empresa):
            return jsonify({"message": "Profesional no encontrado"}), 404
        
        # Obtener duración del servicio
        duracion_servicio = Config.DEFAULT_SERVICE_DURATION_MINUTES
        if servicio_id:
            servicio = validate_servicio_empresa(servicio_id, id_empresa)
            if servicio:
                duracion_servicio = servicio['duration_minutes']
        
        horarios = _calcular_horarios_disponibles(
            profesional_id, fecha, duracion_servicio
        )
        
        return jsonify({"horarios_disponibles": horarios}), 200
        
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ---------------------- GESTIÓN DE TURNOS (CLIENTE) ----------------------
@app.route('/cliente/empresa/<int:id_empresa>/reservar-turno', methods=['POST'])
@requiere_token_cliente
def reservar_turno_publico(id_empresa):
    """Endpoint para que los clientes reserven turnos"""
    datos = request.get_json()
    
    if not datos:
        return jsonify({"message": "Se requiere un cuerpo JSON"}), 400
    
    # Validar campos requeridos
    if not datos.get('profesional_id') or not datos.get('start_datetime'):
        return jsonify({"message": "Se requiere profesional_id y start_datetime"}), 400
    
    # Validar fecha/hora futura
    try:
        fecha_hora_turno = datetime.strptime(datos['start_datetime'], '%Y-%m-%d %H:%M:%S')
        if fecha_hora_turno <= datetime.now():
            return jsonify({"message": "No se pueden agendar turnos en el pasado"}), 400
    except ValueError:
        return jsonify({"message": "Formato de fecha/hora inválido"}), 400
    
    # Obtener nombre del cliente
    cliente_name = get_cliente_name_by_id(request.cliente_id)
    if not cliente_name:
        return jsonify({"message": "Cliente no encontrado"}), 404
    
    try:
        # Validar profesional
        profesional = validate_profesional_empresa(datos['profesional_id'], id_empresa)
        if not profesional:
            return jsonify({"message": "Profesional no encontrado"}), 404
        
        # Validar servicio si se proporciona
        servicio_id = datos.get('servicio_id')
        duracion_servicio = _get_duracion_servicio(servicio_id, id_empresa, profesional['especialidad'])
        
        if servicio_id and not validate_servicio_empresa(servicio_id, id_empresa):
            return jsonify({"message": "Servicio no encontrado"}), 404
        
        # Verificar superposición
        if check_turno_overlap(datos['profesional_id'], datos['start_datetime'], duracion_servicio):
            return jsonify({"message": "El profesional ya tiene un turno asignado en ese horario"}), 400
        
        # Crear turno
        datos_turno = {
            'empresa_id': id_empresa,
            'profesional_id': datos['profesional_id'],
            'servicio_id': servicio_id,
            'cliente_name': cliente_name,
            'observaciones': datos.get('observaciones'),
            'start_datetime': datos['start_datetime'],
            'status': 'Reservado'
        }
        
        nuevo = Turno.create_turno(datos_turno)
        return jsonify(nuevo), 201
        
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return jsonify({"message": f"Error interno del servidor: {str(e)}"}), 500


@app.route('/cliente/todos-mis-turnos', methods=['GET'])
@requiere_token_cliente
def obtener_todos_mis_turnos():
    """Endpoint para obtener todos los turnos del cliente
    Solo muestra turnos con estado 'Reservado' o 'Completado'
    Oculta 'Cancelado' y 'Pendiente de Confirmación' para mantener el panel limpio
    """
    cliente_name = get_cliente_name_by_id(request.cliente_id)
    if not cliente_name:
        return jsonify({"message": "Cliente no encontrado"}), 404
    
    try:
        with get_db_cursor() as cursor:
            # Solo mostrar turnos Reservado y Completado
            cursor.execute(
                f"""{TURNO_SELECT_QUERY} 
                WHERE t.cliente_name = %s 
                AND t.status IN ('Reservado', 'Completado')
                ORDER BY t.start_datetime DESC""",
                (cliente_name,)
            )
            turnos = cursor.fetchall()
            
        return jsonify(format_turno_list(turnos)), 200
        
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@app.route('/cliente/empresa/<int:id_empresa>/mis-turnos', methods=['GET'])
@requiere_token_cliente
def consultar_turnos_cliente(id_empresa):
    """Endpoint para consultar turnos del cliente en una empresa
    Solo muestra turnos 'Reservado' y 'Completado'
    """
    cliente_name = get_cliente_name_by_id(request.cliente_id)
    if not cliente_name:
        return jsonify({"message": "Cliente no encontrado"}), 404
    
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                f"""{TURNO_SELECT_QUERY} 
                WHERE t.empresa_id = %s AND t.cliente_name = %s 
                AND t.status IN ('Reservado', 'Completado')
                ORDER BY t.start_datetime DESC""",
                (id_empresa, cliente_name)
            )
            turnos = cursor.fetchall()
            
        return jsonify(format_turno_list(turnos)), 200
        
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@app.route('/cliente/empresa/<int:id_empresa>/turno/<int:id_turno>/cancelar', methods=['PUT'])
@requiere_token_cliente
def cancelar_turno_cliente(id_empresa, id_turno):
    """Endpoint para que los clientes cancelen sus turnos"""
    cliente_name = get_cliente_name_by_id(request.cliente_id)
    if not cliente_name:
        return jsonify({"message": "Cliente no encontrado"}), 404
    
    try:
        with get_db_cursor() as cursor:
            # Verificar turno
            cursor.execute(
                "SELECT id, status FROM turnos WHERE id = %s AND empresa_id = %s AND cliente_name = %s",
                (id_turno, id_empresa, cliente_name)
            )
            turno = cursor.fetchone()
            
            if not turno:
                return jsonify({"message": "Turno no encontrado o no tienes permiso"}), 404
            
            if turno[1] == 'Cancelado':
                return jsonify({"message": "El turno ya está cancelado"}), 400
            
            if turno[1] == 'Completado':
                return jsonify({"message": "No se pueden cancelar turnos completados"}), 400
            
            # Cancelar
            cursor.execute("UPDATE turnos SET status = 'Cancelado' WHERE id = %s", (id_turno,))
            
            # Obtener turno actualizado
            cursor.execute(f"{TURNO_SELECT_QUERY} WHERE t.id = %s", (id_turno,))
            turno_actualizado = cursor.fetchone()
            
        return jsonify(format_turno_row(turno_actualizado)), 200
        
    except Exception as e:
        return jsonify({"message": f"Error interno del servidor: {str(e)}"}), 500


@app.route('/cliente/empresa/<int:id_empresa>/turno/<int:id_turno>/modificar', methods=['PUT'])
@requiere_token_cliente
def modificar_turno_cliente(id_empresa, id_turno):
    """Endpoint para que los clientes modifiquen sus turnos"""
    datos = request.get_json()
    if not datos:
        return jsonify({"message": "Se requiere un cuerpo JSON"}), 400
    
    cliente_name = get_cliente_name_by_id(request.cliente_id)
    if not cliente_name:
        return jsonify({"message": "Cliente no encontrado"}), 404
    
    try:
        with get_db_cursor() as cursor:
            # Verificar turno
            cursor.execute(
                "SELECT id, status FROM turnos WHERE id = %s AND empresa_id = %s AND cliente_name = %s",
                (id_turno, id_empresa, cliente_name)
            )
            turno = cursor.fetchone()
            
            if not turno:
                return jsonify({"message": "Turno no encontrado o no tienes permiso"}), 404
            
            if turno[1] in ('Cancelado', 'Completado'):
                return jsonify({"message": f"No se pueden modificar turnos {turno[1].lower()}s"}), 400
            
            # Validar fecha si se proporciona
            if 'start_datetime' in datos:
                try:
                    fecha_hora = datetime.strptime(datos['start_datetime'], '%Y-%m-%d %H:%M:%S')
                    if fecha_hora <= datetime.now():
                        return jsonify({"message": "No se pueden agendar turnos en el pasado"}), 400
                except ValueError:
                    return jsonify({"message": "Formato de fecha/hora inválido"}), 400
            
            # Validar profesional si se proporciona
            if 'profesional_id' in datos:
                if not validate_profesional_empresa(datos['profesional_id'], id_empresa):
                    return jsonify({"message": "Profesional no encontrado"}), 404
            
            campos, valores = _build_update_fields(
                datos, ['profesional_id', 'start_datetime', 'observaciones']
            )
            
            if not campos:
                return jsonify({"message": "No hay datos para actualizar"}), 400
            
            valores.append(id_turno)
            cursor.execute(f"UPDATE turnos SET {', '.join(campos)} WHERE id = %s", valores)
            
            # Obtener turno actualizado
            cursor.execute(f"{TURNO_SELECT_QUERY} WHERE t.id = %s", (id_turno,))
            turno_actualizado = cursor.fetchone()
            
        return jsonify(format_turno_row(turno_actualizado)), 200
        
    except Exception as e:
        return jsonify({"message": f"Error interno del servidor: {str(e)}"}), 500


# ---------------------- ENDPOINT PÚBLICO ----------------------
@app.route('/publico/empresas', methods=['GET'])
def obtener_empresas_publicas():
    """Endpoint público para listar empresas disponibles"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT id, nombre FROM empresas ORDER BY nombre")
            empresas = cursor.fetchall()
            
        return jsonify([{"id": emp[0], "nombre": emp[1]} for emp in empresas]), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ==================== FUNCIONES HELPER PRIVADAS ====================

def _build_update_fields(datos, allowed_fields):
    """
    Construye campos y valores para una query UPDATE.
    
    Args:
        datos: dict con los datos
        allowed_fields: lista de campos permitidos
        
    Returns:
        tuple: (campos, valores)
    """
    campos = []
    valores = []
    for field in allowed_fields:
        if field in datos and datos[field] is not None:
            # Para password vacío, no incluir
            if field == 'password' and not datos[field]:
                continue
            campos.append(f"{field} = %s")
            valores.append(datos[field])
    return campos, valores


def _check_cliente_duplicado(cursor, dni, email=None):
    """Verifica si ya existe un cliente con el mismo DNI o email"""
    cursor.execute("SELECT id FROM clientes WHERE dni = %s", (dni,))
    if cursor.fetchone():
        return True
    
    if email:
        cursor.execute("SELECT id FROM clientes WHERE email = %s", (email,))
        if cursor.fetchone():
            return True
    return False


def _validate_cliente_update(cursor, id_cliente, datos):
    """Valida campos únicos para actualización de cliente"""
    if 'dni' in datos:
        cursor.execute(
            "SELECT id FROM clientes WHERE dni = %s AND id != %s", 
            (datos['dni'], id_cliente)
        )
        if cursor.fetchone():
            return jsonify({"message": "No se pudo actualizar. Verifique los datos ingresados."}), 400
    
    if 'email' in datos and datos['email']:
        cursor.execute(
            "SELECT id FROM clientes WHERE email = %s AND id != %s", 
            (datos['email'], id_cliente)
        )
        if cursor.fetchone():
            return jsonify({"message": "No se pudo actualizar. Verifique los datos ingresados."}), 400
    
    return None


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
        cursor.execute(
            """SELECT start_datetime, 
               DATE_ADD(start_datetime, INTERVAL COALESCE(s.duration_minutes, 30) MINUTE) as end_datetime
               FROM turnos t
               LEFT JOIN servicios s ON t.servicio_id = s.id
               WHERE t.profesional_id = %s AND DATE(t.start_datetime) = %s AND t.status != 'Cancelado'""",
            (profesional_id, fecha)
        )
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
            
            if not ocupado and hora_actual > ahora:
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

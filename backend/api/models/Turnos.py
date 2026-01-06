from api.db.db_config import get_db_connection

class Turno:

    schema = {
        "empresa_id": int,
        "profesional_id": int,
        "servicio_id": int,  # Puede ser None
        "cliente_name": str,
        "start_datetime": str, 
        "status": str,
        "observaciones": str  # Opcional
    }

    @classmethod
    def validar(cls, datos):
        if datos is None or not isinstance(datos, dict):
            return False
        # Campos requeridos (servicio_id y observaciones son opcionales)
        campos_requeridos = ["empresa_id", "profesional_id", "cliente_name", "start_datetime", "status"]
        for campo in campos_requeridos:
            if campo not in datos:
                return False
            if type(datos[campo]) != cls.schema[campo]:
                return False
        # servicio_id es opcional (puede ser None)
        if "servicio_id" in datos and datos["servicio_id"] is not None:
            if type(datos["servicio_id"]) != int:
                return False
        # observaciones es opcional
        if "observaciones" in datos and datos["observaciones"] is not None:
            if type(datos["observaciones"]) != str:
                return False
        return True

    def __init__(self, fila):
        self.__id = fila[0]
        self.__empresa_id = fila[1]
        self.__profesional_id = fila[2]
        self.__servicio_id = fila[3] if fila[3] is not None else None
        self.__cliente_name = fila[4]
        self.__observaciones = fila[5] if len(fila) > 5 and fila[5] is not None else None
        # Ajustar índices según si hay observaciones o no
        if len(fila) > 8:
            # Nueva estructura con observaciones
            self.__start_datetime = str(fila[6])
            self.__status = fila[7]
            self.__created_at = fila[8]
        else:
            # Estructura antigua sin observaciones
            self.__start_datetime = str(fila[5])
            self.__status = fila[6]
            self.__created_at = fila[7]

    def to_json(self):
        return {
            "id": self.__id,
            "empresa_id": self.__empresa_id,
            "profesional_id": self.__profesional_id,
            "servicio_id": self.__servicio_id,
            "cliente_name": self.__cliente_name,
            "observaciones": self.__observaciones,
            "start_datetime": self.__start_datetime,
            "status": self.__status,
            "created_at": self.__created_at
        }

    # ----------------- MÉTODOS CRUD ----------------- #

    @classmethod
    def get_turno_by_id(cls, id):
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT * FROM turnos WHERE id = %s", (id,))
        fila = cursor.fetchone()
        cursor.close()
        connection.close()
        return Turno(fila).to_json() if fila else None

    @classmethod
    def get_turnos(cls):
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT * FROM turnos")
        filas = cursor.fetchall()
        cursor.close()
        connection.close()
        return [Turno(fila).to_json() for fila in filas] if filas else []
    
    @classmethod
    def get_turnos_by_idempresa(cls, empresa_id):
        connection = get_db_connection()
        cursor = connection.cursor()
        
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
            ORDER BY t.start_datetime ASC
        """
        
        cursor.execute(query, (empresa_id,))
        filas = cursor.fetchall()
        cursor.close()
        connection.close()

        resultados = []
        for fila in filas:
            # Creamos el objeto Turno base
            turno_base = Turno(fila).to_json()
            
            # Agregamos los datos extra obtenidos del JOIN
            # Ahora incluye observaciones (columna 5) y especialidad
            turno_base["profesional_nombre"] = fila[9] if len(fila) > 9 else None
            turno_base["profesional_apellido"] = fila[10] if len(fila) > 10 else None
            turno_base["profesional_especialidad"] = fila[11] if len(fila) > 11 else "Consulta General"
            turno_base["servicio_nombre"] = fila[12] if len(fila) > 12 else None
            turno_base["precio"] = fila[13] if len(fila) > 13 else 0
            
            # Si no hay servicio, usar la especialidad como nombre
            if not turno_base["servicio_nombre"]:
                turno_base["servicio_nombre"] = turno_base["profesional_especialidad"] or "Consulta General"
            
            resultados.append(turno_base)
            
        return resultados

    @classmethod
    def create_turno(cls, datos):
        if not cls.validar(datos):
            raise ValueError("Datos inválidos")

        connection = get_db_connection()
        cursor = connection.cursor()

        # 0. Validar que la fecha/hora no sea en el pasado
        from datetime import datetime
        try:
            fecha_hora_turno = datetime.strptime(datos["start_datetime"], '%Y-%m-%d %H:%M:%S')
            ahora = datetime.now()
            
            if fecha_hora_turno <= ahora:
                cursor.close()
                connection.close()
                raise ValueError("No se pueden agendar turnos en el pasado")
        except ValueError as e:
            if "No se pueden agendar" in str(e):
                raise
            # Si es error de formato, continuar (se validará después)

        # 1. Obtener la duración del servicio o usar duración por defecto
        duracion_nueva = 30  # Duración por defecto en minutos
        
        if datos.get("servicio_id"):
            cursor.execute("SELECT duration_minutes FROM servicios WHERE id = %s", (datos["servicio_id"],))
            servicio = cursor.fetchone()
            
            if not servicio:
                cursor.close()
                connection.close()
                raise ValueError("El servicio seleccionado no existe")
                
            duracion_nueva = servicio[0]
        else:
            # Si no hay servicio_id, obtener duración por defecto según especialidad del profesional
            cursor.execute("SELECT especialidad FROM profesionales WHERE id = %s", (datos["profesional_id"],))
            prof = cursor.fetchone()
            if prof:
                # Duración por defecto según especialidad (puedes ajustar estos valores)
                especialidad = prof[0] or "Consulta General"
                if "Cardiología" in especialidad or "Psiquiatría" in especialidad:
                    duracion_nueva = 45
                elif "Cirugía" in especialidad:
                    duracion_nueva = 60
                else:
                    duracion_nueva = 30

        # 2. VALIDACIÓN DE SUPERPOSICIÓN DE TURNOS
        # Buscamos turnos existentes del mismo profesional que se superpongan.
        # Si el turno tiene servicio, usamos su duración, sino usamos 30 minutos por defecto
        cursor.execute(
            """SELECT t.id FROM turnos t
               LEFT JOIN servicios s ON t.servicio_id = s.id
               WHERE t.profesional_id = %s
               AND t.status != 'Cancelado'
               AND t.start_datetime < DATE_ADD(%s, INTERVAL %s MINUTE)
               AND DATE_ADD(t.start_datetime, INTERVAL COALESCE(s.duration_minutes, 30) MINUTE) > %s""",
            (datos["profesional_id"], datos["start_datetime"], duracion_nueva, datos["start_datetime"])
        )
        
        if cursor.fetchone():
            cursor.close()
            connection.close()
            raise ValueError("El profesional ya tiene un turno asignado en ese horario")

        # 3. Insertar si no hay conflictos
        observaciones = datos.get("observaciones") or None
        servicio_id = datos.get("servicio_id") or None
        
        cursor.execute(
            """INSERT INTO turnos 
               (empresa_id, profesional_id, servicio_id, cliente_name, observaciones, start_datetime, status, created_at) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())""",
            (datos["empresa_id"], datos["profesional_id"], servicio_id, 
             datos["cliente_name"], observaciones, datos["start_datetime"], datos["status"])
        )
        connection.commit()
        nuevo_id = cursor.lastrowid
        
        cursor.execute("SELECT * FROM turnos WHERE id = %s", (nuevo_id,))
        nuevo = cursor.fetchone()
        cursor.close()
        connection.close()
        return Turno(nuevo).to_json()

    @classmethod
    def update_turno(cls, id, datos):
        if not cls.validar(datos):
            raise ValueError("Datos inválidos")

        connection = get_db_connection()
        cursor = connection.cursor()
        
        cursor.execute("SELECT id FROM turnos WHERE id = %s", (id,))
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            raise ValueError("No existe el turno")

        # Validar que la fecha/hora no sea en el pasado (solo si se está cambiando la fecha/hora)
        # Si solo se está cambiando el estado, permitir incluso si el turno ya pasó
        from datetime import datetime
        try:
            # Obtener el turno original para comparar
            cursor.execute("SELECT start_datetime FROM turnos WHERE id = %s", (id,))
            turno_original = cursor.fetchone()
            
            if turno_original and "start_datetime" in datos:
                fecha_original = turno_original[0]
                fecha_nueva = datetime.strptime(datos["start_datetime"], '%Y-%m-%d %H:%M:%S')
                
                # Solo validar si se está cambiando la fecha/hora
                if isinstance(fecha_original, str):
                    fecha_original = datetime.strptime(fecha_original, '%Y-%m-%d %H:%M:%S')
                
                if fecha_nueva != fecha_original:
                    # Se está cambiando la fecha/hora, validar que no sea en el pasado
                    ahora = datetime.now()
                    if fecha_nueva <= ahora:
                        cursor.close()
                        connection.close()
                        raise ValueError("No se pueden reprogramar turnos a fechas/horas pasadas")
        except ValueError as e:
            if "No se pueden" in str(e):
                raise
            # Si es otro tipo de ValueError (formato inválido), continuar

        # 1. Obtener duración del servicio o usar duración por defecto
        duracion_nueva = 30  # Duración por defecto
        
        if datos.get("servicio_id"):
            cursor.execute("SELECT duration_minutes FROM servicios WHERE id = %s", (datos["servicio_id"],))
            servicio = cursor.fetchone()
            if not servicio:
                cursor.close()
                connection.close()
                raise ValueError("El servicio seleccionado no existe")
            duracion_nueva = servicio[0]
        else:
            # Si no hay servicio_id, obtener duración por defecto según especialidad
            cursor.execute("SELECT especialidad FROM profesionales WHERE id = %s", (datos["profesional_id"],))
            prof = cursor.fetchone()
            if prof:
                especialidad = prof[0] or "Consulta General"
                if "Cardiología" in especialidad or "Psiquiatría" in especialidad:
                    duracion_nueva = 45
                elif "Cirugía" in especialidad:
                    duracion_nueva = 60
                else:
                    duracion_nueva = 30

        # 2. VALIDACIÓN DE SUPERPOSICIÓN (UPDATE)
        # Excluimos el ID actual (AND t.id != %s) para permitir guardar cambios en el mismo turno
        cursor.execute(
            """SELECT t.id FROM turnos t
               LEFT JOIN servicios s ON t.servicio_id = s.id
               WHERE t.profesional_id = %s
               AND t.status != 'Cancelado'
               AND t.id != %s
               AND t.start_datetime < DATE_ADD(%s, INTERVAL %s MINUTE)
               AND DATE_ADD(t.start_datetime, INTERVAL COALESCE(s.duration_minutes, 30) MINUTE) > %s""",
            (datos["profesional_id"], id, datos["start_datetime"], duracion_nueva, datos["start_datetime"])
        )

        if cursor.fetchone():
            cursor.close()
            connection.close()
            raise ValueError("El profesional ya tiene un turno asignado en ese horario")

        # 3. Update
        observaciones = datos.get("observaciones") or None
        servicio_id = datos.get("servicio_id") or None
        
        cursor.execute(
            """UPDATE turnos SET 
               empresa_id=%s, profesional_id=%s, servicio_id=%s, cliente_name=%s, observaciones=%s, start_datetime=%s, status=%s 
               WHERE id=%s""",
            (datos["empresa_id"], datos["profesional_id"], servicio_id, 
             datos["cliente_name"], observaciones, datos["start_datetime"], datos["status"], id)
        )
        connection.commit()
        
        cursor.execute("SELECT * FROM turnos WHERE id = %s", (id,))
        actualizado = cursor.fetchone()
        cursor.close()
        connection.close()
        return Turno(actualizado).to_json()
        
    @classmethod
    def delete_turno(cls, id):
        connection = get_db_connection()
        cursor = connection.cursor()
        
        cursor.execute("SELECT * FROM turnos WHERE id = %s", (id,))
        eliminado = cursor.fetchone()
        if not eliminado:
            cursor.close()
            connection.close()
            raise ValueError("No existe el turno")

        # En Turnos no hay dependencias hijas que eliminar, así que el borrado es directo
        cursor.execute("DELETE FROM turnos WHERE id = %s", (id,))
        connection.commit()
        cursor.close()
        connection.close()
        return Turno(eliminado).to_json()
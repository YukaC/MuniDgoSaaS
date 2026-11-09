"""
Modelo Turno - Refactorizado con Connection Pooling
"""
from api.utils.db_helpers import get_db_cursor
from api.utils.formatters import format_turno_row
from api.config import Config


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
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM turnos WHERE id = %s", (id,))
            fila = cursor.fetchone()
        return Turno(fila).to_json() if fila else None

    @classmethod
    def get_turnos(cls, limit=500, offset=0):
        limit = min(int(limit), 500) if limit else 500
        offset = max(int(offset), 0) if offset else 0
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM turnos ORDER BY id ASC LIMIT %s OFFSET %s", (limit, offset))
            filas = cursor.fetchall()
        return [Turno(fila).to_json() for fila in filas] if filas else []
    
    @classmethod
    def get_turnos_by_idempresa(cls, empresa_id):
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
            ORDER BY 
                CASE 
                    WHEN t.status = 'Pendiente de Confirmación' THEN 0
                    WHEN t.status = 'Reservado' THEN 1
                    ELSE 2
                END,
                t.start_datetime ASC
        """
        
        with get_db_cursor() as cursor:
            cursor.execute(query, (empresa_id,))
            filas = cursor.fetchall()

        resultados = []
        for fila in filas:
            # Creamos el objeto Turno base
            turno_base = Turno(fila).to_json()
            
            # Agregamos los datos extra obtenidos del JOIN
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

        # 1. Obtener la duración del servicio o usar duración por defecto
        duracion_nueva = cls._get_duracion_servicio(datos)

        with get_db_cursor() as cursor:
            # 2. VALIDACIÓN DE SUPERPOSICIÓN DE TURNOS
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
            nuevo_id = cursor.lastrowid
            
            # Programar email de confirmación (15 mins de retardo)
            from api.utils.email_utils import programar_email_confirmacion
            programar_email_confirmacion(nuevo_id)
            
            cursor.execute("SELECT * FROM turnos WHERE id = %s", (nuevo_id,))
            nuevo = cursor.fetchone()
            
        return Turno(nuevo).to_json()

    @classmethod
    def update_turno(cls, id, datos):
        if not cls.validar(datos):
            raise ValueError("Datos inválidos")

        # 1. Obtener duración del servicio
        duracion_nueva = cls._get_duracion_servicio(datos)

        with get_db_cursor() as cursor:
            cursor.execute("SELECT id FROM turnos WHERE id = %s", (id,))
            if not cursor.fetchone():
                raise ValueError("No existe el turno")

            # 2. VALIDACIÓN DE SUPERPOSICIÓN (UPDATE)
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
            
            cursor.execute("SELECT * FROM turnos WHERE id = %s", (id,))
            actualizado = cursor.fetchone()
            
        return Turno(actualizado).to_json()
        
    @classmethod
    def delete_turno(cls, id):
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM turnos WHERE id = %s", (id,))
            eliminado = cursor.fetchone()
            if not eliminado:
                raise ValueError("No existe el turno")

            cursor.execute("DELETE FROM turnos WHERE id = %s", (id,))
            
        return Turno(eliminado).to_json()

    # ----------------- HELPERS PRIVADOS ----------------- #
    
    @classmethod
    def _get_duracion_servicio(cls, datos):
        """Obtiene la duración del servicio o calcula por defecto según especialidad"""
        duracion_nueva = Config.DURATION_SHORT  # Por defecto
        
        with get_db_cursor() as cursor:
            if datos.get("servicio_id"):
                cursor.execute("SELECT duration_minutes FROM servicios WHERE id = %s", (datos["servicio_id"],))
                servicio = cursor.fetchone()
                
                if not servicio:
                    raise ValueError("El servicio seleccionado no existe")
                    
                duracion_nueva = servicio[0]
            else:
                # Si no hay servicio_id, obtener duración por defecto según especialidad
                cursor.execute("SELECT especialidad FROM profesionales WHERE id = %s", (datos["profesional_id"],))
                prof = cursor.fetchone()
                if prof:
                    especialidad = prof[0] or "Consulta General"
                    if "Cardiología" in especialidad or "Psiquiatría" in especialidad:
                        duracion_nueva = Config.DURATION_MEDIUM
                    elif "Cirugía" in especialidad:
                        duracion_nueva = Config.DURATION_LONG
                    else:
                        duracion_nueva = Config.DURATION_SHORT
        
        return duracion_nueva
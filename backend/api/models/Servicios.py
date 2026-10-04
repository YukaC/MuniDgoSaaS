"""
Modelo Servicio - Refactorizado con Connection Pooling
"""
from api.utils.db_helpers import get_db_cursor


class Servicio:

    schema = {
        "empresa_id": int,
        "name": str,
        "duration_minutes": int,
        "price": int,
        "description": str
    }

    @classmethod
    def validar(cls, datos):
        if datos is None or not isinstance(datos, dict):
            return False
        
        for key in cls.schema:
            if key not in datos:
                return False
            if type(datos[key]) != cls.schema[key]:
                return False
        return True

    def __init__(self, fila):
        self.__id = fila[0]
        self.__empresa_id = fila[1]
        self.__name = fila[2]
        self.__duration_minutes = fila[3]
        self.__price = int(fila[4]) if fila[4] is not None else 0
        self.__description = fila[5] 
        self.__created_at = fila[6]

    def to_json(self):
        return {
            "id": self.__id,
            "empresa_id": self.__empresa_id,
            "name": self.__name,
            "duration_minutes": self.__duration_minutes,
            "price": self.__price,
            "description": self.__description,
            "created_at": self.__created_at
        }

    # ----------------- MÉTODOS CRUD ----------------- #

    @classmethod
    def get_servicio_by_id(cls, id):
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM servicios WHERE id = %s", (id,))
            fila = cursor.fetchone()
        return Servicio(fila).to_json() if fila else None

    @classmethod
    def get_servicios(cls, limit=500, offset=0):
        limit = min(int(limit), 500) if limit else 500
        offset = max(int(offset), 0) if offset else 0
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM servicios ORDER BY id ASC LIMIT %s OFFSET %s", (limit, offset))
            filas = cursor.fetchall()
        return [Servicio(fila).to_json() for fila in filas] if filas else []
    
    @classmethod
    def get_servicios_by_idempresa(cls, empresa_id):
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM servicios WHERE empresa_id = %s", (empresa_id,))
            filas = cursor.fetchall()
        return [Servicio(fila).to_json() for fila in filas] if filas else []

    @classmethod
    def create_servicio(cls, datos):
        if not cls.validar(datos):
            raise ValueError("Datos inválidos")

        with get_db_cursor() as cursor:
            # --- VALIDACIÓN DE DUPLICADOS ---
            cursor.execute("SELECT id FROM servicios WHERE name = %s", (datos["name"],))
            if cursor.fetchone():
                raise ValueError("El nombre del servicio ya existe")

            # --- INSERCIÓN ---
            cursor.execute(
                """INSERT INTO servicios 
                   (empresa_id, name, duration_minutes, price, description, created_at) 
                   VALUES (%s, %s, %s, %s, %s, NOW())""",
                (datos["empresa_id"], datos["name"], datos["duration_minutes"], 
                 datos["price"], datos["description"])
            )
            nuevo_id = cursor.lastrowid
            
            cursor.execute("SELECT * FROM servicios WHERE id = %s", (nuevo_id,))
            nuevo = cursor.fetchone()
            
        return Servicio(nuevo).to_json()

    @classmethod
    def update_servicio(cls, id, datos):
        if not cls.validar(datos):
            raise ValueError("Datos inválidos")

        with get_db_cursor() as cursor:
            cursor.execute("SELECT id FROM servicios WHERE id = %s", (id,))
            if not cursor.fetchone():
                raise ValueError("No existe el recurso")

            # --- VALIDACIÓN DE DUPLICADOS PARA UPDATE ---
            cursor.execute("SELECT id FROM servicios WHERE name = %s AND id != %s", (datos["name"], id))
            if cursor.fetchone():
                raise ValueError("El nombre del servicio ya existe")

            # --- ACTUALIZACIÓN ---
            cursor.execute(
                """UPDATE servicios SET 
                   empresa_id=%s, name=%s, duration_minutes=%s, price=%s, description=%s 
                   WHERE id=%s""",
                (datos["empresa_id"], datos["name"], datos["duration_minutes"], 
                 datos["price"], datos["description"], id)
            )
            
            cursor.execute("SELECT * FROM servicios WHERE id = %s", (id,))
            actualizado = cursor.fetchone()
            
        return Servicio(actualizado).to_json()

    @classmethod
    def delete_servicio(cls, id):
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM servicios WHERE id = %s", (id,))
            eliminado = cursor.fetchone()
            if not eliminado:
                raise ValueError("No existe el recurso")

            # --- ELIMINACIÓN EN CASCADA ---
            # Eliminar turnos asociados (o poner servicio_id = NULL)
            cursor.execute("UPDATE turnos SET servicio_id = NULL WHERE servicio_id = %s", (id,))

            # Eliminar el servicio
            cursor.execute("DELETE FROM servicios WHERE id = %s", (id,))
            
        return Servicio(eliminado).to_json()
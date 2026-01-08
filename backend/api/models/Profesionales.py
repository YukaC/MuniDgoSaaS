"""
Modelo Profesional - Refactorizado con Connection Pooling
"""
from api.utils.db_helpers import get_db_cursor


class Profesional:

    schema = {
        "empresa_id": int,
        "name": str,
        "surname": str,
        "email": str,
        "dni": str,      
        "matricula": str,
        "especialidad": str
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
        self.__surname = fila[3]
        self.__email = fila[4]
        self.__dni = fila[5]
        self.__matricula = fila[6]
        self.__especialidad = fila[7] if len(fila) > 7 else 'Consulta General'
        self.__created_at = fila[8] if len(fila) > 8 else fila[7] 

    def to_json(self):
        return {
            "id": self.__id,
            "empresa_id": self.__empresa_id,
            "name": self.__name,
            "surname": self.__surname,
            "email": self.__email,
            "dni": self.__dni,
            "matricula": self.__matricula,
            "especialidad": self.__especialidad,
            "created_at": self.__created_at
        }

    # ----------------- MÉTODOS CRUD ----------------- #

    @classmethod
    def get_profesional_by_id(cls, id):
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM profesionales WHERE id = %s", (id,))
            fila = cursor.fetchone()
        return Profesional(fila).to_json() if fila else None

    @classmethod
    def get_profesionales(cls):
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM profesionales")
            filas = cursor.fetchall()
        return [Profesional(fila).to_json() for fila in filas] if filas else []

    @classmethod
    def get_profesionales_by_idempresa(cls, empresa_id):
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM profesionales WHERE empresa_id = %s", (empresa_id,))
            filas = cursor.fetchall()
        return [Profesional(fila).to_json() for fila in filas] if filas else []

    @classmethod
    def create_profesional(cls, datos):
        if not cls.validar(datos):
            raise ValueError("Datos inválidos")

        with get_db_cursor() as cursor:
            # --- VALIDACIÓN DE DUPLICADOS ---
            cursor.execute(
                """SELECT email, dni, matricula FROM profesionales 
                   WHERE email = %s OR dni = %s OR matricula = %s""",
                (datos["email"], datos["dni"], datos["matricula"])
            )
            coincidencias = cursor.fetchall()

            if coincidencias:
                cls._verificar_duplicados(coincidencias, datos)

            # --- INSERCIÓN ---
            especialidad = datos.get("especialidad", "Consulta General")
            cursor.execute(
                """INSERT INTO profesionales 
                   (empresa_id, name, surname, email, dni, matricula, especialidad, created_at) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())""",
                (datos["empresa_id"], datos["name"], datos["surname"], 
                 datos["email"], datos["dni"], datos["matricula"], especialidad)
            )
            nuevo_id = cursor.lastrowid
            
            cursor.execute("SELECT * FROM profesionales WHERE id = %s", (nuevo_id,))
            nuevo = cursor.fetchone()

        return Profesional(nuevo).to_json()

    @classmethod
    def update_profesional(cls, id, datos):
        if not cls.validar(datos):
            raise ValueError("Datos inválidos")

        with get_db_cursor() as cursor:
            cursor.execute("SELECT id FROM profesionales WHERE id = %s", (id,))
            if not cursor.fetchone():
                raise ValueError("No existe el recurso solicitado")

            # --- VALIDACIÓN DE DUPLICADOS PARA UPDATE ---
            cursor.execute(
                """SELECT email, dni, matricula FROM profesionales 
                   WHERE (email = %s OR dni = %s OR matricula = %s) AND id != %s""",
                (datos["email"], datos["dni"], datos["matricula"], id)
            )
            coincidencias = cursor.fetchall()

            if coincidencias:
                cls._verificar_duplicados(coincidencias, datos)

            # --- ACTUALIZACIÓN ---
            especialidad = datos.get("especialidad", "Consulta General")
            cursor.execute(
                """UPDATE profesionales SET 
                   empresa_id=%s, name=%s, surname=%s, email=%s, dni=%s, matricula=%s, especialidad=%s 
                   WHERE id=%s""",
                (datos["empresa_id"], datos["name"], datos["surname"], 
                 datos["email"], datos["dni"], datos["matricula"], especialidad, id)
            )

            cursor.execute("SELECT * FROM profesionales WHERE id = %s", (id,))
            actualizado = cursor.fetchone()

        return Profesional(actualizado).to_json()

    @classmethod
    def delete_profesional(cls, id):
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM profesionales WHERE id = %s", (id,))
            eliminado = cursor.fetchone()

            if eliminado is None:
                raise ValueError("No existe el recurso solicitado")

            # --- ELIMINACIÓN EN CASCADA ---
            # 1. Eliminar Turnos asociados
            cursor.execute("DELETE FROM turnos WHERE profesional_id = %s", (id,))
            
            # 2. Eliminar Disponibilidades asociadas
            cursor.execute("DELETE FROM disponibilidades WHERE profesional_id = %s", (id,))

            # 3. Eliminar el Profesional
            cursor.execute("DELETE FROM profesionales WHERE id = %s", (id,))

        return Profesional(eliminado).to_json()

    # ----------------- HELPERS PRIVADOS ----------------- #
    
    @classmethod
    def _verificar_duplicados(cls, coincidencias, datos):
        """Verifica qué campo está duplicado y lanza error apropiado"""
        for fila in coincidencias:
            db_email, db_dni, db_matricula = fila
            
            if db_email == datos["email"]:
                raise ValueError("El email ya está registrado")
            
            if db_dni == datos["dni"]:
                raise ValueError("El DNI ya está registrado")
            
            if db_matricula == datos["matricula"]:
                raise ValueError("La matrícula ya está registrada")
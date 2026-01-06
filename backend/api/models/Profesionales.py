from api.db.db_config import get_db_connection

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
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT * FROM profesionales WHERE id = %s", (id,))
        fila = cursor.fetchone()

        cursor.close()
        connection.close()

        if fila:
            return Profesional(fila).to_json()
        return None

    @classmethod
    def get_profesionales(cls):
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT * FROM profesionales")
        filas = cursor.fetchall()

        cursor.close()
        connection.close()

        if filas:
            return [Profesional(fila).to_json() for fila in filas]
        return []

    @classmethod
    def get_profesionales_by_idempresa(cls, empresa_id):
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT * FROM profesionales WHERE empresa_id = %s", (empresa_id,))
        filas = cursor.fetchall()

        cursor.close()
        connection.close()

        if filas:
            return [Profesional(fila).to_json() for fila in filas]
        return []

    @classmethod
    def create_profesional(cls, datos):
        if not cls.validar(datos):
            raise ValueError("Datos inválidos")

        connection = get_db_connection()
        cursor = connection.cursor()

        # --- VALIDACIÓN DE DUPLICADOS ---
        # Buscamos si existe algun registro que coincida con email, dni o matrícula
        cursor.execute(
            """SELECT email, dni, matricula FROM profesionales 
               WHERE email = %s OR dni = %s OR matricula = %s""",
            (datos["email"], datos["dni"], datos["matricula"])
        )
        # Usamos fetchall por si hay conflictos con múltiples registros diferentes
        coincidencias = cursor.fetchall()

        if coincidencias:
            # Si hay resultados, verificamos cuál campo causó el conflicto
            for fila in coincidencias:
                # fila[0] = email, fila[1] = dni, fila[2] = matricula
                db_email, db_dni, db_matricula = fila
                
                if db_email == datos["email"]:
                    cursor.close()
                    connection.close()
                    raise ValueError("El email ya está registrado")
                
                if db_dni == datos["dni"]:
                    cursor.close()
                    connection.close()
                    raise ValueError("El DNI ya está registrado")
                
                if db_matricula == datos["matricula"]:
                    cursor.close()
                    connection.close()
                    raise ValueError("La matrícula ya está registrada")

        # --- FIN VALIDACIÓN ---

        especialidad = datos.get("especialidad", "Consulta General")
        cursor.execute(
            """INSERT INTO profesionales 
               (empresa_id, name, surname, email, dni, matricula, especialidad, created_at) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())""",
            (datos["empresa_id"], datos["name"], datos["surname"], 
             datos["email"], datos["dni"], datos["matricula"], especialidad)
        )
        connection.commit()
        nuevo_id = cursor.lastrowid
        
        cursor.execute("SELECT * FROM profesionales WHERE id = %s", (nuevo_id,))
        nuevo = cursor.fetchone()

        cursor.close()
        connection.close()

        return Profesional(nuevo).to_json()

    @classmethod
    def update_profesional(cls, id, datos):
        if not cls.validar(datos):
            raise ValueError("Datos inválidos")

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("SELECT id FROM profesionales WHERE id = %s", (id,))
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            raise ValueError("No existe el recurso solicitado")

        # --- VALIDACIÓN DE DUPLICADOS PARA UPDATE ---
        # Buscamos coincidencias excluyendo el ID actual para permitir guardar los mismos datos propios
        cursor.execute(
            """SELECT email, dni, matricula FROM profesionales 
               WHERE (email = %s OR dni = %s OR matricula = %s) AND id != %s""",
            (datos["email"], datos["dni"], datos["matricula"], id)
        )
        coincidencias = cursor.fetchall()

        if coincidencias:
            for fila in coincidencias:
                db_email, db_dni, db_matricula = fila
                
                if db_email == datos["email"]:
                    cursor.close()
                    connection.close()
                    raise ValueError("El email ya está registrado")
                
                if db_dni == datos["dni"]:
                    cursor.close()
                    connection.close()
                    raise ValueError("El DNI ya está registrado")
                
                if db_matricula == datos["matricula"]:
                    cursor.close()
                    connection.close()
                    raise ValueError("La matrícula ya está registrada")
        # --- FIN VALIDACIÓN ---

        especialidad = datos.get("especialidad", "Consulta General")
        cursor.execute(
            """UPDATE profesionales SET 
               empresa_id=%s, name=%s, surname=%s, email=%s, dni=%s, matricula=%s, especialidad=%s 
               WHERE id=%s""",
            (datos["empresa_id"], datos["name"], datos["surname"], 
             datos["email"], datos["dni"], datos["matricula"], especialidad, id)
        )
        connection.commit()

        cursor.execute("SELECT * FROM profesionales WHERE id = %s", (id,))
        actualizado = cursor.fetchone()

        cursor.close()
        connection.close()

        return Profesional(actualizado).to_json()

    @classmethod
    def delete_profesional(cls, id):
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("SELECT * FROM profesionales WHERE id = %s", (id,))
        eliminado = cursor.fetchone()

        if eliminado is None:
            cursor.close()
            connection.close()
            raise ValueError("No existe el recurso solicitado")

        # --- ELIMINACIÓN EN CASCADA MANUAL ---
        # 1. Eliminar Turnos asociados a este profesional (evita registros huérfanos)
        cursor.execute("DELETE FROM turnos WHERE profesional_id = %s", (id,))
        
        # 2. Eliminar Disponibilidades asociadas (Pedido explícito)
        cursor.execute("DELETE FROM disponibilidades WHERE profesional_id = %s", (id,))

        # 3. Eliminar el Profesional
        cursor.execute("DELETE FROM profesionales WHERE id = %s", (id,))
        connection.commit()

        cursor.close()
        connection.close()

        return Profesional(eliminado).to_json()
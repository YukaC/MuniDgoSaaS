from api.db.db_config import get_db_connection

class Disponibilidad:

    schema = {
        "profesional_id": int,
        "empresa_id": int,
        "day_of_week": int, 
        "start_time": str, 
        "end_time": str  
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
        self.__profesional_id = fila[1]
        self.__empresa_id = fila[2]
        self.__day_of_week = fila[3]
        self.__start_time = str(fila[4])
        self.__end_time = str(fila[5])
        self.__created_at = fila[6]

    def to_json(self):
        return {
            "id": self.__id,
            "profesional_id": self.__profesional_id,
            "empresa_id": self.__empresa_id,
            "day_of_week": self.__day_of_week,
            "start_time": self.__start_time,
            "end_time": self.__end_time,
            "created_at": self.__created_at
        }

    # ----------------- MÉTODOS CRUD ----------------- #

    @classmethod
    def get_disponibilidad_by_id(cls, id):
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT * FROM disponibilidades WHERE id = %s", (id,))
        fila = cursor.fetchone()
        cursor.close()
        connection.close()
        return Disponibilidad(fila).to_json() if fila else None

    @classmethod
    def get_disponibilidades(cls):
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT * FROM disponibilidades")
        filas = cursor.fetchall()
        cursor.close()
        connection.close()
        return [Disponibilidad(fila).to_json() for fila in filas] if filas else []
    
    @classmethod
    def get_disponibilidades_by_idempresa(cls, empresa_id):
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Seleccionamos explícitamente las columnas para asegurar el orden correcto para __init__ (0-6)
        # y agregamos las columnas extra de la tabla profesionales (7-8)
        query = """
            SELECT 
                d.id, 
                d.profesional_id, 
                d.empresa_id, 
                d.day_of_week, 
                d.start_time, 
                d.end_time, 
                d.created_at,
                p.name AS profesional_nombre, 
                p.surname AS profesional_apellido
            FROM disponibilidades d
            LEFT JOIN profesionales p ON d.profesional_id = p.id
            WHERE d.empresa_id = %s
            ORDER BY d.day_of_week ASC, d.start_time ASC
        """
        
        cursor.execute(query, (empresa_id,))
        filas = cursor.fetchall()

        cursor.close()
        connection.close()

        resultados = []
        if filas:
            for fila in filas:
                # Creamos el objeto base con las primeras 7 columnas
                disp_base = Disponibilidad(fila).to_json()
                
                # Inyectamos los datos extra del profesional
                disp_base["profesional_nombre"] = fila[7]
                disp_base["profesional_apellido"] = fila[8]
                
                resultados.append(disp_base)
                
        return resultados

    @classmethod
    def get_disponibilidades_by_idprofesional(cls, profesional_id):
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT * FROM disponibilidades WHERE profesional_id = %s", (profesional_id,))
        filas = cursor.fetchall()
        cursor.close()
        connection.close()
        return [Disponibilidad(fila).to_json() for fila in filas] if filas else []
    

    @classmethod
    def create_disponibilidad(cls, datos):
        if not cls.validar(datos):
            raise ValueError("Datos inválidos")

        connection = get_db_connection()
        cursor = connection.cursor()

        # --- VALIDACIÓN DE SUPERPOSICIÓN ---
        cursor.execute(
            """SELECT id FROM disponibilidades 
               WHERE profesional_id = %s 
               AND day_of_week = %s 
               AND start_time < %s 
               AND end_time > %s""",
            (datos["profesional_id"], datos["day_of_week"], datos["end_time"], datos["start_time"])
        )
        if cursor.fetchone():
            cursor.close()
            connection.close()
            raise ValueError("El profesional ya tiene disponibilidad asignada en ese horario")
        
        # --- INSERT ACTUALIZADO ---
        # Incluye empresa_id y created_at (NOW())
        cursor.execute(
            """INSERT INTO disponibilidades 
               (profesional_id, empresa_id, day_of_week, start_time, end_time, created_at) 
               VALUES (%s, %s, %s, %s, %s, NOW())""",
            (datos["profesional_id"], datos["empresa_id"], datos["day_of_week"], 
             datos["start_time"], datos["end_time"])
        )
        connection.commit()
        nuevo_id = cursor.lastrowid
        
        cursor.execute("SELECT * FROM disponibilidades WHERE id = %s", (nuevo_id,))
        nuevo = cursor.fetchone()
        cursor.close()
        connection.close()
        return Disponibilidad(nuevo).to_json()

    @classmethod
    def update_disponibilidad(cls, id, datos):
        if not cls.validar(datos):
            raise ValueError("Datos inválidos")

        connection = get_db_connection()
        cursor = connection.cursor()
        
        cursor.execute("SELECT id FROM disponibilidades WHERE id = %s", (id,))
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            raise ValueError("No existe la disponibilidad")

        # --- VALIDACIÓN DE SUPERPOSICIÓN (UPDATE) ---
        cursor.execute(
            """SELECT id FROM disponibilidades 
               WHERE profesional_id = %s 
               AND day_of_week = %s 
               AND start_time < %s 
               AND end_time > %s
               AND id != %s""",
            (datos["profesional_id"], datos["day_of_week"], datos["end_time"], datos["start_time"], id)
        )
        if cursor.fetchone():
            cursor.close()
            connection.close()
            raise ValueError("El profesional ya tiene disponibilidad asignada en ese horario")
        
        # --- UPDATE ACTUALIZADO ---
        # Incluye empresa_id, pero NO toca created_at
        cursor.execute(
            """UPDATE disponibilidades SET 
               profesional_id=%s, empresa_id=%s, day_of_week=%s, start_time=%s, end_time=%s 
               WHERE id=%s""",
            (datos["profesional_id"], datos["empresa_id"], datos["day_of_week"], 
             datos["start_time"], datos["end_time"], id)
        )
        connection.commit()
        
        cursor.execute("SELECT * FROM disponibilidades WHERE id = %s", (id,))
        actualizado = cursor.fetchone()
        cursor.close()
        connection.close()
        return Disponibilidad(actualizado).to_json()

    @classmethod
    def delete_disponibilidad(cls, id):
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT * FROM disponibilidades WHERE id = %s", (id,))
        eliminado = cursor.fetchone()
        if not eliminado:
            raise ValueError("No existe la disponibilidad")

        cursor.execute("DELETE FROM disponibilidades WHERE id = %s", (id,))
        connection.commit()
        cursor.close()
        connection.close()
        return Disponibilidad(eliminado).to_json()
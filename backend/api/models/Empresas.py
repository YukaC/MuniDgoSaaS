from api.db.db_config import get_db_connection
from werkzeug.security import generate_password_hash, check_password_hash
from flask import current_app
import jwt
import datetime

class Empresa:

    schema = {
        "nombre": str,
        "username": str,
        "password": str,
        "email": str
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
        self.__nombre = fila[1]
        self.__username = fila[2]
        self.__password = fila[3]
        self.__email = fila[4]
        self.__created_at = fila[5]

    def to_json(self):
        return {
            "id": self.__id,
            "nombre": self.__nombre,
            "username": self.__username,
            "password": self.__password,
            "email": self.__email,
            "created_at": self.__created_at
        }

    # ----------------- MÉTODOS CRUD ----------------- #

    @classmethod
    def get_empresa_by_id(cls, id):
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT * FROM Empresas WHERE id = %s", (id,))
        fila = cursor.fetchone()
        cursor.close()
        connection.close()
        return Empresa(fila).to_json() if fila else None
    
    @classmethod
    def get_empresa_by_username(cls, username):
        """Método auxiliar útil para login"""
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT * FROM Empresas WHERE username = %s", (username,))
        fila = cursor.fetchone()
        cursor.close()
        connection.close()
        return Empresa(fila).to_json() if fila else None

    @classmethod
    def get_empresas(cls):
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT * FROM Empresas")
        filas = cursor.fetchall()
        cursor.close()
        connection.close()
        return [Empresa(fila).to_json() for fila in filas] if filas else []

    @classmethod
    def register(cls, datos):
        if not cls.validar(datos):
            raise ValueError("Datos inválidos")

        connection = get_db_connection()
        cursor = connection.cursor()

        # --- VALIDACIÓN DE DUPLICADOS ---
        cursor.execute(
            "SELECT nombre, username, email FROM Empresas WHERE nombre = %s OR username = %s OR email = %s",
            (datos["nombre"], datos["username"], datos["email"])
        )
        coincidencias = cursor.fetchall()

        if coincidencias:
            for fila in coincidencias:
                db_nombre, db_username, db_email = fila
                
                if db_nombre == datos["nombre"]:
                    cursor.close()
                    connection.close()
                    raise ValueError("El nombre de la empresa ya está registrado")
                
                if db_username == datos["username"]:
                    cursor.close()
                    connection.close()
                    raise ValueError("El nombre de usuario ya está registrado")
                
                if db_email == datos["email"]:
                    cursor.close()
                    connection.close()
                    raise ValueError("El email ya está registrado")
        # --- FIN VALIDACIÓN ---

        hashed_password = generate_password_hash(datos["password"], method='pbkdf2:sha256')

        cursor.execute(
            """INSERT INTO Empresas (nombre, username, password, email, created_at) 
               VALUES (%s, %s, %s, %s, NOW())""",
            (datos["nombre"], datos["username"], hashed_password, datos["email"])
        )
        connection.commit()
        nuevo_id = cursor.lastrowid
        
        cursor.execute("SELECT * FROM Empresas WHERE id = %s", (nuevo_id,))
        nuevo = cursor.fetchone()
        cursor.close()
        connection.close()
        return Empresa(nuevo).to_json()

    @classmethod
    def update_empresa(cls, id, datos):
        if not cls.validar(datos):
            raise ValueError("Datos inválidos")

        connection = get_db_connection()
        cursor = connection.cursor()
        
        cursor.execute("SELECT id FROM Empresas WHERE id = %s", (id,))
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            raise ValueError("No existe la empresa")

        # --- VALIDACIÓN DE DUPLICADOS PARA UPDATE ---
        # Excluímos el ID actual para permitir guardar los mismos datos propios
        cursor.execute(
            """SELECT nombre, username, email FROM Empresas 
               WHERE (nombre = %s OR username = %s OR email = %s) AND id != %s""",
            (datos["nombre"], datos["username"], datos["email"], id)
        )
        coincidencias = cursor.fetchall()

        if coincidencias:
            for fila in coincidencias:
                db_nombre, db_username, db_email = fila
                
                if db_nombre == datos["nombre"]:
                    cursor.close()
                    connection.close()
                    raise ValueError("El nombre de la empresa ya está registrado")
                
                if db_username == datos["username"]:
                    cursor.close()
                    connection.close()
                    raise ValueError("El nombre de usuario ya está registrado")
                
                if db_email == datos["email"]:
                    cursor.close()
                    connection.close()
                    raise ValueError("El email ya está registrado")
        # --- FIN VALIDACIÓN ---

        hashed_password = generate_password_hash(datos["password"], method='pbkdf2:sha256')

        cursor.execute(
            """UPDATE Empresas SET 
               nombre=%s, username=%s, password=%s, email=%s 
               WHERE id=%s""",
            (datos["nombre"], datos["username"], hashed_password, datos["email"], id)
        )
        connection.commit()
        
        cursor.execute("SELECT * FROM Empresas WHERE id = %s", (id,))
        actualizado = cursor.fetchone()
        cursor.close()
        connection.close()
        return Empresa(actualizado).to_json()

    @classmethod
    def delete_empresa(cls, id):
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Verificar existencia
        cursor.execute("SELECT * FROM Empresas WHERE id = %s", (id,))
        eliminado = cursor.fetchone()
        if not eliminado:
            cursor.close()
            connection.close()
            raise ValueError("No existe la empresa")

        # --- ELIMINACIÓN EN CASCADA MANUAL ---
        # Aseguramos la limpieza desde el código en el orden correcto de dependencias
        
        # 1. Eliminar Turnos (vinculados a empresa, profesional y servicio)
        cursor.execute("DELETE FROM turnos WHERE empresa_id = %s", (id,))

        # 2. Eliminar Disponibilidades (vinculadas a los profesionales de esta empresa)
        # Usamos una subconsulta para encontrar los profesionales de esta empresa
        cursor.execute("""
            DELETE FROM disponibilidades 
            WHERE profesional_id IN (SELECT id FROM profesionales WHERE empresa_id = %s)
        """, (id,))

        # 3. Eliminar Servicios (vinculados a la empresa)
        cursor.execute("DELETE FROM servicios WHERE empresa_id = %s", (id,))

        # 4. Eliminar Profesionales (vinculados a la empresa)
        cursor.execute("DELETE FROM profesionales WHERE empresa_id = %s", (id,))

        # 5. Finalmente eliminar la Empresa
        cursor.execute("DELETE FROM Empresas WHERE id = %s", (id,))
        
        connection.commit()
        cursor.close()
        connection.close()
        return Empresa(eliminado).to_json()

    @classmethod
    def login(cls, auth):
        # Controlar si se recibieron las credenciales
        if not auth or not auth.username or not auth.password:
            raise ValueError("No se recibieron las credenciales")
    
        # Buscar si existe el usuario en la BD
        connection = get_db_connection()
        cursor = connection.cursor()

        # Seleccionamos explícitamente los campos necesarios (password)
        cursor.execute("SELECT id, username, password FROM Empresas WHERE username = %s", (auth.username,))
        fila = cursor.fetchone()

        cursor.close()
        connection.close()

        # Control si el usuario existe
        if fila is None:
            raise ValueError("No existe el usuario")
        
        # Control de la contraseña
        password_bd = fila[2] # password es la tercera columna en el SELECT
        
        if not check_password_hash(password_bd, auth.password):
            raise ValueError("No coincide la contraseña")
        
        # Las credenciales son correctas
        # Generar un token de autorizacion
        token = jwt.encode({
            'username': auth.username,
            'id': fila[0],
            'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=30)
        }, current_app.config["SECRET_KEY"], algorithm="HS256")

        return {"token": token, "nombre": fila[1], "id": fila[0]}
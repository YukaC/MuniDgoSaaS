"""
Modelo Empresa - Refactorizado con Connection Pooling
"""
from werkzeug.security import generate_password_hash, check_password_hash
from flask import current_app
import jwt
import datetime
import os

from api.utils.db_helpers import get_db_cursor


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
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM Empresas WHERE id = %s", (id,))
            fila = cursor.fetchone()
        return Empresa(fila).to_json() if fila else None
    
    @classmethod
    def get_empresa_by_username(cls, username):
        """Método auxiliar útil para login"""
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM Empresas WHERE username = %s", (username,))
            fila = cursor.fetchone()
        return Empresa(fila).to_json() if fila else None

    @classmethod
    def get_empresas(cls):
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM Empresas")
            filas = cursor.fetchall()
        return [Empresa(fila).to_json() for fila in filas] if filas else []

    @classmethod
    def register(cls, datos):
        if not cls.validar(datos):
            raise ValueError("Datos inválidos")

        with get_db_cursor() as cursor:
            # --- VALIDACIÓN DE DUPLICADOS ---
            cursor.execute(
                "SELECT nombre, username, email FROM Empresas WHERE nombre = %s OR username = %s OR email = %s",
                (datos["nombre"], datos["username"], datos["email"])
            )
            coincidencias = cursor.fetchall()

            if coincidencias:
                cls._verificar_duplicados(coincidencias, datos)

            # --- INSERCIÓN ---
            hashed_password = generate_password_hash(datos["password"], method='pbkdf2:sha256')

            cursor.execute(
                """INSERT INTO Empresas (nombre, username, password, email, created_at) 
                   VALUES (%s, %s, %s, %s, NOW())""",
                (datos["nombre"], datos["username"], hashed_password, datos["email"])
            )
            nuevo_id = cursor.lastrowid
            
            cursor.execute("SELECT * FROM Empresas WHERE id = %s", (nuevo_id,))
            nuevo = cursor.fetchone()
            
        return Empresa(nuevo).to_json()

    @classmethod
    def update_empresa(cls, id, datos):
        if not cls.validar(datos):
            raise ValueError("Datos inválidos")

        with get_db_cursor() as cursor:
            cursor.execute("SELECT id FROM Empresas WHERE id = %s", (id,))
            if not cursor.fetchone():
                raise ValueError("No existe la empresa")

            # --- VALIDACIÓN DE DUPLICADOS PARA UPDATE ---
            cursor.execute(
                """SELECT nombre, username, email FROM Empresas 
                   WHERE (nombre = %s OR username = %s OR email = %s) AND id != %s""",
                (datos["nombre"], datos["username"], datos["email"], id)
            )
            coincidencias = cursor.fetchall()

            if coincidencias:
                cls._verificar_duplicados(coincidencias, datos)

            # --- ACTUALIZACIÓN ---
            hashed_password = generate_password_hash(datos["password"], method='pbkdf2:sha256')

            cursor.execute(
                """UPDATE Empresas SET 
                   nombre=%s, username=%s, password=%s, email=%s 
                   WHERE id=%s""",
                (datos["nombre"], datos["username"], hashed_password, datos["email"], id)
            )
            
            cursor.execute("SELECT * FROM Empresas WHERE id = %s", (id,))
            actualizado = cursor.fetchone()
            
        return Empresa(actualizado).to_json()

    @classmethod
    def delete_empresa(cls, id):
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM Empresas WHERE id = %s", (id,))
            eliminado = cursor.fetchone()
            if not eliminado:
                raise ValueError("No existe la empresa")

            # --- ELIMINACIÓN EN CASCADA ---
            # 1. Eliminar Turnos
            cursor.execute("DELETE FROM turnos WHERE empresa_id = %s", (id,))

            # 2. Eliminar Disponibilidades (vinculadas a profesionales de esta empresa)
            cursor.execute("""
                DELETE FROM disponibilidades 
                WHERE profesional_id IN (SELECT id FROM profesionales WHERE empresa_id = %s)
            """, (id,))

            # 3. Eliminar Servicios
            cursor.execute("DELETE FROM servicios WHERE empresa_id = %s", (id,))

            # 4. Eliminar Profesionales
            cursor.execute("DELETE FROM profesionales WHERE empresa_id = %s", (id,))

            # 5. Eliminar la Empresa
            cursor.execute("DELETE FROM Empresas WHERE id = %s", (id,))
            
        return Empresa(eliminado).to_json()

    @classmethod
    def login(cls, auth):
        # Controlar si se recibieron las credenciales
        if not auth or not auth.username or not auth.password:
            raise ValueError("No se recibieron las credenciales")
    
        with get_db_cursor() as cursor:
            cursor.execute("SELECT id, nombre, username, password FROM Empresas WHERE username = %s", (auth.username,))
            fila = cursor.fetchone()

        if fila is None:
            raise ValueError("No existe el usuario")
        
        # Control de la contraseña
        password_bd = fila[3]
        
        if not check_password_hash(password_bd, auth.password):
            raise ValueError("No coincide la contraseña")
        
        # Generar token de autorización
        jwt_expiration = int(os.getenv('JWT_EXPIRATION_MINUTES', 30))
        token = jwt.encode({
            'username': auth.username,
            'id': fila[0],
            'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=jwt_expiration)
        }, current_app.config["SECRET_KEY"], algorithm="HS256")

        return {"token": token, "nombre": fila[1], "id": fila[0]}

    # ----------------- HELPERS PRIVADOS ----------------- #
    
    @classmethod
    def _verificar_duplicados(cls, coincidencias, datos):
        """Verifica qué campo está duplicado y lanza error apropiado"""
        for fila in coincidencias:
            db_nombre, db_username, db_email = fila
            
            if db_nombre == datos["nombre"]:
                raise ValueError("El nombre de la empresa ya está registrado")
            
            if db_username == datos["username"]:
                raise ValueError("El nombre de usuario ya está registrado")
            
            if db_email == datos["email"]:
                raise ValueError("El email ya está registrado")
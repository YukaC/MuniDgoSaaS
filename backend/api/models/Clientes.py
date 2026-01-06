from api.db.db_config import get_db_connection
from werkzeug.security import generate_password_hash, check_password_hash
from flask import current_app
import jwt
import datetime

class Cliente:

    schema = {
        "dni": str,
        "nombre": str,
        "apellido": str,
        "email": str,
        "telefono": str,
        "password": str
    }

    @classmethod
    def validar(cls, datos):
        if datos is None or not isinstance(datos, dict):
            return False
        
        # Campos requeridos
        campos_requeridos = ["dni", "nombre", "apellido", "password"]
        for campo in campos_requeridos:
            if campo not in datos or not datos[campo]:
                return False
        
        return True

    def __init__(self, fila):
        self.__id = fila[0]
        self.__dni = fila[1]
        self.__nombre = fila[2]
        self.__apellido = fila[3]
        self.__email = fila[4] if fila[4] else None
        self.__telefono = fila[5] if fila[5] else None
        self.__password = fila[6]
        self.__activo = fila[7]
        self.__created_at = fila[8]
        self.__updated_at = fila[9] if len(fila) > 9 else None

    def to_json(self, incluir_password=False):
        resultado = {
            "id": self.__id,
            "dni": self.__dni,
            "nombre": self.__nombre,
            "apellido": self.__apellido,
            "email": self.__email,
            "telefono": self.__telefono,
            "activo": bool(self.__activo),
            "created_at": str(self.__created_at) if self.__created_at else None,
            "updated_at": str(self.__updated_at) if self.__updated_at else None
        }
        if incluir_password:
            resultado["password"] = self.__password
        return resultado

    # ----------------- MÉTODOS CRUD ----------------- #

    @classmethod
    def get_cliente_by_id(cls, id):
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT * FROM clientes WHERE id = %s", (id,))
        fila = cursor.fetchone()
        cursor.close()
        connection.close()
        return Cliente(fila).to_json() if fila else None

    @classmethod
    def get_cliente_by_dni(cls, dni):
        """Método auxiliar útil para login"""
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT * FROM clientes WHERE dni = %s", (dni,))
        fila = cursor.fetchone()
        cursor.close()
        connection.close()
        return Cliente(fila) if fila else None

    @classmethod
    def get_clientes(cls):
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT * FROM clientes")
        filas = cursor.fetchall()
        cursor.close()
        connection.close()
        return [Cliente(fila).to_json() for fila in filas] if filas else []

    @classmethod
    def register(cls, datos):
        if not cls.validar(datos):
            raise ValueError("Datos inválidos. Se requiere DNI, nombre, apellido y contraseña")

        connection = get_db_connection()
        cursor = connection.cursor()

        # Validar que el DNI no esté duplicado
        cursor.execute("SELECT id FROM clientes WHERE dni = %s", (datos["dni"],))
        if cursor.fetchone():
            cursor.close()
            connection.close()
            raise ValueError("Ya existe un cliente registrado con este DNI")

        # Validar email si se proporciona
        if datos.get("email"):
            cursor.execute("SELECT id FROM clientes WHERE email = %s", (datos["email"],))
            if cursor.fetchone():
                cursor.close()
                connection.close()
                raise ValueError("Ya existe un cliente registrado con este email")

        # Hash de la contraseña
        password_hash = generate_password_hash(datos["password"])

        # Insertar nuevo cliente
        cursor.execute(
            """INSERT INTO clientes 
               (dni, nombre, apellido, email, telefono, password, activo, created_at) 
               VALUES (%s, %s, %s, %s, %s, %s, TRUE, NOW())""",
            (
                datos["dni"],
                datos["nombre"],
                datos["apellido"],
                datos.get("email"),
                datos.get("telefono"),
                password_hash
            )
        )
        connection.commit()
        nuevo_id = cursor.lastrowid

        cursor.execute("SELECT * FROM clientes WHERE id = %s", (nuevo_id,))
        nuevo = cursor.fetchone()
        cursor.close()
        connection.close()

        return Cliente(nuevo).to_json()

    @classmethod
    def login(cls, dni, password):
        """Autenticación por DNI y contraseña"""
        if not dni or not password:
            raise ValueError("DNI y contraseña son requeridos")

        cliente_obj = cls.get_cliente_by_dni(dni)
        
        if not cliente_obj:
            raise ValueError("DNI o contraseña incorrectos")

        # Acceder a atributos privados usando el objeto
        if not cliente_obj._Cliente__activo:
            raise ValueError("Cuenta desactivada. Contacte al administrador")

        # Verificar contraseña
        if not check_password_hash(cliente_obj._Cliente__password, password):
            raise ValueError("DNI o contraseña incorrectos")

        # Generar token JWT
        token = jwt.encode(
            {
                'cliente_id': cliente_obj._Cliente__id,
                'dni': cliente_obj._Cliente__dni,
                'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)
            },
            current_app.config["SECRET_KEY"],
            algorithm="HS256"
        )

        return {
            "token": token,
            "cliente": cliente_obj.to_json()
        }

    @classmethod
    def update_cliente(cls, id, datos):
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("SELECT * FROM clientes WHERE id = %s", (id,))
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            raise ValueError("Cliente no encontrado")

        # Validar DNI único si se está cambiando
        if "dni" in datos:
            cursor.execute("SELECT id FROM clientes WHERE dni = %s AND id != %s", (datos["dni"], id))
            if cursor.fetchone():
                cursor.close()
                connection.close()
                raise ValueError("Ya existe otro cliente con este DNI")

        # Validar email único si se está cambiando
        if "email" in datos and datos["email"]:
            cursor.execute("SELECT id FROM clientes WHERE email = %s AND id != %s", (datos["email"], id))
            if cursor.fetchone():
                cursor.close()
                connection.close()
                raise ValueError("Ya existe otro cliente con este email")

        # Si se actualiza la contraseña, hashearla
        if "password" in datos:
            datos["password"] = generate_password_hash(datos["password"])

        # Construir query de actualización dinámicamente
        campos = []
        valores = []
        for campo in ["dni", "nombre", "apellido", "email", "telefono", "password"]:
            if campo in datos:
                campos.append(f"{campo} = %s")
                valores.append(datos[campo])

        if not campos:
            cursor.close()
            connection.close()
            raise ValueError("No hay campos para actualizar")

        valores.append(id)
        query = f"UPDATE clientes SET {', '.join(campos)}, updated_at = NOW() WHERE id = %s"
        cursor.execute(query, valores)
        connection.commit()

        cursor.execute("SELECT * FROM clientes WHERE id = %s", (id,))
        actualizado = cursor.fetchone()
        cursor.close()
        connection.close()

        return Cliente(actualizado).to_json()

    @classmethod
    def delete_cliente(cls, id):
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("SELECT * FROM clientes WHERE id = %s", (id,))
        eliminado = cursor.fetchone()
        
        if not eliminado:
            cursor.close()
            connection.close()
            raise ValueError("Cliente no encontrado")

        # En lugar de eliminar, desactivar la cuenta (soft delete)
        cursor.execute("UPDATE clientes SET activo = FALSE WHERE id = %s", (id,))
        connection.commit()
        cursor.close()
        connection.close()

        return Cliente(eliminado).to_json()


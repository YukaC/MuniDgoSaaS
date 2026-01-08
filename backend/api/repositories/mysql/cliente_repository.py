"""
Implementación MySQL del repositorio de Clientes.
Contiene toda la lógica de acceso a datos para la tabla 'clientes'.
"""
from typing import Optional, List, Dict, Any
from werkzeug.security import generate_password_hash

from api.repositories.interfaces.cliente_repository import IClienteRepository
from api.utils.db_helpers import get_db_cursor


class MySQLClienteRepository(IClienteRepository):
    """
    Implementación concreta del repositorio de clientes usando MySQL.
    Si en el futuro se migra a MongoDB u otra BD, se crea otra clase
    que implemente IClienteRepository sin tocar la lógica de negocio.
    """
    
    def get_by_id(self, id: int) -> Optional[Dict[str, Any]]:
        with get_db_cursor() as cursor:
            cursor.execute(
                "SELECT id, dni, nombre, apellido, email, telefono, activo, created_at "
                "FROM clientes WHERE id = %s",
                (id,)
            )
            row = cursor.fetchone()
        
        return self._row_to_dict(row) if row else None
    
    def get_by_dni(self, dni: str) -> Optional[Dict[str, Any]]:
        with get_db_cursor() as cursor:
            cursor.execute(
                "SELECT id, dni, nombre, apellido, email, telefono, password, activo "
                "FROM clientes WHERE dni = %s",
                (dni,)
            )
            row = cursor.fetchone()
        
        if row:
            return {
                "id": row[0],
                "dni": row[1],
                "nombre": row[2],
                "apellido": row[3],
                "email": row[4],
                "telefono": row[5],
                "password_hash": row[6],
                "activo": bool(row[7])
            }
        return None
    
    def get_all(self) -> List[Dict[str, Any]]:
        with get_db_cursor() as cursor:
            cursor.execute(
                "SELECT id, dni, nombre, apellido, email, telefono, activo, created_at "
                "FROM clientes ORDER BY apellido, nombre"
            )
            rows = cursor.fetchall()
        
        return [self._row_to_dict(row) for row in rows] if rows else []
    
    def create(self, data: Dict[str, Any]) -> int:
        password_hash = generate_password_hash(data["password"], method='pbkdf2:sha256')
        
        with get_db_cursor() as cursor:
            cursor.execute(
                """INSERT INTO clientes (dni, nombre, apellido, email, telefono, password)
                VALUES (%s, %s, %s, %s, %s, %s)""",
                (
                    data["dni"],
                    data["nombre"],
                    data["apellido"],
                    data.get("email"),
                    data.get("telefono"),
                    password_hash
                )
            )
            return cursor.lastrowid
    
    def update(self, id: int, data: Dict[str, Any]) -> bool:
        campos = []
        valores = []
        
        for field in ["nombre", "apellido", "email", "telefono"]:
            if field in data and data[field] is not None:
                campos.append(f"{field} = %s")
                valores.append(data[field])
        
        if "password" in data and data["password"]:
            campos.append("password = %s")
            valores.append(generate_password_hash(data["password"], method='pbkdf2:sha256'))
        
        if not campos:
            return False
        
        valores.append(id)
        
        with get_db_cursor() as cursor:
            cursor.execute(
                f"UPDATE clientes SET {', '.join(campos)} WHERE id = %s",
                valores
            )
            return cursor.rowcount > 0
    
    def delete(self, id: int) -> bool:
        with get_db_cursor() as cursor:
            cursor.execute("DELETE FROM clientes WHERE id = %s", (id,))
            return cursor.rowcount > 0
    
    def exists_with_dni(self, dni: str, exclude_id: Optional[int] = None) -> bool:
        with get_db_cursor() as cursor:
            if exclude_id:
                cursor.execute(
                    "SELECT 1 FROM clientes WHERE dni = %s AND id != %s",
                    (dni, exclude_id)
                )
            else:
                cursor.execute("SELECT 1 FROM clientes WHERE dni = %s", (dni,))
            return cursor.fetchone() is not None
    
    def exists_with_email(self, email: str, exclude_id: Optional[int] = None) -> bool:
        if not email:
            return False
        
        with get_db_cursor() as cursor:
            if exclude_id:
                cursor.execute(
                    "SELECT 1 FROM clientes WHERE email = %s AND id != %s",
                    (email, exclude_id)
                )
            else:
                cursor.execute("SELECT 1 FROM clientes WHERE email = %s", (email,))
            return cursor.fetchone() is not None
    
    def _row_to_dict(self, row) -> Dict[str, Any]:
        """Convierte una fila de la BD a diccionario."""
        return {
            "id": row[0],
            "dni": row[1],
            "nombre": row[2],
            "apellido": row[3],
            "email": row[4],
            "telefono": row[5],
            "activo": bool(row[6]),
            "created_at": str(row[7]) if row[7] else None
        }

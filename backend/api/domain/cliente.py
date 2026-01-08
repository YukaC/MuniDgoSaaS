"""
Modelo de Dominio Cliente - Puro, sin acoplamiento a infraestructura.

Este modelo solo contiene:
- Propiedades del objeto
- Reglas de negocio
- Validaciones de dominio

NO DEBE contener:
- Acceso a base de datos
- Imports de conexiones
- Queries SQL
"""
from typing import Optional
from dataclasses import dataclass


@dataclass
class ClienteDomain:
    """
    Modelo de dominio puro para Cliente.
    Representa la entidad Cliente con sus reglas de negocio.
    """
    id: int
    dni: str
    nombre: str
    apellido: str
    email: Optional[str] = None
    telefono: Optional[str] = None
    activo: bool = True
    
    @property
    def nombre_completo(self) -> str:
        """Retorna el nombre completo del cliente."""
        return f"{self.nombre} {self.apellido}"
    
    @property
    def puede_reservar_turno(self) -> bool:
        """Regla de negocio: solo clientes activos pueden reservar."""
        return self.activo
    
    def to_dict(self) -> dict:
        """Serializa el modelo a diccionario."""
        return {
            "id": self.id,
            "dni": self.dni,
            "nombre": self.nombre,
            "apellido": self.apellido,
            "email": self.email,
            "telefono": self.telefono,
            "nombre_completo": self.nombre_completo,
            "activo": self.activo
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> 'ClienteDomain':
        """Crea una instancia desde un diccionario."""
        return cls(
            id=data.get("id", 0),
            dni=data["dni"],
            nombre=data["nombre"],
            apellido=data["apellido"],
            email=data.get("email"),
            telefono=data.get("telefono"),
            activo=data.get("activo", True)
        )
    
    # ==================== REGLAS DE NEGOCIO ====================
    
    @staticmethod
    def validar_datos_registro(datos: dict) -> tuple[bool, str]:
        """
        Valida los datos para registro de un nuevo cliente.
        
        Returns:
            tuple: (es_valido, mensaje_error)
        """
        if not datos.get("dni"):
            return False, "DNI es requerido"
        
        if not datos.get("nombre"):
            return False, "Nombre es requerido"
        
        if not datos.get("apellido"):
            return False, "Apellido es requerido"
        
        if not datos.get("password"):
            return False, "Contraseña es requerida"
        
        # Validar formato DNI
        dni = str(datos["dni"]).strip()
        if not dni.isdigit() or len(dni) < 7 or len(dni) > 8:
            return False, "DNI debe contener entre 7 y 8 dígitos"
        
        # Validar longitud de contraseña
        if len(datos["password"]) < 6:
            return False, "La contraseña debe tener al menos 6 caracteres"
        
        return True, ""

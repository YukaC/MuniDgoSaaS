"""
Interface abstracta para el repositorio de Clientes.
Define el contrato que deben cumplir todas las implementaciones.
"""
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any


class IClienteRepository(ABC):
    """
    Contrato para el repositorio de clientes.
    Permite desacoplar la lógica de negocio del motor de base de datos.
    """
    
    @abstractmethod
    def get_by_id(self, id: int) -> Optional[Dict[str, Any]]:
        """Obtiene un cliente por su ID."""
        pass
    
    @abstractmethod
    def get_by_dni(self, dni: str) -> Optional[Dict[str, Any]]:
        """Obtiene un cliente por su DNI."""
        pass
    
    @abstractmethod
    def get_all(self) -> List[Dict[str, Any]]:
        """Obtiene todos los clientes."""
        pass
    
    @abstractmethod
    def create(self, data: Dict[str, Any]) -> int:
        """
        Crea un nuevo cliente.
        Returns: ID del cliente creado.
        """
        pass
    
    @abstractmethod
    def update(self, id: int, data: Dict[str, Any]) -> bool:
        """
        Actualiza un cliente existente.
        Returns: True si se actualizó correctamente.
        """
        pass
    
    @abstractmethod
    def delete(self, id: int) -> bool:
        """
        Elimina un cliente.
        Returns: True si se eliminó correctamente.
        """
        pass
    
    @abstractmethod
    def exists_with_dni(self, dni: str, exclude_id: Optional[int] = None) -> bool:
        """Verifica si existe un cliente con el DNI dado."""
        pass
    
    @abstractmethod
    def exists_with_email(self, email: str, exclude_id: Optional[int] = None) -> bool:
        """Verifica si existe un cliente con el email dado."""
        pass

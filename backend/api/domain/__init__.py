"""
Módulo Domain - Modelos de dominio puros.

Los modelos de dominio:
- Solo contienen propiedades y reglas de negocio
- NO acceden a bases de datos
- NO importan infraestructura (conexiones, queries, etc.)
- Son inmutables o tienen cambios controlados via métodos

Esta separación permite:
- Testing unitario sin mocks de BD
- Cambiar de motor de BD sin afectar la lógica
- Código más limpio y mantenible
"""

from api.domain.cliente import ClienteDomain

__all__ = ['ClienteDomain']

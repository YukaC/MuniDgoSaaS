"""
Claves de Cache - Definición centralizada de todas las claves
"""
from api.config import Config


class CacheKeys:
    """
    Definición centralizada de claves de cache.
    Usar estos patrones para consistencia.
    """
    
    # ==================== TTL (segundos) - desde Config ====================
    TTL_SHORT = Config.CACHE_TTL_SHORT
    TTL_MEDIUM = Config.CACHE_TTL_MEDIUM
    TTL_LONG = Config.CACHE_TTL_LONG
    TTL_VERY_LONG = Config.CACHE_TTL_VERY_LONG
    
    # ==================== EMPRESAS ====================
    EMPRESAS_LISTA = "empresas:lista"                          # TTL_VERY_LONG
    EMPRESA_BY_ID = "empresa:{empresa_id}"                     # TTL_LONG
    
    # ==================== PROFESIONALES ====================
    PROFESIONALES_EMPRESA = "profesionales:empresa:{empresa_id}"    # TTL_LONG
    PROFESIONAL_BY_ID = "profesional:{profesional_id}"              # TTL_MEDIUM
    
    # ==================== SERVICIOS ====================
    SERVICIOS_EMPRESA = "servicios:empresa:{empresa_id}"       # TTL_LONG
    SERVICIO_BY_ID = "servicio:{servicio_id}"                  # TTL_MEDIUM
    
    # ==================== DISPONIBILIDADES ====================
    DISPONIBILIDADES_PROFESIONAL = "disponibilidades:profesional:{profesional_id}"  # TTL_MEDIUM
    DISPONIBILIDADES_RESUMEN = "disponibilidades:resumen:empresa:{empresa_id}"      # TTL_MEDIUM
    DIAS_PROFESIONAL = "dias:profesional:{profesional_id}"                          # TTL_MEDIUM
    
    # ==================== HORARIOS ====================
    # Estos cambian con cada reserva, TTL corto
    HORARIOS_DISPONIBLES = "horarios:{empresa_id}:{profesional_id}:{fecha}:{servicio_id}"  # TTL_SHORT
    
    # ==================== TURNOS ====================
    # No cachear turnos individuales (muy dinámicos)
    TURNOS_CLIENTE = "turnos:cliente:{cliente_id}"             # TTL_SHORT
    
    # ==================== CLIENTES ====================
    CLIENTES_LISTA = "clientes:empresa:{empresa_id}"           # TTL_MEDIUM
    CLIENTE_BY_ID = "cliente:{cliente_id}"                     # TTL_MEDIUM
    
    @classmethod
    def profesionales_empresa(cls, empresa_id):
        """Genera clave para lista de profesionales de una empresa"""
        return cls.PROFESIONALES_EMPRESA.format(empresa_id=empresa_id)
    
    @classmethod
    def servicios_empresa(cls, empresa_id):
        """Genera clave para lista de servicios de una empresa"""
        return cls.SERVICIOS_EMPRESA.format(empresa_id=empresa_id)
    
    @classmethod
    def disponibilidades_profesional(cls, profesional_id):
        """Genera clave para disponibilidades de un profesional"""
        return cls.DISPONIBILIDADES_PROFESIONAL.format(profesional_id=profesional_id)
    
    @classmethod
    def disponibilidades_resumen(cls, empresa_id):
        """Genera clave para resumen de disponibilidades"""
        return cls.DISPONIBILIDADES_RESUMEN.format(empresa_id=empresa_id)
    
    @classmethod
    def horarios_disponibles(cls, empresa_id, profesional_id, fecha, servicio_id=None):
        """Genera clave para horarios disponibles"""
        return cls.HORARIOS_DISPONIBLES.format(
            empresa_id=empresa_id,
            profesional_id=profesional_id,
            fecha=fecha,
            servicio_id=servicio_id or 'none'
        )
    
    @classmethod
    def cliente_by_id(cls, cliente_id):
        """Genera clave para un cliente específico"""
        return cls.CLIENTE_BY_ID.format(cliente_id=cliente_id)
    
    @classmethod
    def turnos_cliente(cls, cliente_id):
        """Genera clave para turnos de un cliente"""
        return cls.TURNOS_CLIENTE.format(cliente_id=cliente_id)
    
    # ==================== PATRONES DE INVALIDACIÓN ====================
    
    @classmethod
    def invalidar_profesionales(cls, empresa_id):
        """Claves a invalidar cuando cambia un profesional"""
        return [
            cls.profesionales_empresa(empresa_id),
            cls.disponibilidades_resumen(empresa_id),
        ]
    
    @classmethod
    def invalidar_servicios(cls, empresa_id):
        """Claves a invalidar cuando cambia un servicio"""
        return [
            cls.servicios_empresa(empresa_id),
        ]
    
    @classmethod
    def invalidar_disponibilidades(cls, profesional_id, empresa_id):
        """Claves a invalidar cuando cambia una disponibilidad"""
        return [
            cls.disponibilidades_profesional(profesional_id),
            cls.disponibilidades_resumen(empresa_id),
        ]
    
    @classmethod
    def invalidar_turno(cls, empresa_id, profesional_id, fecha, cliente_id=None):
        """Claves a invalidar cuando se crea/modifica/cancela un turno"""
        keys = [
            # Invalidar horarios disponibles para esa fecha
            f"horarios:{empresa_id}:{profesional_id}:{fecha}:*",
        ]
        if cliente_id:
            keys.append(cls.turnos_cliente(cliente_id))
        return keys

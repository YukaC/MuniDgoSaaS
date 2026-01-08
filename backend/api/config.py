"""
Configuración centralizada de la aplicación.
Valores por defecto para la lógica de negocio.
"""
import os


class Config:
    """Configuración de la aplicación - Valores inyectables desde .env"""
    
    # ==================== TURNOS Y SERVICIOS ====================
    # Duración por defecto de un servicio si no se especifica (en minutos)
    DEFAULT_SERVICE_DURATION_MINUTES = int(os.getenv('DEFAULT_SERVICE_DURATION', 60))
    
    # Intervalo entre slots de horarios disponibles (en minutos)
    DEFAULT_SLOT_INTERVAL_MINUTES = int(os.getenv('DEFAULT_SLOT_INTERVAL', 30))
    
    # ==================== JWT ====================
    JWT_EXPIRATION_MINUTES = int(os.getenv('JWT_EXPIRATION_MINUTES', 60))
    JWT_CLIENTE_EXPIRATION_MINUTES = int(os.getenv('JWT_CLIENTE_EXPIRATION_MINUTES', 1440))
    
    # ==================== EMAIL ====================
    # Tiempo de espera antes de enviar email de confirmación (en segundos)
    EMAIL_DELAY_SECONDS = int(os.getenv('EMAIL_DELAY_SECONDS', 900))  # 15 minutos
    
    # ==================== LIMPIEZA DE DATOS ====================
    # Días de antigüedad para eliminar turnos completados/cancelados
    DATA_RETENTION_DAYS = int(os.getenv('DATA_RETENTION_DAYS', 14))

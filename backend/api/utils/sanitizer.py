"""
Módulo de sanitización de inputs para prevenir XSS y SQL Injection.
Todas las entradas del usuario deben pasar por estas funciones antes de ser procesadas.
"""
import re
from html import escape
from typing import Optional


def sanitize_string(value: Optional[str], max_length: int = 255) -> Optional[str]:
    """
    Limpia un string de caracteres peligrosos.
    
    - Escapa caracteres HTML especiales
    - Remueve caracteres de control
    - Limita la longitud
    
    Args:
        value: String a sanitizar
        max_length: Longitud máxima permitida
        
    Returns:
        String sanitizado o None si el input era None
    """
    if value is None:
        return None
    
    if not isinstance(value, str):
        value = str(value)
    
    # Escapar caracteres HTML peligrosos
    value = escape(value.strip())
    
    # Remover caracteres de control (excepto newlines y tabs)
    value = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', value)
    
    # Limitar longitud
    return value[:max_length]


def sanitize_dni(dni: Optional[str]) -> Optional[str]:
    """
    Sanitiza un DNI/documento de identidad.
    Solo permite letras y números.
    
    Args:
        dni: DNI a sanitizar
        
    Returns:
        DNI sanitizado (solo alfanumérico, max 20 chars)
    """
    if not dni:
        return dni
    
    # Solo permitir alfanuméricos
    sanitized = re.sub(r'[^a-zA-Z0-9]', '', str(dni).strip())
    return sanitized[:20]


def sanitize_email(email: Optional[str]) -> Optional[str]:
    """
    Sanitiza y valida formato básico de email.
    
    Args:
        email: Email a sanitizar
        
    Returns:
        Email sanitizado y en minúsculas
        
    Raises:
        ValueError: Si el formato de email es inválido
    """
    if not email:
        return email
    
    email = str(email).strip().lower()
    
    # Validación básica de formato
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, email):
        raise ValueError("Formato de email inválido")
    
    return email[:100]


def sanitize_telefono(telefono: Optional[str]) -> Optional[str]:
    """
    Sanitiza un número de teléfono.
    Solo permite números, espacios, guiones y paréntesis.
    
    Args:
        telefono: Teléfono a sanitizar
        
    Returns:
        Teléfono sanitizado
    """
    if not telefono:
        return telefono
    
    # Solo permitir caracteres válidos para teléfonos
    sanitized = re.sub(r'[^0-9\s\-\(\)\+]', '', str(telefono).strip())
    return sanitized[:30]


def sanitize_observaciones(texto: Optional[str]) -> Optional[str]:
    """
    Sanitiza texto libre como observaciones.
    Permite más caracteres pero escapa HTML.
    
    Args:
        texto: Texto a sanitizar
        
    Returns:
        Texto sanitizado (max 500 chars)
    """
    return sanitize_string(texto, max_length=500)


def sanitize_dict(datos: dict, rules: dict) -> dict:
    """
    Aplica reglas de sanitización a un diccionario.
    
    Args:
        datos: Diccionario con datos a sanitizar
        rules: Diccionario con {campo: funcion_sanitizadora}
        
    Returns:
        Diccionario con valores sanitizados
        
    Example:
        rules = {
            'nombre': sanitize_string,
            'dni': sanitize_dni,
            'email': sanitize_email
        }
        datos_limpios = sanitize_dict(datos, rules)
    """
    resultado = {}
    for key, value in datos.items():
        if key in rules:
            resultado[key] = rules[key](value)
        else:
            # Por defecto, aplicar sanitización básica a strings
            if isinstance(value, str):
                resultado[key] = sanitize_string(value)
            else:
                resultado[key] = value
    return resultado

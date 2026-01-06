"""
Sistema básico de rate limiting para protección contra DDoS.
En producción, se recomienda usar Flask-Limiter o similar.
"""

from functools import wraps
from flask import request, jsonify
from datetime import datetime, timedelta
from collections import defaultdict

# Almacenamiento en memoria de intentos (en producción usar Redis)
_intentos_por_ip = defaultdict(list)
_max_intentos = 5  # Máximo de intentos
_ventana_tiempo = timedelta(minutes=15)  # Ventana de tiempo

def limpiar_intentos_antiguos(ip):
    """Elimina intentos fuera de la ventana de tiempo"""
    ahora = datetime.now()
    _intentos_por_ip[ip] = [
        intento for intento in _intentos_por_ip[ip]
        if ahora - intento < _ventana_tiempo
    ]

def rate_limit_login(func):
    """
    Decorador para limitar intentos de login por IP.
    Bloquea después de N intentos fallidos en una ventana de tiempo.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        ip = request.remote_addr
        
        # Limpiar intentos antiguos
        limpiar_intentos_antiguos(ip)
        
        # Verificar si excede el límite
        if len(_intentos_por_ip[ip]) >= _max_intentos:
            return jsonify({
                "message": "Demasiados intentos fallidos. Por favor intenta nuevamente en 15 minutos."
            }), 429  # Too Many Requests
        
        # Ejecutar la función
        resultado = func(*args, **kwargs)
        
        # Si el login falló, registrar el intento
        if hasattr(resultado, 'status_code') and resultado.status_code != 200:
            _intentos_por_ip[ip].append(datetime.now())
        
        return resultado
    
    return wrapper

def rate_limit_registro(func):
    """
    Decorador para limitar registros por IP.
    Permite máximo 5 registros por hora desde la misma IP.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        ip = request.remote_addr
        ahora = datetime.now()
        ventana_registro = timedelta(hours=1)
        
        # Contar registros en la última hora
        registros_recientes = [
            r for r in _intentos_por_ip.get(f"{ip}_registro", [])
            if ahora - r < ventana_registro
        ]
        
        if len(registros_recientes) >= 5:
            return jsonify({
                "message": "Demasiados intentos de registro. Por favor intenta nuevamente más tarde."
            }), 429
        
        # Ejecutar la función
        resultado = func(*args, **kwargs)
        
        # Si el registro fue exitoso, registrar
        if hasattr(resultado, 'status_code') and resultado.status_code == 201:
            if f"{ip}_registro" not in _intentos_por_ip:
                _intentos_por_ip[f"{ip}_registro"] = []
            _intentos_por_ip[f"{ip}_registro"].append(ahora)
        
        return resultado
    
    return wrapper


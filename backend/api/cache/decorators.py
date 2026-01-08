"""
Decoradores de Cache - Para uso fácil en funciones y endpoints
"""
import functools
import logging
from typing import Callable, List, Union

from api.cache.cache_manager import cache_manager
from api.cache.cache_keys import CacheKeys

logger = logging.getLogger(__name__)


def cached(key_template: str = None, ttl: int = 300, key_builder: Callable = None):
    """
    Decorador para cachear el resultado de una función.
    
    Args:
        key_template: Template de clave (ej: "profesionales:empresa:{empresa_id}")
        ttl: Tiempo de vida en segundos
        key_builder: Función personalizada para construir la clave
        
    Usage:
        @cached("profesionales:empresa:{empresa_id}", ttl=300)
        def get_profesionales(empresa_id):
            # Consulta a BD
            return resultado
            
        @cached(key_builder=lambda *args, **kw: f"custom:{args[0]}")
        def otra_funcion(id):
            return data
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Construir clave del cache
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            elif key_template:
                try:
                    # Obtener argumentos de la función
                    func_args = func.__code__.co_varnames[:func.__code__.co_argcount]
                    
                    # Crear diccionario de argumentos
                    arg_dict = dict(zip(func_args, args))
                    arg_dict.update(kwargs)
                    
                    cache_key = key_template.format(**arg_dict)
                except KeyError as e:
                    logger.warning(f"Error formateando clave de cache: {e}")
                    # Si falla el formateo, ejecutar sin cache
                    return func(*args, **kwargs)
            else:
                # Sin template, usar nombre de función y argumentos
                cache_key = f"{func.__module__}:{func.__name__}:{hash(str(args) + str(kwargs))}"
            
            # Intentar obtener del cache
            cached_value = cache_manager.get(cache_key)
            if cached_value is not None:
                logger.debug(f"Cache HIT: {cache_key}")
                return cached_value
            
            logger.debug(f"Cache MISS: {cache_key}")
            
            # Ejecutar función
            result = func(*args, **kwargs)
            
            # Guardar en cache si hay resultado
            if result is not None:
                cache_manager.set(cache_key, result, ttl)
            
            return result
        
        # Agregar método para invalidar cache de esta función
        wrapper.invalidate = lambda *args, **kwargs: _invalidate_cached_func(
            key_template, key_builder, func, *args, **kwargs
        )
        
        return wrapper
    return decorator


def _invalidate_cached_func(key_template, key_builder, func, *args, **kwargs):
    """Helper para invalidar cache de una función específica"""
    if key_builder:
        cache_key = key_builder(*args, **kwargs)
    elif key_template:
        func_args = func.__code__.co_varnames[:func.__code__.co_argcount]
        arg_dict = dict(zip(func_args, args))
        arg_dict.update(kwargs)
        cache_key = key_template.format(**arg_dict)
    else:
        cache_key = f"{func.__module__}:{func.__name__}:*"
    
    if '*' in cache_key:
        return cache_manager.delete_many([cache_key])
    return cache_manager.delete(cache_key)


def invalidate_cache(keys: Union[str, List[str], Callable] = None):
    """
    Decorador para invalidar cache después de ejecutar una función.
    Útil para operaciones de escritura (POST, PUT, DELETE).
    
    Args:
        keys: Clave(s) a invalidar o función que retorna las claves
        
    Usage:
        @invalidate_cache(["profesionales:empresa:1", "profesionales:empresa:2"])
        def crear_profesional(empresa_id, data):
            # Crear en BD
            return nuevo_profesional
            
        @invalidate_cache(lambda empresa_id, **kw: CacheKeys.invalidar_profesionales(empresa_id))
        def actualizar_profesional(empresa_id, profesional_id, data):
            # Actualizar en BD
            return profesional_actualizado
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Ejecutar función primero
            result = func(*args, **kwargs)
            
            # Determinar claves a invalidar
            keys_to_invalidate = []
            
            if callable(keys):
                # Función que retorna las claves
                try:
                    func_args = func.__code__.co_varnames[:func.__code__.co_argcount]
                    arg_dict = dict(zip(func_args, args))
                    arg_dict.update(kwargs)
                    
                    keys_result = keys(**arg_dict)
                    if isinstance(keys_result, str):
                        keys_to_invalidate = [keys_result]
                    else:
                        keys_to_invalidate = list(keys_result)
                except Exception as e:
                    logger.warning(f"Error obteniendo claves a invalidar: {e}")
            elif isinstance(keys, str):
                keys_to_invalidate = [keys]
            elif isinstance(keys, list):
                keys_to_invalidate = keys
            
            # Invalidar
            if keys_to_invalidate:
                count = cache_manager.invalidate(keys_to_invalidate)
                logger.debug(f"Cache invalidado: {count} claves eliminadas")
            
            return result
        
        return wrapper
    return decorator


def cache_profesionales(empresa_id: int):
    """Decorador específico para cachear profesionales de una empresa"""
    def decorator(func):
        return cached(
            key_template=CacheKeys.PROFESIONALES_EMPRESA,
            ttl=CacheKeys.TTL_LONG
        )(func)
    return decorator


def cache_servicios(empresa_id: int):
    """Decorador específico para cachear servicios de una empresa"""
    def decorator(func):
        return cached(
            key_template=CacheKeys.SERVICIOS_EMPRESA,
            ttl=CacheKeys.TTL_LONG
        )(func)
    return decorator


def cache_disponibilidades(profesional_id: int):
    """Decorador específico para cachear disponibilidades"""
    def decorator(func):
        return cached(
            key_template=CacheKeys.DISPONIBILIDADES_PROFESIONAL,
            ttl=CacheKeys.TTL_MEDIUM
        )(func)
    return decorator

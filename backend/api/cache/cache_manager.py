"""
Cache Manager - Implementación Cache-Aside Pattern
Soporta Redis (producción) y Memory Cache (desarrollo)
"""
import os
import json
import time
import logging
import threading
from typing import Any, Optional, List
from functools import wraps

logger = logging.getLogger(__name__)


class MemoryCache:
    """
    Cache en memoria para desarrollo y fallback.
    Thread-safe con TTL automático.
    """
    
    def __init__(self, max_size: int = 1000):
        self._cache = {}
        self._lock = threading.RLock()
        self._max_size = max_size
    
    def get(self, key: str) -> Optional[Any]:
        """Obtiene un valor del cache"""
        with self._lock:
            if key not in self._cache:
                return None
            
            item = self._cache[key]
            
            # Verificar expiración
            if item['expires_at'] and time.time() > item['expires_at']:
                del self._cache[key]
                return None
            
            return item['value']
    
    def set(self, key: str, value: Any, ttl: int = None) -> bool:
        """Guarda un valor en el cache"""
        with self._lock:
            # Limpiar si alcanzamos el límite
            if len(self._cache) >= self._max_size:
                self._evict_expired()
            
            expires_at = time.time() + ttl if ttl else None
            self._cache[key] = {
                'value': value,
                'expires_at': expires_at,
                'created_at': time.time()
            }
            return True
    
    def delete(self, key: str) -> bool:
        """Elimina un valor del cache"""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False
    
    def delete_pattern(self, pattern: str) -> int:
        """Elimina claves que coincidan con un patrón (soporta * como wildcard)"""
        import fnmatch
        
        with self._lock:
            keys_to_delete = [
                k for k in self._cache.keys()
                if fnmatch.fnmatch(k, pattern)
            ]
            
            for key in keys_to_delete:
                del self._cache[key]
            
            return len(keys_to_delete)
    
    def clear(self) -> bool:
        """Limpia todo el cache"""
        with self._lock:
            self._cache.clear()
            return True
    
    def _evict_expired(self):
        """Elimina entradas expiradas"""
        current_time = time.time()
        keys_to_delete = [
            k for k, v in self._cache.items()
            if v['expires_at'] and current_time > v['expires_at']
        ]
        
        for key in keys_to_delete:
            del self._cache[key]
        
        # Si aún estamos llenos, eliminar los más antiguos
        if len(self._cache) >= self._max_size:
            sorted_items = sorted(
                self._cache.items(),
                key=lambda x: x[1]['created_at']
            )
            # Eliminar el 20% más antiguo
            to_remove = int(self._max_size * 0.2)
            for key, _ in sorted_items[:to_remove]:
                del self._cache[key]
    
    def stats(self) -> dict:
        """Retorna estadísticas del cache"""
        with self._lock:
            return {
                'type': 'memory',
                'size': len(self._cache),
                'max_size': self._max_size
            }


class RedisCache:
    """
    Cache usando Redis para producción.
    Requiere redis-py instalado.
    """
    
    def __init__(self, redis_url: str):
        try:
            import redis
            self._client = redis.from_url(redis_url, decode_responses=True)
            self._client.ping()
            logger.info(f"Conectado a Redis: {redis_url}")
        except Exception as e:
            logger.error(f"Error conectando a Redis: {e}")
            raise
    
    def get(self, key: str) -> Optional[Any]:
        """Obtiene un valor del cache"""
        try:
            value = self._client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.error(f"Error en Redis GET: {e}")
            return None
    
    def set(self, key: str, value: Any, ttl: int = None) -> bool:
        """Guarda un valor en el cache"""
        try:
            serialized = json.dumps(value, default=str)
            if ttl:
                self._client.setex(key, ttl, serialized)
            else:
                self._client.set(key, serialized)
            return True
        except Exception as e:
            logger.error(f"Error en Redis SET: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Elimina un valor del cache"""
        try:
            return bool(self._client.delete(key))
        except Exception as e:
            logger.error(f"Error en Redis DELETE: {e}")
            return False
    
    def delete_pattern(self, pattern: str) -> int:
        """Elimina claves que coincidan con un patrón"""
        try:
            keys = self._client.keys(pattern)
            if keys:
                return self._client.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Error en Redis DELETE PATTERN: {e}")
            return 0
    
    def clear(self) -> bool:
        """Limpia todo el cache (CUIDADO en producción)"""
        try:
            self._client.flushdb()
            return True
        except Exception as e:
            logger.error(f"Error en Redis CLEAR: {e}")
            return False
    
    def stats(self) -> dict:
        """Retorna estadísticas del cache"""
        try:
            info = self._client.info('memory')
            return {
                'type': 'redis',
                'used_memory': info.get('used_memory_human'),
                'keys': self._client.dbsize()
            }
        except:
            return {'type': 'redis', 'status': 'error'}


class CacheManager:
    """
    Manager principal de cache.
    Implementa el patrón Cache-Aside.
    """
    
    def __init__(self):
        self._cache = None
        self._stats = {
            'hits': 0,
            'misses': 0
        }
        self._lock = threading.Lock()
    
    def init_app(self, app=None):
        """
        Inicializa el cache según la configuración.
        """
        cache_type = os.getenv('CACHE_TYPE', 'memory')
        redis_url = os.getenv('REDIS_URL')
        
        if cache_type == 'redis' and redis_url:
            try:
                self._cache = RedisCache(redis_url)
                logger.info("Cache inicializado con Redis")
            except Exception as e:
                logger.warning(f"Fallback a memory cache: {e}")
                self._cache = MemoryCache()
        else:
            self._cache = MemoryCache()
            logger.info("Cache inicializado en memoria")
    
    def _ensure_initialized(self):
        """Asegura que el cache esté inicializado"""
        if self._cache is None:
            self.init_app()
    
    def get(self, key: str) -> Optional[Any]:
        """
        Obtiene un valor del cache.
        
        Returns:
            El valor si existe, None si no
        """
        self._ensure_initialized()
        
        value = self._cache.get(key)
        
        with self._lock:
            if value is not None:
                self._stats['hits'] += 1
            else:
                self._stats['misses'] += 1
        
        return value
    
    def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """
        Guarda un valor en el cache.
        
        Args:
            key: Clave del cache
            value: Valor a guardar
            ttl: Tiempo de vida en segundos (default 5 min)
        """
        self._ensure_initialized()
        return self._cache.set(key, value, ttl)
    
    def delete(self, key: str) -> bool:
        """Elimina un valor del cache"""
        self._ensure_initialized()
        return self._cache.delete(key)
    
    def delete_many(self, keys: List[str]) -> int:
        """Elimina múltiples claves"""
        self._ensure_initialized()
        count = 0
        for key in keys:
            if '*' in key:
                count += self._cache.delete_pattern(key)
            else:
                if self._cache.delete(key):
                    count += 1
        return count
    
    def invalidate(self, keys: List[str]):
        """
        Invalida múltiples claves (alias de delete_many).
        Soporta patrones con *.
        """
        return self.delete_many(keys)
    
    def get_or_set(self, key: str, getter_func, ttl: int = 300) -> Any:
        """
        Patrón Cache-Aside: obtiene del cache o ejecuta función.
        
        Args:
            key: Clave del cache
            getter_func: Función para obtener el dato si no está en cache
            ttl: Tiempo de vida en segundos
            
        Returns:
            El valor (del cache o recién obtenido)
        """
        # Intentar obtener del cache
        value = self.get(key)
        
        if value is not None:
            return value
        
        # Cache miss: ejecutar función
        value = getter_func()
        
        # Guardar en cache (solo si hay valor)
        if value is not None:
            self.set(key, value, ttl)
        
        return value
    
    def clear(self) -> bool:
        """Limpia todo el cache"""
        self._ensure_initialized()
        return self._cache.clear()
    
    def stats(self) -> dict:
        """Retorna estadísticas del cache"""
        self._ensure_initialized()
        
        cache_stats = self._cache.stats()
        
        total = self._stats['hits'] + self._stats['misses']
        hit_rate = (self._stats['hits'] / total * 100) if total > 0 else 0
        
        return {
            **cache_stats,
            'hits': self._stats['hits'],
            'misses': self._stats['misses'],
            'hit_rate': f"{hit_rate:.1f}%"
        }


# Instancia global del cache manager
cache_manager = CacheManager()

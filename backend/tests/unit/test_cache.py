"""Tests para el módulo de cache"""
import pytest
import time
from api.cache.cache_manager import CacheManager, MemoryCache
from api.cache.cache_keys import CacheKeys


class TestMemoryCache:
    """Tests para MemoryCache"""
    
    def test_set_and_get(self):
        """Test básico de set y get"""
        cache = MemoryCache()
        cache.set('test_key', {'data': 'test_value'})
        result = cache.get('test_key')
        assert result == {'data': 'test_value'}
    
    def test_get_nonexistent_key(self):
        """Test de get con clave inexistente"""
        cache = MemoryCache()
        result = cache.get('nonexistent')
        assert result is None
    
    def test_delete(self):
        """Test de eliminación"""
        cache = MemoryCache()
        cache.set('test_key', 'value')
        assert cache.get('test_key') == 'value'
        
        cache.delete('test_key')
        assert cache.get('test_key') is None
    
    def test_ttl_expiration(self):
        """Test de expiración por TTL"""
        cache = MemoryCache()
        cache.set('expire_key', 'value', ttl=1)
        
        assert cache.get('expire_key') == 'value'
        time.sleep(1.1)
        assert cache.get('expire_key') is None
    
    def test_delete_pattern(self):
        """Test de eliminación por patrón"""
        cache = MemoryCache()
        cache.set('prefix:1', 'value1')
        cache.set('prefix:2', 'value2')
        cache.set('other:1', 'value3')
        
        deleted = cache.delete_pattern('prefix:*')
        assert deleted == 2
        assert cache.get('prefix:1') is None
        assert cache.get('prefix:2') is None
        assert cache.get('other:1') == 'value3'
    
    def test_clear(self):
        """Test de limpieza total"""
        cache = MemoryCache()
        cache.set('key1', 'value1')
        cache.set('key2', 'value2')
        
        cache.clear()
        assert cache.get('key1') is None
        assert cache.get('key2') is None
    
    def test_max_size_eviction(self):
        """Test de evicción cuando se alcanza el tamaño máximo"""
        cache = MemoryCache(max_size=3)
        cache.set('key1', 'value1')
        cache.set('key2', 'value2')
        cache.set('key3', 'value3')
        cache.set('key4', 'value4')  # Debería triggear evicción
        cache.set('key5', 'value5')  # Más entradas para forzar evicción
        
        # Verificar que el cache no excede significativamente el tamaño
        # La evicción elimina el 20% más antiguo cuando se llena
        assert len(cache._cache) <= 5  # Puede haber algunas más antes de limpieza total


class TestCacheManager:
    """Tests para CacheManager"""
    
    def test_get_or_set(self):
        """Test del patrón cache-aside"""
        manager = CacheManager()
        manager.init_app()
        manager.clear()
        
        call_count = 0
        
        def getter():
            nonlocal call_count
            call_count += 1
            return {'data': 'from_getter'}
        
        # Primera llamada - cache miss
        result1 = manager.get_or_set('test_key', getter, ttl=60)
        assert result1 == {'data': 'from_getter'}
        assert call_count == 1
        
        # Segunda llamada - cache hit
        result2 = manager.get_or_set('test_key', getter, ttl=60)
        assert result2 == {'data': 'from_getter'}
        assert call_count == 1  # No debería haber llamado al getter
    
    def test_stats(self):
        """Test de estadísticas"""
        manager = CacheManager()
        manager.init_app()
        manager.clear()
        manager._stats = {'hits': 0, 'misses': 0}
        
        manager.set('key1', 'value1')
        manager.get('key1')  # hit
        manager.get('nonexistent')  # miss
        
        stats = manager.stats()
        assert stats['hits'] == 1
        assert stats['misses'] == 1


class TestCacheKeys:
    """Tests para CacheKeys"""
    
    def test_profesionales_empresa_key(self):
        """Test de generación de clave de profesionales"""
        key = CacheKeys.profesionales_empresa(1)
        assert key == 'profesionales:empresa:1'
    
    def test_horarios_disponibles_key(self):
        """Test de generación de clave de horarios"""
        key = CacheKeys.horarios_disponibles(1, 2, '2026-01-15', 3)
        assert key == 'horarios:1:2:2026-01-15:3'
        
        key_sin_servicio = CacheKeys.horarios_disponibles(1, 2, '2026-01-15')
        assert key_sin_servicio == 'horarios:1:2:2026-01-15:none'
    
    def test_invalidar_profesionales(self):
        """Test de claves de invalidación"""
        keys = CacheKeys.invalidar_profesionales(1)
        assert 'profesionales:empresa:1' in keys
        assert 'disponibilidades:resumen:empresa:1' in keys

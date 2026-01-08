"""
Configuración de pytest y fixtures compartidos
"""
import pytest
import os
import sys

# Agregar el backend al path antes de las importaciones
backend_path = os.path.join(os.path.dirname(__file__), '..')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)


@pytest.fixture(scope='session')
def app():
    """Crear aplicación para testing"""
    os.environ['FLASK_ENV'] = 'testing'
    os.environ['CACHE_TYPE'] = 'memory'
    
    from api import create_app
    application = create_app()
    application.config.update({
        'TESTING': True,
    })
    
    yield application


@pytest.fixture(scope='session')
def client(app):
    """Cliente de testing"""
    return app.test_client()


@pytest.fixture(scope='function')
def clean_cache():
    """Limpiar cache antes de cada test"""
    from api.cache.cache_manager import cache_manager
    cache_manager.clear()
    yield
    cache_manager.clear()


@pytest.fixture
def auth_headers():
    """Headers de autenticación para tests"""
    return {
        'Content-Type': 'application/json',
        'x-access-token': 'test-token',
        'id-empresa': '1'
    }


@pytest.fixture
def sample_turno_data():
    """Datos de ejemplo para turno"""
    return {
        'empresa_id': 1,
        'profesional_id': 1,
        'servicio_id': 1,
        'cliente_name': 'Test Cliente',
        'start_datetime': '2026-01-20 10:00:00',
        'status': 'Reservado'
    }


@pytest.fixture
def sample_cliente_data():
    """Datos de ejemplo para cliente"""
    return {
        'dni': '12345678',
        'nombre': 'Test',
        'apellido': 'Cliente',
        'email': 'test@example.com',
        'telefono': '1234567890'
    }


@pytest.fixture
def sample_profesional_data():
    """Datos de ejemplo para profesional"""
    return {
        'empresa_id': 1,
        'name': 'Test',
        'surname': 'Profesional',
        'especialidad': 'Consulta General',
        'matricula': '12345',
        'dni': '87654321',
        'email': 'profesional@example.com'
    }

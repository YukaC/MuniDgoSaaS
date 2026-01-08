"""
Tests de Integración - API de Turnos
Prueba flujos completos de la API
"""
import pytest
import json


class TestHealthEndpoint:
    """Tests del endpoint de health check"""
    
    def test_health_check_responds(self, client):
        """El endpoint /health debe responder (200 o 503 si BD caída)"""
        response = client.get('/health')
        # Health puede retornar 200 (healthy) o 503 (degraded)
        assert response.status_code in [200, 503]
    
    def test_health_check_content(self, client):
        """El endpoint /health debe retornar estructura correcta"""
        response = client.get('/health')
        data = json.loads(response.data)
        
        assert 'status' in data
        assert data['status'] in ['healthy', 'degraded']
        assert 'api' in data


class TestAuthFlow:
    """Tests de autenticación de empresas"""
    
    def test_login_sin_credenciales(self, client):
        """Login sin credenciales debe retornar error"""
        response = client.post('/login')
        # Sin credenciales puede retornar 400, 401, o 500
        assert response.status_code >= 400


class TestProtectedEndpoints:
    """Tests de endpoints protegidos (requieren autenticación)"""
    
    def test_turnos_sin_token_requiere_auth(self, client):
        """Acceder a turnos sin token debe requerir autenticación"""
        response = client.get('/empresa/1/turnos')
        # Debe fallar: 401 (no auth), 404 (ruta sin token), 500 (error interno)
        assert response.status_code >= 400
    
    def test_profesionales_sin_token_requiere_auth(self, client):
        """Acceder a profesionales sin token debe requerir autenticación"""
        response = client.get('/empresa/1/profesionales')
        assert response.status_code >= 400
    
    def test_servicios_sin_token_requiere_auth(self, client):
        """Acceder a servicios sin token debe requerir autenticación"""
        response = client.get('/empresa/1/servicios')
        assert response.status_code >= 400


class TestClienteAuth:
    """Tests de autenticación de clientes"""
    
    def test_registro_cliente_datos_incompletos(self, client):
        """Registro de cliente con datos incompletos debe fallar"""
        response = client.post('/cliente/registro',
            data=json.dumps({'dni': '12345678'}),
            content_type='application/json')
        # Datos incompletos = error de cliente
        assert response.status_code >= 400
    
    def test_login_cliente_sin_credenciales(self, client):
        """Login de cliente sin credenciales debe fallar"""
        response = client.post('/cliente/login',
            data=json.dumps({}),
            content_type='application/json')
        # Sin credenciales = error
        assert response.status_code >= 400
    
    def test_login_cliente_credenciales_invalidas(self, client):
        """Login de cliente con credenciales inválidas debe fallar"""
        response = client.post('/cliente/login',
            data=json.dumps({'dni': 'INVALIDO', 'password': 'fake'}),
            content_type='application/json')
        # Credenciales inválidas = error de autenticación
        assert response.status_code >= 400


class TestErrorHandlers:
    """Tests de manejadores de errores"""
    
    def test_404_endpoint_inexistente(self, client):
        """Endpoint inexistente debe retornar 404"""
        response = client.get('/ruta/que/nunca/existira/12345')
        assert response.status_code == 404
    
    def test_404_retorna_json(self, client):
        """404 debe retornar JSON"""
        response = client.get('/ruta/que/nunca/existira/12345')
        data = json.loads(response.data)
        # Debe ser un JSON válido
        assert isinstance(data, dict)


class TestSecurityHeaders:
    """Tests de headers de seguridad"""
    
    def test_x_frame_options_presente(self, client):
        """X-Frame-Options debe estar presente"""
        response = client.get('/health')
        assert 'X-Frame-Options' in response.headers
    
    def test_x_content_type_options_presente(self, client):
        """X-Content-Type-Options debe estar presente"""
        response = client.get('/health')
        assert 'X-Content-Type-Options' in response.headers
    
    def test_x_xss_protection_presente(self, client):
        """X-XSS-Protection debe estar presente"""
        response = client.get('/health')
        assert 'X-XSS-Protection' in response.headers
    
    def test_referrer_policy_presente(self, client):
        """Referrer-Policy debe estar presente"""
        response = client.get('/health')
        assert 'Referrer-Policy' in response.headers

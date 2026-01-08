"""
Configuración principal de la aplicación Flask
Optimizado para producción con variables de entorno
"""
import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()


def create_app(config_name=None):
    """Factory pattern para crear la aplicación Flask"""
    
    # Configurar rutas estáticas para servir el Frontend
    # backend/api/__init__.py -> backend/api -> backend -> root -> frontend
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    frontend_dir = os.path.join(base_dir, 'frontend')
    
    app = Flask(__name__, static_folder=frontend_dir, static_url_path='')
    
    # ==================== CONFIGURACIÓN ====================
    
    # Determinar entorno
    flask_env = os.getenv('FLASK_ENV', 'development')
    is_production = flask_env == 'production'
    
    # Validar SECRET_KEY en producción
    secret_key = os.getenv('SECRET_KEY', 'dev-key-cambiar-en-produccion')
    if is_production and (not secret_key or secret_key == 'dev-key-cambiar-en-produccion'):
        raise ValueError(
            "CRÍTICO: SECRET_KEY no está configurada correctamente para producción. "
            "Define una clave segura de al menos 32 caracteres en la variable de entorno SECRET_KEY."
        )
    
    # Configuración base
    app.config.update(
        # Seguridad
        SECRET_KEY=secret_key,
        
        # JWT
        JWT_EXPIRATION_MINUTES=int(os.getenv('JWT_EXPIRATION_MINUTES', 60)),
        JWT_REFRESH_EXPIRATION_DAYS=int(os.getenv('JWT_REFRESH_EXPIRATION_DAYS', 7)),
        
        # Server
        DEBUG=not is_production,
        TESTING=False,
        
        # Rate Limiting
        RATE_LIMIT_PER_MINUTE=int(os.getenv('RATE_LIMIT_PER_MINUTE', 60)),
        RATE_LIMIT_PER_HOUR=int(os.getenv('RATE_LIMIT_PER_HOUR', 1000)),
        
        # Cache
        CACHE_TYPE=os.getenv('CACHE_TYPE', 'memory'),
        REDIS_URL=os.getenv('REDIS_URL', None),
        
        # JSON
        JSON_SORT_KEYS=False,
        JSONIFY_PRETTYPRINT_REGULAR=not is_production,
    )
    
    # ==================== CORS ====================
    # Permitir requests desde el mismo origen (frontend servido por flask) + externos si es necesario
    cors_origins = os.getenv('CORS_ORIGINS', '*')
    if cors_origins != '*':
        cors_origins = [origin.strip() for origin in cors_origins.split(',')]
    
    CORS(app, origins=cors_origins, supports_credentials=True)
    
    # ==================== HEADERS DE SEGURIDAD ====================
    @app.after_request
    def add_security_headers(response):
        """Agregar headers de seguridad a todas las respuestas"""
        # Prevenir clickjacking
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        # Prevenir MIME type sniffing
        response.headers['X-Content-Type-Options'] = 'nosniff'
        # XSS Protection
        response.headers['X-XSS-Protection'] = '1; mode=block'
        # Referrer Policy
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        if is_production:
            # HSTS (solo en producción con HTTPS)
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        
        return response
    
    # ==================== MANEJO DE ERRORES GLOBAL ====================
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({"message": "Solicitud inválida", "error": str(error)}), 400
    
    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({"message": "No autorizado"}), 401
    
    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({"message": "Acceso denegado"}), 403
    
    @app.errorhandler(404)
    def not_found(error):
        # Si es una petición API (JSON), devuelve 404 JSON.
        # Si es navegador (HTML), podría ser una ruta del frontend, intentamos servir index.html?
        # Por ahora simple: JSON para /api/..., 404 para otros.
        if request.path.startswith('/api/') or request.path.startswith('/empresa/') or request.path.startswith('/cliente/'):
             return jsonify({"message": "Recurso no encontrado"}), 404
        return jsonify({"message": "Página no encontrada"}), 404
    
    @app.errorhandler(429)
    def rate_limit_exceeded(error):
        return jsonify({"message": "Demasiadas solicitudes. Intente más tarde."}), 429
    
    @app.errorhandler(500)
    def internal_error(error):
        # En producción, no exponer detalles del error
        if is_production:
            return jsonify({"message": "Error interno del servidor"}), 500
        return jsonify({"message": "Error interno", "error": str(error)}), 500
    
    # ==================== RUTA DE FRONTEND ====================
    @app.route('/')
    def index():
        return app.send_static_file('index.html')

    # También servir cliente.html en su ruta
    @app.route('/cliente.html')
    def cliente_portal():
        return app.send_static_file('cliente.html')
    
    @app.route('/health')
    def health_check():
        """Endpoint para verificar salud del servidor"""
        from api.db.db_config import check_db_health
        
        health_status = {
            "status": "healthy",
            "api": True,
            "version": "2.0"
        }
        
        # Verificar base de datos
        db_health = check_db_health()
        health_status["database"] = db_health.get("connected", False)
        
        if not health_status["database"]:
            health_status["status"] = "degraded"
            if not is_production:
                health_status["db_error"] = db_health.get("error", "Unknown")
        
        status_code = 200 if health_status["status"] == "healthy" else 503
        return jsonify(health_status), status_code
    
    return app


# Crear instancia de la aplicación
app = create_app()

# ==================== IMPORTAR RUTAS ====================
import api.routes.Empresas
import api.routes.Profesionales
import api.routes.Servicios
import api.routes.Disponibilidades
import api.routes.Turnos
import api.routes.Clientes
import api.routes.AuthClientes

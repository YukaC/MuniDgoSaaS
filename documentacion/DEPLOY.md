# 🚀 Checklist de Deploy - TurnosApp

## Pre-Deploy

### 1. Variables de Entorno ⚙️
- [ ] `FLASK_ENV=production`
- [ ] `SECRET_KEY` configurada con valor seguro (mínimo 32 caracteres)
  ```bash
  # Generar SECRET_KEY segura:
  python -c "import secrets; print(secrets.token_hex(32))"
  ```
- [ ] Credenciales de BD configuradas (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`)
- [ ] `CORS_ORIGINS` restringido a dominios permitidos
- [ ] Variables de email configuradas (si aplica)

### 2. Base de Datos 🗄️
- [ ] BD de producción creada
- [ ] Usuario de BD con permisos mínimos necesarios (SELECT, INSERT, UPDATE, DELETE)
- [ ] Índices de optimización aplicados
  ```sql
  SOURCE INDICES_OPTIMIZACION.sql;
  ```
- [ ] Backup inicial creado
- [ ] Cron job para backups automáticos configurado

### 3. Servidor 🖥️
- [ ] Python 3.9+ instalado
- [ ] Entorno virtual creado
- [ ] Dependencias instaladas: `pip install -r requirements.txt`
- [ ] Servidor WSGI instalado (Gunicorn/uWSGI)
- [ ] Proxy reverso configurado (Nginx/Apache)
- [ ] Certificado SSL instalado (Let's Encrypt)
- [ ] Firewall configurado (solo puertos 80, 443)

---

## Deploy

### 4. Verificaciones Pre-Launch ✅
```bash
# Verificar que la app arranca
FLASK_ENV=production python backend/main.py

# Verificar health check
curl https://tu-dominio.com/health
```

### 5. Comandos de Deploy
```bash
# Con Gunicorn (recomendado)
gunicorn -w 4 -b 127.0.0.1:5000 --access-logfile /var/log/turnosapp/access.log "api:create_app()"

# Con systemd
sudo systemctl start turnosapp
sudo systemctl enable turnosapp
```

---

## Post-Deploy

### 6. Verificación 🔍
- [ ] Health check retorna `status: healthy`
- [ ] Login de empresa funciona
- [ ] Login de cliente funciona
- [ ] Se puede crear un turno
- [ ] Headers de seguridad presentes (verificar con curl -I)
- [ ] HTTPS funcionando correctamente
- [ ] Logs se están generando

### 7. Monitoreo 📊
- [ ] Configurar alertas de uptime (UptimeRobot, Pingdom)
- [ ] Configurar logs centralizados (opcional)
- [ ] Backup automático verificado

---

## Ejemplo de Configuración Nginx

```nginx
server {
    listen 80;
    server_name tu-dominio.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tu-dominio.com;

    ssl_certificate /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;

    # Seguridad SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # Frontend estático
    location / {
        root /var/www/turnosApp/frontend;
        try_files $uri $uri/ /index.html;
    }

    # API Backend
    location /api {
        rewrite ^/api(.*)$ $1 break;
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # O si el backend está en la raíz:
    location ~ ^/(login|health|empresa|cliente|turno|servicio|profesional|disponibilidad|publico) {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Ejemplo de Servicio systemd

```ini
# /etc/systemd/system/turnosapp.service
[Unit]
Description=TurnosApp API
After=network.target mysql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/turnosApp/backend
Environment="PATH=/var/www/turnosApp/.venv/bin"
EnvironmentFile=/var/www/turnosApp/backend/.env
ExecStart=/var/www/turnosApp/.venv/bin/gunicorn \
    -w 4 \
    -b 127.0.0.1:5000 \
    --access-logfile /var/log/turnosapp/access.log \
    --error-logfile /var/log/turnosapp/error.log \
    "api:create_app()"
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
# Comandos para gestionar el servicio
sudo systemctl daemon-reload
sudo systemctl start turnosapp
sudo systemctl enable turnosapp
sudo systemctl status turnosapp
```

---

## Rollback

En caso de problemas:

```bash
# Detener servicio
sudo systemctl stop turnosapp

# Restaurar código anterior
cd /var/www/turnosApp
git checkout <commit-anterior>

# Restaurar BD si es necesario
mysql -u root -p miturnoapp < backup_YYYYMMDD.sql

# Reiniciar
sudo systemctl start turnosapp
```

---

## Contacto de Emergencia

En caso de caída crítica:
1. Verificar logs: `tail -f /var/log/turnosapp/error.log`
2. Verificar BD: `mysql -u root -p -e "SELECT 1"`
3. Reiniciar servicio: `sudo systemctl restart turnosapp`

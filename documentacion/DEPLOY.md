# 🚀 Guía de Despliegue (Deploy)

Esta guía explica cómo desplegar la aplicación `TurnosApp` en servicios de nube. Recomendamos **Railway** por su facilidad de uso con Python y MySQL.

---

## Opción 1: Railway (Recomendado)

Railway detecta automáticamente el proyecto, instala las dependencias y provisiona la base de datos.

### Pasos:

1.  **Crear cuenta**: Regístrate en [railway.app](https://railway.app/).
2.  **Nuevo Proyecto**: Selecciona "Deploy from GitHub repo" y elige este repositorio.
3.  **Agregar Base de Datos**:
    *   En el dashboard del proyecto en Railway, clic derecho (o botón "New") -> **Database** -> **MySQL**.
    *   Esto creará una instancia de MySQL y generará automáticamente las variables de entorno (`MYSQLUSER`, `MYSQLPASSWORD`, etc.).
4.  **Configurar Variables de Entorno (Environment Variables)**:
    *   Ve a la pestaña **Variables** de tu servicio de aplicación (el repositorio que conectaste).
    *   Railway suele inyectar `DATABASE_URL` automáticamente. Sin embargo, nuestra app espera variables separadas.
    *   Debes mapear las variables que te da Railway a las que usa la app, o editar `backend/api/db/db_config.py` para leer `DATABASE_URL` (pero lo más fácil es agregar las variables manualmente en Railway):
        *   `DB_HOST`: `${MYSQLHOST}`
        *   `DB_PORT`: `${MYSQLPORT}`
        *   `DB_USER`: `${MYSQLUSER}`
        *   `DB_PASSWORD`: `${MYSQLPASSWORD}`
        *   `DB_NAME`: `${MYSQLDATABASE}`
        *   `SECRET_KEY`: (Genera un string aleatorio seguro)
5.  **Inicializar Base de Datos**:
    *   Una vez desplegado, necesitas crear las tablas.
    *   Railway tiene una pestaña **Data** (o puedes usar cualquier cliente MySQL conectándote con las credenciales públicas de Railway).
    *   Ejecuta el contenido de `database/01_INSTALL.sql`.

### Nota sobre el Frontend
El frontend se sirve como archivos estáticos desde la misma app Flask (si se configura así) o puedes desplegarlo por separado (ej. Vercel/Netlify) y apuntar la `API_URL`.
*En esta configuración simple (Monolito), Flask puede servir el frontend si se configura la carpeta `static`.*

---

## Opción 2: PythonAnywhere

Ideal si buscas un control más manual y un entorno 100% estándar de Python.

1.  Crear cuenta en PythonAnywhere.
2.  Subir el código (git clone).
3.  Crear Virtualenv e instalar `requirements.txt`.
4.  Configurar base de datos MySQL en la pestaña "Databases".
5.  Configurar el archivo `.env` con las credenciales.
6.  Apuntar el "WSGI configuration file" a nuestra app Flask.

---

## Archivos Importantes para Deploy

-   **Procfile**: Indica el comando de inicio (`gunicorn`).
-   **requirements.txt**: Lista de librerías necesarias.
-   **runtime.txt** (Opcional): Para especificar versión de Python exacta (por defecto Railway usa la última estable).

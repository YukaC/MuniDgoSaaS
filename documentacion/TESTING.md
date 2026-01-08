# 🧪 Guía de Testing

El proyecto incluye una suite de tests automatizados para asegurar la estabilidad del backend y la API.

---

## ⚙️ Configuración

Las pruebas utilizan `pytest` y requieren que el entorno virtual esté activado con las dependencias instaladas.

1. Activar entorno virtual:
   ```powershell
   .\.venv\Scripts\Activate
   ```

2. Instalar dependencias de desarrollo (ya incluidas en requirements.txt):
   ```bash
   pip install pytest
   ```

---

## 🏃 Ejecutar Tests

### Ejecutar toda la suite
Simplemente corre el comando:
```bash
pytest
```
Esto buscará automáticamente todos los archivos `test_*.py` en la carpeta `backend/tests/`.

### Ejecutar tests específicos
Para correr solo las pruebas de integración de la API:
```bash
pytest backend/tests/integration/test_api.py
```

Para ver la salida detallada (logs y prints):
```bash
pytest -s
```

---

## 📂 Organización de Tests

```
backend/tests/
├── unit/               # Tests unitarios (funciones aisladas)
│   ├── test_models.py  # Pruebas de lógica de modelos
│   └── test_utils.py   # Pruebas de funciones auxiliares
└── integration/        # Tests de integración (API completa)
    └── test_api.py     # Pruebas de endpoints HTTP y BD real/mock
```

---

## ✅ Cobertura

Actualmente los tests cubren:
- Autenticación de usuarios y empresas.
- CRUD de Turnos (Crear, Leer, Actualizar, Borrar).
- Validación de disponibilidades y horarios.
- Filtrado de turnos para clientes vs. administradores.

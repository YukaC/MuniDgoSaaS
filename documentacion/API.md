# 📡 API Reference - TurnosApp

Documentación detallada de los endpoints disponibles en la API RESTful de TurnosApp.

## 🔐 Autenticación

La API utiliza JSON Web Tokens (JWT) para la autenticación.

### Headers Requeridos

**Para Administradores (Empresas):**
```http
x-access-token: <tu_token_jwt>
id-empresa: <id_empresa>
```

**Para Clientes (Portal Ciudadano):**
```http
x-access-token-cliente: <tu_token_jwt>
```

---

## 🌍 Endpoints Públicos

### Health Check
Verificar el estado del servicio.
- **URL**: `/health`
- **Método**: `GET`
- **Respuesta Exitosa (200)**:
  ```json
  {
    "status": "healthy",
    "api": true,
    "database": true
  }
  ```

### Listar Empresas
Obtener lista de empresas/entidades registradas.
- **URL**: `/publico/empresas`
- **Método**: `GET`

---

## 🏢 Endpoints de Empresa (Admin)

Requieren `x-access-token` e `id-empresa`.

### 🔑 Sesión
#### Login Empresa
- **URL**: `/login`
- **Método**: `POST`
- **Auth**: Basic Auth (username:password)
- **Body**: `{}` (vacío)
- **Respuesta**: Token JWT y datos de la empresa.

### 📅 Turnos
#### Obtener Turnos
- **URL**: `/empresa/{id_empresa}/turnos`
- **Método**: `GET`
- **Descripción**: Devuelve todos los turnos.
- **Orden**: Prioridad a "Pendiente de Confirmación", luego por fecha.

#### Crear Turno
- **URL**: `/turno`
- **Método**: `POST`
- **Body**:
  ```json
  {
    "empresa_id": 1,
    "profesional_id": 5,
    "servicio_id": 2,
    "cliente_name": "Juan Perez",
    "start_datetime": "2026-01-20 10:00",
    "observaciones": "Nota opcional"
  }
  ```

#### Actualizar Turno
- **URL**: `/empresa/{id_empresa}/turno/{id_turno}`
- **Método**: `PUT`
- **Body**: Campos a actualizar (mismo formato que Crear).

#### Eliminar Turno
- **URL**: `/empresa/{id_empresa}/turno/{id_turno}`
- **Método**: `DELETE`

### 👥 Clientes
#### Listar Clientes
- **URL**: `/empresa/{id_empresa}/clientes-todos`
- **Método**: `GET`

#### Crear Cliente (Manual)
- **URL**: `/empresa/{id_empresa}/cliente/nuevo`
- **Método**: `POST`
- **Body**: `{"nombre": "...", "apellido": "...", "dni": "...", ...}`

### 👨‍⚕️ Profesionales
- **GET** `/empresa/{id_empresa}/profesionales`: Listar todos.
- **POST** `/profesional`: Crear nuevo.
- **PUT** `/empresa/{id_empresa}/profesional/{id}`: Editar.
- **DELETE** `/empresa/{id_empresa}/profesional/{id}`: Eliminar.

### 💼 Servicios
- **GET** `/empresa/{id_empresa}/servicios`: Listar todos.
- **POST** `/servicio`: Crear nuevo.
- **PUT** `/empresa/{id_empresa}/servicio/{id}`: Editar.
- **DELETE** `/empresa/{id_empresa}/servicio/{id}`: Eliminar.

### ⏰ Disponibilidades
- **GET** `/empresa/{id_empresa}/disponibilidades`: Listar config de horarios.
- **POST** `/disponibilidad`: Crear regla de disponibilidad.
- **PUT** `/empresa/{id_empresa}/disponibilidad/{id}`: Editar.
- **DELETE** `/empresa/{id_empresa}/disponibilidad/{id}`: Eliminar.

#### Consultar Horarios Disponibles
Calcula slots libres según duración del servicio y agenda del profesional.
- **URL**: `/empresa/{id_empresa}/horarios-disponibles`
- **Método**: `GET`
- **Query Params**:
  - `profesional_id`: ID del profesional.
  - `fecha`: Fecha (YYYY-MM-DD).
  - `servicio_id`: (Opcional) para calcular duración.

---

## 👤 Endpoints de Cliente (Portal)

### 🔐 Autenticación
#### Registro
- **URL**: `/cliente/registro`
- **Método**: `POST`
- **Body**:
  ```json
  {
    "dni": "...",
    "nombre": "...",
    "apellido": "...",
    "password": "...",
    "email": "..."
  }
  ```

#### Login
- **URL**: `/cliente/login`
- **Método**: `POST`
- **Body**: `{"dni": "...", "password": "..."}`

### 📅 Mis Turnos
#### Obtener Mis Turnos (Global)
- **URL**: `/cliente/todos-mis-turnos`
- **Método**: `GET`
- **Headers**: `x-access-token-cliente`
- **Filtro**: Solo devuelve turnos **Reservados** o **Completados**. Oculta "Cancelados" y "Pendientes".

#### Obtener Mis Turnos (Por Empresa)
- **URL**: `/cliente/empresa/{id_empresa}/mis-turnos`
- **Método**: `GET`
- **Headers**: `x-access-token-cliente`

#### Reservar Turno
- **URL**: `/cliente/empresa/{id_empresa}/reservar-turno`
- **Método**: `POST`
- **Headers**: `x-access-token-cliente`
- **Body**:
  ```json
  {
    "profesional_id": 1,
    "start_datetime": "2026-01-20 10:00",
    "observaciones": "..."
  }
  ```

#### Cancelar Turno
- **URL**: `/cliente/empresa/{id_empresa}/turno/{id_turno}/cancelar`
- **Método**: `PUT`
- **Headers**: `x-access-token-cliente`

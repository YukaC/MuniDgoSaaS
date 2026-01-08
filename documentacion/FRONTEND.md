# 💻 Guía de Frontend

El frontend está construido con HTML5, CSS3 Nativo y JavaScript Moderno (ES6+), sin frameworks pesados (React/Vue/Angular) para mantener la simplicidad y el rendimiento.

---

## 📂 Organización de Archivos

```
frontend/
├── css/
│   └── style.css       # Estilos globales y variables CSS
├── js/
│   ├── main.js         # Lógica central del dashboard y navegación
│   ├── turnos.js       # Gestión de citas (CRUD)
│   ├── clientes.js     # Gestión de clientes
│   ├── profesionales.js # Gestión de médicos/profesionales
│   ├── servicios.js    # Gestión de servicios
│   ├── reportes.js     # Gráficos con ECharts
│   └── utils.js        # Funciones auxiliares
├── index.html          # Panel de Administración (SPA)
└── cliente.html        # Portal público de reservas
```

---

## 🎨 Principios de Diseño

1.  **Single Page Application (SPA)**: La navegación en el panel de admin (`index.html`) simula una SPA ocultando/mostrando secciones (`div`s) mediante JavaScript, sin recargar la página.
2.  **Modularidad**: Cada "vista" (Turnos, Clientes, etc.) tiene su propio archivo JS encargado de renderizar y manejar la lógica de esa sección.
3.  **Estilos Unificados**: Se utiliza grid/flexbox y variables CSS (`:root`) para mantener consistencia en colores y espaciado.
4.  **Cards**: La interfaz utiliza un diseño basado en tarjetas (`.item-card`) para mostrar la información, optimizado tanto para escritorio como móviles.

---

## 🔍 Funcionalidades Clave

### Barra de Búsqueda Global
El panel de administración incluye una barra de búsqueda en el encabezado que permite filtrar resultados en tiempo real.
- **Funcionamiento**: Filtra las tarjetas visibles en la sección activa.
- **Visualización**: Los resultados coincidentes se mantienen visibles y se ordenan automáticamente al inicio de la lista.
- **Accesibilidad**: Se activa automáticamente en secciones compatibles (Citas, Clientes, Profesionales).

### Notificaciones de Turnos
- Los turnos con estado `Pendiente de Confirmación` se destacan visualmente con un borde naranja y una animación pulsante para alertar al administrador.

### Sistema de Reportes
- Integración con **Apache ECharts** para visualizar métricas clave como turnos por día, ingresos estimados y servicios más solicitados.

---

## 🚀 Despliegue Frontend

Al ser un frontend estático, no requiere proceso de compilación (`build`).
Para producción, simplemente servir la carpeta `frontend/` mediante Nginx, Apache, o el servidor estático de Flask (ya configurado en `backend/main.py`).

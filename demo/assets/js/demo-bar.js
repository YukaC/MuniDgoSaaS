/**
 * Demo chrome (sólo existe en demo/): hace visible que el sistema tiene dos roles
 * sobre los mismos datos.
 *
 *  - Barra fija arriba en todas las páginas: qué rol estás viendo, botón para
 *    cambiar al otro rol, volver a la portada y reiniciar la demo.
 *  - Recorrido guiado de 3 pasos: el ciudadano reserva un turno → un clic pasa
 *    al panel del sector → el turno aparece resaltado en "Citas".
 *  - Fuera del recorrido, el panel también resalta el último turno reservado
 *    desde el portal y muestra un aviso en la barra.
 *
 * No toca el frontend original: sólo lee localStorage (sesiones y la última
 * reserva que registra js/mock-api.js) y escucha el evento "turnos-demo:booking".
 */
(function () {
  "use strict";

  const PREFIX = "turnos-demo:";
  const TOUR_KEY = `${PREFIX}tour`;
  const BOOKING_KEY = `${PREFIX}last-booking`;
  const SEEN_KEY = `${PREFIX}booking-seen`;
  const DEMO_PASSWORD = "123456";
  const DEFAULT_SECTOR = "hospital_muni";

  const page = currentPage();

  // ------------------------------------------------------------------ helpers

  function currentPage() {
    const file = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
    if (file === "cliente.html") return "cliente";
    if (file === "admin.html") return "admin";
    if (file === "login.html") return "login";
    return "home";
  }

  function readJson(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch (error) {
      return null;
    }
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value);
    });
    (children || []).forEach((child) => {
      if (child == null) return;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }

  function button(label, onClick, variant) {
    return el("button", {
      type: "button",
      class: `demo-bar__btn${variant ? ` ${variant}` : ""}`,
      text: label,
      onclick: onClick,
    });
  }

  function formatTurno(datetime) {
    const date = new Date(String(datetime || "").replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return datetime || "";
    const pad = (n) => String(n).padStart(2, "0");
    const dia = date.toLocaleDateString("es-AR", { weekday: "long" });
    return `${dia} ${date.getDate()}/${date.getMonth() + 1} a las ${pad(date.getHours())}:${pad(date.getMinutes())} h`;
  }

  function adminSession() {
    return readJson("activeUser");
  }

  function lastBooking() {
    return readJson(BOOKING_KEY);
  }

  function getTour() {
    return localStorage.getItem(TOUR_KEY);
  }

  function setTour(step) {
    if (step) localStorage.setItem(TOUR_KEY, step);
    else localStorage.removeItem(TOUR_KEY);
  }

  /** Inicia sesión como un sector (misma llamada que js/login.js) y abre el panel. */
  async function openPanelAs(username) {
    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: { Authorization: `Basic ${btoa(`${username}:${DEMO_PASSWORD}`)}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "login falló");
      localStorage.setItem(
        "activeUser",
        JSON.stringify({ id: data.id, nombre: data.nombre, token: data.token })
      );
      localStorage.setItem("authToken", data.token);
      window.location.href = "admin.html";
    } catch (error) {
      console.error("[demo-bar] no se pudo abrir el panel", error);
      window.location.href = "login.html";
    }
  }

  function goToCitizen() {
    window.location.href = "cliente.html";
  }

  function goToMunicipio() {
    const booking = lastBooking();
    const session = adminSession();
    if (booking && booking.empresa_username && (!session || Number(session.id) !== Number(booking.empresa_id))) {
      openPanelAs(booking.empresa_username);
    } else if (session) {
      window.location.href = "admin.html";
    } else {
      openPanelAs(DEFAULT_SECTOR);
    }
  }

  function resetDemo() {
    const go = "index.html";
    if (typeof window.turnosDemoReset === "function") window.turnosDemoReset(go);
    else {
      localStorage.clear();
      window.location.href = go;
    }
  }

  function startTour() {
    setTour("reservar");
    localStorage.removeItem(SEEN_KEY);
    goToCitizen();
  }
  window.turnosDemoStartTour = startTour;

  // ---------------------------------------------------------------- top bar

  function renderBar() {
    const bar = el("div", { class: "demo-bar", role: "region", "aria-label": "Controles de la demo" });
    const role = page === "cliente" ? "ciudadano" : page === "home" ? "" : "municipio";
    if (role) bar.dataset.role = role;

    bar.appendChild(el("span", { class: "demo-bar__tag", text: "DEMO" }));
    bar.appendChild(el("a", { class: "demo-bar__home", href: "index.html", text: "Mi Turno" }));

    if (role === "ciudadano") {
      bar.appendChild(
        el("span", { class: "demo-bar__role" }, [
          el("span", { class: "demo-bar__long", text: "Estás viendo: " }),
          el("strong", { text: "Portal del ciudadano" }),
        ])
      );
    } else if (role === "municipio") {
      const session = adminSession();
      const sector = page === "admin" && session && session.nombre ? ` · ${session.nombre}` : "";
      bar.appendChild(
        el("span", { class: "demo-bar__role" }, [
          el("span", { class: "demo-bar__long", text: "Estás viendo: " }),
          el("strong", { text: "Panel del municipio" }),
          el("span", { class: "demo-bar__long", text: sector }),
        ])
      );
    } else {
      bar.appendChild(
        el("span", { class: "demo-bar__role" }, [
          el("span", { class: "demo-bar__long", text: "Un sistema, dos roles, los mismos datos" }),
        ])
      );
    }

    bar.appendChild(el("span", { class: "demo-bar__spacer" }));

    if (page === "admin" && pendingBookingForThisPanel()) {
      bar.appendChild(
        button("★ Turno nuevo desde el portal", () => showBookingInPanel(true), "demo-bar__btn--chip demo-bar__new")
      );
    }

    if (role === "ciudadano") {
      bar.appendChild(button("Ver como municipio →", goToMunicipio, "demo-bar__btn--solid"));
    } else if (role === "municipio") {
      bar.appendChild(button("← Ver como ciudadano", goToCitizen, "demo-bar__btn--solid"));
    } else if (!getTour()) {
      bar.appendChild(button("▶ Recorrido guiado", startTour, "demo-bar__btn--solid"));
    }

    bar.appendChild(button("Reiniciar demo", resetDemo, "demo-bar__btn--reset"));

    document.body.classList.add("has-demo-bar");
    document.body.prepend(bar);
  }

  // ------------------------------------------------------------ guided tour

  let tourCard = null;

  function renderTour() {
    if (tourCard) tourCard.remove();
    tourCard = null;
    const step = getTour();
    if (!step) return;

    const content = tourContent(step);
    if (!content) return;

    tourCard = el("aside", { class: "demo-tour", role: "dialog", "aria-label": "Recorrido guiado" }, [
      el("button", {
        class: "demo-tour__close",
        type: "button",
        "aria-label": "Salir del recorrido",
        text: "×",
        onclick: () => {
          setTour(null);
          renderTour();
        },
      }),
      el("div", { class: "demo-tour__step", text: content.label }),
      el("h3", { text: content.title }),
      ...content.body,
      el("div", { class: "demo-tour__actions" }, content.actions),
    ]);
    document.body.appendChild(tourCard);
  }

  function tourContent(step) {
    const booking = lastBooking();

    if (step === "reservar") {
      if (page !== "cliente") {
        return {
          label: "Paso 1 de 3 · Ciudadano",
          title: "Empezamos del lado del vecino",
          body: [el("p", { text: "Vas a reservar un turno desde el portal público, como lo haría cualquier ciudadano." })],
          actions: [button("Ir al portal del ciudadano →", goToCitizen, "demo-bar__btn--solid is-ciudadano")],
        };
      }
      return {
        label: "Paso 1 de 3 · Ciudadano",
        title: "Reservá un turno como Juan Perez",
        body: [
          el("ol", {}, [
            el("li", { text: "Tocá Ingresar (las credenciales ya están cargadas)." }),
            el("li", { text: "+ Reservar Nuevo Turno → Hospital Municipal." }),
            el("li", { text: "Elegí profesional, un día que atienda y un horario libre." }),
            el("li", { text: "Confirmá la reserva." }),
          ]),
          el("p", { text: "Cuando se confirme, te llevo al otro lado del sistema." }),
        ],
        actions: [],
      };
    }

    if (step === "ver-panel") {
      const sector = (booking && booking.empresa_nombre) || "el sector";
      return {
        label: "Paso 2 de 3 · Cambio de rol",
        title: "Turno reservado ✓",
        body: [
          el("p", {
            text: booking
              ? `${booking.cliente_name} tiene turno el ${formatTurno(booking.start_datetime)}.`
              : "El turno quedó registrado.",
          }),
          el("p", { text: `Ahora entrá como ${sector}: el mismo turno ya está en su agenda.` }),
        ],
        actions: [
          button(`Ver como ${sector} →`, () => {
            setTour("en-panel");
            goToMunicipio();
          }, "demo-bar__btn--solid"),
        ],
      };
    }

    if (step === "en-panel") {
      if (page !== "admin") {
        return {
          label: "Paso 3 de 3 · Municipio",
          title: "Falta ver el panel",
          body: [el("p", { text: "Entrá al panel del sector para ver el turno reservado." })],
          actions: [button("Abrir panel →", goToMunicipio, "demo-bar__btn--solid")],
        };
      }
      return {
        label: "Paso 3 de 3 · Municipio",
        title: "El mismo turno, del otro lado",
        body: [
          el("p", { text: "Está resaltado en Citas. El sector puede editarlo, reasignarlo o cancelarlo, y el ciudadano ve el cambio en su portal." }),
          el("p", { text: "Probá al revés: editá el turno acá y volvé al portal." }),
        ],
        actions: [
          button("← Volver al portal", () => {
            setTour(null);
            goToCitizen();
          }, "demo-bar__btn--solid is-ciudadano"),
          button("Terminar", () => {
            setTour(null);
            renderTour();
          }),
        ],
      };
    }

    return null;
  }

  // ----------------------------------------- highlight the booking in the panel

  function pendingBookingForThisPanel() {
    const booking = lastBooking();
    const session = adminSession();
    if (!booking || !session) return false;
    if (Number(session.id) !== Number(booking.empresa_id)) return false;
    return localStorage.getItem(SEEN_KEY) !== String(booking.id);
  }

  function showBookingInPanel(openCitas) {
    const booking = lastBooking();
    const session = adminSession();
    if (!booking || !session || Number(session.id) !== Number(booking.empresa_id)) return;

    if (openCitas) {
      const link = document.querySelector('a[data-target="view-shifts"]');
      if (link) link.click();
    }

    const container = document.getElementById("container-gestion-turnos");
    if (!container) return;

    let scrolled = false;
    const decorate = () => {
      const editBtn = container.querySelector(`button[onclick="prepararEdicion(${Number(booking.id)})"]`);
      const card = editBtn && editBtn.closest(".item-card");
      if (!card || card.classList.contains("demo-highlight")) return;
      card.classList.add("demo-highlight");
      card.prepend(el("span", { class: "demo-highlight__badge", text: "★ Reservado desde el portal" }));
      if (openCitas && !scrolled) {
        scrolled = true;
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        localStorage.setItem(SEEN_KEY, String(booking.id));
        const chip = document.querySelector(".demo-bar__new");
        if (chip) chip.remove();
      }
    };
    decorate();
    new MutationObserver(decorate).observe(container, { childList: true });
  }

  // -------------------------------------------------------------------- boot

  function boot() {
    renderBar();
    renderTour();

    if (page === "cliente") {
      window.addEventListener("turnos-demo:booking", () => {
        if (getTour() === "reservar") {
          setTour("ver-panel");
          renderTour();
        }
      });
    }

    if (page === "admin") {
      const fromTour = getTour() === "en-panel";
      // Esperar a que main.js arme el panel antes de cambiar de sección.
      setTimeout(() => showBookingInPanel(fromTour), fromTour ? 400 : 0);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

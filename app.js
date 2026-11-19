// ¿Qué tal el clima? — app de clima (datos de Open-Meteo, sin clave)
const $ = (s) => document.querySelector(s);
const API_CLIMA = "https://api.open-meteo.com/v1/forecast";
const API_GEO = "https://geocoding-api.open-meteo.com/v1/search";
const REFRESCO_MIN = 15; // cada cuántos minutos se actualiza la pantalla
const CIUDAD_INICIAL = { nombre: "Buenos Aires", detalle: "Argentina", lat: -34.61, lon: -58.38 };

// Código de clima de Open-Meteo -> [texto, ícono de día, ícono de noche]
const CODIGOS = {
  0: ["Despejado", "☀️", "🌙"], 1: ["Mayormente despejado", "🌤️", "🌙"],
  2: ["Parcialmente nublado", "⛅", "☁️"], 3: ["Nublado", "☁️"],
  45: ["Niebla", "🌫️"], 48: ["Niebla con escarcha", "🌫️"],
  51: ["Llovizna débil", "🌦️"], 53: ["Llovizna", "🌦️"], 55: ["Llovizna intensa", "🌧️"],
  56: ["Llovizna helada", "🌧️"], 57: ["Llovizna helada", "🌧️"],
  61: ["Lluvia débil", "🌦️"], 63: ["Lluvia", "🌧️"], 65: ["Lluvia fuerte", "🌧️"],
  66: ["Lluvia helada", "🌧️"], 67: ["Lluvia helada", "🌧️"],
  71: ["Nevada débil", "🌨️"], 73: ["Nevada", "🌨️"], 75: ["Nevada fuerte", "❄️"], 77: ["Granizo fino", "🌨️"],
  80: ["Chaparrones", "🌦️"], 81: ["Chaparrones", "🌧️"], 82: ["Chaparrones fuertes", "⛈️"],
  85: ["Chaparrones de nieve", "🌨️"], 86: ["Chaparrones de nieve", "❄️"],
  95: ["Tormenta", "⛈️"], 96: ["Tormenta con granizo", "⛈️"], 99: ["Tormenta con granizo", "⛈️"],
};
function estadoClima(codigo, esDeDia = 1) {
  const c = CODIGOS[codigo] || ["Sin datos", "🌡️"];
  return { texto: c[0], icono: !esDeDia && c[2] ? c[2] : c[1] };
}
function direccionViento(grados) {
  const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return dirs[Math.round(grados / 45) % 8];
}
const redondear = (n) => Math.round(n);
const hhmm = (iso) => iso.slice(11, 16);

// ---------- Guardado local (puede fallar en modo privado) ----------
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const leer = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };

// ---------- Tema claro / oscuro ----------
const TEMAS = ["auto", "claro", "oscuro"];
const ICONO_TEMA = { auto: "🌓", claro: "☀️", oscuro: "🌙" };
function aplicarTema(tema) {
  if (tema === "auto") document.documentElement.removeAttribute("data-tema");
  else document.documentElement.setAttribute("data-tema", tema);
  $("#btnTema").textContent = ICONO_TEMA[tema];
  $("#btnTema").title = "Tema: " + tema;
  const oscuro = tema === "oscuro" || (tema === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]').content = oscuro ? "#0f1622" : "#2b6cb0";
}
let tema = leer("tema") || "auto";
aplicarTema(tema);
$("#btnTema").addEventListener("click", () => {
  tema = TEMAS[(TEMAS.indexOf(tema) + 1) % TEMAS.length];
  guardar("tema", tema);
  aplicarTema(tema);
});

// ---------- Botón "Descargar app" ----------
let promptInstalar = null;
const yaInstalada = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
if (yaInstalada()) $("#btnInstalar").hidden = true;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); promptInstalar = e; });
window.addEventListener("appinstalled", () => { $("#btnInstalar").hidden = true; promptInstalar = null; });
$("#btnInstalar").addEventListener("click", async () => {
  if (promptInstalar) {
    promptInstalar.prompt();
    await promptInstalar.userChoice;
    promptInstalar = null;
  } else {
    $("#dlgInstalar").showModal(); // iPhone u otros navegadores: instrucciones
  }
});
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

// ---------- Clima ----------
let ciudadActual = leer("ciudad") || CIUDAD_INICIAL;

async function cargarClima(ciudad) {
  ciudadActual = ciudad;
  guardar("ciudad", ciudad);
  $("#estado").textContent = "Cargando el clima de " + ciudad.nombre + "…";
  const params = new URLSearchParams({
    latitude: ciudad.lat, longitude: ciudad.lon, timezone: "auto", forecast_days: 7,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day",
    hourly: "temperature_2m,precipitation_probability,weather_code,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,uv_index_max",
  });
  try {
    const r = await fetch(API_CLIMA + "?" + params);
    if (!r.ok) throw new Error(r.status);
    const datos = await r.json();
    mostrar(ciudad, datos);
    $("#estado").textContent = "";
  } catch (e) {
    $("#estado").textContent = "No se pudo cargar el clima. Revisá tu conexión e intentá de nuevo.";
  }
}

function mostrar(ciudad, d) {
  const c = d.current;
  const hoy = d.daily;
  const est = estadoClima(c.weather_code, c.is_day);
  $("#actual").innerHTML = `
    <div class="lugar">${ciudad.nombre}${ciudad.detalle ? `<small class="desc">, ${ciudad.detalle}</small>` : ""}</div>
    <div class="principal">
      <div class="emoji">${est.icono}</div>
      <div>
        <div class="temp">${redondear(c.temperature_2m)}°</div>
        <div class="desc">${est.texto} · Máx ${redondear(hoy.temperature_2m_max[0])}° / Mín ${redondear(hoy.temperature_2m_min[0])}°</div>
      </div>
    </div>
    <div class="datos">
      <div class="dato"><span>Sensación térmica</span><strong>${redondear(c.apparent_temperature)}°</strong></div>
      <div class="dato"><span>Humedad</span><strong>${c.relative_humidity_2m}%</strong></div>
      <div class="dato"><span>Viento</span><strong>${redondear(c.wind_speed_10m)} km/h ${direccionViento(c.wind_direction_10m)}</strong></div>
      <div class="dato"><span>Lluvia ahora</span><strong>${c.precipitation} mm</strong></div>
      <div class="dato"><span>Prob. de lluvia hoy</span><strong>${hoy.precipitation_probability_max[0] ?? "—"}%</strong></div>
      <div class="dato"><span>Índice UV máx.</span><strong>${hoy.uv_index_max[0] ?? "—"}</strong></div>
      <div class="dato"><span>Amanecer</span><strong>${hhmm(hoy.sunrise[0])}</strong></div>
      <div class="dato"><span>Atardecer</span><strong>${hhmm(hoy.sunset[0])}</strong></div>
    </div>
    <div class="actualizado">Hora local: ${hhmm(c.time)} · se actualiza cada ${REFRESCO_MIN} min</div>`;
  $("#actual").hidden = false;

  // Próximas 24 horas
  const h = d.hourly;
  let inicio = h.time.indexOf(c.time.slice(0, 13) + ":00");
  if (inicio < 0) inicio = 0;
  let htmlHoras = "";
  for (let i = inicio; i < Math.min(inicio + 24, h.time.length); i++) {
    const e = estadoClima(h.weather_code[i], h.is_day[i]);
    htmlHoras += `<div class="hora" title="${e.texto}">
      <div class="h">${i === inicio ? "Ahora" : hhmm(h.time[i])}</div>
      <div class="e">${e.icono}</div>
      <div><strong>${redondear(h.temperature_2m[i])}°</strong></div>
      <div class="p">💧${h.precipitation_probability[i] ?? 0}%</div>
    </div>`;
  }
  $("#horas").innerHTML = htmlHoras;
  $("#horasCard").hidden = false;

  // Próximos 7 días
  $("#dias").innerHTML = hoy.time.map((fecha, i) => {
    const e = estadoClima(hoy.weather_code[i]);
    const nombre = i === 0 ? "Hoy" : new Date(fecha + "T12:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric" });
    return `<div class="dia">
      <div class="nombre">${nombre}</div>
      <div class="e" title="${e.texto}">${e.icono}</div>
      <div class="extra">${e.texto}<br>💧${hoy.precipitation_probability_max[i] ?? 0}% · ${hoy.precipitation_sum[i]} mm</div>
      <div class="rango"><strong>${redondear(hoy.temperature_2m_max[i])}°</strong><span class="min">${redondear(hoy.temperature_2m_min[i])}°</span></div>
    </div>`;
  }).join("");
  $("#diasCard").hidden = false;
}

// ---------- Buscador de ciudades ----------
let resultados = [];
let espera = null;
async function buscar(texto) {
  if (texto.trim().length < 2) { $("#sugerencias").hidden = true; return; }
  try {
    const r = await fetch(`${API_GEO}?${new URLSearchParams({ name: texto, count: 6, language: "es", format: "json" })}`);
    const d = await r.json();
    resultados = (d.results || []).map((x) => ({
      nombre: x.name,
      detalle: [x.admin1, x.country].filter(Boolean).join(", "),
      lat: x.latitude, lon: x.longitude,
    }));
  } catch (e) { resultados = []; }
  const lista = $("#sugerencias");
  lista.innerHTML = resultados.length
    ? resultados.map((x, i) => `<li data-i="${i}">${x.nombre} <small>${x.detalle}</small></li>`).join("")
    : `<li class="vacio"><small>No encontré esa ciudad</small></li>`;
  lista.hidden = false;
}
function elegir(i) {
  const ciudad = resultados[i];
  if (!ciudad) return;
  $("#sugerencias").hidden = true;
  $("#q").value = "";
  $("#q").blur();
  cargarClima(ciudad);
}
$("#q").addEventListener("input", (e) => {
  clearTimeout(espera);
  espera = setTimeout(() => buscar(e.target.value), 300);
});
$("#sugerencias").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-i]");
  if (li) elegir(Number(li.dataset.i));
});
$("#buscador").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearTimeout(espera);
  await buscar($("#q").value);
  elegir(0);
});
document.addEventListener("click", (e) => {
  if (!e.target.closest("#buscador")) $("#sugerencias").hidden = true;
});

// ---------- Mi ubicación ----------
$("#btnUbicacion").addEventListener("click", () => {
  if (!navigator.geolocation) { $("#estado").textContent = "Tu navegador no permite usar la ubicación."; return; }
  $("#estado").textContent = "Buscando tu ubicación…";
  navigator.geolocation.getCurrentPosition(
    (p) => cargarClima({ nombre: "Mi ubicación", detalle: "", lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3) }),
    () => { $("#estado").textContent = "No pude obtener tu ubicación (¿diste permiso?)."; },
    { timeout: 10000 }
  );
});

// ---------- Ciudades rápidas + sección API (desde api/ciudades.json) ----------
async function cargarIndice() {
  try {
    const r = await fetch("api/ciudades.json", { cache: "no-store" });
    if (!r.ok) return;
    const indice = await r.json();
    $("#chips").innerHTML = indice.ciudades.map((c, i) => `<button type="button" data-i="${i}">${c.ciudad}</button>`).join("");
    $("#chips").onclick = (e) => {
      const b = e.target.closest("button[data-i]");
      if (!b) return;
      const c = indice.ciudades[Number(b.dataset.i)];
      cargarClima({ nombre: c.ciudad, detalle: "", lat: c.latitud, lon: c.longitud });
    };
    const base = new URL("api/", location.href).href;
    $("#endpoints").innerHTML =
      `<li><code>${base}ciudades.json</code> — lista de ciudades</li>` +
      indice.ciudades.map((c) => `<li><a href="${c.url}" target="_blank" rel="noopener"><code>${base}${c.slug}.json</code></a></li>`).join("");
    $("#apiCard").hidden = false;
  } catch (e) { /* todavía no hay API generada: no se muestra la sección */ }
}

// ---------- Arranque ----------
cargarClima(ciudadActual);
cargarIndice();
setInterval(() => cargarClima(ciudadActual), REFRESCO_MIN * 60 * 1000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") cargarClima(ciudadActual);
});

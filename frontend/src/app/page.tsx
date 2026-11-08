"use client";

import React, { useState, useEffect } from "react";

interface PackOption {
  id: "inicial" | "impulso" | "pro";
  name: string;
  title: string;
  chances: number;
  price: number;
  badge: string;
  accent: string;
  topics: string[];
  downloads: string[];
}

interface OrderSummary {
  order_id: number;
  pack_type: string;
  pack_title: string;
  amount: number;
  status: string;
  mp_payment_id?: string | null;
  created_at: string;
  tickets: string[];
  downloads: string[];
}

interface LookupResult {
  dni: string;
  full_name?: string | null;
  total_tickets: number;
  numbers: string[];
  downloads: string[];
  orders: OrderSummary[];
}

const PDF_DISPLAY_NAMES: Record<string, string> = {
  "/downloads/guia-optimizacion-red-fps-gaming-v2.pdf":
    "Guía Optimización de Red y FPS Gaming (v2)",
  "/downloads/manual-configuracion-pantallas-120hz-144hz-v2.pdf":
    "Manual Configuración Pantallas 120Hz/144Hz (v2)",
  "/downloads/catalogo-trucos-gta-v2.pdf": "Catálogo de Trucos GTA (v2)",
};

const PACKS: PackOption[] = [
  {
    id: "inicial",
    name: "Pack Inicial",
    title: "Guía Optimización de Red y FPS Gaming (v2)",
    chances: 2,
    price: 5000,
    badge: "Pack Inicial · 2 Chances",
    accent: "from-blue-600 to-cyan-500",
    topics: [
      "Reducción de Input Lag (<10ms)",
      "Registro TCP (Nagle) y optimización de Windows",
      "2 números de 5 cifras",
    ],
    downloads: ["/downloads/guia-optimizacion-red-fps-gaming-v2.pdf"],
  },
  {
    id: "impulso",
    name: "Pack Impulso",
    title: "Pack Rendimiento: FPS + Manual Pantallas 120Hz/144Hz (v2)",
    chances: 6,
    price: 10000,
    badge: "Más Elegido · 6 Chances",
    accent: "from-emerald-500 to-blue-600",
    topics: [
      "Incluye Guía de Red/FPS",
      "Manual completo de configuración 144Hz/240Hz, DisplayPort/HDMI y G-Sync/FreeSync",
      "6 números de 5 cifras",
    ],
    downloads: [
      "/downloads/guia-optimizacion-red-fps-gaming-v2.pdf",
      "/downloads/manual-configuracion-pantallas-120hz-144hz-v2.pdf",
    ],
  },
  {
    id: "pro",
    name: "Pack Pro",
    title: "Trilogía Gamer Pro + Catálogo Trucos GTA (v2)",
    chances: 15,
    price: 20000,
    badge: "Mejor Valor · 15 Chances",
    accent: "from-violet-600 to-blue-600",
    topics: [
      "Los 3 manuales completos en PDF (Red/FPS + Monitores 144Hz + Catálogo completo de trucos GTA para todas las plataformas)",
      "15 números de 5 cifras",
    ],
    downloads: [
      "/downloads/guia-optimizacion-red-fps-gaming-v2.pdf",
      "/downloads/manual-configuracion-pantallas-120hz-144hz-v2.pdf",
      "/downloads/catalogo-trucos-gta-v2.pdf",
    ],
  },
];

// Fecha objetivo del sorteo: 19 de noviembre de 2026 a las 21:00 hs (Argentina UTC-3)
const DRAW_DATE_ISO = "2026-11-19T21:00:00-03:00";

export default function HomePage() {
  const [selectedPack, setSelectedPack] = useState<PackOption>(PACKS[1]);
  const [dni, setDni] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<{
    order_id: number;
    preference_id: string;
    init_point: string;
    amount: number;
    chances: number;
    dni: string;
  } | null>(null);

  const [isSimulatingWebhook, setIsSimulatingWebhook] = useState(false);

  // Estado para consulta de tickets por DNI
  const [lookupDni, setLookupDni] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);

  // Estado del pool de 100.000 tickets
  const [poolStats, setPoolStats] = useState<{
    total_tickets: number;
    available_tickets: number;
    assigned_tickets: number;
  } | null>(null);

  // Estado del contador regresivo al 19 de noviembre de 2026
  const [countdown, setCountdown] = useState({
    days: 11,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const targetTime = new Date(DRAW_DATE_ISO).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, targetTime - now);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setCountdown({ days, hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        setPoolStats(data);
      }
    } catch {
      // Silencioso en carga inicial
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dni,
          full_name: fullName,
          email,
          whatsapp,
          pack_type: selectedPack.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.detail?.[0]?.msg || data.detail || "No se pudo generar la orden de compra."
        );
      }

      setCreatedOrder({
        order_id: data.order_id,
        preference_id: data.preference_id,
        init_point: data.init_point,
        amount: data.amount,
        chances: data.chances,
        dni: dni.replace(/\D/g, ""),
      });

      if (data.init_point && data.init_point.includes("mercadopago.com")) {
        window.location.href = data.init_point;
      }
    } catch (err: unknown) {
      setCheckoutError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulateMercadoPagoWebhook = async () => {
    if (!createdOrder) return;
    setIsSimulatingWebhook(true);
    setCheckoutError(null);

    try {
      const fakePaymentId = `MP-${Date.now()}`;
      const res = await fetch("/api/webhook/mp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "payment",
          data: { id: fakePaymentId },
          simulate_approved: true,
          external_reference: String(createdOrder.order_id),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Error al procesar el webhook de pago.");
      }

      await fetchStats();
      setLookupDni(createdOrder.dni);
      await performDniLookup(createdOrder.dni);

      const lookupSection = document.getElementById("seccion-consulta-dni");
      if (lookupSection) {
        lookupSection.scrollIntoView({ behavior: "smooth" });
      }
    } catch (err: unknown) {
      setCheckoutError(err instanceof Error ? err.message : "Error al simular pago.");
    } finally {
      setIsSimulatingWebhook(false);
    }
  };

  const performDniLookup = async (targetDni: string) => {
    const cleaned = targetDni.replace(/\D/g, "");
    if (!cleaned || cleaned.length < 6) {
      setLookupError("Ingresá un DNI válido sin puntos (mínimo 6 dígitos).");
      return;
    }

    setLookupLoading(true);
    setLookupError(null);
    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(cleaned)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Error al consultar tus números.");
      }
      setLookupResult(data);
    } catch (err: unknown) {
      setLookupError(err instanceof Error ? err.message : "Error de conexión.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performDniLookup(lookupDni);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Header Dark Gamer con detalles Azul PlayStation y Verde/Violeta */}
      <header className="border-b border-blue-900/50 bg-slate-950/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#00439C] via-blue-600 to-violet-600 text-white font-mono font-bold text-base shadow-lg shadow-blue-600/30 border border-blue-400/30">
              PS5
            </span>
            <div>
              <span className="font-bold text-base sm:text-lg tracking-tight text-white block leading-none">
                GAMING PRO <span className="text-blue-400">SORTEO OFICIAL</span>
              </span>
              <span className="text-xs text-slate-400">
                Guías PDF de Alto Rendimiento + Chances Sorteo PS5 Slim
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-3 sm:gap-5 text-sm font-medium">
            <a
              href="#catalogo-packs"
              id="nav-link-packs"
              className="hidden sm:inline-block text-slate-300 hover:text-blue-400 transition-colors"
            >
              Packs Gamer
            </a>
            <a
              href="#seccion-consulta-dni"
              id="nav-link-consulta"
              className="px-4 py-2 rounded-xl bg-[#00439C] hover:bg-blue-600 text-white border border-blue-400/30 transition-all font-semibold shadow-md shadow-blue-900/40"
            >
              Verificar mis Números (DNI)
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO GAMER: SORTEO PLAYSTATION 5 SLIM + GTA + Contador Regresivo + Vista Previa PDF */}
        <section className="relative overflow-hidden py-12 sm:py-20 border-b border-slate-800/80 bg-gradient-to-b from-slate-950 via-[#040d21] to-slate-950">
          {/* Luces ambientales Azul PlayStation, Violeta y Verde Esmeralda */}
          <div className="pointer-events-none absolute -top-24 left-1/4 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="pointer-events-none absolute top-12 right-10 w-80 h-80 rounded-full bg-violet-600/15 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/2 w-96 h-64 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              {/* Columna principal Hero */}
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex flex-wrap items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/80 border border-blue-500/40 text-xs font-mono uppercase tracking-wider text-blue-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>FECHA DE SORTEO: 19 DE NOVIEMBRE DE 2026</span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08]">
                  SORTEO{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-400">
                    PLAYSTATION 5 SLIM + GTA
                  </span>
                </h1>

                <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
                  Potenciá tu PC y consola al máximo con nuestras guías técnicas de{" "}
                  <strong className="text-white">Red/FPS (&lt;10ms)</strong>,{" "}
                  <strong className="text-white">Monitores 120Hz/144Hz</strong> y el{" "}
                  <strong className="text-white">Catálogo Completo de Trucos GTA</strong>. Con cada
                  pack recibís números aleatorios únicos de 5 cifras (<code className="text-emerald-400 font-mono">00000</code> a{" "}
                  <code className="text-emerald-400 font-mono">99999</code>) al instante.
                </p>

                {/* Botones de Acción Principal y Vista Previa Gratuita */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
                  <a
                    href="#catalogo-packs"
                    id="btn-hero-comprar"
                    className="inline-flex items-center justify-center px-6 py-4 rounded-xl bg-gradient-to-r from-[#00439C] via-blue-600 to-violet-600 hover:from-blue-600 hover:to-violet-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-600/30 border border-blue-400/30 transition-all"
                  >
                    Elegir mi Pack Gamer y Participar
                  </a>

                  <a
                    href="/downloads/vista-previa-paquete-guias-gaming-pro.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    id="btn-hero-preview-pdf"
                    className="inline-flex items-center justify-center gap-2 px-5 py-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-emerald-400 border border-emerald-500/40 hover:border-emerald-400 font-semibold text-sm sm:text-base transition-all"
                  >
                    <span>📄</span>
                    <span>Descargar Vista Previa Gratuita (PDF)</span>
                  </a>
                </div>

                {/* Indicador en vivo del padrón de 100.000 números */}
                {poolStats && (
                  <div className="inline-flex flex-wrap items-center gap-4 px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs sm:text-sm text-slate-300">
                    <span>
                      Padrón Oficial:{" "}
                      <strong className="font-mono text-white">
                        {poolStats.total_tickets.toLocaleString("es-AR")}
                      </strong>{" "}
                      números
                    </span>
                    <span className="text-slate-600">|</span>
                    <span>
                      Disponibles:{" "}
                      <strong className="font-mono text-emerald-400">
                        {poolStats.available_tickets.toLocaleString("es-AR")}
                      </strong>
                    </span>
                    <span className="text-slate-600">|</span>
                    <span>
                      Asignados:{" "}
                      <strong className="font-mono text-violet-400">
                        {poolStats.assigned_tickets.toLocaleString("es-AR")}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Columna derecha Hero: Tarjeta del Premio + Contador Regresivo */}
              <div className="lg:col-span-5">
                <div className="rounded-2xl bg-gradient-to-b from-slate-900 via-[#091530] to-slate-900 border border-blue-500/40 p-6 sm:p-8 shadow-2xl shadow-blue-950/60">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold block">
                        PREMIO MAYOR OFICIAL
                      </span>
                      <h2 className="text-xl font-extrabold text-white mt-0.5">
                        PlayStation 5 Slim + GTA
                      </h2>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-violet-500/20 border border-violet-400/40 text-violet-300 font-mono text-xs font-bold">
                      19 NOV 2026
                    </span>
                  </div>

                  {/* Contador regresivo en vivo */}
                  <p className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
                    Tiempo restante para el sorteo:
                  </p>
                  <div
                    id="countdown-timer"
                    className="grid grid-cols-4 gap-2.5 sm:gap-3 text-center mb-6"
                  >
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-blue-500/30">
                      <span className="font-mono text-2xl sm:text-3xl font-extrabold text-blue-400 block">
                        {String(countdown.days).padStart(2, "0")}
                      </span>
                      <span className="text-[11px] font-mono uppercase text-slate-400">Días</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-blue-500/30">
                      <span className="font-mono text-2xl sm:text-3xl font-extrabold text-emerald-400 block">
                        {String(countdown.hours).padStart(2, "0")}
                      </span>
                      <span className="text-[11px] font-mono uppercase text-slate-400">Horas</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-blue-500/30">
                      <span className="font-mono text-2xl sm:text-3xl font-extrabold text-violet-400 block">
                        {String(countdown.minutes).padStart(2, "0")}
                      </span>
                      <span className="text-[11px] font-mono uppercase text-slate-400">Min</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/90 border border-blue-500/30">
                      <span className="font-mono text-2xl sm:text-3xl font-extrabold text-white block">
                        {String(countdown.seconds).padStart(2, "0")}
                      </span>
                      <span className="text-[11px] font-mono uppercase text-slate-400">Seg</span>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs sm:text-sm text-slate-300 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Consola incluida:</span>
                      <span className="font-semibold text-white">PS5 Slim (Nueva en Caja)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Juego incluido:</span>
                      <span className="font-semibold text-emerald-400">Edición GTA</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Asignación de números:</span>
                      <span className="font-mono text-blue-300">Automática e inmediata</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN DE PACKS GAMER + FORMULARIO DE CHECKOUT */}
        <section id="catalogo-packs" className="py-14 sm:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Columna izquierda: Las 3 Tarjetas de Packs actualizadas */}
            <div className="lg:col-span-7 space-y-5">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-blue-400 font-bold">
                  PASO 1 · SELECCIONÁ TU PACK DE GUÍAS GAMING PRO
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                  Elegí tu Pack y Sumá Chances para la PS5 Slim
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Descarga directa de los manuales en PDF al aprobarse el pago + asignación
                  instantánea de tus números de 5 cifras.
                </p>
              </div>

              <div className="space-y-4">
                {PACKS.map((pack) => {
                  const isSelected = selectedPack.id === pack.id;
                  return (
                    <div
                      key={pack.id}
                      id={`card-${pack.id}`}
                      onClick={() => setSelectedPack(pack)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setSelectedPack(pack);
                      }}
                      className={`cursor-pointer rounded-2xl p-6 transition-all border text-left ${
                        isSelected
                          ? "bg-slate-900 border-blue-500 shadow-xl shadow-blue-950/50 ring-2 ring-blue-500/80"
                          : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <span
                          className={`inline-block text-xs font-mono uppercase tracking-wider px-3 py-1 rounded-md bg-gradient-to-r ${pack.accent} text-white font-bold`}
                        >
                          {pack.badge}
                        </span>
                        <span className="text-xs font-mono text-emerald-400 font-semibold">
                          {pack.downloads.length}{" "}
                          {pack.downloads.length === 1 ? "Archivo PDF" : "Archivos PDF"} incluidos
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
                        <div>
                          <span className="text-xs uppercase font-mono text-slate-400 block">
                            {pack.name}
                          </span>
                          <h3 className="text-lg sm:text-xl font-bold text-white mt-0.5">
                            {pack.title}
                          </h3>
                        </div>
                        <div className="sm:text-right shrink-0">
                          <span className="font-mono text-2xl sm:text-3xl font-extrabold text-white">
                            ${pack.price.toLocaleString("es-AR")}{" "}
                            <span className="text-xs font-normal text-slate-400">ARS</span>
                          </span>
                          <span className="block text-xs font-mono text-emerald-400 font-bold mt-0.5">
                            +{pack.chances} chances (números de 5 cifras)
                          </span>
                        </div>
                      </div>

                      <ul className="mt-4 pt-4 border-t border-slate-800 space-y-2 text-sm text-slate-300">
                        {pack.topics.map((topic, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <span className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                            <span>{topic}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Columna derecha: Formulario de Checkout (POST /api/checkout) */}
            <div className="lg:col-span-5 bg-slate-900 rounded-2xl border border-blue-500/30 p-6 sm:p-8 shadow-xl sticky top-24">
              <div className="border-b border-slate-800 pb-4 mb-6">
                <span className="text-xs font-mono uppercase tracking-wider text-blue-400 font-bold">
                  PASO 2 · DATOS DEL PARTICIPANTE
                </span>
                <h2 className="text-2xl font-extrabold text-white mt-1">
                  Completar Orden y Recibir Números
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Tus números y tus manuales PDF quedan asociados a tu DNI y se envían a tu email.
                </p>
              </div>

              <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="input-dni"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
                  >
                    DNI (sin puntos) *
                  </label>
                  <input
                    id="input-dni"
                    type="text"
                    required
                    placeholder="Ej: 38123456"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="input-full-name"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
                  >
                    Nombre y Apellido Completo *
                  </label>
                  <input
                    id="input-full-name"
                    type="text"
                    required
                    placeholder="Ej: Martín Gómez"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="input-email"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
                    >
                      Correo Electrónico *
                    </label>
                    <input
                      id="input-email"
                      type="email"
                      required
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="input-whatsapp"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
                    >
                      WhatsApp *
                    </label>
                    <input
                      id="input-whatsapp"
                      type="tel"
                      required
                      placeholder="+54 9 11 2345 6789"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Resumen del pack seleccionado */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 mt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-white">{selectedPack.name}</span>
                    <span className="font-mono font-extrabold text-blue-400">
                      ${selectedPack.price.toLocaleString("es-AR")} ARS
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{selectedPack.title}</p>
                  <div className="flex items-center justify-between text-xs text-slate-300 mt-2 pt-2 border-t border-slate-800/80">
                    <span>Chances a asignar:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {selectedPack.chances} números de 5 cifras
                    </span>
                  </div>
                </div>

                {checkoutError && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/40 text-xs text-red-300 font-medium"
                  >
                    {checkoutError}
                  </div>
                )}

                <button
                  id="btn-submit-checkout"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 px-5 rounded-xl bg-gradient-to-r from-[#00439C] via-blue-600 to-violet-600 hover:from-blue-600 hover:to-violet-500 text-white font-bold text-sm transition-all shadow-lg shadow-blue-900/40 disabled:opacity-50"
                >
                  {isSubmitting
                    ? "Generando Preferencia en Mercado Pago..."
                    : `Pagar $${selectedPack.price.toLocaleString("es-AR")} ARS con Mercado Pago`}
                </button>
              </form>

              {/* Panel de confirmación de orden pending / Simulador Sandbox */}
              {createdOrder && (
                <div className="mt-6 pt-5 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono uppercase text-emerald-400 font-bold">
                      Orden #{createdOrder.order_id} registrada (pending)
                    </span>
                    <span className="font-mono text-slate-400">
                      Pref: {createdOrder.preference_id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    En modo local/pruebas podés simular la aprobación del pago en Mercado Pago para
                    asignar tus {createdOrder.chances} números y habilitar la descarga inmediata de
                    tus guías en PDF:
                  </p>
                  <button
                    id="btn-simulate-webhook"
                    type="button"
                    onClick={handleSimulateMercadoPagoWebhook}
                    disabled={isSimulatingWebhook}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold text-xs transition-colors"
                  >
                    {isSimulatingWebhook
                      ? "Procesando Pago y Asignando Tickets..."
                      : `Simular Pago Aprobado (+${createdOrder.chances} Tickets y Descargar PDFs)`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* SECCIÓN VERIFICADOR POR DNI (Sin texto técnico GET /API/TICKETS/{DNI}) */}
        <section
          id="seccion-consulta-dni"
          className="py-16 sm:py-20 bg-slate-900/50 border-t border-slate-800"
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="bg-slate-900 rounded-2xl border border-blue-500/30 p-6 sm:p-10 shadow-2xl">
              <div className="max-w-2xl">
                <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-bold">
                  VERIFICADOR OFICIAL DE PARTICIPACIÓN Y DESCARGAS
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                  Consultá tus Números Asignados y Descargá tus Guías PDF
                </h2>
                <p className="text-sm text-slate-400 mt-1.5">
                  Ingresá tu DNI sin puntos para ver tus números de 5 cifras participantes del
                  sorteo del 19 de noviembre de 2026 y acceder a los manuales PDF de tu pack.
                </p>
              </div>

              <form
                onSubmit={handleLookupSubmit}
                className="mt-6 flex flex-col sm:flex-row gap-3"
              >
                <input
                  id="input-lookup-dni"
                  type="text"
                  placeholder="Ingresá tu DNI sin puntos (ej: 40555888)"
                  value={lookupDni}
                  onChange={(e) => setLookupDni(e.target.value)}
                  className="flex-1 px-4 py-3.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  id="btn-lookup-dni"
                  type="submit"
                  disabled={lookupLoading}
                  className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#00439C] to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white font-bold text-sm transition-all shrink-0 disabled:opacity-50"
                >
                  {lookupLoading ? "Verificando..." : "Consultar por DNI"}
                </button>
              </form>

              {lookupError && (
                <div className="mt-4 p-3.5 rounded-xl bg-red-950/80 border border-red-500/40 text-xs text-red-300 font-medium">
                  {lookupError}
                </div>
              )}

              {lookupResult && (
                <div id="lookup-results-container" className="mt-8 pt-6 border-t border-slate-800">
                  {lookupResult.total_tickets === 0 ? (
                    <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 text-center">
                      <p className="text-sm font-semibold text-slate-200">
                        No se encontraron órdenes aprobadas para el DNI{" "}
                        <strong className="font-mono text-blue-400">{lookupResult.dni}</strong>.
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Si acabás de realizar el pago, aguardá unos instantes a que se confirme la
                        transacción.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Cabecera del comprador */}
                      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                        <div>
                          <p className="text-xs text-slate-400 uppercase font-mono">
                            Participante Verificado
                          </p>
                          <p className="text-base font-bold text-white">
                            {lookupResult.full_name} · DNI {lookupResult.dni}
                          </p>
                        </div>
                        <span className="px-3.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono text-xs font-bold">
                          {lookupResult.total_tickets} Chances Activas
                        </span>
                      </div>

                      {/* Archivos PDF correspondientes al Pack Comprado */}
                      <div className="p-5 rounded-xl bg-slate-950 border border-blue-500/30 space-y-3">
                        <h3 className="text-xs font-mono uppercase tracking-wider text-blue-400 font-bold">
                          Tus Guías Gaming Pro en PDF Listas para Descargar (
                          {lookupResult.downloads.length}):
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {lookupResult.downloads.map((pdfUrl) => (
                            <a
                              key={pdfUrl}
                              href={pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900 hover:bg-blue-950/60 border border-slate-700 hover:border-blue-400 transition-all group"
                            >
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-white group-hover:text-blue-300 block truncate">
                                  {PDF_DISPLAY_NAMES[pdfUrl] || pdfUrl.split("/").pop()}
                                </span>
                                <span className="text-[11px] font-mono text-slate-400 block truncate">
                                  {pdfUrl}
                                </span>
                              </div>
                              <span className="px-2.5 py-1 rounded-md bg-blue-600 text-white text-xs font-mono font-bold shrink-0">
                                PDF ⬇
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>

                      {/* Números asignados */}
                      <div>
                        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
                          Tus Números Promocionales de 5 Cifras (Sorteo 19/11/2026):
                        </h3>
                        <div className="flex flex-wrap gap-3">
                          {lookupResult.numbers.map((num) => (
                            <div key={num} className="ticket-stub flex items-center gap-2">
                              <span className="text-emerald-400 font-mono text-xs font-bold">
                                N°
                              </span>
                              <span className="font-mono text-lg font-extrabold tracking-widest text-white">
                                {num}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Historial de órdenes aprobadas */}
                      <div className="space-y-3 pt-2">
                        <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                          Detalle de Órdenes Aprobadas
                        </h4>
                        {lookupResult.orders.map((ord) => (
                          <div
                            key={ord.order_id}
                            className="p-4 rounded-xl border border-slate-800 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
                            <div>
                              <span className="font-mono font-bold text-blue-400">
                                Orden #{ord.order_id}
                              </span>{" "}
                              · <span className="font-semibold text-white">{ord.pack_title}</span>
                              {ord.mp_payment_id && (
                                <span className="block text-slate-400 font-mono mt-0.5">
                                  Pago MP: {ord.mp_payment_id}
                                </span>
                              )}
                            </div>
                            <div className="sm:text-right font-mono">
                              <span className="inline-block px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                                {ord.status.toUpperCase()}
                              </span>
                              <span className="block text-slate-300 mt-1">
                                ${ord.amount.toLocaleString("es-AR")} ARS · {ord.tickets.length}{" "}
                                chances · {ord.downloads.length} PDF(s)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950 py-8 text-center text-xs text-slate-400">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-bold text-slate-200">
            SORTEO PLAYSTATION 5 SLIM + GTA · Fecha de sorteo: 19 de noviembre de 2026
          </p>
          <p>
            Pagos procesados con Mercado Pago Checkout Pro · Asignación atómica PostgreSQL
          </p>
        </div>
      </footer>
    </div>
  );
}

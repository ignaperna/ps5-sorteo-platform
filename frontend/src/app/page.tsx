"use client";

import React, { useState, useEffect } from "react";

interface PackOption {
  id: "pack_1" | "pack_2" | "pack_3";
  title: string;
  ebook_title: string;
  chances: number;
  price: number;
  badge: string;
  pages: string;
  topics: string[];
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
}

interface LookupResult {
  dni: string;
  full_name?: string | null;
  total_tickets: number;
  numbers: string[];
  orders: OrderSummary[];
}

const PACKS: PackOption[] = [
  {
    id: "pack_1",
    title: "Pack Inicial",
    ebook_title: "Manual de Optimización & Productividad Digital (PDF)",
    chances: 2,
    price: 5000,
    badge: "Acceso Inmediato",
    pages: "118 páginas · Edición 2026",
    topics: [
      "Sistemas prácticos de organización personal",
      "Plantillas descargables listas para usar",
      "2 números promocionales de 5 dígitos ('00000' a '99999')",
    ],
  },
  {
    id: "pack_2",
    title: "Pack Impulso",
    ebook_title: "Colección Maestra: Finanzas Personales & Automatización (2 PDFs)",
    chances: 6,
    price: 12000,
    badge: "Más Elegido",
    pages: "260 páginas · 2 Volúmenes PDF",
    topics: [
      "Guía de planificación patrimonial y presupuestos",
      "Automatización de flujos de trabajo sin código",
      "6 números promocionales de 5 dígitos ('00000' a '99999')",
    ],
  },
  {
    id: "pack_3",
    title: "Pack Pro",
    ebook_title: "Biblioteca Integral de Negocios Digitales (5 PDFs + Anexos)",
    chances: 15,
    price: 25000,
    badge: "Mejor Valor · x3 Chances",
    pages: "540 páginas · Colección Completa",
    topics: [
      "Los 5 volúmenes completos en alta definición (PDF)",
      "Acceso vitalicio a actualizaciones de la edición",
      "15 números promocionales de 5 dígitos ('00000' a '99999')",
    ],
  },
];

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

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        setPoolStats(data);
      }
    } catch {
      // Silencioso en caso de carga inicial
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

      // Si el init_point es una URL real de Mercado Pago, redirigimos automáticamente
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

      // Actualizar estadísticas y consultar automáticamente los tickets asignados al DNI
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
    <div className="min-h-screen flex flex-col">
      {/* Barra superior informativa */}
      <header className="border-b border-stone-300/80 bg-[#F7F5F0]/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-ink text-ivory font-serif font-bold text-lg">
              E
            </span>
            <div>
              <span className="font-serif font-bold text-lg tracking-tight text-ink block leading-none">
                Editorial & Sorteo Oficial
              </span>
              <span className="text-xs text-stone-600">
                Infoproductos PDF + Números de 5 cifras
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-4 sm:gap-6 text-sm font-medium">
            <a
              href="#catalogo-packs"
              id="nav-link-packs"
              className="text-stone-700 hover:text-ink transition-colors"
            >
              Packs eBooks
            </a>
            <a
              href="#seccion-consulta-dni"
              id="nav-link-consulta"
              className="px-3.5 py-2 rounded-lg bg-stone-200/80 hover:bg-stone-300/80 text-ink transition-colors font-semibold"
            >
              Consultar mis Números (DNI)
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Editorial + Explicación clara */}
        <section className="py-12 sm:py-16 border-b border-stone-300/70">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="max-w-3xl">
              <p className="text-xs font-mono uppercase tracking-widest text-amber-800 font-semibold mb-3">
                EDICIÓN DIGITAL DESCARGABLE · SERIE 00000 AL 99999
              </p>
              <h1 className="font-serif text-3xl sm:text-5xl font-bold text-ink tracking-tight leading-[1.12] mb-5">
                Adquirí nuestras guías en PDF y recibí tus números promocionales al instante.
              </h1>
              <p className="text-base sm:text-lg text-stone-700 leading-relaxed mb-6">
                Con cada pack de eBooks recibís por correo electrónico el enlace de descarga directa
                en formato PDF junto con tus números aleatorios de 5 cifras asignados de forma única
                mediante Mercado Pago Checkout Pro.
              </p>

              {poolStats && (
                <div className="inline-flex flex-wrap items-center gap-4 px-4 py-2.5 rounded-xl bg-sand border border-stone-300 text-xs sm:text-sm text-stone-800">
                  <span>
                    <strong className="font-mono text-ink">
                      {poolStats.total_tickets.toLocaleString("es-AR")}
                    </strong>{" "}
                    números totales en padrón (00000–99999)
                  </span>
                  <span className="text-stone-400">|</span>
                  <span>
                    Disponibles:{" "}
                    <strong className="font-mono text-emerald-800">
                      {poolStats.available_tickets.toLocaleString("es-AR")}
                    </strong>
                  </span>
                  <span className="text-stone-400">|</span>
                  <span>
                    Asignados:{" "}
                    <strong className="font-mono text-amber-900">
                      {poolStats.assigned_tickets.toLocaleString("es-AR")}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Selección de Pack + Checkout */}
        <section id="catalogo-packs" className="py-12 sm:py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Columna izquierda: Los 3 Packs de eBooks */}
            <div className="lg:col-span-7 space-y-5">
              <div>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink">
                  1. Elegí tu Pack de Lectura Digital
                </h2>
                <p className="text-sm text-stone-600 mt-1">
                  Seleccioná la edición que deseás descargar. Los números promocionales se asignan
                  automáticamente apenas se aprueba el pago.
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
                          ? "bg-white border-ink shadow-md ring-2 ring-ink"
                          : "bg-white/70 border-stone-300 hover:border-stone-500 hover:bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <span className="inline-block text-xs font-mono uppercase tracking-wider px-2.5 py-1 rounded-md bg-stone-900 text-ivory font-semibold">
                          {pack.badge}
                        </span>
                        <span className="text-xs font-mono text-stone-600">{pack.pages}</span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mt-3">
                        <div>
                          <h3 className="font-serif text-xl font-bold text-ink">{pack.title}</h3>
                          <p className="text-sm font-medium text-stone-700 mt-0.5">
                            {pack.ebook_title}
                          </p>
                        </div>
                        <div className="sm:text-right shrink-0">
                          <span className="font-mono text-2xl font-bold text-ink">
                            ${pack.price.toLocaleString("es-AR")}
                          </span>
                          <span className="block text-xs font-mono text-amber-800 font-semibold">
                            Incluye {pack.chances} chances
                          </span>
                        </div>
                      </div>

                      <ul className="mt-4 pt-4 border-t border-stone-200 space-y-1.5 text-sm text-stone-700">
                        {pack.topics.map((topic, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-700 shrink-0" />
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
            <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-300 p-6 sm:p-8 shadow-sm sticky top-24">
              <div className="border-b border-stone-200 pb-4 mb-6">
                <span className="text-xs font-mono uppercase tracking-wider text-stone-500">
                  PASO 2 · DATOS DEL COMPRADOR
                </span>
                <h2 className="font-serif text-2xl font-bold text-ink mt-1">
                  Completar Orden y Pagar
                </h2>
                <p className="text-xs text-stone-600 mt-1">
                  Tus números quedarán vinculados a tu DNI y se enviarán junto al PDF a tu email.
                </p>
              </div>

              <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="input-dni"
                    className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5"
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
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF9F6] text-ink font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ink"
                  />
                </div>

                <div>
                  <label
                    htmlFor="input-full-name"
                    className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5"
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
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF9F6] text-ink text-sm focus:outline-none focus:ring-2 focus:ring-ink"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="input-email"
                      className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5"
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
                      className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF9F6] text-ink text-sm focus:outline-none focus:ring-2 focus:ring-ink"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="input-whatsapp"
                      className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5"
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
                      className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-[#FAF9F6] text-ink font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ink"
                    />
                  </div>
                </div>

                {/* Resumen del pack seleccionado */}
                <div className="p-4 rounded-xl bg-sand/70 border border-stone-300/80 mt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-ink">{selectedPack.title}</span>
                    <span className="font-mono font-bold text-ink">
                      ${selectedPack.price.toLocaleString("es-AR")} ARS
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-stone-600 mt-1">
                    <span>Chances promocionales a asignar:</span>
                    <span className="font-mono font-semibold text-amber-900">
                      {selectedPack.chances} números de 5 cifras
                    </span>
                  </div>
                </div>

                {checkoutError && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 font-medium"
                  >
                    {checkoutError}
                  </div>
                )}

                <button
                  id="btn-submit-checkout"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-5 rounded-xl bg-ink hover:bg-charcoal text-ivory font-semibold text-sm transition-colors disabled:opacity-50"
                >
                  {isSubmitting
                    ? "Generando Preferencia en Mercado Pago..."
                    : `Pagar $${selectedPack.price.toLocaleString("es-AR")} con Mercado Pago`}
                </button>
              </form>

              {/* Panel de confirmación de orden pending / Simulador Sandbox */}
              {createdOrder && (
                <div className="mt-6 pt-5 border-t border-stone-200 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono uppercase text-amber-800 font-bold">
                      Orden #{createdOrder.order_id} creada (Estado: pending)
                    </span>
                    <span className="font-mono text-stone-500">
                      Pref: {createdOrder.preference_id}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    En producción el comprador completa el pago en Mercado Pago Checkout Pro y
                    nuestro endpoint <code className="font-mono text-ink">/api/webhook/mp</code>{" "}
                    asigna los {createdOrder.chances} tickets con{" "}
                    <code className="font-mono text-ink">FOR UPDATE SKIP LOCKED</code>.
                  </p>
                  <button
                    id="btn-simulate-webhook"
                    type="button"
                    onClick={handleSimulateMercadoPagoWebhook}
                    disabled={isSimulatingWebhook}
                    className="w-full py-2.5 px-4 rounded-lg bg-amber-800 hover:bg-amber-900 text-white font-semibold text-xs transition-colors"
                  >
                    {isSimulatingWebhook
                      ? "Procesando Webhook y Asignando Tickets..."
                      : `Simular Pago Aprobado en Webhook MP (+${createdOrder.chances} Tickets)`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Sección de Consulta de Números por DNI (GET /api/tickets/{dni}) */}
        <section
          id="seccion-consulta-dni"
          className="py-14 sm:py-20 bg-sand/60 border-t border-stone-300"
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="bg-white rounded-2xl border border-stone-300 p-6 sm:p-10 shadow-sm">
              <div className="max-w-2xl">
                <span className="text-xs font-mono uppercase tracking-widest text-amber-800 font-semibold">
                  VERIFICACIÓN EN TIEMPO REAL · GET /api/tickets/&#123;dni&#125;
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink mt-1">
                  Consultá tus Números Asignados por DNI
                </h2>
                <p className="text-sm text-stone-600 mt-1.5">
                  Ingresá tu número de documento para ver todas tus órdenes aprobadas, descargar tu
                  eBook en PDF y verificar tus números de 5 dígitos.
                </p>
              </div>

              <form
                onSubmit={handleLookupSubmit}
                className="mt-6 flex flex-col sm:flex-row gap-3"
              >
                <input
                  id="input-lookup-dni"
                  type="text"
                  placeholder="Ingresá tu DNI sin puntos (ej: 38123456)"
                  value={lookupDni}
                  onChange={(e) => setLookupDni(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl border border-stone-300 bg-[#FAF9F6] text-ink font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ink"
                />
                <button
                  id="btn-lookup-dni"
                  type="submit"
                  disabled={lookupLoading}
                  className="px-6 py-3 rounded-xl bg-ink hover:bg-charcoal text-ivory font-semibold text-sm transition-colors shrink-0 disabled:opacity-50"
                >
                  {lookupLoading ? "Buscando..." : "Consultar Números"}
                </button>
              </form>

              {lookupError && (
                <div className="mt-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 font-medium">
                  {lookupError}
                </div>
              )}

              {lookupResult && (
                <div id="lookup-results-container" className="mt-8 pt-6 border-t border-stone-200">
                  {lookupResult.total_tickets === 0 ? (
                    <div className="p-6 rounded-xl bg-stone-100 text-center">
                      <p className="text-sm font-medium text-stone-800">
                        No se encontraron órdenes aprobadas para el DNI{" "}
                        <strong className="font-mono">{lookupResult.dni}</strong>.
                      </p>
                      <p className="text-xs text-stone-600 mt-1">
                        Si acabás de realizar el pago, aguardá unos segundos a que se procese la
                        notificación de Mercado Pago.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-4 bg-stone-100 p-4 rounded-xl border border-stone-200">
                        <div>
                          <p className="text-xs text-stone-500 uppercase font-mono">
                            Titular Registrado
                          </p>
                          <p className="text-base font-bold text-ink">
                            {lookupResult.full_name} · DNI {lookupResult.dni}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1.5 rounded-lg bg-emerald-900 text-white font-mono text-xs font-bold">
                            {lookupResult.total_tickets} Chances Activas
                          </span>
                          <a
                            id="link-download-ebook"
                            href="/api/downloads/ebook-edicion-2026.pdf"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-1.5 rounded-lg bg-ink text-ivory text-xs font-semibold hover:bg-charcoal transition-colors"
                          >
                            Descargar PDF
                          </a>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-xs font-mono uppercase tracking-wider text-stone-600 mb-3">
                          Tus Números Promocionales de 5 Cifras:
                        </h3>
                        <div className="flex flex-wrap gap-3">
                          {lookupResult.numbers.map((num) => (
                            <div key={num} className="ticket-stub flex items-center gap-2">
                              <span className="text-amber-400 font-mono text-xs">N°</span>
                              <span className="font-mono text-lg font-bold tracking-widest">
                                {num}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Detalle por orden */}
                      <div className="space-y-3 pt-2">
                        <h4 className="text-xs font-mono uppercase tracking-wider text-stone-500">
                          Historial de Órdenes Aprobadas
                        </h4>
                        {lookupResult.orders.map((ord) => (
                          <div
                            key={ord.order_id}
                            className="p-4 rounded-xl border border-stone-200 bg-[#FAF9F6] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <span className="font-mono font-bold text-ink">
                                Orden #{ord.order_id}
                              </span>{" "}
                              · <span className="font-medium text-stone-800">{ord.pack_title}</span>
                              {ord.mp_payment_id && (
                                <span className="block text-stone-500 font-mono mt-0.5">
                                  ID Pago MP: {ord.mp_payment_id}
                                </span>
                              )}
                            </div>
                            <div className="sm:text-right font-mono">
                              <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-semibold">
                                {ord.status.toUpperCase()}
                              </span>
                              <span className="block text-stone-600 mt-1">
                                ${ord.amount.toLocaleString("es-AR")} ARS ({ord.tickets.length}{" "}
                                tickets)
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

      <footer className="border-t border-stone-300 py-8 text-center text-xs text-stone-600">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-serif font-semibold text-ink">
            Editorial & Sorteo Oficial — Plataforma de Infoproductos
          </p>
          <p>
            Pagos procesados de forma segura con Mercado Pago Checkout Pro · Asignación atómica PostgreSQL
          </p>
        </div>
      </footer>
    </div>
  );
}

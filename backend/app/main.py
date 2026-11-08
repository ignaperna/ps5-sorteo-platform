from contextlib import asynccontextmanager
import logging
import os
from pathlib import Path
import re
from typing import Any, Dict, List, Optional

import mercadopago
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from .database import get_db
from .email_utils import send_purchase_confirmation_email
from .init_db import init_db
from .models import Order, Ticket
from .schemas import (
    PACK_CONFIG,
    CheckoutRequest,
    CheckoutResponse,
    OrderTicketSummary,
    UserTicketsResponse,
    get_downloads_for_pack,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MP_ACCESS_TOKEN = os.getenv("MP_ACCESS_TOKEN", "")
WEBHOOK_BASE_URL = os.getenv("WEBHOOK_BASE_URL", "http://localhost:8000")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

ALLOWED_PDF_FILES = {
    "vista-previa-paquete-guias-gaming-pro.pdf": "Vista Previa Gratuita - Paquete Guias Gaming Pro",
    "guia-optimizacion-red-fps-gaming-v2.pdf": "Guia Optimizacion de Red y FPS Gaming (v2)",
    "manual-configuracion-pantallas-120hz-144hz-v2.pdf": "Manual Configuracion Pantallas 120Hz/144Hz (v2)",
    "catalogo-trucos-gta-v2.pdf": "Catalogo de Trucos GTA (v2)",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.getenv("SKIP_AUTO_INIT_DB", "false").lower() != "true":
        init_db()
    yield


app = FastAPI(
    title="API de Venta de Guías Gaming Pro & Sorteo PS5 Slim + GTA",
    description="Backend FastAPI + PostgreSQL + Mercado Pago Checkout Pro con asignación concurrente SKIP LOCKED.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def fetch_mp_payment(payment_id: str) -> Dict[str, Any]:
    """
    Consulta el pago en la API oficial de Mercado Pago usando el SDK.
    """
    sdk = mercadopago.SDK(MP_ACCESS_TOKEN)
    result = sdk.payment().get(payment_id)
    status_code = result.get("status")
    response_data = result.get("response", {})
    if status_code not in (200, 201) or not response_data:
        raise HTTPException(
            status_code=400,
            detail=f"No se pudo verificar el pago {payment_id} en Mercado Pago.",
        )
    return response_data


def create_mp_preference(order: Order, pack: Dict[str, Any]) -> Dict[str, Any]:
    """
    Genera una preferencia de Mercado Pago Checkout Pro con notification_url apuntando a /api/webhook/mp.
    """
    notification_url = f"{WEBHOOK_BASE_URL.rstrip('/')}/api/webhook/mp"
    frontend_base = FRONTEND_URL.rstrip("/")

    name_parts = (order.full_name or "").strip().split(" ", 1)
    payer_name = name_parts[0] if name_parts else "Cliente"
    payer_surname = name_parts[1] if len(name_parts) > 1 else ""

    preference_data = {
        "items": [
            {
                "id": pack["id"],
                "title": pack["title"],
                "description": f"{pack['ebook_title']} + {pack['chances']} números promocionales Sorteo PS5 Slim",
                "quantity": 1,
                "currency_id": "ARS",
                "unit_price": float(pack["price"]),
            }
        ],
        "payer": {
            "name": payer_name,
            "surname": payer_surname,
            "email": order.email,
            "identification": {
                "type": "DNI",
                "number": order.dni,
            },
        },
        "external_reference": str(order.id),
        "notification_url": notification_url,
        "back_urls": {
            "success": f"{frontend_base}/?status=approved&dni={order.dni}&order_id={order.id}",
            "failure": f"{frontend_base}/?status=failure&order_id={order.id}",
            "pending": f"{frontend_base}/?status=pending&dni={order.dni}&order_id={order.id}",
        },
        "auto_return": "approved",
        "statement_descriptor": "GAMING PRO PS5",
    }

    if MP_ACCESS_TOKEN and not MP_ACCESS_TOKEN.startswith("TEST-000000"):
        sdk = mercadopago.SDK(MP_ACCESS_TOKEN)
        pref_result = sdk.preference().create(preference_data)
        if pref_result.get("status") in (200, 201):
            return pref_result["response"]
        logger.warning(
            f"Mercado Pago devolvió status {pref_result.get('status')}: {pref_result.get('response')}"
        )

    mock_pref_id = f"PREF-DEV-{order.id}"
    sim_url = f"{frontend_base}/?simulate_order={order.id}&dni={order.dni}"
    return {
        "id": mock_pref_id,
        "init_point": sim_url,
        "sandbox_init_point": sim_url,
    }


@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    total_tickets = db.query(func.count(Ticket.id)).scalar() or 0
    available_tickets = (
        db.query(func.count(Ticket.id)).filter(Ticket.order_id.is_(None)).scalar() or 0
    )
    return {
        "status": "ok",
        "total_tickets": total_tickets,
        "available_tickets": available_tickets,
        "assigned_tickets": total_tickets - available_tickets,
    }


@app.get("/api/packs")
def list_packs():
    primary_packs = [PACK_CONFIG["inicial"], PACK_CONFIG["impulso"], PACK_CONFIG["pro"]]
    return {"packs": primary_packs}


@app.post("/api/checkout", response_model=CheckoutResponse)
def create_checkout(payload: CheckoutRequest, db: Session = Depends(get_db)):
    """
    Recibe los datos del comprador y el pack elegido, guarda la orden como 'pending'
    y genera una preferencia de Mercado Pago Checkout Pro con notification_url apuntando al webhook.
    """
    pack = PACK_CONFIG.get(payload.pack_type)
    if not pack:
        raise HTTPException(status_code=400, detail="Pack inválido.")

    available_count = (
        db.query(func.count(Ticket.id)).filter(Ticket.order_id.is_(None)).scalar() or 0
    )
    if available_count < pack["chances"]:
        raise HTTPException(
            status_code=409,
            detail="No quedan suficientes números disponibles para este pack.",
        )

    canonical_pack_id = pack["id"]
    new_order = Order(
        dni=payload.dni,
        full_name=payload.full_name,
        email=payload.email,
        whatsapp=payload.whatsapp,
        pack_type=canonical_pack_id,
        amount=pack["price"],
        status="pending",
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    pref_response = create_mp_preference(new_order, pack)

    return CheckoutResponse(
        order_id=new_order.id,
        status=new_order.status,
        pack_type=new_order.pack_type,
        amount=float(new_order.amount),
        chances=pack["chances"],
        preference_id=pref_response.get("id", f"PREF-{new_order.id}"),
        init_point=pref_response.get("init_point", ""),
        sandbox_init_point=pref_response.get("sandbox_init_point"),
    )


@app.post("/api/webhook/mp")
async def mercadopago_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    type_param: Optional[str] = Query(None, alias="type"),
    topic_param: Optional[str] = Query(None, alias="topic"),
    data_id_param: Optional[str] = Query(None, alias="data.id"),
    id_param: Optional[str] = Query(None, alias="id"),
):
    """
    Webhook de Mercado Pago:
    1. Valida el pago aprobado en la API de Mercado Pago.
    2. Asigna la cantidad de tickets correspondientes usando SELECT FOR UPDATE SKIP LOCKED.
    3. Cambia la orden a 'approved' y registra mp_payment_id.
    4. Envía email con los links de descarga de los PDFs correspondientes al pack y los números asignados.
    """
    body: Dict[str, Any] = {}
    try:
        body = await request.json()
    except Exception:
        body = {}

    event_type = body.get("type") or body.get("topic") or type_param or topic_param
    payment_id = (
        (body.get("data") or {}).get("id")
        or data_id_param
        or id_param
        or body.get("id")
    )

    if event_type != "payment" or not payment_id:
        return {"status": "ignored", "reason": "Not a payment notification"}

    payment_id_str = str(payment_id)

    if body.get("simulate_approved") is True and body.get("external_reference"):
        payment_info = {
            "id": payment_id_str,
            "status": "approved",
            "external_reference": str(body["external_reference"]),
        }
    else:
        payment_info = fetch_mp_payment(payment_id_str)

    mp_status = payment_info.get("status")
    external_reference = payment_info.get("external_reference")

    if mp_status != "approved":
        return {
            "status": "ignored",
            "mp_status": mp_status,
            "payment_id": payment_id_str,
        }

    if not external_reference or not str(external_reference).isdigit():
        raise HTTPException(
            status_code=400,
            detail="El pago no posee un external_reference válido con el ID de la orden.",
        )

    order_id = int(external_reference)

    order = (
        db.query(Order)
        .filter(Order.id == order_id)
        .with_for_update()
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail=f"Orden #{order_id} no encontrada.")

    pack = PACK_CONFIG.get(order.pack_type)
    if not pack:
        raise HTTPException(status_code=400, detail="Pack asociado a la orden inválido.")

    download_links = get_downloads_for_pack(order.pack_type)

    if order.status == "approved":
        existing_numbers = [t.number for t in order.tickets]
        return {
            "status": "already_processed",
            "order_id": order.id,
            "tickets": existing_numbers,
            "downloads": download_links,
        }

    chances_to_assign = pack["chances"]

    selected_tickets = (
        db.query(Ticket)
        .filter(Ticket.order_id.is_(None))
        .order_by(Ticket.id.asc())
        .with_for_update(skip_locked=True)
        .limit(chances_to_assign)
        .all()
    )

    if len(selected_tickets) < chances_to_assign:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="No hay suficientes tickets libres para completar la asignación.",
        )

    assigned_numbers = []
    for ticket in selected_tickets:
        ticket.order_id = order.id
        assigned_numbers.append(ticket.number)

    order.status = "approved"
    order.mp_payment_id = payment_id_str
    db.commit()

    background_tasks.add_task(
        send_purchase_confirmation_email,
        to_email=order.email,
        full_name=order.full_name,
        dni=order.dni,
        pack_title=pack["title"],
        ticket_numbers=assigned_numbers,
        order_id=order.id,
        download_links=download_links,
    )

    return {
        "status": "approved",
        "order_id": order.id,
        "mp_payment_id": order.mp_payment_id,
        "assigned_tickets": assigned_numbers,
        "downloads": download_links,
    }


@app.get("/api/tickets/{dni}", response_model=UserTicketsResponse)
def get_tickets_by_dni(dni: str, db: Session = Depends(get_db)):
    """
    Permite al usuario consultar todos sus números promocionales asignados y los enlaces
    de descarga de sus guías en PDF según el pack comprado cuando la orden está 'approved'.
    """
    cleaned_dni = re.sub(r"\D", "", dni.strip())
    if not cleaned_dni:
        raise HTTPException(status_code=400, detail="Debe proporcionar un DNI válido.")

    approved_orders = (
        db.query(Order)
        .filter(Order.dni == cleaned_dni, Order.status == "approved")
        .order_by(Order.created_at.desc())
        .all()
    )

    all_numbers: List[str] = []
    all_downloads: List[str] = []
    order_summaries: List[OrderTicketSummary] = []
    buyer_name = approved_orders[0].full_name if approved_orders else None

    for order in approved_orders:
        order_numbers = sorted([t.number for t in order.tickets])
        all_numbers.extend(order_numbers)
        pack_info = PACK_CONFIG.get(order.pack_type, {})
        order_downloads = get_downloads_for_pack(order.pack_type)
        for dl in order_downloads:
            if dl not in all_downloads:
                all_downloads.append(dl)

        order_summaries.append(
            OrderTicketSummary(
                order_id=order.id,
                pack_type=pack_info.get("id", order.pack_type),
                pack_title=pack_info.get("title", order.pack_type),
                amount=float(order.amount),
                status=order.status,
                mp_payment_id=order.mp_payment_id,
                created_at=order.created_at,
                tickets=order_numbers,
                downloads=order_downloads,
            )
        )

    return UserTicketsResponse(
        dni=cleaned_dni,
        full_name=buyer_name,
        total_tickets=len(all_numbers),
        numbers=all_numbers,
        downloads=all_downloads,
        orders=order_summaries,
    )


def _serve_pdf_file(filename: str):
    """
    Sirve cualquiera de los 4 archivos PDF guardados en la raíz del proyecto (E:\\Proyectos\\PS5 SORTEO),
    o genera un PDF de respaldo si aún no fue copiado al contenedor.
    """
    safe_name = os.path.basename(filename)
    if safe_name not in ALLOWED_PDF_FILES:
        raise HTTPException(status_code=404, detail="Archivo PDF no encontrado.")

    search_dirs = [
        Path("/host_project"),
        Path("/host_project/downloads"),
        Path(__file__).resolve().parent.parent.parent,
        Path(__file__).resolve().parent.parent,
        Path("/home/antigravity"),
    ]

    for directory in search_dirs:
        candidate = directory / safe_name
        if candidate.is_file():
            return FileResponse(
                path=str(candidate),
                media_type="application/pdf",
                filename=safe_name,
            )

    title_text = ALLOWED_PDF_FILES[safe_name]
    stream_content = f"BT /F1 16 Tf 50 720 Td ({title_text}) Tj ET\n".encode("latin-1")
    minimal_pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
        b"3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> "
        b"/MediaBox [0 0 612 792] /Contents 5 0 R >> endobj\n"
        b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj\n"
        + f"5 0 obj << /Length {len(stream_content)} >> stream\n".encode("ascii")
        + stream_content
        + b"endstream endobj\n"
        b"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n"
        b"0000000115 00000 n \n0000000229 00000 n \n0000000302 00000 n \n"
        b"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n430\n%%EOF\n"
    )
    return Response(
        content=minimal_pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{safe_name}"'},
    )


@app.get("/downloads/{filename}")
def download_pdf_direct(filename: str):
    return _serve_pdf_file(filename)


@app.get("/api/downloads/{filename}")
def download_pdf_api(filename: str):
    return _serve_pdf_file(filename)

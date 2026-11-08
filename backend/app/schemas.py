from datetime import datetime
from typing import List, Optional, Literal
from pydantic import BaseModel, EmailStr, Field, field_validator
import re

PACK_DOWNLOADS = {
    "inicial": [
        "/downloads/guia-optimizacion-red-fps-gaming-v2.pdf",
    ],
    "impulso": [
        "/downloads/guia-optimizacion-red-fps-gaming-v2.pdf",
        "/downloads/manual-configuracion-pantallas-120hz-144hz-v2.pdf",
    ],
    "pro": [
        "/downloads/guia-optimizacion-red-fps-gaming-v2.pdf",
        "/downloads/manual-configuracion-pantallas-120hz-144hz-v2.pdf",
        "/downloads/catalogo-trucos-gta-v2.pdf",
    ],
}

PACK_CONFIG = {
    "inicial": {
        "id": "inicial",
        "name": "Pack Inicial",
        "title": "Guía Optimización de Red y FPS Gaming (v2)",
        "ebook_title": "Guía Optimización de Red y FPS Gaming (v2)",
        "chances": 2,
        "price": 5000.00,
        "badge": "Pack Inicial · 2 Chances",
        "downloads": PACK_DOWNLOADS["inicial"],
    },
    "impulso": {
        "id": "impulso",
        "name": "Pack Impulso",
        "title": "Pack Rendimiento: FPS + Manual Pantallas 120Hz/144Hz (v2)",
        "ebook_title": "Pack Rendimiento: FPS + Manual Pantallas 120Hz/144Hz (v2)",
        "chances": 6,
        "price": 10000.00,
        "badge": "Más Elegido · 6 Chances",
        "downloads": PACK_DOWNLOADS["impulso"],
    },
    "pro": {
        "id": "pro",
        "name": "Pack Pro",
        "title": "Trilogía Gamer Pro + Catálogo Trucos GTA (v2)",
        "ebook_title": "Trilogía Gamer Pro + Catálogo Trucos GTA (v2)",
        "chances": 15,
        "price": 20000.00,
        "badge": "Mejor Valor · 15 Chances",
        "downloads": PACK_DOWNLOADS["pro"],
    },
    # Alias de compatibilidad hacia atrás
    "pack_1": {
        "id": "inicial",
        "name": "Pack Inicial",
        "title": "Guía Optimización de Red y FPS Gaming (v2)",
        "ebook_title": "Guía Optimización de Red y FPS Gaming (v2)",
        "chances": 2,
        "price": 5000.00,
        "badge": "Pack Inicial · 2 Chances",
        "downloads": PACK_DOWNLOADS["inicial"],
    },
    "pack_2": {
        "id": "impulso",
        "name": "Pack Impulso",
        "title": "Pack Rendimiento: FPS + Manual Pantallas 120Hz/144Hz (v2)",
        "ebook_title": "Pack Rendimiento: FPS + Manual Pantallas 120Hz/144Hz (v2)",
        "chances": 6,
        "price": 10000.00,
        "badge": "Más Elegido · 6 Chances",
        "downloads": PACK_DOWNLOADS["impulso"],
    },
    "pack_3": {
        "id": "pro",
        "name": "Pack Pro",
        "title": "Trilogía Gamer Pro + Catálogo Trucos GTA (v2)",
        "ebook_title": "Trilogía Gamer Pro + Catálogo Trucos GTA (v2)",
        "chances": 15,
        "price": 20000.00,
        "badge": "Mejor Valor · 15 Chances",
        "downloads": PACK_DOWNLOADS["pro"],
    },
}


def get_downloads_for_pack(pack_type: str) -> List[str]:
    normalized = (pack_type or "").strip().lower()
    if normalized in PACK_CONFIG:
        return list(PACK_CONFIG[normalized]["downloads"])
    return list(PACK_DOWNLOADS["inicial"])


class CheckoutRequest(BaseModel):
    dni: str = Field(..., min_length=6, max_length=15, description="DNI del comprador sin puntos")
    full_name: str = Field(..., min_length=3, max_length=150, description="Nombre y apellido completo")
    email: EmailStr = Field(..., description="Correo electrónico donde recibirá los PDFs y sus números")
    whatsapp: str = Field(..., min_length=8, max_length=25, description="Número de WhatsApp de contacto")
    pack_type: Literal["inicial", "impulso", "pro", "pack_1", "pack_2", "pack_3"] = Field(
        ..., description="Identificador del pack elegido"
    )

    @field_validator("dni")
    @classmethod
    def clean_dni(cls, v: str) -> str:
        cleaned = re.sub(r"\D", "", v.strip())
        if len(cleaned) < 6 or len(cleaned) > 12:
            raise ValueError("El DNI debe contener entre 6 y 12 dígitos numéricos.")
        return cleaned

    @field_validator("full_name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        return " ".join(v.strip().split())


class CheckoutResponse(BaseModel):
    order_id: int
    status: str
    pack_type: str
    amount: float
    chances: int
    preference_id: str
    init_point: str
    sandbox_init_point: Optional[str] = None


class OrderTicketSummary(BaseModel):
    order_id: int
    pack_type: str
    pack_title: str
    amount: float
    status: str
    mp_payment_id: Optional[str] = None
    created_at: datetime
    tickets: List[str]
    downloads: List[str]


class UserTicketsResponse(BaseModel):
    dni: str
    full_name: Optional[str] = None
    total_tickets: int
    numbers: List[str]
    downloads: List[str]
    orders: List[OrderTicketSummary]

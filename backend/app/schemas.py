from datetime import datetime
from typing import List, Optional, Literal
from pydantic import BaseModel, EmailStr, Field, field_validator
import re

PACK_CONFIG = {
    "pack_1": {
        "id": "pack_1",
        "title": "Pack Inicial — Guía Digital + 2 Chances",
        "ebook_title": "Manual de Optimización & Productividad Digital (Edición 2026)",
        "chances": 2,
        "price": 5000.00,
        "badge": "Acceso Inmediato",
    },
    "pack_2": {
        "id": "pack_2",
        "title": "Pack Impulso — Colección 2 eBooks + 6 Chances",
        "ebook_title": "Colección Maestra: Finanzas Personales & Automatización",
        "chances": 6,
        "price": 12000.00,
        "badge": "Más Elegido",
    },
    "pack_3": {
        "id": "pack_3",
        "title": "Pack Pro — Biblioteca Completa + 15 Chances",
        "ebook_title": "Biblioteca Integral de Negocios Digitales (5 PDFs + Plantillas)",
        "chances": 15,
        "price": 25000.00,
        "badge": "Mejor Valor (x3 Chances)",
    },
}


class CheckoutRequest(BaseModel):
    dni: str = Field(..., min_length=6, max_length=15, description="DNI del comprador sin puntos")
    full_name: str = Field(..., min_length=3, max_length=150, description="Nombre y apellido completo")
    email: EmailStr = Field(..., description="Correo electrónico donde recibirá el PDF y sus números")
    whatsapp: str = Field(..., min_length=8, max_length=25, description="Número de WhatsApp de contacto")
    pack_type: Literal["pack_1", "pack_2", "pack_3"] = Field(..., description="Identificador del pack elegido")

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


class UserTicketsResponse(BaseModel):
    dni: str
    full_name: Optional[str] = None
    total_tickets: int
    numbers: List[str]
    orders: List[OrderTicketSummary]

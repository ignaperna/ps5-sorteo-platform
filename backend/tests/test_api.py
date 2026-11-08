import os
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///./test_sorteo.db"
os.environ["SKIP_AUTO_INIT_DB"] = "true"

from fastapi.testclient import TestClient
from app.database import Base, engine, SessionLocal
from app.init_db import init_db
from app.main import app
from app.models import Order, Ticket

client = TestClient(app)


def setup_module(module):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    # Inicializamos los 100.000 tickets en orden aleatorio
    inserted = init_db(100_000)
    assert inserted == 100_000


def teardown_module(module):
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_sorteo.db"):
        os.remove("./test_sorteo.db")


def test_init_db_100k_random_tickets():
    db = SessionLocal()
    try:
        total = db.query(Ticket).count()
        assert total == 100_000

        # Verificar que no se dupliquen si se vuelve a ejecutar init_db()
        second_run = init_db(100_000)
        assert second_run == 0

        # Verificar que los primeros 20 tickets no sean secuenciales ('00000'..'00019')
        first_20 = [t.number for t in db.query(Ticket).order_by(Ticket.id.asc()).limit(20).all()]
        sequential_20 = [f"{i:05d}" for i in range(20)]
        assert first_20 != sequential_20
        assert all(len(num) == 5 and num.isdigit() for num in first_20)
    finally:
        db.close()


def test_checkout_and_webhook_and_get_tickets():
    # 1. Crear orden pendiente en POST /api/checkout
    with patch("app.main.create_mp_preference") as mock_pref:
        mock_pref.return_value = {
            "id": "PREF-123456",
            "init_point": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=PREF-123456",
            "sandbox_init_point": "https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=PREF-123456",
        }
        res = client.post(
            "/api/checkout",
            json={
                "dni": "38.123.456",
                "full_name": "Juan Pérez",
                "email": "juan.perez@example.com",
                "whatsapp": "+5491122334455",
                "pack_type": "pack_2",
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "pending"
        assert data["chances"] == 6
        assert data["amount"] == 12000.0
        order_id = data["order_id"]

    # 2. Procesar webhook de Mercado Pago en POST /api/webhook/mp
    with patch("app.main.fetch_mp_payment") as mock_mp_get, patch(
        "app.main.send_purchase_confirmation_email"
    ) as mock_email:
        mock_mp_get.return_value = {
            "id": "9988776655",
            "status": "approved",
            "external_reference": str(order_id),
        }
        mock_email.return_value = True

        webhook_res = client.post(
            "/api/webhook/mp",
            json={"type": "payment", "data": {"id": "9988776655"}},
        )
        assert webhook_res.status_code == 200
        w_data = webhook_res.json()
        assert w_data["status"] == "approved"
        assert w_data["order_id"] == order_id
        assert len(w_data["assigned_tickets"]) == 6
        assert mock_email.called

        # Verificar idempotencia ante segundo webhook idéntico
        dup_res = client.post(
            "/api/webhook/mp",
            json={"type": "payment", "data": {"id": "9988776655"}},
        )
        assert dup_res.status_code == 200
        assert dup_res.json()["status"] == "already_processed"

    # 3. Consultar tickets por DNI en GET /api/tickets/{dni}
    tickets_res = client.get("/api/tickets/38123456")
    assert tickets_res.status_code == 200
    t_data = tickets_res.json()
    assert t_data["dni"] == "38123456"
    assert t_data["total_tickets"] == 6
    assert len(t_data["numbers"]) == 6
    assert len(t_data["orders"]) == 1
    assert t_data["orders"][0]["status"] == "approved"

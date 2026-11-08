import os
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///./test_sorteo.db"
os.environ["SKIP_AUTO_INIT_DB"] = "true"

from fastapi.testclient import TestClient
from app.database import Base, engine, SessionLocal
from app.init_db import init_db
from app.main import app
from app.models import Ticket

client = TestClient(app)


def setup_module(module):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
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

        second_run = init_db(100_000)
        assert second_run == 0

        first_20 = [t.number for t in db.query(Ticket).order_by(Ticket.id.asc()).limit(20).all()]
        sequential_20 = [f"{i:05d}" for i in range(20)]
        assert first_20 != sequential_20
        assert all(len(num) == 5 and num.isdigit() for num in first_20)
    finally:
        db.close()


def test_packs_and_downloads_in_verifier_and_email():
    expected_packs = [
        (
            "inicial",
            "35111222",
            5000.0,
            2,
            ["/downloads/guia-optimizacion-red-fps-gaming-v2.pdf"],
        ),
        (
            "impulso",
            "38123456",
            10000.0,
            6,
            [
                "/downloads/guia-optimizacion-red-fps-gaming-v2.pdf",
                "/downloads/manual-configuracion-pantallas-120hz-144hz-v2.pdf",
            ],
        ),
        (
            "pro",
            "42999888",
            20000.0,
            15,
            [
                "/downloads/guia-optimizacion-red-fps-gaming-v2.pdf",
                "/downloads/manual-configuracion-pantallas-120hz-144hz-v2.pdf",
                "/downloads/catalogo-trucos-gta-v2.pdf",
            ],
        ),
    ]

    for pack_type, dni, expected_amount, expected_chances, expected_downloads in expected_packs:
        with patch("app.main.create_mp_preference") as mock_pref:
            mock_pref.return_value = {
                "id": f"PREF-{pack_type}",
                "init_point": f"https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=PREF-{pack_type}",
            }
            res = client.post(
                "/api/checkout",
                json={
                    "dni": dni,
                    "full_name": f"Gamer {pack_type}",
                    "email": f"{pack_type}@example.com",
                    "whatsapp": "+5491122334455",
                    "pack_type": pack_type,
                },
            )
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "pending"
            assert data["pack_type"] == pack_type
            assert data["chances"] == expected_chances
            assert data["amount"] == expected_amount
            order_id = data["order_id"]

        with patch("app.main.fetch_mp_payment") as mock_mp_get, patch(
            "app.main.send_purchase_confirmation_email"
        ) as mock_email:
            mock_mp_get.return_value = {
                "id": f"PAY-{order_id}",
                "status": "approved",
                "external_reference": str(order_id),
            }
            mock_email.return_value = True

            webhook_res = client.post(
                "/api/webhook/mp",
                json={"type": "payment", "data": {"id": f"PAY-{order_id}"}},
            )
            assert webhook_res.status_code == 200
            w_data = webhook_res.json()
            assert w_data["status"] == "approved"
            assert len(w_data["assigned_tickets"]) == expected_chances
            assert w_data["downloads"] == expected_downloads
            assert mock_email.called
            _, kwargs = mock_email.call_args
            assert kwargs["download_links"] == expected_downloads

        tickets_res = client.get(f"/api/tickets/{dni}")
        assert tickets_res.status_code == 200
        t_data = tickets_res.json()
        assert t_data["dni"] == dni
        assert t_data["total_tickets"] == expected_chances
        assert t_data["downloads"] == expected_downloads
        assert t_data["orders"][0]["downloads"] == expected_downloads


def test_pdf_download_routes():
    for pdf_name in [
        "vista-previa-paquete-guias-gaming-pro.pdf",
        "guia-optimizacion-red-fps-gaming-v2.pdf",
        "manual-configuracion-pantallas-120hz-144hz-v2.pdf",
        "catalogo-trucos-gta-v2.pdf",
    ]:
        res = client.get(f"/downloads/{pdf_name}")
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"

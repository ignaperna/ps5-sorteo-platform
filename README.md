# Plataforma de Venta de Infoproductos (eBooks/PDFs) + Sorteo Promocional

Plataforma web full-stack dockerizada para la venta de eBooks descargables con asignación automática y concurrente de números promocionales de 5 cifras (`00000` a `99999`) integrada con **Mercado Pago Checkout Pro**.

## Arquitectura y Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS (`/frontend`)
- **Backend**: FastAPI (Python 3.11) + SQLAlchemy 2.0 + SDK oficial de Mercado Pago (`/backend`)
- **Base de Datos**: PostgreSQL 15 (`orders` y `tickets` con bloqueo pesimista `SELECT ... FOR UPDATE SKIP LOCKED`)
- **Infraestructura**: `docker-compose.yml` orquestando `db`, `backend` y `frontend`

---

## Cumplimiento de Requerimientos

1. **Modelo de Base de Datos (`backend/app/models.py`)**:
   - Tabla `orders`: `id`, `dni`, `full_name`, `email`, `whatsapp`, `pack_type`, `amount`, `mp_payment_id`, `status`, `created_at`.
   - Tabla `tickets`: `id`, `number` (5 dígitos `'00000'` a `'99999'`, `UNIQUE`), `order_id` (`FK` hacia `orders.id`).
2. **Script de Inicialización (`backend/app/init_db.py`)**:
   - Verifica si la tabla `tickets` está vacía y, en ese caso, genera los **100.000 números** (`'00000'` a `'99999'`), los mezcla aleatoriamente con `random.shuffle()` y los inserta por lotes.
3. **Endpoint `POST /api/checkout` (`backend/app/main.py`)**:
   - Recibe los datos del comprador y el pack elegido (`pack_1`, `pack_2`, `pack_3`), guarda la orden con `status='pending'` y genera una preferencia de **Mercado Pago Checkout Pro** con `external_reference=str(order.id)` y `notification_url` apuntando a `/api/webhook/mp`.
4. **Endpoint `POST /api/webhook/mp` (`backend/app/main.py`)**:
   - Valida el pago aprobado (`status == 'approved'`) directamente contra la API de Mercado Pago, asigna la cantidad de tickets del pack usando `with_for_update(skip_locked=True)` (`SELECT ... FOR UPDATE SKIP LOCKED` en PostgreSQL), actualiza la orden a `'approved'` y dispara el envío de un correo electrónico (`backend/app/email_utils.py`) con el link del PDF y los números asignados.
5. **Endpoint `GET /api/tickets/{dni}` (`backend/app/main.py`)**:
   - Permite consultar desde la web todos los números de 5 cifras asignados a las órdenes aprobadas de un comprador ingresando su DNI.

---

## Ejecución con Docker Compose

1. Copiar el archivo de variables de entorno y completar las credenciales de Mercado Pago y SMTP:
   ```bash
   cp .env.example .env
   ```
2. Levantar todos los servicios:
   ```bash
   docker compose up --build
   ```
   - **Frontend Web**: `http://localhost:3000`
   - **API Backend / Docs OpenAPI**: `http://localhost:8000/docs`
   - **PostgreSQL**: `localhost:5432`

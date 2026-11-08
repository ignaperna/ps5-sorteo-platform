import logging
import os
import smtplib
from email.message import EmailMessage
from typing import List

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER or "no-reply@sorteoebooks.com")
EBOOK_PDF_URL = os.getenv(
    "EBOOK_PDF_URL",
    "http://localhost:8000/api/downloads/ebook-edicion-2026.pdf",
)


def send_purchase_confirmation_email(
    to_email: str,
    full_name: str,
    dni: str,
    pack_title: str,
    ticket_numbers: List[str],
    order_id: int,
) -> bool:
    """
    Envía un correo electrónico al comprador con el enlace de descarga del eBook/PDF
    y la lista de números promocionales de 5 dígitos asignados.
    """
    formatted_numbers = ", ".join(ticket_numbers)
    badges_html = "".join(
        f'<span style="display:inline-block;margin:6px;padding:10px 16px;'
        f'background:#111827;color:#f9fafb;font-family:monospace;font-size:18px;'
        f'font-weight:700;letter-spacing:2px;border-radius:8px;border:1px solid #374151;">'
        f"#{num}</span>"
        for num in ticket_numbers
    )

    msg = EmailMessage()
    msg["Subject"] = f"Tu eBook + Tus Números Asignados (Orden #{order_id})"
    msg["From"] = SMTP_FROM
    msg["To"] = to_email

    text_body = (
        f"Hola {full_name} (DNI {dni}),\n\n"
        f"¡Tu pago fue aprobado con éxito! Gracias por adquirir: {pack_title}.\n\n"
        f"1) Descargá tu eBook/PDF aquí:\n{EBOOK_PDF_URL}\n\n"
        f"2) Tus números promocionales de 5 dígitos para el sorteo ({len(ticket_numbers)} chances):\n"
        f"{formatted_numbers}\n\n"
        f"Podés consultar tus números en cualquier momento desde la web ingresando tu DNI ({dni}).\n"
    )
    msg.set_content(text_body)

    html_body = f"""
    <!DOCTYPE html>
    <html lang="es">
      <body style="margin:0;padding:24px;background-color:#f4f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;">
          <p style="margin:0 0 8px 0;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#6b7280;font-weight:600;">
            Confirmación de Compra · Orden #{order_id}
          </p>
          <h1 style="margin:0 0 16px 0;font-size:24px;color:#111827;">
            ¡Gracias por tu compra, {full_name}!
          </h1>
          <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#374151;">
            Tu pago para <strong>{pack_title}</strong> fue validado. A continuación encontrás el acceso directo a tu material descargable en PDF y tus números promocionales asignados para el sorteo.
          </p>

          <div style="margin:24px 0;padding:20px;background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0 0 12px 0;font-size:14px;color:#4b5563;">Tu infoproducto está listo para descargar:</p>
            <a href="{EBOOK_PDF_URL}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;border-radius:8px;font-size:15px;">
              Descargar eBook (PDF)
            </a>
          </div>

          <div style="margin:28px 0;">
            <h2 style="margin:0 0 12px 0;font-size:16px;color:#111827;">
              Tus Números Promocionales Asignados ({len(ticket_numbers)} chances)
            </h2>
            <div style="padding:16px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;text-align:center;">
              {badges_html}
            </div>
          </div>

          <p style="margin:24px 0 0 0;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px;">
            DNI registrado: <strong>{dni}</strong> · Podés volver a consultar tus números en nuestra web ingresando tu DNI.
          </p>
        </div>
      </body>
    </html>
    """
    msg.add_alternative(html_body, subtype="html")

    if not SMTP_USER or not SMTP_PASSWORD or "tu-correo" in SMTP_USER:
        logger.info(
            f"[MODO DEV - EMAIL SIMULADO] Para: {to_email} | Orden #{order_id} | "
            f"PDF: {EBOOK_PDF_URL} | Tickets asignados: {formatted_numbers}"
        )
        return True

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        logger.info(f"Email enviado exitosamente a {to_email} para la orden #{order_id}.")
        return True
    except Exception as exc:
        logger.error(f"Error enviando email a {to_email} (Orden #{order_id}): {exc}")
        return False

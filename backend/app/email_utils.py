import logging
import os
import smtplib
from email.message import EmailMessage
from typing import List, Optional

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER or "no-reply@sorteops5gaming.com")
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", os.getenv("FRONTEND_URL", "http://localhost:3000"))

PDF_LABELS = {
    "/downloads/guia-optimizacion-red-fps-gaming-v2.pdf": "Guía Optimización de Red y FPS Gaming (v2)",
    "/downloads/manual-configuracion-pantallas-120hz-144hz-v2.pdf": "Manual Configuración Pantallas 120Hz/144Hz (v2)",
    "/downloads/catalogo-trucos-gta-v2.pdf": "Catálogo de Trucos GTA (v2)",
    "/downloads/vista-previa-paquete-guias-gaming-pro.pdf": "Vista Previa Paquete Guías Gaming Pro",
}


def _resolve_full_url(path: str) -> str:
    if path.startswith("http://") or path.startswith("https://"):
        return path
    return f"{PUBLIC_BASE_URL.rstrip('/')}/{path.lstrip('/')}"


def send_purchase_confirmation_email(
    to_email: str,
    full_name: str,
    dni: str,
    pack_title: str,
    ticket_numbers: List[str],
    order_id: int,
    download_links: Optional[List[str]] = None,
) -> bool:
    """
    Envía un correo electrónico al comprador con los enlaces de descarga de los PDFs
    correspondientes a su pack y la lista de números promocionales de 5 dígitos asignados.
    """
    links = download_links or ["/downloads/guia-optimizacion-red-fps-gaming-v2.pdf"]
    formatted_numbers = ", ".join(ticket_numbers)

    text_links = "\n".join(
        f" - {PDF_LABELS.get(link, link)}: {_resolve_full_url(link)}"
        for link in links
    )

    buttons_html = "".join(
        f'<div style="margin:10px 0;">'
        f'<a href="{_resolve_full_url(link)}" style="display:inline-block;width:90%;max-width:420px;padding:12px 20px;'
        f'background:#00439C;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;'
        f'font-size:14px;border:1px solid #3b82f6;">'
        f'⬇ Descargar {PDF_LABELS.get(link, os.path.basename(link))} (PDF)'
        f"</a></div>"
        for link in links
    )

    badges_html = "".join(
        f'<span style="display:inline-block;margin:6px;padding:10px 16px;'
        f'background:#0f172a;color:#34d399;font-family:monospace;font-size:18px;'
        f'font-weight:700;letter-spacing:2px;border-radius:8px;border:1px solid #10b981;">'
        f"#{num}</span>"
        for num in ticket_numbers
    )

    msg = EmailMessage()
    msg["Subject"] = f"Tus Guías Gaming Pro + Tus Números Sorteo PS5 Slim (Orden #{order_id})"
    msg["From"] = SMTP_FROM
    msg["To"] = to_email

    text_body = (
        f"Hola {full_name} (DNI {dni}),\n\n"
        f"¡Tu pago fue aprobado con éxito! Gracias por adquirir: {pack_title}.\n\n"
        f"1) Descargá tus manuales en PDF aquí:\n{text_links}\n\n"
        f"2) Tus números promocionales de 5 dígitos para el SORTEO PLAYSTATION 5 SLIM + GTA ({len(ticket_numbers)} chances):\n"
        f"{formatted_numbers}\n\n"
        f"Fecha del sorteo: 19 de noviembre de 2026.\n"
        f"Podés consultar tus números y descargar tus archivos en cualquier momento desde la web ingresando tu DNI ({dni}).\n"
    )
    msg.set_content(text_body)

    html_body = f"""
    <!DOCTYPE html>
    <html lang="es">
      <body style="margin:0;padding:24px;background-color:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f8fafc;">
        <div style="max-width:600px;margin:0 auto;background:#0f172a;border:1px solid #1e293b;border-radius:14px;padding:32px;">
          <p style="margin:0 0 8px 0;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#38bdf8;font-weight:700;">
            SORTEO PLAYSTATION 5 SLIM + GTA · ORDEN #{order_id}
          </p>
          <h1 style="margin:0 0 16px 0;font-size:24px;color:#ffffff;">
            ¡Pago confirmado, {full_name}!
          </h1>
          <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#cbd5e1;">
            Tu compra de <strong>{pack_title}</strong> fue validada exitosamente. A continuación tenés los enlaces de descarga directa de tus manuales en PDF y tus números asignados para el sorteo del <strong>19 de noviembre de 2026</strong>.
          </p>

          <div style="margin:24px 0;padding:20px;background:#020617;border-radius:12px;border:1px solid #1e293b;text-align:center;">
            <p style="margin:0 0 12px 0;font-size:14px;color:#94a3b8;font-weight:600;">
              Tus Archivos PDF Disponibles ({len(links)}):
            </p>
            {buttons_html}
          </div>

          <div style="margin:28px 0;">
            <h2 style="margin:0 0 12px 0;font-size:16px;color:#f8fafc;">
              Tus Números Promocionales Asignados ({len(ticket_numbers)} chances)
            </h2>
            <div style="padding:16px;background:#020617;border:1px dashed #334155;border-radius:10px;text-align:center;">
              {badges_html}
            </div>
          </div>

          <p style="margin:24px 0 0 0;font-size:13px;color:#64748b;border-top:1px solid #1e293b;padding-top:16px;">
            DNI registrado: <strong style="color:#e2e8f0;">{dni}</strong> · Podés volver a consultar tus números y enlaces en nuestra web ingresando tu DNI.
          </p>
        </div>
      </body>
    </html>
    """
    msg.add_alternative(html_body, subtype="html")

    if not SMTP_USER or not SMTP_PASSWORD or "tu-correo" in SMTP_USER:
        logger.info(
            f"[MODO DEV - EMAIL SIMULADO] Para: {to_email} | Orden #{order_id} | "
            f"PDFs: {links} | Tickets asignados: {formatted_numbers}"
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

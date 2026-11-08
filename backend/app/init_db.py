import logging
import random
from sqlalchemy import func, insert
from .database import engine, SessionLocal, Base
from .models import Ticket

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TOTAL_TICKETS = 100_000
BATCH_SIZE = 10_000


def init_db(total_tickets: int = TOTAL_TICKETS) -> int:
    """
    Crea las tablas en la base de datos y puebla los 100.000 tickets ('00000' a '99999')
    en orden aleatorio si la tabla 'tickets' está vacía.
    Retorna la cantidad de tickets insertados (0 si ya estaba poblada).
    """
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        existing_count = db.query(func.count(Ticket.id)).scalar() or 0
        if existing_count > 0:
            logger.info(
                f"La tabla 'tickets' ya contiene {existing_count} registros. Se omite la inicialización."
            )
            return 0

        logger.info(
            f"Generando y mezclando {total_tickets} tickets ('00000' a '{total_tickets - 1:05d}') en orden aleatorio..."
        )
        numbers = [f"{i:05d}" for i in range(total_tickets)]
        random.shuffle(numbers)

        # Insertar en lotes para máxima velocidad en PostgreSQL
        for start in range(0, total_tickets, BATCH_SIZE):
            batch = [
                {"number": num, "order_id": None}
                for num in numbers[start : start + BATCH_SIZE]
            ]
            db.execute(insert(Ticket), batch)
            db.commit()
            logger.info(
                f"Insertados {min(start + BATCH_SIZE, total_tickets)}/{total_tickets} tickets..."
            )

        logger.info("Inicialización de los 100.000 tickets completada exitosamente.")
        return total_tickets
    except Exception as exc:
        db.rollback()
        logger.error(f"Error al inicializar la base de datos: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    init_db()

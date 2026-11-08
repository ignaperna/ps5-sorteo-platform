from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, DateTime, Index
from sqlalchemy.orm import relationship
from .database import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    dni = Column(String(20), nullable=False, index=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), nullable=False, index=True)
    whatsapp = Column(String(30), nullable=False)
    pack_type = Column(String(50), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    mp_payment_id = Column(String(100), nullable=True, unique=True, index=True)
    status = Column(String(30), nullable=False, default="pending", index=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    tickets = relationship("Ticket", back_populates="order", cascade="all, delete-orphan")


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    number = Column(String(5), unique=True, nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True)

    order = relationship("Order", back_populates="tickets")

    __table_args__ = (
        Index("ix_tickets_unassigned_id", "order_id", "id"),
    )

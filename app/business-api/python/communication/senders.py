"""STUB senders - no real email/WhatsApp provider is configured for this POC.

These always "succeed" and just log what would have been sent. This is the
integration point for a real provider later:
  - send_email_stub    -> replace with e.g. SendGrid/SES/Azure Communication Services
  - send_whatsapp_stub -> replace with e.g. Twilio/WhatsApp Business API

Communications are still recorded in the database regardless (see
gql/repository.py) so history/audit behavior is real even though delivery
is simulated.
"""
import logging

logger = logging.getLogger(__name__)


def send_email_stub(to: str, subject: str, body: str) -> bool:
    logger.info("[STUB EMAIL] to=%s subject=%s body=%s", to, subject, body[:100])
    return True


def send_whatsapp_stub(to: str, body: str) -> bool:
    logger.info("[STUB WHATSAPP] to=%s body=%s", to, body[:100])
    return True


def send_notification_stub(customer_id: str, body: str) -> bool:
    logger.info("[STUB NOTIFICATION] customer_id=%s body=%s", customer_id, body[:100])
    return True

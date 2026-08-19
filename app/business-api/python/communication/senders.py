"""Real senders - Gmail SMTP for email, Twilio WhatsApp Sandbox for WhatsApp.

Configuration (env vars):
  GMAIL_ADDRESS       - the Gmail account to send from
  GMAIL_APP_PASSWORD  - a Google Account App Password (not the regular password)
  TWILIO_ACCOUNT_SID  - from the Twilio console
  TWILIO_AUTH_TOKEN   - from the Twilio console
  TWILIO_WHATSAPP_FROM - the Twilio sandbox WhatsApp number, e.g. "whatsapp:+14155238886"

If a channel's env vars aren't set, that channel falls back to the old stub
behavior (logs only, always "succeeds") rather than failing outright - so
partial configuration (e.g. email only) doesn't break the other channel.

Communications are recorded in the database regardless (see gql/repository.py)
so history/audit behavior is real even for the stub fallback.
"""
import base64
import json
import logging
import os
import smtplib
import urllib.parse
import urllib.request
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

logger = logging.getLogger(__name__)


def send_email_stub(
    to: str,
    subject: str,
    body: str,
    attachment_base64: Optional[str] = None,
    attachment_filename: Optional[str] = None,
) -> bool:
    gmail_address = os.environ.get("GMAIL_ADDRESS")
    gmail_app_password = os.environ.get("GMAIL_APP_PASSWORD")

    if not gmail_address or not gmail_app_password:
        logger.info("[STUB EMAIL - no Gmail credentials configured] to=%s subject=%s body=%s", to, subject, body[:100])
        return True

    try:
        if attachment_base64 and attachment_filename:
            msg = MIMEMultipart()
            msg.attach(MIMEText(body))
            attachment = MIMEApplication(base64.b64decode(attachment_base64), _subtype="pdf")
            attachment.add_header("Content-Disposition", "attachment", filename=attachment_filename)
            msg.attach(attachment)
        else:
            msg = MIMEText(body)

        msg["Subject"] = subject
        msg["From"] = gmail_address
        msg["To"] = to

        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(gmail_address, gmail_app_password)
            server.sendmail(gmail_address, [to], msg.as_string())

        logger.info("[EMAIL SENT via Gmail] to=%s subject=%s attachment=%s", to, subject, attachment_filename or "none")
        return True
    except Exception:
        logger.exception("Failed to send email via Gmail SMTP to=%s", to)
        return False


def send_whatsapp_stub(to: str, body: str) -> bool:
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_number = os.environ.get("TWILIO_WHATSAPP_FROM")

    if not account_sid or not auth_token or not from_number:
        logger.info("[STUB WHATSAPP - no Twilio credentials configured] to=%s body=%s", to, body[:100])
        return True

    try:
        to_number = to if to.startswith("whatsapp:") else f"whatsapp:{to}"
        url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
        data = urllib.parse.urlencode({"From": from_number, "To": to_number, "Body": body}).encode()

        request = urllib.request.Request(url, data=data, method="POST")
        credentials = base64.b64encode(f"{account_sid}:{auth_token}".encode()).decode()
        request.add_header("Authorization", f"Basic {credentials}")
        request.add_header("Content-Type", "application/x-www-form-urlencoded")

        with urllib.request.urlopen(request, timeout=15) as response:
            result = json.loads(response.read())
            logger.info("[WHATSAPP SENT via Twilio] to=%s sid=%s", to, result.get("sid"))
            return True
    except Exception:
        logger.exception("Failed to send WhatsApp via Twilio to=%s", to)
        return False


def send_notification_stub(customer_id: str, body: str) -> bool:
    logger.info("[STUB NOTIFICATION] customer_id=%s body=%s", customer_id, body[:100])
    return True

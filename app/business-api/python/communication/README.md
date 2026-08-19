# Communication Service

Email, WhatsApp, and in-app notifications, plus a history log of what was sent.

IMPORTANT: no real email/WhatsApp provider is wired in for this POC (no
credentials available). `senders.py` contains clearly-labeled stub senders
that always "succeed" and log instead of actually delivering anything - this
is the integration point where a real provider (e.g. SendGrid for email,
Twilio for WhatsApp) would be plugged in later. Every send is still recorded
in the database regardless, so history/audit behavior is real even though
delivery is simulated.

Run locally:
```
uv sync
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/bankingassistant PROFILE=dev uv run python main.py
```

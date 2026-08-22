import uuid

import senders
import strawberry
from strawberry.types import Info

from gql import mappers
from gql.repository import CommunicationRepository
from gql.types import CommunicationType


def _new_id() -> str:
    return "COM" + uuid.uuid4().hex[:14].upper()


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def send_login_alert_email(
        self, info: Info, customer_id: str, recipient_email: str, device_info: str
    ) -> CommunicationType:
        """System-triggered login notification - sent directly, no AI/approval
        gate involved, since it's a security alert the user didn't ask for in
        the moment, not a financial action needing confirmation."""
        subject = "New sign-in to your SecureBank account"
        body = (
            f"We noticed a new sign-in to your SecureBank account.\n\n"
            f"Device/browser: {device_info}\n\n"
            f"If this was you, no action is needed. If you don't recognize this "
            f"sign-in, please contact support immediately."
        )
        success = senders.send_email_stub(recipient_email, subject, body)
        repo = CommunicationRepository(info.context["db_session"])
        comm = await repo.record_communication(
            comm_id=_new_id(), customer_id=customer_id, channel="email", body=body,
            status="sent" if success else "failed", recipient=recipient_email, subject=subject,
        )
        return mappers.orm_to_communication(comm)

from typing import Optional

import strawberry


@strawberry.type
class CommunicationType:
    id: str
    customerId: str
    channel: str
    recipient: Optional[str] = None
    subject: Optional[str] = None
    body: str
    status: str
    sentAt: Optional[str] = None

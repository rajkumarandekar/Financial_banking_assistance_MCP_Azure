from typing import Optional

import strawberry


@strawberry.type
class CustomerType:
    id: str
    email: str
    fullName: str
    phone: Optional[str] = None
    role: str

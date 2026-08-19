from db.models import CustomerORM
from gql.types import CustomerType


def orm_to_customer(row: CustomerORM) -> CustomerType:
    return CustomerType(
        id=str(row.id),
        email=row.email,
        fullName=row.full_name,
        phone=row.phone,
        role=row.role,
    )

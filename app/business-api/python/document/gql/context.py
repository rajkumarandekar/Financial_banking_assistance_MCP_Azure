from typing import Any, Dict

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db.base import get_session


async def get_context(db_session: AsyncSession = Depends(get_session)) -> Dict[str, Any]:
    return {"db_session": db_session}

"""
Pydantic models for user domain.
These mirror the user_profiles table columns that are safe to pass around internally.
"""
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

UserRole = Literal["admin", "tenant", "cleaning", "security"]


class UserProfile(BaseModel):
    id: UUID
    role: UserRole
    first_name: str
    last_name: str
    phone: str | None = None
    rfc: str | None = None
    is_active: bool = True

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

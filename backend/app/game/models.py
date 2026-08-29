from dataclasses import dataclass
from typing import Optional

from .enums import Shape, Color


@dataclass
class Secret:
    shape: Shape
    color: Color


@dataclass
class Player:
    id: str
    name: str
    secret: Secret

    # Private token used by the contestant's device
    # to identify the player without exposing their secret.
    token: str

    attempts_remaining: int = 2
    active: bool = True

    discovered_shape: Optional[Shape] = None
    discovered_color: Optional[Color] = None
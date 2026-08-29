from typing import Optional

from pydantic import BaseModel, Field

from app.game.enums import Shape, Color


# =========================================================
# PLAYER REGISTRATION
# =========================================================

class PlayerCreate(BaseModel):

    # -----------------------------------------------------
    # ONE-TIME GAME JOIN KEY
    # -----------------------------------------------------

    join_key: str = Field(
        min_length=8,
        max_length=8,
    )

    # -----------------------------------------------------
    # CONTESTANT NAME
    # -----------------------------------------------------

    name: str = Field(
        min_length=1,
        max_length=30,
    )

    # -----------------------------------------------------
    # SECRET COMBINATION
    # -----------------------------------------------------

    shape: Shape

    color: Color


# =========================================================
# PLAYER RESPONSE
# =========================================================

class PlayerResponse(BaseModel):

    id: str
    name: str
    token: str


# =========================================================
# PUBLIC PLAYER
# =========================================================

class PublicPlayerResponse(BaseModel):

    id: str

    name: str

    active: bool

    attempts_remaining: int


# =========================================================
# MAKE GUESS
# =========================================================

class GuessCreate(BaseModel):

    target_player_id: str

    shape: Shape

    color: Color


# =========================================================
# GUESS RESPONSE
# =========================================================

class GuessResponse(BaseModel):

    result: str

    message: str

    shape_correct: bool

    color_correct: bool

    attempts_remaining: Optional[int] = None

    guesser_eliminated: bool = False

    eliminated_player: Optional[str] = None

    secret: Optional[dict] = None

    target_information: Optional[dict] = None

    winner: Optional[dict] = None
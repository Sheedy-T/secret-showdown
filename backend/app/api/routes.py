from uuid import uuid4
from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    HTTPException,
    Header,
    Depends,
)

from app.api.host import router as host_router

from app.auth import require_host

from app.database import (
    supabase,
    supabase_admin,
)

from app.game.engine import GameEngine

from app.schemas.game import (
    PlayerCreate,
    PlayerResponse,
    PublicPlayerResponse,
    GuessCreate,
    GuessResponse,
)


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/api"
)

router.include_router(
    host_router
)


# =========================================================
# GAME ENGINE
# =========================================================

# The actual game state is currently handled by GameEngine.
#
# Supabase stores:
#
#   - game sessions
#   - contestant join keys
#
# The complete game state can later be moved into Supabase
# when we are ready for persistent/multi-instance gameplay.

game = GameEngine()


# =========================================================
# GAME INFORMATION
# =========================================================

@router.get("/game")
def get_game():
    """
    Return the current in-memory game status.
    """

    return game.get_game_status()


# =========================================================
# AVAILABLE COMBINATIONS
# =========================================================

@router.get("/combinations")
def get_combinations():
    """
    Return currently available shape/color combinations.
    """

    return {
        "combinations": game.get_available_combinations()
    }


# =========================================================
# CREATE PLAYER / CONTESTANT
# =========================================================

@router.post(
    "/players",
    response_model=PlayerResponse,
)
def create_player(
    player_data: PlayerCreate,
):
    """
    Register a contestant using a one-time join key.

    Registration flow:

        1. Validate the join key.
        2. Find an active game session.
        3. Make sure the key belongs to that session.
        4. Make sure the key has not already been used.
        5. Make sure registration is still open.
        6. Create the contestant in GameEngine.
        7. Mark the join key as used.
        8. Return the contestant token.

    IMPORTANT:

    Supabase database operations here use supabase_admin
    because the normal client may be restricted by RLS.

    The service-role key NEVER goes to the frontend.
    """

    # =====================================================
    # NORMALIZE JOIN KEY
    # =====================================================

    join_key = player_data.join_key.strip().upper()

    if not join_key:

        raise HTTPException(
            status_code=400,
            detail="A game join key is required.",
        )

    # =====================================================
    # FIND ACTIVE GAME SESSION
    # =====================================================

    try:

        session_response = (
            supabase_admin
            .table("game_sessions")
            .select(
                "id,host_id,status,created_at,started_at,ended_at"
            )
            .in_(
                "status",
                [
                    "WAITING",
                    "LIVE",
                ],
            )
            .order(
                "created_at",
                desc=True,
            )
            .limit(1)
            .execute()
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not retrieve the active game session: "
                f"{error}"
            ),
        )

    sessions = (
        session_response.data
        or []
    )

    # =====================================================
    # NO ACTIVE SESSION
    # =====================================================

    if not sessions:

        raise HTTPException(
            status_code=400,
            detail=(
                "There is currently no active game session. "
                "Please ask the host to create a game."
            ),
        )

    session = sessions[0]

    session_id = session["id"]

    # =====================================================
    # SESSION MUST ACCEPT REGISTRATION
    # =====================================================

    if session["status"] != "WAITING":

        raise HTTPException(
            status_code=400,
            detail=(
                "Contestant registration is closed for "
                "this game."
            ),
        )

    # =====================================================
    # FIND JOIN KEY
    # =====================================================

    try:

        key_response = (
            supabase_admin
            .table("game_join_keys")
            .select(
                "id,"
                "host_id,"
                "session_id,"
                "join_key,"
                "used,"
                "created_at,"
                "used_at,"
                "used_by_player_id"
            )
            .eq(
                "join_key",
                join_key,
            )
            .limit(1)
            .execute()
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not verify the game join key: "
                f"{error}"
            ),
        )

    keys = (
        key_response.data
        or []
    )

    # =====================================================
    # KEY DOES NOT EXIST
    # =====================================================

    if not keys:

        raise HTTPException(
            status_code=400,
            detail="Invalid game join key.",
        )

    join_key_record = keys[0]

    # =====================================================
    # KEY MUST BELONG TO CURRENT SESSION
    # =====================================================

    if (
        join_key_record["session_id"]
        != session_id
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "This join key belongs to a different "
                "game session."
            ),
        )

    # =====================================================
    # KEY MUST BELONG TO CURRENT HOST
    # =====================================================

    if (
        join_key_record["host_id"]
        != session["host_id"]
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "This join key does not belong to the "
                "current game."
            ),
        )

    # =====================================================
    # KEY MUST NOT ALREADY BE USED
    # =====================================================

    if join_key_record["used"]:

        raise HTTPException(
            status_code=400,
            detail=(
                "This join key has already been used. "
                "Please ask the host for another key."
            ),
        )

    # =====================================================
    # CREATE PLAYER IN GAME ENGINE
    # =====================================================

    player_id = str(
        uuid4()
    )

    try:

        player = game.add_player(
            player_id=player_id,
            name=player_data.name.strip(),
            shape=player_data.shape,
            color=player_data.color,
        )

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    # =====================================================
    # MARK JOIN KEY AS USED
    # =====================================================

    try:

        used_at = datetime.now(
            timezone.utc
        ).isoformat()

        update_response = (
            supabase_admin
            .table("game_join_keys")
            .update(
                {
                    "used": True,
                    "used_at": used_at,
                    "used_by_player_id": player.id,
                }
            )
            .eq(
                "id",
                join_key_record["id"],
            )
            .eq(
                "used",
                False,
            )
            .execute()
        )

    except Exception as error:

        # -------------------------------------------------
        # ROLLBACK IN-MEMORY PLAYER
        # -------------------------------------------------

        game.players.pop(
            player.id,
            None,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "The contestant could not be registered "
                "because the join key could not be consumed: "
                f"{error}"
            ),
        )

    # =====================================================
    # VERIFY KEY WAS ACTUALLY CONSUMED
    # =====================================================

    if not update_response.data:

        # Another request may have consumed the key between
        # our initial check and this update.

        game.players.pop(
            player.id,
            None,
        )

        raise HTTPException(
            status_code=400,
            detail=(
                "This join key has already been used. "
                "Please ask the host for another key."
            ),
        )

    # =====================================================
    # RETURN PLAYER TOKEN
    # =====================================================

    return PlayerResponse(
        id=player.id,
        name=player.name,
        token=player.token,
    )


# =========================================================
# GET PUBLIC PLAYERS
# =========================================================

@router.get(
    "/players",
    response_model=list[PublicPlayerResponse],
)
def get_players():
    """
    Return public contestant information.

    Secrets are never exposed here.
    """

    return [
        PublicPlayerResponse(
            id=player.id,
            name=player.name,
            active=player.active,
            attempts_remaining=player.attempts_remaining,
        )
        for player in game.players.values()
    ]


# =========================================================
# HOST ONLY — GET PLAYERS + SECRETS
# =========================================================

@router.get(
    "/host/players"
)
def get_host_players(
    _: bool = Depends(
        require_host
    ),
):
    """
    Return private contestant information.

    Only an approved host can access this endpoint.
    """

    return [
        {
            "id": player.id,

            "name": player.name,

            # -------------------------------------------------
            # PRIVATE SECRET
            # -------------------------------------------------

            "secret": {
                "shape": player.secret.shape.value,
                "color": player.secret.color.value,
            },

            "active": player.active,

            "attempts_remaining": (
                player.attempts_remaining
            ),

            "discovered": {
                "shape": (
                    player.discovered_shape.value
                    if player.discovered_shape
                    else None
                ),

                "color": (
                    player.discovered_color.value
                    if player.discovered_color
                    else None
                ),
            },
        }

        for player in game.players.values()
    ]


# =========================================================
# GET MY PLAYER INFORMATION
# =========================================================

@router.get(
    "/me"
)
def get_my_player(
    x_player_token: str = Header(...),
):
    """
    Return information about the currently authenticated
    contestant.
    """

    player = game.get_player_by_token(
        x_player_token
    )

    if player is None:

        raise HTTPException(
            status_code=401,
            detail="Invalid player token.",
        )

    return {
        "id": player.id,

        "name": player.name,

        "active": player.active,

        "attempts_remaining": (
            player.attempts_remaining
        ),

        "is_my_turn": (
            game.current_player_id
            == player.id
        ),
    }


# =========================================================
# MAKE GUESS
# =========================================================

@router.post(
    "/guess",
    response_model=GuessResponse,
)
def make_guess(
    guess_data: GuessCreate,

    x_player_token: str = Header(...),
):
    """
    Process a contestant guess.
    """

    # =====================================================
    # IDENTIFY PLAYER
    # =====================================================

    guessing_player = (
        game.get_player_by_token(
            x_player_token
        )
    )

    if guessing_player is None:

        raise HTTPException(
            status_code=401,
            detail="Invalid player token.",
        )

    # =====================================================
    # GAME MUST BE RUNNING
    # =====================================================

    if not game.game_started:

        raise HTTPException(
            status_code=400,
            detail="The game has not started.",
        )

    # =====================================================
    # CHECK TURN
    # =====================================================

    if (
        game.current_player_id
        != guessing_player.id
    ):

        raise HTTPException(
            status_code=403,
            detail="It is not your turn.",
        )

    # =====================================================
    # PLAYER MUST BE ACTIVE
    # =====================================================

    if not guessing_player.active:

        raise HTTPException(
            status_code=400,
            detail="You have been eliminated.",
        )

    # =====================================================
    # CANNOT GUESS YOURSELF
    # =====================================================

    if (
        guessing_player.id
        == guess_data.target_player_id
    ):

        raise HTTPException(
            status_code=400,
            detail="You cannot guess yourself.",
        )

    # =====================================================
    # MAKE GUESS
    # =====================================================

    try:

        result = game.make_guess(

            guessing_player_id=(
                guessing_player.id
            ),

            target_player_id=(
                guess_data.target_player_id
            ),

            guessed_shape=(
                guess_data.shape
            ),

            guessed_color=(
                guess_data.color
            ),
        )

        return result

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


# =========================================================
# CLOSE REGISTRATION
# =========================================================

@router.post(
    "/host/registration/close"
)
def close_registration(
    _: bool = Depends(
        require_host
    ),
):
    """
    Close contestant registration.
    """

    try:

        return game.close_registration()

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


# =========================================================
# OPEN REGISTRATION
# =========================================================

@router.post(
    "/host/registration/open"
)
def open_registration(
    _: bool = Depends(
        require_host
    ),
):
    """
    Open contestant registration.
    """

    try:

        return game.open_registration()

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


# =========================================================
# START GAME
# =========================================================

@router.post(
    "/host/start"
)
def start_game(
    _: bool = Depends(
        require_host
    ),
):
    """
    Start the game.
    """

    try:

        player = game.start_game()

        return {
            "message": "Game started.",

            "current_player": {
                "id": player.id,
                "name": player.name,
            },
        }

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


# =========================================================
# SPIN WHEEL
# =========================================================

@router.post(
    "/host/spin"
)
def spin_wheel(
    _: bool = Depends(
        require_host
    ),
):
    """
    Spin the wheel and select the next player.
    """

    try:

        player = game.spin()

        return {
            "message": "Wheel selected a player.",

            "spin_number": (
                game.spin_number
            ),

            "player": {
                "id": player.id,
                "name": player.name,
            },
        }

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


# =========================================================
# RESET GAME
# =========================================================

@router.post(
    "/host/reset"
)
def reset_game(
    _: bool = Depends(
        require_host
    ),
):
    """
    Reset the in-memory game.
    """

    return game.reset_game()
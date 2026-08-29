import secrets
import string

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.auth import require_host
from app.database import supabase_admin


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/host",
    tags=["Host"],
)


# =========================================================
# HOST PROFILE
# =========================================================

@router.get("/me")
def host_me(
    profile: dict = Depends(require_host),
):
    """
    Verify that the authenticated user is an
    approved HOST.
    """

    return {
        "message": "Host authentication successful.",
        "profile": profile,
    }


# =========================================================
# GENERATE RANDOM JOIN KEY
# =========================================================

def generate_join_key(length: int = 8) -> str:
    """
    Generate a random contestant join key.

    Example:

        1ESRD234
        K8P2XZ91
        Q7M4AB29
    """

    alphabet = (
        string.ascii_uppercase
        + string.digits
    )

    return "".join(
        secrets.choice(alphabet)
        for _ in range(length)
    )


# =========================================================
# CREATE GAME SESSION
# =========================================================

@router.post("/sessions")
def create_game_session(
    profile: dict = Depends(require_host),
):
    """
    Create a new game session for the authenticated host.

    Only approved HOST accounts can create sessions.
    """

    host_id = profile["id"]

    # -----------------------------------------------------
    # CHECK FOR EXISTING ACTIVE SESSION
    # -----------------------------------------------------

    try:

        existing_response = (
            supabase_admin
            .table("game_sessions")
            .select(
                "id,host_id,status,created_at,started_at,ended_at"
            )
            .eq(
                "host_id",
                host_id,
            )
            .in_(
                "status",
                ["WAITING", "LIVE"],
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
                "Could not check existing game sessions: "
                f"{error}"
            ),
        )

    existing_sessions = (
        existing_response.data or []
    )

    if existing_sessions:

        return {
            "message": "You already have an active game session.",
            "session": existing_sessions[0],
        }

    # -----------------------------------------------------
    # CREATE SESSION
    # -----------------------------------------------------

    try:

        response = (
            supabase_admin
            .table("game_sessions")
            .insert(
                {
                    "host_id": host_id,
                    "status": "WAITING",
                }
            )
            .execute()
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not create game session: "
                f"{error}"
            ),
        )

    session = (
        response.data[0]
        if response.data
        else None
    )

    if not session:

        raise HTTPException(
            status_code=500,
            detail="Game session was not created.",
        )

    return {
        "message": "Game session created successfully.",
        "session": session,
    }


# =========================================================
# GET CURRENT GAME SESSION
# =========================================================

@router.get("/sessions/current")
def get_current_game_session(
    profile: dict = Depends(require_host),
):
    """
    Return the authenticated host's current active session.
    """

    host_id = profile["id"]

    try:

        response = (
            supabase_admin
            .table("game_sessions")
            .select(
                "id,host_id,status,created_at,started_at,ended_at"
            )
            .eq(
                "host_id",
                host_id,
            )
            .in_(
                "status",
                ["WAITING", "LIVE"],
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
                "Could not retrieve current session: "
                f"{error}"
            ),
        )

    sessions = response.data or []

    if not sessions:

        return {
            "session": None,
        }

    return {
        "session": sessions[0],
    }


# =========================================================
# GENERATE 8 JOIN KEYS
# =========================================================

@router.post("/join-keys/generate")
def generate_join_keys(
    profile: dict = Depends(require_host),
):
    """
    Generate eight contestant join keys for the
    authenticated host's current game session.

    Each generated key is unique.

    Keys cannot be reused once consumed.
    """

    host_id = profile["id"]

    # -----------------------------------------------------
    # FIND CURRENT SESSION
    # -----------------------------------------------------

    try:

        session_response = (
            supabase_admin
            .table("game_sessions")
            .select(
                "id,host_id,status"
            )
            .eq(
                "host_id",
                host_id,
            )
            .in_(
                "status",
                ["WAITING", "LIVE"],
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
                "Could not retrieve game session: "
                f"{error}"
            ),
        )

    sessions = (
        session_response.data or []
    )

    if not sessions:

        raise HTTPException(
            status_code=400,
            detail=(
                "You do not have an active game session. "
                "Create a game session first."
            ),
        )

    session = sessions[0]

    session_id = session["id"]

    # -----------------------------------------------------
    # MAKE SURE SESSION IS WAITING
    # -----------------------------------------------------

    if session["status"] not in [
        "WAITING",
        "LIVE",
    ]:

        raise HTTPException(
            status_code=400,
            detail="This game session is no longer active.",
        )

    # -----------------------------------------------------
    # GENERATE KEYS
    # -----------------------------------------------------

    generated_keys = []

    # We generate exactly eight keys.
    for _ in range(8):

        # Keep generating until we have a unique key.
        for _attempt in range(20):

            join_key = generate_join_key()

            try:

                existing_response = (
                    supabase_admin
                    .table("game_join_keys")
                    .select("id")
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
                        "Could not verify join key: "
                        f"{error}"
                    ),
                )

            if not existing_response.data:

                break

        else:

            raise HTTPException(
                status_code=500,
                detail=(
                    "Could not generate a unique join key."
                ),
            )

        # -------------------------------------------------
        # SAVE KEY
        # -------------------------------------------------

        try:

            key_response = (
                supabase_admin
                .table("game_join_keys")
                .insert(
                    {
                        "host_id": host_id,
                        "session_id": session_id,
                        "join_key": join_key,
                        "used": False,
                    }
                )
                .execute()
            )

        except Exception as error:

            raise HTTPException(
                status_code=500,
                detail=(
                    "Could not save join key: "
                    f"{error}"
                ),
            )

        saved_key = (
            key_response.data[0]
            if key_response.data
            else None
        )

        if not saved_key:

            raise HTTPException(
                status_code=500,
                detail="Join key was not saved.",
            )

        generated_keys.append(
            {
                "id": saved_key["id"],
                "key": saved_key["join_key"],
                "used": saved_key["used"],
            }
        )

    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return {
        "message": "8 join keys generated successfully.",
        "session_id": session_id,
        "keys": generated_keys,
    }


# =========================================================
# GET JOIN KEYS
# =========================================================

@router.get("/join-keys")
def get_join_keys(
    profile: dict = Depends(require_host),
):
    """
    Return join keys belonging only to the authenticated
    host's current game session.
    """

    host_id = profile["id"]

    # -----------------------------------------------------
    # FIND CURRENT SESSION
    # -----------------------------------------------------

    try:

        session_response = (
            supabase_admin
            .table("game_sessions")
            .select("id")
            .eq(
                "host_id",
                host_id,
            )
            .in_(
                "status",
                ["WAITING", "LIVE"],
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
                "Could not retrieve current session: "
                f"{error}"
            ),
        )

    sessions = (
        session_response.data or []
    )

    if not sessions:

        return {
            "session_id": None,
            "keys": [],
        }

    session_id = sessions[0]["id"]

    # -----------------------------------------------------
    # GET KEYS
    # -----------------------------------------------------

    try:

        response = (
            supabase_admin
            .table("game_join_keys")
            .select(
                "id,join_key,used,created_at,used_at,used_by_player_id"
            )
            .eq(
                "host_id",
                host_id,
            )
            .eq(
                "session_id",
                session_id,
            )
            .order(
                "created_at",
                desc=False,
            )
            .execute()
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not retrieve join keys: "
                f"{error}"
            ),
        )

    return {
        "session_id": session_id,
        "keys": response.data or [],
    }


# =========================================================
# END GAME SESSION
# =========================================================

@router.post("/sessions/end")
def end_game_session(
    profile: dict = Depends(require_host),
):
    """
    End the current game session.

    Because join keys belong to this session,
    they can no longer be used for a future session.
    """

    host_id = profile["id"]

    # -----------------------------------------------------
    # FIND CURRENT SESSION
    # -----------------------------------------------------

    try:

        response = (
            supabase_admin
            .table("game_sessions")
            .select(
                "id,status"
            )
            .eq(
                "host_id",
                host_id,
            )
            .in_(
                "status",
                ["WAITING", "LIVE"],
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
                "Could not retrieve current session: "
                f"{error}"
            ),
        )

    sessions = response.data or []

    if not sessions:

        raise HTTPException(
            status_code=404,
            detail="No active game session found.",
        )

    session_id = sessions[0]["id"]

    # -----------------------------------------------------
    # END SESSION
    # -----------------------------------------------------

    try:

        update_response = (
            supabase_admin
            .table("game_sessions")
            .update(
                {
                    "status": "ENDED",
                    "ended_at": "now()",
                }
            )
            .eq(
                "id",
                session_id,
            )
            .eq(
                "host_id",
                host_id,
            )
            .execute()
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not end game session: "
                f"{error}"
            ),
        )

    return {
        "message": "Game session ended successfully.",
        "session_id": session_id,
        "session": (
            update_response.data[0]
            if update_response.data
            else None
        ),
    }
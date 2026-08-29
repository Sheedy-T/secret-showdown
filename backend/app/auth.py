from fastapi import Depends, HTTPException
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)

from app.database import supabase


# =========================================================
# BEARER AUTHENTICATION
# =========================================================

security = HTTPBearer()


# =========================================================
# GET AUTHENTICATED SUPABASE USER
# =========================================================

def get_authenticated_user(
    credentials: HTTPAuthorizationCredentials = Depends(
        security
    ),
):
    """
    Read the Supabase access token from:

        Authorization: Bearer <access_token>

    Then ask Supabase to verify the token and return
    the authenticated user.
    """

    access_token = credentials.credentials

    try:

        response = supabase.auth.get_user(
            access_token
        )

        if not response.user:

            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token.",
            )

        return response.user

    except HTTPException:
        raise

    except Exception:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token.",
        )


# =========================================================
# REQUIRE APPROVED HOST
# =========================================================

def require_host(
    credentials: HTTPAuthorizationCredentials = Depends(
        security
    ),
):
    """
    Allow access only to an authenticated user whose
    profile is:

        role   = HOST
        status = APPROVED
    """

    user = get_authenticated_user(
        credentials
    )

    # -----------------------------------------------------
    # FIND USER PROFILE
    # -----------------------------------------------------

    try:

        response = (
            supabase
            .table("profiles")
            .select(
                "id,email,role,status,display_name"
            )
            .eq(
                "id",
                user.id,
            )
            .single()
            .execute()
        )

    except Exception:

        raise HTTPException(
            status_code=403,
            detail="Could not retrieve host profile.",
        )

    profile = response.data

    # -----------------------------------------------------
    # PROFILE MUST EXIST
    # -----------------------------------------------------

    if not profile:

        raise HTTPException(
            status_code=403,
            detail="Host profile was not found.",
        )

    # -----------------------------------------------------
    # MUST BE HOST
    # -----------------------------------------------------

    if profile["role"] != "HOST":

        raise HTTPException(
            status_code=403,
            detail="Host access required.",
        )

    # -----------------------------------------------------
    # MUST BE APPROVED
    # -----------------------------------------------------

    if profile["status"] != "APPROVED":

        if profile["status"] == "PENDING":

            raise HTTPException(
                status_code=403,
                detail=(
                    "Your host application is still "
                    "pending approval."
                ),
            )

        if profile["status"] == "REJECTED":

            raise HTTPException(
                status_code=403,
                detail=(
                    "Your host application was rejected."
                ),
            )

        if profile["status"] == "SUSPENDED":

            raise HTTPException(
                status_code=403,
                detail=(
                    "Your host account has been suspended."
                ),
            )

        raise HTTPException(
            status_code=403,
            detail="Your host account is not approved.",
        )

    # -----------------------------------------------------
    # HOST IS AUTHORIZED
    # -----------------------------------------------------

    return profile
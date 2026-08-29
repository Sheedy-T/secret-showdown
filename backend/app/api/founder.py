from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)

from app.database import (
    supabase_admin,
    supabase_auth,
)

from app.services.email import (
    send_host_approval_email,
    send_host_rejection_email,
)


router = APIRouter(
    prefix="/api/founder",
    tags=["Founder"],
)


# =========================================================
# BEARER AUTHENTICATION
# =========================================================

security = HTTPBearer()


# =========================================================
# GET AUTHENTICATED USER
# =========================================================

def get_authenticated_user(
    credentials: HTTPAuthorizationCredentials = Depends(
        security
    ),
):

    access_token = credentials.credentials

    try:

        response = supabase_auth.auth.get_user(
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

    except Exception as error:

        print(
            "Founder authentication error:",
            error,
        )

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token.",
        )


# =========================================================
# REQUIRE FOUNDER
# =========================================================

def require_founder(
    credentials: HTTPAuthorizationCredentials = Depends(
        security
    ),
):

    # -----------------------------------------------------
    # VALIDATE ACCESS TOKEN
    # -----------------------------------------------------

    user = get_authenticated_user(
        credentials
    )

    # -----------------------------------------------------
    # GET FOUNDER PROFILE
    # -----------------------------------------------------

    try:

        response = (
            supabase_admin
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

    except Exception as error:

        print(
            "Founder profile lookup error:",
            error,
        )

        raise HTTPException(
            status_code=403,
            detail="Could not retrieve founder profile.",
        )

    profile = response.data

    # -----------------------------------------------------
    # PROFILE MUST EXIST
    # -----------------------------------------------------

    if not profile:

        raise HTTPException(
            status_code=403,
            detail="Founder profile was not found.",
        )

    # -----------------------------------------------------
    # USER MUST BE FOUNDER
    # -----------------------------------------------------

    if profile["role"] != "FOUNDER":

        raise HTTPException(
            status_code=403,
            detail="Founder access required.",
        )

    # -----------------------------------------------------
    # FOUNDER MUST BE APPROVED
    # -----------------------------------------------------

    if profile["status"] != "APPROVED":

        raise HTTPException(
            status_code=403,
            detail="Founder account is not approved.",
        )

    return profile


# =========================================================
# FOUNDER PROFILE TEST
# =========================================================

@router.get("/me")
def founder_me(
    credentials: HTTPAuthorizationCredentials = Depends(
        security
    ),
):

    profile = require_founder(
        credentials
    )

    return {
        "message": "Founder authentication successful.",
        "profile": profile,
    }


# =========================================================
# GET HOST APPLICATIONS
# =========================================================

@router.get("/hosts")
def get_host_applications(
    _: dict = Depends(require_founder),
):

    try:

        response = (
            supabase_admin
            .table("profiles")
            .select(
                "id,email,role,status,display_name,created_at,updated_at"
            )
            .eq(
                "role",
                "HOST",
            )
            .order(
                "created_at",
                desc=False,
            )
            .execute()
        )

        print(
            "Founder host query result:",
            response.data,
        )

        return {
            "hosts": response.data or []
        }

    except Exception as error:

        print(
            "Host applications lookup error:",
            error,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not retrieve host applications: "
                f"{error}"
            ),
        )


# =========================================================
# APPROVE HOST
# =========================================================

@router.post("/hosts/{user_id}/approve")
async def approve_host(
    user_id: str,
    _: dict = Depends(require_founder),
):

    # -----------------------------------------------------
    # FIND HOST
    # -----------------------------------------------------

    try:

        response = (
            supabase_admin
            .table("profiles")
            .select(
                "id,email,role,status,display_name"
            )
            .eq(
                "id",
                user_id,
            )
            .single()
            .execute()
        )

    except Exception as error:

        print(
            "Host lookup error:",
            error,
        )

        raise HTTPException(
            status_code=404,
            detail="Host application not found.",
        )

    host = response.data

    if not host:

        raise HTTPException(
            status_code=404,
            detail="Host application not found.",
        )

    # -----------------------------------------------------
    # MAKE SURE THIS IS A HOST
    # -----------------------------------------------------

    if host["role"] != "HOST":

        raise HTTPException(
            status_code=400,
            detail="This user is not a host account.",
        )

    # -----------------------------------------------------
    # ALREADY APPROVED
    # -----------------------------------------------------

    if host["status"] == "APPROVED":

        return {
            "message": "Host is already approved.",
            "host": host,
            "email_sent": False,
        }

    # -----------------------------------------------------
    # APPROVE HOST
    # -----------------------------------------------------

    try:

        update_response = (
            supabase_admin
            .table("profiles")
            .update(
                {
                    "status": "APPROVED",
                }
            )
            .eq(
                "id",
                user_id,
            )
            .execute()
        )

        updated_host = (
            update_response.data[0]
            if update_response.data
            else None
        )

        if not updated_host:

            raise Exception(
                "Profile status was not updated."
            )

    except Exception as error:

        print(
            "Host approval error:",
            error,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not approve host: "
                f"{error}"
            ),
        )

    # -----------------------------------------------------
    # SEND APPROVAL EMAIL
    # -----------------------------------------------------

    email_sent = False

    try:

        await send_host_approval_email(
            email=host["email"],
            display_name=host.get(
                "display_name"
            ),
        )

        email_sent = True

        print(
            f"Approval email sent to {host['email']}"
        )

    except Exception as error:

        print(
            "Approval email error:",
            error,
        )

    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    result = {
        "message": "Host approved successfully.",
        "host": updated_host,
        "email_sent": email_sent,
    }

    if not email_sent:

        result["email_warning"] = (
            "Host was approved, but the "
            "notification email could not be sent."
        )

    return result


# =========================================================
# REJECT HOST
# =========================================================

@router.post("/hosts/{user_id}/reject")
async def reject_host(
    user_id: str,
    _: dict = Depends(require_founder),
):

    # -----------------------------------------------------
    # FIND HOST
    # -----------------------------------------------------

    try:

        response = (
            supabase_admin
            .table("profiles")
            .select(
                "id,email,role,status,display_name"
            )
            .eq(
                "id",
                user_id,
            )
            .single()
            .execute()
        )

    except Exception as error:

        print(
            "Host lookup error:",
            error,
        )

        raise HTTPException(
            status_code=404,
            detail="Host application not found.",
        )

    host = response.data

    if not host:

        raise HTTPException(
            status_code=404,
            detail="Host application not found.",
        )

    # -----------------------------------------------------
    # MAKE SURE THIS IS A HOST
    # -----------------------------------------------------

    if host["role"] != "HOST":

        raise HTTPException(
            status_code=400,
            detail="This user is not a host account.",
        )

    # -----------------------------------------------------
    # ALREADY REJECTED
    # -----------------------------------------------------

    if host["status"] == "REJECTED":

        return {
            "message": "Host application is already rejected.",
            "host": host,
            "email_sent": False,
        }

    # -----------------------------------------------------
    # REJECT HOST
    # -----------------------------------------------------

    try:

        update_response = (
            supabase_admin
            .table("profiles")
            .update(
                {
                    "status": "REJECTED",
                }
            )
            .eq(
                "id",
                user_id,
            )
            .execute()
        )

        updated_host = (
            update_response.data[0]
            if update_response.data
            else None
        )

        if not updated_host:

            raise Exception(
                "Profile status was not updated."
            )

    except Exception as error:

        print(
            "Host rejection error:",
            error,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not reject host: "
                f"{error}"
            ),
        )

    # -----------------------------------------------------
    # SEND REJECTION EMAIL
    # -----------------------------------------------------

    email_sent = False

    try:

        await send_host_rejection_email(
            email=host["email"],
            display_name=host.get(
                "display_name"
            ),
        )

        email_sent = True

        print(
            f"Rejection email sent to {host['email']}"
        )

    except Exception as error:

        print(
            "Rejection email error:",
            error,
        )

    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    result = {
        "message": "Host application rejected.",
        "host": updated_host,
        "email_sent": email_sent,
    }

    if not email_sent:

        result["email_warning"] = (
            "Host was rejected, but the "
            "notification email could not be sent."
        )

    return result


# =========================================================
# SUSPEND HOST
# =========================================================

@router.post("/hosts/{user_id}/suspend")
def suspend_host(
    user_id: str,
    _: dict = Depends(require_founder),
):

    # -----------------------------------------------------
    # FIND HOST
    # -----------------------------------------------------

    try:

        response = (
            supabase_admin
            .table("profiles")
            .select(
                "id,email,role,status,display_name"
            )
            .eq(
                "id",
                user_id,
            )
            .single()
            .execute()
        )

    except Exception as error:

        print(
            "Host lookup error:",
            error,
        )

        raise HTTPException(
            status_code=404,
            detail="Host account not found.",
        )

    host = response.data

    if not host:

        raise HTTPException(
            status_code=404,
            detail="Host account not found.",
        )

    # -----------------------------------------------------
    # MAKE SURE THIS IS A HOST
    # -----------------------------------------------------

    if host["role"] != "HOST":

        raise HTTPException(
            status_code=400,
            detail="This user is not a host account.",
        )

    # -----------------------------------------------------
    # ALREADY SUSPENDED
    # -----------------------------------------------------

    if host["status"] == "SUSPENDED":

        return {
            "message": "Host is already suspended.",
            "host": host,
        }

    # -----------------------------------------------------
    # SUSPEND
    # -----------------------------------------------------

    try:

        update_response = (
            supabase_admin
            .table("profiles")
            .update(
                {
                    "status": "SUSPENDED",
                }
            )
            .eq(
                "id",
                user_id,
            )
            .execute()
        )

        updated_host = (
            update_response.data[0]
            if update_response.data
            else None
        )

        if not updated_host:

            raise Exception(
                "Profile status was not updated."
            )

        return {
            "message": "Host suspended successfully.",
            "host": updated_host,
        }

    except Exception as error:

        print(
            "Host suspension error:",
            error,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not suspend host: "
                f"{error}"
            ),
        )
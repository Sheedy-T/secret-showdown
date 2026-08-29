from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from app.database import supabase, supabase_admin


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


# =========================================================
# REQUEST SCHEMAS
# =========================================================


class HostRegisterRequest(BaseModel):
    display_name: str
    email: EmailStr
    password: str
    confirm_password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# =========================================================
# HOST REGISTRATION
# =========================================================


@router.post("/host/register")
def register_host(data: HostRegisterRequest):

    # -----------------------------------------------------
    # CLEAN INPUT
    # -----------------------------------------------------

    display_name = data.display_name.strip()
    email = str(data.email).lower().strip()

    # -----------------------------------------------------
    # VALIDATE DISPLAY NAME
    # -----------------------------------------------------

    if not display_name:

        raise HTTPException(
            status_code=400,
            detail="Display name is required.",
        )

    # -----------------------------------------------------
    # VALIDATE PASSWORD
    # -----------------------------------------------------

    if data.password != data.confirm_password:

        raise HTTPException(
            status_code=400,
            detail="Passwords do not match.",
        )

    if len(data.password) < 6:

        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters long.",
        )

    # =====================================================
    # CREATE SUPABASE AUTH USER
    # =====================================================

    try:

        auth_response = (
            supabase_admin
            .auth
            .admin
            .create_user(
                {
                    "email": email,
                    "password": data.password,

                    # For now, email confirmation is enabled.
                    # Founder approval controls host access.
                    "email_confirm": True,

                    # The database trigger reads display_name
                    # from raw_user_meta_data.
                    "user_metadata": {
                        "display_name": display_name,
                        "role": "HOST",
                    },
                }
            )
        )

    except Exception as error:

        print(
            "Host Auth registration error:",
            repr(error),
        )

        error_message = str(error).lower()

        # -------------------------------------------------
        # DUPLICATE EMAIL
        # -------------------------------------------------

        if (
            "already registered" in error_message
            or "already exists" in error_message
            or "user already exists" in error_message
            or "duplicate" in error_message
            or "unique" in error_message
        ):

            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists.",
            )

        # -------------------------------------------------
        # OTHER AUTH ERROR
        # -------------------------------------------------

        raise HTTPException(
            status_code=400,
            detail=(
                "Could not create host account. "
                f"Supabase error: {error}"
            ),
        )

    # =====================================================
    # VERIFY AUTH USER
    # =====================================================

    if not auth_response.user:

        raise HTTPException(
            status_code=500,
            detail="Supabase did not return the created user.",
        )

    user_id = auth_response.user.id

    print(
        "Created host Auth user:",
        user_id,
    )

    # =====================================================
    # PROFILE IS CREATED AUTOMATICALLY BY DATABASE TRIGGER
    # =====================================================
    #
    # The trigger:
    #
    # on_auth_user_created
    #
    # calls:
    #
    # handle_new_user()
    #
    # which creates:
    #
    # role = HOST
    # status = PENDING
    #
    # Therefore DO NOT manually insert into profiles here.
    # =====================================================

    try:

        profile_response = (
            supabase_admin
            .table("profiles")
            .select(
                "id,email,role,status,display_name"
            )
            .eq(
                "id",
                user_id,
            )
            .limit(1)
            .execute()
        )

        profile_data = profile_response.data

    except Exception as error:

        print(
            "Host profile verification error:",
            repr(error),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "The Auth account was created, but the "
                "host profile could not be verified. "
                f"Supabase error: {error}"
            ),
        )

    # =====================================================
    # PROFILE MUST EXIST
    # =====================================================

    if not profile_data:

        raise HTTPException(
            status_code=500,
            detail=(
                "The Auth account was created, but the "
                "host profile was not created automatically."
            ),
        )

    profile = profile_data[0]

    # =====================================================
    # VERIFY HOST STATUS
    # =====================================================

    if profile.get("role") != "HOST":

        raise HTTPException(
            status_code=500,
            detail=(
                "Host profile was created with an "
                "unexpected role."
            ),
        )

    if profile.get("status") != "PENDING":

        raise HTTPException(
            status_code=500,
            detail=(
                "Host profile was created with an "
                "unexpected status."
            ),
        )

    # =====================================================
    # SUCCESS
    # =====================================================

    return {
        "message": (
            "Host registration submitted successfully. "
            "Your application is pending Founder approval."
        ),

        "host": {
            "id": user_id,
            "email": profile.get("email"),
            "display_name": profile.get("display_name"),
            "role": profile.get("role"),
            "status": profile.get("status"),
        },
    }


# =========================================================
# LOGIN
# =========================================================


@router.post("/login")
def login(data: LoginRequest):

    email = str(data.email).lower().strip()

    try:

        # =================================================
        # AUTHENTICATE WITH SUPABASE
        # =================================================

        response = (
            supabase
            .auth
            .sign_in_with_password(
                {
                    "email": email,
                    "password": data.password,
                }
            )
        )

        # -------------------------------------------------
        # USER MUST EXIST
        # -------------------------------------------------

        if not response.user:

            raise HTTPException(
                status_code=401,
                detail="Invalid email or password.",
            )

        user = response.user

        # =================================================
        # GET PROFILE
        # =================================================

        profile_response = (
            supabase_admin
            .table("profiles")
            .select(
                "id,email,role,status,display_name"
            )
            .eq(
                "id",
                user.id,
            )
            .limit(1)
            .execute()
        )

        profile_data = profile_response.data

        # -------------------------------------------------
        # PROFILE MUST EXIST
        # -------------------------------------------------

        if not profile_data:

            raise HTTPException(
                status_code=403,
                detail="User profile was not found.",
            )

        profile = profile_data[0]

        # =================================================
        # PENDING
        # =================================================

        if profile["status"] == "PENDING":

            raise HTTPException(
                status_code=403,
                detail=(
                    "Your host application is still pending "
                    "Founder approval."
                ),
            )

        # =================================================
        # REJECTED
        # =================================================

        if profile["status"] == "REJECTED":

            raise HTTPException(
                status_code=403,
                detail=(
                    "Your host application was rejected."
                ),
            )

        # =================================================
        # SUSPENDED
        # =================================================

        if profile["status"] == "SUSPENDED":

            raise HTTPException(
                status_code=403,
                detail=(
                    "Your host account has been suspended."
                ),
            )

        # =================================================
        # ONLY APPROVED HOSTS CAN LOGIN
        # =================================================

        if profile["status"] != "APPROVED":

            raise HTTPException(
                status_code=403,
                detail="Your account is not approved.",
            )

        # =================================================
        # LOGIN SUCCESS
        # =================================================

        return {
            "message": "Login successful.",

            "user": {
                "id": user.id,
                "email": user.email,
            },

            "profile": profile,

            "session": {
                "access_token": (
                    response.session.access_token
                    if response.session
                    else None
                ),
            },
        }

    # =====================================================
    # EXPECTED HTTP ERROR
    # =====================================================

    except HTTPException:

        raise

    # =====================================================
    # UNEXPECTED ERROR
    # =====================================================

    except Exception as error:

        print(
            "Login error:",
            repr(error),
        )

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )
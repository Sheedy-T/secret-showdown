import os

from dotenv import load_dotenv
from supabase import create_client, Client


# =========================================================
# LOAD ENVIRONMENT VARIABLES
# =========================================================

load_dotenv()


SUPABASE_URL = os.getenv("SUPABASE_URL")

SUPABASE_SECRET_KEY = os.getenv(
    "SUPABASE_SECRET_KEY"
)

SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY"
)


# =========================================================
# VALIDATE SUPABASE URL
# =========================================================

if not SUPABASE_URL:
    raise RuntimeError(
        "SUPABASE_URL is not configured in the .env file."
    )


# =========================================================
# VALIDATE NORMAL SERVER KEY
# =========================================================

if not SUPABASE_SECRET_KEY:
    raise RuntimeError(
        "SUPABASE_SECRET_KEY is not configured "
        "in the .env file."
    )


# =========================================================
# VALIDATE ADMIN KEY
# =========================================================

if not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError(
        "SUPABASE_SERVICE_ROLE_KEY is not configured "
        "in the .env file."
    )


# =========================================================
# NORMAL SUPABASE CLIENT
# =========================================================

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
)


# =========================================================
# AUTHENTICATION CLIENT
# =========================================================
#
# Used when verifying Supabase authentication tokens.
#
# =========================================================

supabase_auth: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
)


# =========================================================
# ADMIN / PRIVILEGED CLIENT
# =========================================================
#
# SERVER ONLY.
#
# This client uses the service_role key and therefore
# bypasses Supabase Row Level Security.
#
# NEVER expose this client or its key to Next.js.
#
# =========================================================

supabase_admin: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
)
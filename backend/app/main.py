from app.api.founder import router as founder_router
from app.api.auth import router as auth_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.database import supabase

app = FastAPI(
    title="Secret Showdown API",
    description="Backend API for the Secret Showdown TikTok LIVE game",
    version="0.1.0",
)


# -------------------------
# CORS
# -------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://secret-showdown.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------
# API ROUTES
# -------------------------

app.include_router(router)
app.include_router(auth_router)
app.include_router(founder_router)
# -------------------------
# ROOT
# -------------------------

@app.get("/")
def root():

    return {
        "message": "Secret Showdown API is running!"
    }


# -------------------------
# HEALTH
# -------------------------

@app.get("/health")
def health():

    return {
        "status": "healthy"
    }

# -------------------------
# DATABASE HEALTH
# -------------------------

@app.get("/health/database")
def database_health():

    try:

        # Perform a simple query against Supabase.
        # We don't need any records to exist.
        # A successful response proves the connection works.

        response = (
            supabase
            .table("game_sessions")
            .select("id")
            .limit(1)
            .execute()
        )

        return {
            "status": "healthy",
            "database": "connected",
            "table": "game_sessions",
            "message": "Supabase connection is working.",
        }

    except Exception as error:

        return {
            "status": "error",
            "database": "not connected",
            "message": str(error),
        }
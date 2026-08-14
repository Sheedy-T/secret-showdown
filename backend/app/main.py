from fastapi import FastAPI

app = FastAPI(
    title="Secret Showdown API",
    description="Backend API for the Secret Showdown TikTok LIVE game",
    version="0.1.0",
)


@app.get("/")
def root():
    return {
        "message": "Secret Showdown API is running!"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }
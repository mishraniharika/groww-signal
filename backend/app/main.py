from fastapi import FastAPI
from app.database import db

app = FastAPI(title="Groww Signal API")

@app.get("/health")
def health_check():
    try:
        db.command("ping")
        return {"status": "ok", "db": "connected"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routers import users, parts

app = FastAPI(
    title="RemaLab WMS API",
    description="API for RemaLab Warehouse Management System",
    version="1.0.0"
)

# CORS (Cross-Origin Resource Sharing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For production, configure this properly
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(parts.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to RemaLab WMS API"}

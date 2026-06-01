from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes import auth, categories, licenses, activations
from app.db.init_db import setup_database

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup database checks, creation, migrations, and seed
    await setup_database()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# Set up CORS middleware
# Pydantic validates ALLOWED_ORIGINS to ensure it's either a list or "*"
origins = settings.ALLOWED_ORIGINS
if isinstance(origins, str):
    if origins == "*":
        origins = ["*"]
    else:
        origins = [origins]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(licenses.router, prefix="/api/licenses", tags=["licenses"])
app.include_router(activations.router, prefix="/api/activation", tags=["activation"])

@app.get("/api/health", tags=["health"])
def health_check():
    """Simple API health check endpoint."""
    return {"status": "healthy", "project": settings.PROJECT_NAME}

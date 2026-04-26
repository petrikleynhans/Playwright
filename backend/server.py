from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone

from seed_data import UNSEEN_FILM, UNSEEN_SHOTS

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)

# ---------------- ENUMS ----------------
ModelEnum = Literal["Kling 3.0", "Veo 3.1 Fast", "WAN 2.6", "Sora 2", "Seedream 5.0 Lite", "Flux 1.1"]
ActEnum = Literal["ACT 1", "ACT 2", "ACT 3"]
ShotTypeEnum = Literal["ECU", "CU", "MS", "WS", "Insert"]
ShotStatusEnum = Literal["NOT STARTED", "IN PROGRESS", "FINAL", "CUT"]
FilmStatusEnum = Literal["IN PRODUCTION", "COMPLETE"]
DecisionEnum = Literal["DISCARD", "KEEP", "FINAL"]


# ---------------- MODELS ----------------
class Film(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str = ""
    deadline: Optional[str] = None  # ISO date string
    total_shots: int = 0
    status: FilmStatusEnum = "IN PRODUCTION"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FilmCreate(BaseModel):
    title: str
    description: str = ""
    deadline: Optional[str] = None
    total_shots: int = 0
    status: FilmStatusEnum = "IN PRODUCTION"


class FilmUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    deadline: Optional[str] = None
    total_shots: Optional[int] = None
    status: Optional[FilmStatusEnum] = None


class Shot(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    film_id: str
    shot_number: str
    act: ActEnum
    filename: str = ""
    model_assigned: ModelEnum
    shot_type: ShotTypeEnum
    location: str = ""
    int_ext: str = ""
    time_of_day: str = ""
    framing: str = ""
    action_summary: str = ""
    emotion_level: int = 0
    camera: str = ""
    audio_notes: str = ""
    special_notes: str = ""
    duration: str = ""
    status: ShotStatusEnum = "NOT STARTED"
    current_thumbnail: Optional[str] = None  # base64 data URL
    attempt_count: int = 0
    sort_key: str = ""  # for natural ordering
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ShotCreate(BaseModel):
    shot_number: str
    act: ActEnum
    filename: str = ""
    model_assigned: ModelEnum
    shot_type: ShotTypeEnum
    location: str = ""
    int_ext: str = ""
    time_of_day: str = ""
    framing: str = ""
    action_summary: str = ""
    emotion_level: int = 0
    camera: str = ""
    audio_notes: str = ""
    special_notes: str = ""
    duration: str = ""
    status: ShotStatusEnum = "NOT STARTED"


class ShotUpdate(BaseModel):
    shot_number: Optional[str] = None
    act: Optional[ActEnum] = None
    filename: Optional[str] = None
    model_assigned: Optional[ModelEnum] = None
    shot_type: Optional[ShotTypeEnum] = None
    location: Optional[str] = None
    int_ext: Optional[str] = None
    time_of_day: Optional[str] = None
    framing: Optional[str] = None
    action_summary: Optional[str] = None
    emotion_level: Optional[int] = None
    camera: Optional[str] = None
    audio_notes: Optional[str] = None
    special_notes: Optional[str] = None
    duration: Optional[str] = None
    status: Optional[ShotStatusEnum] = None
    current_thumbnail: Optional[str] = None


class Iteration(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shot_id: str
    attempt_number: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    model_used: ModelEnum
    prompt_text: str
    thumbnail: Optional[str] = None  # base64 data URL
    what_failed: str
    what_worked: str
    decision: DecisionEnum
    notes: str = ""


class IterationCreate(BaseModel):
    model_used: ModelEnum
    prompt_text: str
    thumbnail: Optional[str] = None
    what_failed: str
    what_worked: str
    decision: DecisionEnum
    notes: str = ""


# ---------------- HELPERS ----------------
def shot_sort_key(num: str) -> str:
    """Natural sort key for shot numbers like '01', '07A', '07B', '21A'."""
    digits = ""
    suffix = ""
    for c in num:
        if c.isdigit():
            digits += c
        else:
            suffix += c
    try:
        n = int(digits) if digits else 0
    except ValueError:
        n = 0
    return f"{n:04d}{suffix}"


def serialize_dt(doc: dict) -> dict:
    """Convert datetime fields to ISO strings for MongoDB storage."""
    for k, v in list(doc.items()):
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc


def deserialize_dt(doc: dict, fields: list) -> dict:
    for f in fields:
        if f in doc and isinstance(doc[f], str):
            try:
                doc[f] = datetime.fromisoformat(doc[f])
            except ValueError:
                pass
    return doc


# ---------------- FILM ROUTES ----------------
@api_router.get("/films", response_model=List[Film])
async def list_films():
    films = await db.films.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for f in films:
        deserialize_dt(f, ["created_at"])
    return films


@api_router.post("/films", response_model=Film)
async def create_film(payload: FilmCreate):
    film = Film(**payload.model_dump())
    doc = serialize_dt(film.model_dump())
    await db.films.insert_one(doc)
    return film


@api_router.get("/films/{film_id}", response_model=Film)
async def get_film(film_id: str):
    f = await db.films.find_one({"id": film_id}, {"_id": 0})
    if not f:
        raise HTTPException(404, "Film not found")
    deserialize_dt(f, ["created_at"])
    return f


@api_router.patch("/films/{film_id}", response_model=Film)
async def update_film(film_id: str, payload: FilmUpdate):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields to update")
    result = await db.films.find_one_and_update(
        {"id": film_id}, {"$set": update}, return_document=True, projection={"_id": 0}
    )
    if not result:
        raise HTTPException(404, "Film not found")
    deserialize_dt(result, ["created_at"])
    return result


@api_router.delete("/films/{film_id}")
async def delete_film(film_id: str):
    f = await db.films.find_one({"id": film_id}, {"_id": 0})
    if not f:
        raise HTTPException(404, "Film not found")
    # cascade: delete shots and iterations
    shots = await db.shots.find({"film_id": film_id}, {"_id": 0, "id": 1}).to_list(10000)
    shot_ids = [s["id"] for s in shots]
    if shot_ids:
        await db.iterations.delete_many({"shot_id": {"$in": shot_ids}})
    await db.shots.delete_many({"film_id": film_id})
    await db.films.delete_one({"id": film_id})
    return {"ok": True}


# ---------------- SHOT ROUTES ----------------
@api_router.get("/films/{film_id}/shots", response_model=List[Shot])
async def list_shots(film_id: str):
    shots = await db.shots.find({"film_id": film_id}, {"_id": 0}).sort("sort_key", 1).to_list(10000)
    for s in shots:
        deserialize_dt(s, ["created_at"])
    return shots


@api_router.post("/films/{film_id}/shots", response_model=Shot)
async def create_shot(film_id: str, payload: ShotCreate):
    f = await db.films.find_one({"id": film_id}, {"_id": 0})
    if not f:
        raise HTTPException(404, "Film not found")
    data = payload.model_dump()
    data["film_id"] = film_id
    data["sort_key"] = shot_sort_key(payload.shot_number)
    shot = Shot(**data)
    doc = serialize_dt(shot.model_dump())
    await db.shots.insert_one(doc)
    return shot


@api_router.get("/shots/{shot_id}", response_model=Shot)
async def get_shot(shot_id: str):
    s = await db.shots.find_one({"id": shot_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Shot not found")
    deserialize_dt(s, ["created_at"])
    return s


@api_router.patch("/shots/{shot_id}", response_model=Shot)
async def update_shot(shot_id: str, payload: ShotUpdate):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "shot_number" in update:
        update["sort_key"] = shot_sort_key(update["shot_number"])
    if not update:
        raise HTTPException(400, "No fields to update")
    result = await db.shots.find_one_and_update(
        {"id": shot_id}, {"$set": update}, return_document=True, projection={"_id": 0}
    )
    if not result:
        raise HTTPException(404, "Shot not found")
    deserialize_dt(result, ["created_at"])
    return result


@api_router.delete("/shots/{shot_id}")
async def delete_shot(shot_id: str):
    s = await db.shots.find_one({"id": shot_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Shot not found")
    await db.iterations.delete_many({"shot_id": shot_id})
    await db.shots.delete_one({"id": shot_id})
    return {"ok": True}


# ---------------- ITERATION ROUTES ----------------
@api_router.get("/shots/{shot_id}/iterations", response_model=List[Iteration])
async def list_iterations(shot_id: str):
    its = await db.iterations.find({"shot_id": shot_id}, {"_id": 0}).sort("attempt_number", 1).to_list(1000)
    for it in its:
        deserialize_dt(it, ["created_at"])
    return its


@api_router.post("/shots/{shot_id}/iterations", response_model=Iteration)
async def create_iteration(shot_id: str, payload: IterationCreate):
    shot = await db.shots.find_one({"id": shot_id}, {"_id": 0})
    if not shot:
        raise HTTPException(404, "Shot not found")
    if not payload.what_failed.strip():
        raise HTTPException(400, "what_failed is required")
    if not payload.what_worked.strip():
        raise HTTPException(400, "what_worked is required")

    # determine attempt_number
    next_attempt = (shot.get("attempt_count") or 0) + 1
    iteration = Iteration(shot_id=shot_id, attempt_number=next_attempt, **payload.model_dump())
    doc = serialize_dt(iteration.model_dump())
    await db.iterations.insert_one(doc)

    # update shot: attempt_count, status, current_thumbnail
    shot_updates = {"attempt_count": next_attempt}
    # status logic
    if payload.decision == "FINAL":
        shot_updates["status"] = "FINAL"
        if payload.thumbnail:
            shot_updates["current_thumbnail"] = payload.thumbnail
    else:
        # only auto-bump to IN PROGRESS if shot is not already FINAL or CUT
        current_status = shot.get("status", "NOT STARTED")
        if current_status == "NOT STARTED":
            shot_updates["status"] = "IN PROGRESS"

    await db.shots.update_one({"id": shot_id}, {"$set": shot_updates})

    return iteration


@api_router.delete("/iterations/{iteration_id}")
async def delete_iteration(iteration_id: str):
    it = await db.iterations.find_one({"id": iteration_id}, {"_id": 0})
    if not it:
        raise HTTPException(404, "Iteration not found")
    await db.iterations.delete_one({"id": iteration_id})
    # decrement attempt_count
    await db.shots.update_one({"id": it["shot_id"]}, {"$inc": {"attempt_count": -1}})
    return {"ok": True}


# ---------------- SEED ----------------
async def seed_unseen_if_empty():
    count = await db.films.count_documents({})
    if count > 0:
        logger.info(f"Films exist ({count}), skipping seed.")
        return
    logger.info("Seeding Unseen film with 41 shots...")
    film = Film(**UNSEEN_FILM)
    await db.films.insert_one(serialize_dt(film.model_dump()))
    for s in UNSEEN_SHOTS:
        data = dict(s)
        data["film_id"] = film.id
        data["sort_key"] = shot_sort_key(data["shot_number"])
        shot = Shot(**data)
        await db.shots.insert_one(serialize_dt(shot.model_dump()))
    logger.info(f"Seeded film '{film.title}' with {len(UNSEEN_SHOTS)} shots.")


@api_router.post("/seed/unseen")
async def manual_seed():
    """Manual reseed endpoint - only seeds if no films exist."""
    await seed_unseen_if_empty()
    return {"ok": True}


@api_router.get("/")
async def root():
    return {"app": "AI Film Production Tracker", "version": "1.0"}


# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


@app.on_event("startup")
async def startup_event():
    await seed_unseen_if_empty()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

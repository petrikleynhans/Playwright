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
from importers import parse_input

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
IterationKind = Literal["STILL", "VIDEO"]
SoulIdStatus = Literal["NOT SET", "GENERATED", "LOCKED"]

# 19-field character protocol fields
PROTOCOL_FIELDS = [
    "subject", "emotion", "environment_setting", "clothing",
    "lighting_weather", "camera_angle_framing", "lens_characteristics",
    "eye_details", "skin_textures", "mouth_lips", "hair",
    "atmospheric_texture", "color_palette", "processing_style",
    "framing", "emotional_impact", "extras_props", "composition_notes",
    "negative_prompt",
]


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
    current_thumbnail: Optional[str] = None  # base64 data URL — promoted from FINAL VIDEO iteration
    current_still: Optional[str] = None  # base64 data URL — promoted from FINAL STILL iteration
    attempt_count: int = 0  # video iteration count
    still_count: int = 0  # still iteration count
    sort_key: str = ""  # for natural ordering
    character_ids: List[str] = Field(default_factory=list)
    location_id: Optional[str] = None
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
    character_ids: List[str] = Field(default_factory=list)
    location_id: Optional[str] = None


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
    current_still: Optional[str] = None
    character_ids: Optional[List[str]] = None
    location_id: Optional[str] = None


class Character(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    film_id: str
    name: str
    role_summary: str = ""
    soul_id_status: SoulIdStatus = "NOT SET"
    soul_id_image: Optional[str] = None  # base64 anchor reference
    reference_images: List[str] = Field(default_factory=list)  # base64 list
    # 19-field protocol
    subject: str = ""
    emotion: str = ""
    environment_setting: str = ""
    clothing: str = ""
    lighting_weather: str = ""
    camera_angle_framing: str = ""
    lens_characteristics: str = ""
    eye_details: str = ""
    skin_textures: str = ""
    mouth_lips: str = ""
    hair: str = ""
    atmospheric_texture: str = ""
    color_palette: str = ""
    processing_style: str = ""
    framing: str = ""
    emotional_impact: str = ""
    extras_props: str = ""
    composition_notes: str = ""
    negative_prompt: str = ""
    notes: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CharacterCreate(BaseModel):
    name: str
    role_summary: str = ""
    soul_id_status: SoulIdStatus = "NOT SET"
    soul_id_image: Optional[str] = None
    reference_images: List[str] = Field(default_factory=list)
    subject: str = ""
    emotion: str = ""
    environment_setting: str = ""
    clothing: str = ""
    lighting_weather: str = ""
    camera_angle_framing: str = ""
    lens_characteristics: str = ""
    eye_details: str = ""
    skin_textures: str = ""
    mouth_lips: str = ""
    hair: str = ""
    atmospheric_texture: str = ""
    color_palette: str = ""
    processing_style: str = ""
    framing: str = ""
    emotional_impact: str = ""
    extras_props: str = ""
    composition_notes: str = ""
    negative_prompt: str = ""
    notes: str = ""


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    role_summary: Optional[str] = None
    soul_id_status: Optional[SoulIdStatus] = None
    soul_id_image: Optional[str] = None
    reference_images: Optional[List[str]] = None
    subject: Optional[str] = None
    emotion: Optional[str] = None
    environment_setting: Optional[str] = None
    clothing: Optional[str] = None
    lighting_weather: Optional[str] = None
    camera_angle_framing: Optional[str] = None
    lens_characteristics: Optional[str] = None
    eye_details: Optional[str] = None
    skin_textures: Optional[str] = None
    mouth_lips: Optional[str] = None
    hair: Optional[str] = None
    atmospheric_texture: Optional[str] = None
    color_palette: Optional[str] = None
    processing_style: Optional[str] = None
    framing: Optional[str] = None
    emotional_impact: Optional[str] = None
    extras_props: Optional[str] = None
    composition_notes: Optional[str] = None
    negative_prompt: Optional[str] = None
    notes: Optional[str] = None


class Location(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    film_id: str
    name: str
    int_ext: str = ""
    visual_grammar: str = ""
    lighting_notes: str = ""
    sound_notes: str = ""
    notes: str = ""
    reference_images: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LocationCreate(BaseModel):
    name: str
    int_ext: str = ""
    visual_grammar: str = ""
    lighting_notes: str = ""
    sound_notes: str = ""
    notes: str = ""
    reference_images: List[str] = Field(default_factory=list)


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    int_ext: Optional[str] = None
    visual_grammar: Optional[str] = None
    lighting_notes: Optional[str] = None
    sound_notes: Optional[str] = None
    notes: Optional[str] = None
    reference_images: Optional[List[str]] = None


class ImportPayload(BaseModel):
    text: str  # CSV or markdown table content


class Iteration(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shot_id: str
    kind: IterationKind = "VIDEO"
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
    kind: IterationKind = "VIDEO"
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
    await db.characters.delete_many({"film_id": film_id})
    await db.locations.delete_many({"film_id": film_id})
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
async def list_iterations(shot_id: str, kind: Optional[str] = None):
    q = {"shot_id": shot_id}
    if kind in ("STILL", "VIDEO"):
        q["kind"] = kind
    its = await db.iterations.find(q, {"_id": 0}).sort("attempt_number", 1).to_list(1000)
    for it in its:
        deserialize_dt(it, ["created_at"])
        # backfill kind for legacy iterations
        if not it.get("kind"):
            it["kind"] = "VIDEO"
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

    is_still = payload.kind == "STILL"
    counter_field = "still_count" if is_still else "attempt_count"
    promoted_field = "current_still" if is_still else "current_thumbnail"

    next_attempt = (shot.get(counter_field) or 0) + 1
    iteration = Iteration(shot_id=shot_id, attempt_number=next_attempt, **payload.model_dump())
    doc = serialize_dt(iteration.model_dump())
    await db.iterations.insert_one(doc)

    shot_updates = {counter_field: next_attempt}

    if payload.decision == "FINAL":
        if is_still:
            # FINAL still: promote still thumbnail. Do NOT change shot status — that tracks video completion.
            if payload.thumbnail:
                shot_updates[promoted_field] = payload.thumbnail
        else:
            # FINAL video: status -> FINAL and promote video thumbnail
            shot_updates["status"] = "FINAL"
            if payload.thumbnail:
                shot_updates[promoted_field] = payload.thumbnail
    else:
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
    counter_field = "still_count" if it.get("kind") == "STILL" else "attempt_count"
    await db.shots.update_one({"id": it["shot_id"]}, {"$inc": {counter_field: -1}})
    return {"ok": True}


# ---------------- IMPORT ----------------
@api_router.post("/films/{film_id}/import")
async def import_shots(film_id: str, payload: ImportPayload):
    f = await db.films.find_one({"id": film_id}, {"_id": 0})
    if not f:
        raise HTTPException(404, "Film not found")
    parsed_shots, warnings, fmt = parse_input(payload.text)
    if not parsed_shots:
        raise HTTPException(400, f"No valid shots found. Warnings: {warnings}")

    created = 0
    updated = 0
    skipped_warnings = list(warnings)
    for s in parsed_shots:
        # upsert by (film_id, shot_number)
        existing = await db.shots.find_one(
            {"film_id": film_id, "shot_number": s["shot_number"]}, {"_id": 0}
        )
        if existing:
            update = {k: v for k, v in s.items() if v not in (None, "") or k in ("emotion_level",)}
            update["sort_key"] = shot_sort_key(s["shot_number"])
            await db.shots.update_one(
                {"id": existing["id"]}, {"$set": update}
            )
            updated += 1
        else:
            data = dict(s)
            data["film_id"] = film_id
            data["sort_key"] = shot_sort_key(s["shot_number"])
            shot = Shot(**data)
            await db.shots.insert_one(serialize_dt(shot.model_dump()))
            created += 1
    return {
        "format": fmt,
        "created": created,
        "updated": updated,
        "warnings": skipped_warnings,
    }


# ---------------- LESSONS ----------------
@api_router.get("/films/{film_id}/lessons")
async def lessons(film_id: str):
    """Aggregate iteration learnings grouped by Model x Location.
    Returns groups with what_failed/what_worked/notes entries plus counts by decision."""
    shots = await db.shots.find({"film_id": film_id}, {"_id": 0}).to_list(10000)
    if not shots:
        return {"film_id": film_id, "groups": [], "summary": {}}
    shot_by_id = {s["id"]: s for s in shots}
    shot_ids = [s["id"] for s in shots]

    iters = await db.iterations.find(
        {"shot_id": {"$in": shot_ids}}, {"_id": 0}
    ).sort("created_at", 1).to_list(10000)

    groups = {}  # key: (model_used, location)
    summary = {"total_iterations": len(iters), "by_model": {}, "by_decision": {"DISCARD": 0, "KEEP": 0, "FINAL": 0}}

    for it in iters:
        shot = shot_by_id.get(it["shot_id"])
        if not shot:
            continue
        loc = shot.get("location") or "—"
        model = it["model_used"]
        key = (model, loc)
        if key not in groups:
            groups[key] = {
                "model": model,
                "location": loc,
                "iterations": [],
                "counts": {"DISCARD": 0, "KEEP": 0, "FINAL": 0},
            }
        g = groups[key]
        g["counts"][it["decision"]] += 1
        g["iterations"].append({
            "id": it["id"],
            "shot_id": it["shot_id"],
            "shot_number": shot["shot_number"],
            "attempt_number": it["attempt_number"],
            "decision": it["decision"],
            "kind": it.get("kind", "VIDEO"),
            "created_at": it["created_at"],
            "what_failed": it["what_failed"],
            "what_worked": it["what_worked"],
            "notes": it.get("notes", ""),
            "prompt_excerpt": (it.get("prompt_text") or "")[:200],
        })
        summary["by_model"][model] = summary["by_model"].get(model, 0) + 1
        summary["by_decision"][it["decision"]] += 1

    group_list = sorted(
        groups.values(), key=lambda g: (g["model"], g["location"])
    )
    return {"film_id": film_id, "groups": group_list, "summary": summary}


# ---------------- CHARACTERS ----------------
@api_router.get("/films/{film_id}/characters", response_model=List[Character])
async def list_characters(film_id: str):
    chars = await db.characters.find({"film_id": film_id}, {"_id": 0}).sort("name", 1).to_list(1000)
    for c in chars:
        deserialize_dt(c, ["created_at"])
    return chars


@api_router.post("/films/{film_id}/characters", response_model=Character)
async def create_character(film_id: str, payload: CharacterCreate):
    f = await db.films.find_one({"id": film_id}, {"_id": 0})
    if not f:
        raise HTTPException(404, "Film not found")
    data = payload.model_dump()
    data["film_id"] = film_id
    char = Character(**data)
    await db.characters.insert_one(serialize_dt(char.model_dump()))
    return char


@api_router.get("/characters/{char_id}", response_model=Character)
async def get_character(char_id: str):
    c = await db.characters.find_one({"id": char_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Character not found")
    deserialize_dt(c, ["created_at"])
    return c


@api_router.patch("/characters/{char_id}", response_model=Character)
async def update_character(char_id: str, payload: CharacterUpdate):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields to update")
    result = await db.characters.find_one_and_update(
        {"id": char_id}, {"$set": update}, return_document=True, projection={"_id": 0}
    )
    if not result:
        raise HTTPException(404, "Character not found")
    deserialize_dt(result, ["created_at"])
    return result


@api_router.delete("/characters/{char_id}")
async def delete_character(char_id: str):
    c = await db.characters.find_one({"id": char_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Character not found")
    # remove from any shot.character_ids
    await db.shots.update_many(
        {"film_id": c["film_id"], "character_ids": char_id},
        {"$pull": {"character_ids": char_id}},
    )
    await db.characters.delete_one({"id": char_id})
    return {"ok": True}


@api_router.get("/characters/{char_id}/shots", response_model=List[Shot])
async def shots_for_character(char_id: str):
    shots = await db.shots.find({"character_ids": char_id}, {"_id": 0}).sort("sort_key", 1).to_list(10000)
    for s in shots:
        deserialize_dt(s, ["created_at"])
    return shots


# ---------------- LOCATIONS ----------------
@api_router.get("/films/{film_id}/locations", response_model=List[Location])
async def list_locations(film_id: str):
    locs = await db.locations.find({"film_id": film_id}, {"_id": 0}).sort("name", 1).to_list(1000)
    for l in locs:
        deserialize_dt(l, ["created_at"])
    return locs


@api_router.post("/films/{film_id}/locations", response_model=Location)
async def create_location(film_id: str, payload: LocationCreate):
    f = await db.films.find_one({"id": film_id}, {"_id": 0})
    if not f:
        raise HTTPException(404, "Film not found")
    data = payload.model_dump()
    data["film_id"] = film_id
    loc = Location(**data)
    await db.locations.insert_one(serialize_dt(loc.model_dump()))
    return loc


@api_router.get("/locations/{loc_id}", response_model=Location)
async def get_location(loc_id: str):
    l = await db.locations.find_one({"id": loc_id}, {"_id": 0})
    if not l:
        raise HTTPException(404, "Location not found")
    deserialize_dt(l, ["created_at"])
    return l


@api_router.patch("/locations/{loc_id}", response_model=Location)
async def update_location(loc_id: str, payload: LocationUpdate):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields to update")
    result = await db.locations.find_one_and_update(
        {"id": loc_id}, {"$set": update}, return_document=True, projection={"_id": 0}
    )
    if not result:
        raise HTTPException(404, "Location not found")
    deserialize_dt(result, ["created_at"])
    return result


@api_router.delete("/locations/{loc_id}")
async def delete_location(loc_id: str):
    l = await db.locations.find_one({"id": loc_id}, {"_id": 0})
    if not l:
        raise HTTPException(404, "Location not found")
    await db.shots.update_many(
        {"film_id": l["film_id"], "location_id": loc_id},
        {"$set": {"location_id": None}},
    )
    await db.locations.delete_one({"id": loc_id})
    return {"ok": True}


@api_router.get("/locations/{loc_id}/shots", response_model=List[Shot])
async def shots_for_location(loc_id: str):
    shots = await db.shots.find({"location_id": loc_id}, {"_id": 0}).sort("sort_key", 1).to_list(10000)
    for s in shots:
        deserialize_dt(s, ["created_at"])
    return shots


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

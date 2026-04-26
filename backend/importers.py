"""Markdown table & CSV parsers for shot list import.
Tolerant to column-name variations and column order."""
import csv
import io
import re
from typing import List, Dict, Tuple

# Maps any reasonable header to canonical schema key.
HEADER_ALIASES = {
    "shot": "shot_number", "shot #": "shot_number", "shot_number": "shot_number", "shot number": "shot_number", "shotnum": "shot_number", "no": "shot_number", "no.": "shot_number", "#": "shot_number",
    "scene": "_scene_ignore", "scene #": "_scene_ignore", "scene number": "_scene_ignore",
    "filename": "filename", "file": "filename", "file name": "filename",
    "model": "model_assigned", "model_assigned": "model_assigned", "assigned model": "model_assigned",
    "location": "location", "loc": "location", "setting": "location",
    "int/ext": "int_ext", "int_ext": "int_ext", "intext": "int_ext", "interior/exterior": "int_ext",
    "time of day": "time_of_day", "time": "time_of_day", "tod": "time_of_day", "time_of_day": "time_of_day",
    "shot type": "shot_type", "type": "shot_type", "shot_type": "shot_type",
    "framing": "framing",
    "camera": "camera", "camera move": "camera",
    "action / subject": "action_summary", "action/subject": "action_summary", "action": "action_summary", "action_summary": "action_summary", "action summary": "action_summary", "subject": "action_summary",
    "est. duration": "duration", "est duration": "duration", "estimated duration": "duration", "duration": "duration",
    "emotion (0–10)": "emotion_level", "emotion (0-10)": "emotion_level", "emotion": "emotion_level", "emotion_level": "emotion_level", "emotion level": "emotion_level",
    "audio notes": "audio_notes", "audio": "audio_notes", "audio_notes": "audio_notes", "sound": "audio_notes", "sound notes": "audio_notes",
    "special notes": "special_notes", "notes": "special_notes", "special_notes": "special_notes",
    "act": "act",
    "status": "status",
}

ACT_NORMALIZE = {
    "1": "ACT 1", "act 1": "ACT 1", "i": "ACT 1", "act i": "ACT 1", "act1": "ACT 1",
    "2": "ACT 2", "act 2": "ACT 2", "ii": "ACT 2", "act ii": "ACT 2", "act2": "ACT 2",
    "3": "ACT 3", "act 3": "ACT 3", "iii": "ACT 3", "act iii": "ACT 3", "act3": "ACT 3",
}

VALID_MODELS = {"Kling 3.0", "Veo 3.1 Fast", "WAN 2.6", "Sora 2", "Seedream 5.0 Lite", "Flux 1.1"}
VALID_SHOT_TYPES = {"ECU", "CU", "MS", "WS", "Insert"}
VALID_STATUSES = {"NOT STARTED", "IN PROGRESS", "FINAL", "CUT"}


def _norm_key(k: str) -> str:
    return k.strip().lower().replace("\u2013", "-").replace("\u2014", "-")


def _normalize_model(v: str) -> str:
    if not v:
        return "Kling 3.0"
    s = v.strip()
    for m in VALID_MODELS:
        if s.lower().startswith(m.lower()) or m.lower() in s.lower():
            return m
    # Common short forms
    if "kling" in s.lower(): return "Kling 3.0"
    if "veo" in s.lower(): return "Veo 3.1 Fast"
    if "wan" in s.lower(): return "WAN 2.6"
    if "sora" in s.lower(): return "Sora 2"
    if "seedream" in s.lower(): return "Seedream 5.0 Lite"
    if "flux" in s.lower(): return "Flux 1.1"
    return "Kling 3.0"


def _normalize_shot_type(v: str) -> str:
    if not v:
        return "MS"
    s = v.strip().upper()
    for t in VALID_SHOT_TYPES:
        if s == t.upper() or s.startswith(t.upper()):
            return t
    return "MS"


def _normalize_act(v: str, fallback="ACT 1") -> str:
    if not v: return fallback
    s = v.strip().lower()
    return ACT_NORMALIZE.get(s, fallback)


def _normalize_status(v: str) -> str:
    if not v: return "NOT STARTED"
    s = v.strip().upper()
    if s in VALID_STATUSES: return s
    if "PROGRESS" in s: return "IN PROGRESS"
    if "FINAL" in s or "DONE" in s or "COMPLETE" in s: return "FINAL"
    if "CUT" in s or "KILLED" in s: return "CUT"
    return "NOT STARTED"


def _act_from_filename_or_shotnum(filename: str, shot_number: str) -> str:
    s = (filename or "").upper()
    if "ACT1" in s or "ACT_1" in s: return "ACT 1"
    if "ACT2" in s or "ACT_2" in s: return "ACT 2"
    if "ACT3" in s or "ACT_3" in s: return "ACT 3"
    return "ACT 1"


def _emotion(v) -> int:
    if v is None or v == "": return 0
    s = str(v).strip()
    m = re.match(r"(\d+)", s)
    if m:
        try:
            n = int(m.group(1))
            return max(0, min(10, n))
        except ValueError:
            return 0
    return 0


def parse_markdown_table(text: str) -> List[List[str]]:
    """Find first markdown table in text and return rows as list of cell-string lists.
    Skips separator row and any rows that are not body."""
    lines = text.splitlines()
    rows = []
    in_table = False
    for line in lines:
        l = line.strip()
        if l.startswith("|") and l.endswith("|"):
            if re.match(r"^\|\s*[:\-\s|]+\|$", l):
                in_table = True
                continue  # separator
            cells = [c.strip() for c in l.strip("|").split("|")]
            rows.append(cells)
            in_table = True
        else:
            if in_table:
                # left the table
                break
    return rows


def parse_csv(text: str) -> List[List[str]]:
    reader = csv.reader(io.StringIO(text))
    return [row for row in reader if any(c.strip() for c in row)]


def detect_format(text: str) -> str:
    """Returns 'markdown' or 'csv'."""
    s = text.strip()
    # Look for markdown table opening
    for line in s.splitlines()[:50]:
        ll = line.strip()
        if ll.startswith("|") and ll.endswith("|") and ll.count("|") >= 3:
            return "markdown"
    return "csv"


def rows_to_shots(rows: List[List[str]]) -> Tuple[List[Dict], List[str]]:
    """Convert raw rows (first row = header) to shot dicts.
    Returns (shots, warnings)."""
    if len(rows) < 2:
        return [], ["No data rows found."]

    raw_headers = rows[0]
    headers = []
    for h in raw_headers:
        norm = _norm_key(h)
        canonical = HEADER_ALIASES.get(norm, norm)
        headers.append(canonical)

    if "shot_number" not in headers:
        # Try heuristic: first column
        return [], [f"Could not find a 'shot_number' / 'shot #' column. Found: {raw_headers}"]

    shots = []
    warnings = []
    for ri, row in enumerate(rows[1:], start=2):
        if all(not c.strip() for c in row):
            continue
        # Pad row to header length
        row = list(row) + [""] * (len(headers) - len(row))
        rec = {}
        for i, h in enumerate(headers):
            if h.startswith("_") or h not in (
                "shot_number", "filename", "model_assigned", "location",
                "int_ext", "time_of_day", "shot_type", "framing", "camera",
                "action_summary", "duration", "emotion_level", "audio_notes",
                "special_notes", "act", "status"
            ):
                continue
            rec[h] = row[i].strip() if i < len(row) else ""

        if not rec.get("shot_number"):
            continue
        # Strip wrapping ** or markdown emphasis
        rec["shot_number"] = re.sub(r"[\*`]+", "", rec["shot_number"]).strip()
        if not rec["shot_number"]:
            continue

        # Normalize values
        rec["model_assigned"] = _normalize_model(rec.get("model_assigned", ""))
        rec["shot_type"] = _normalize_shot_type(rec.get("shot_type", ""))
        rec["act"] = _normalize_act(rec.get("act", ""), fallback=_act_from_filename_or_shotnum(rec.get("filename", ""), rec["shot_number"]))
        rec["status"] = _normalize_status(rec.get("status", ""))
        rec["emotion_level"] = _emotion(rec.get("emotion_level"))
        # Defaults for missing strings
        for k in ("filename", "location", "int_ext", "time_of_day", "framing", "camera",
                  "action_summary", "duration", "audio_notes", "special_notes"):
            rec.setdefault(k, "")
        # Strip .mp4 from filename - keep as-is, user choice
        shots.append(rec)

    if not shots:
        warnings.append("No shots produced from the input.")
    return shots, warnings


def parse_input(text: str) -> Tuple[List[Dict], List[str], str]:
    """Top-level parser. Returns (shots, warnings, detected_format)."""
    fmt = detect_format(text)
    if fmt == "markdown":
        rows = parse_markdown_table(text)
    else:
        rows = parse_csv(text)
    shots, warnings = rows_to_shots(rows)
    return shots, warnings, fmt

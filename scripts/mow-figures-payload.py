"""Build the ingest payload for .github/workflows/mow-figures.yml.

A separate file rather than a heredoc inside the workflow: nested heredocs in a YAML `run:` block
are whitespace-sensitive and fail in ways that are hard to read in Actions logs.

Figures arrive as strings from workflow inputs, may carry thousands separators, and any of them
may be blank — a partial payload is legitimate and the route leaves the other figures alone.
"""
import json
import os
import sys

KEYS = (("leads", "LEADS"), ("revenue", "REVENUE"), ("email_revenue", "EMAIL_REVENUE"))

figures = {}
for key, env in KEYS:
    raw = (os.environ.get(env) or "").strip().replace(",", "").replace("$", "")
    if not raw:
        continue
    try:
        figures[key] = float(raw)
    except ValueError:
        sys.exit(f"::error::{env}={raw!r} is not a number")

if not figures:
    sys.exit("::error::no figures supplied — give at least one of leads / revenue / emailRevenue")

week_of = (os.environ.get("WEEK_OF") or "").strip()
if len(week_of) != 10:
    sys.exit(f"::error::weekOf={week_of!r} must be YYYY-MM-DD")

body = {"weekOf": week_of, "source": "session:metabase", "figures": figures}

brands = [b.strip() for b in (os.environ.get("BRANDS") or "").split(",") if b.strip()]
if brands:
    body["brands"] = brands

print(json.dumps(body))

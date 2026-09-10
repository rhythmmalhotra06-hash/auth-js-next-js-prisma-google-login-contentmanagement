"""Fail the run when an ingest silently changed nothing.

`updated: []` alongside a populated `skippedCommitted` is CORRECT — a human committed that week and
the snapshot must not move. Both empty means the figures went nowhere, which a 200 would otherwise
hide.
"""
import json
import sys

r = json.load(open("/tmp/resp.json"))
if not r.get("updated") and not r.get("skippedCommitted"):
    sys.exit("::error::nothing was updated — check weekOf and brands")

print("updated:", r.get("updated"))
print("skipped (already committed):", r.get("skippedCommitted"))
if r.get("missingFigure"):
    print("::warning::no figure for this brand's headline metric:", r["missingFigure"])

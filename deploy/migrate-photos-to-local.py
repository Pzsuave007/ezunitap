#!/usr/bin/env python3
"""Migrate existing photos from Emergent Object Storage to LOCAL disk.

Run ONCE on the production server AFTER deploying (so STORAGE_BACKEND=local is set):
    cd /opt/ezunitap/backend && python3 /home/ezunitap/repo/deploy/migrate-photos-to-local.py

It downloads every photo currently stored on Emergent and re-stores it on this
server's disk (UPLOADS_DIR), then flips the photo's storage_backend to 'local'.
Safe to re-run: already-local photos are skipped.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/../backend")
sys.path.insert(0, "/opt/ezunitap/backend")
sys.path.insert(0, "/app/backend")

from dotenv import load_dotenv  # noqa: E402

for p in ("/opt/ezunitap/backend/.env", "/app/backend/.env", ".env"):
    if os.path.exists(p):
        load_dotenv(p)
        break

import storage_service  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    local = storage_service.get_backend("local")
    emergent = storage_service.get_backend("emergent")
    ok = skipped = failed = 0
    cursor = db.photos.find({"is_deleted": {"$ne": True}}, {"_id": 0, "id": 1, "storage_path": 1, "storage_backend": 1, "content_type": 1})
    async for doc in cursor:
        if (doc.get("storage_backend") or "emergent") == "local":
            skipped += 1
            continue
        path = doc.get("storage_path")
        if not path:
            failed += 1
            continue
        try:
            data, ct = await asyncio.to_thread(emergent.get, path)
            await asyncio.to_thread(local.put, path, data, doc.get("content_type") or ct or "image/jpeg")
            await db.photos.update_one({"id": doc["id"]}, {"$set": {"storage_backend": "local"}})
            ok += 1
            print(f"  migrated {doc['id']}")
        except Exception as e:
            failed += 1
            print(f"  FAILED {doc['id']}: {e!r}")
    print(f"\nDone. migrated={ok} skipped(local)={skipped} failed={failed}")
    if failed:
        print("Failed ones may be missing on Emergent; re-add those photos in the app.")


if __name__ == "__main__":
    asyncio.run(main())

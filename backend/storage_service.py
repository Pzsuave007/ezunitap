"""Storage abstraction layer.

Default backend: Emergent Object Storage.
To migrate to a self-hosted server later, implement a new backend with the same
StorageBackend interface and switch `_backend` instance.
"""
from __future__ import annotations

import logging
import mimetypes
import os
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Tuple

import requests

logger = logging.getLogger(__name__)

EMERGENT_STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"


class StorageBackend(ABC):
    name = "base"

    @abstractmethod
    def put(self, path: str, data: bytes, content_type: str) -> dict: ...

    @abstractmethod
    def get(self, path: str) -> Tuple[bytes, str]: ...


class LocalDiskStorage(StorageBackend):
    """Stores files on the local (persistent) disk. Use this in self-hosted
    production where the Emergent Object Storage isn't reachable. Set
    STORAGE_BACKEND=local and (optionally) UPLOADS_DIR=/absolute/persistent/path."""

    name = "local"

    def __init__(self, base_dir: str):
        self.base = Path(base_dir)
        self.base.mkdir(parents=True, exist_ok=True)

    def put(self, path: str, data: bytes, content_type: str) -> dict:
        fp = self.base / path
        fp.parent.mkdir(parents=True, exist_ok=True)
        fp.write_bytes(data)
        return {"path": path, "size": len(data)}

    def get(self, path: str) -> Tuple[bytes, str]:
        fp = self.base / path
        data = fp.read_bytes()
        ct = mimetypes.guess_type(str(fp))[0] or "application/octet-stream"
        return data, ct


class EmergentObjectStorage(StorageBackend):
    name = "emergent"

    def __init__(self, emergent_key: str):
        self.emergent_key = emergent_key
        self._storage_key: str | None = None

    def _init_session(self) -> str:
        if self._storage_key:
            return self._storage_key
        resp = requests.post(
            f"{EMERGENT_STORAGE_URL}/init",
            json={"emergent_key": self.emergent_key},
            timeout=30,
        )
        resp.raise_for_status()
        self._storage_key = resp.json()["storage_key"]
        return self._storage_key

    def put(self, path: str, data: bytes, content_type: str) -> dict:
        key = self._init_session()
        resp = requests.put(
            f"{EMERGENT_STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=45,
        )
        if resp.status_code == 403:
            # Refresh key once
            self._storage_key = None
            key = self._init_session()
            resp = requests.put(
                f"{EMERGENT_STORAGE_URL}/objects/{path}",
                headers={"X-Storage-Key": key, "Content-Type": content_type},
                data=data,
                timeout=45,
            )
        resp.raise_for_status()
        return resp.json()

    def get(self, path: str) -> Tuple[bytes, str]:
        key = self._init_session()
        resp = requests.get(
            f"{EMERGENT_STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key},
            timeout=30,
        )
        if resp.status_code == 403:
            self._storage_key = None
            key = self._init_session()
            resp = requests.get(
                f"{EMERGENT_STORAGE_URL}/objects/{path}",
                headers={"X-Storage-Key": key},
                timeout=30,
            )
        resp.raise_for_status()
        return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# Module-level singletons (one per backend kind, so we can serve objects that
# were stored by a different backend than the current default).
_backend: StorageBackend | None = None
_by_name: dict = {}


def _make_backend(kind: str) -> StorageBackend:
    kind = (kind or "").strip().lower()
    if kind == "local":
        return LocalDiskStorage(os.environ.get("UPLOADS_DIR", "/app/uploads"))
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise RuntimeError("EMERGENT_LLM_KEY not set")
    return EmergentObjectStorage(key)


def get_storage() -> StorageBackend:
    """Default backend for NEW uploads. Chosen by STORAGE_BACKEND env
    ('local' for self-hosted production, otherwise Emergent Object Storage)."""
    global _backend
    if _backend is None:
        _backend = _make_backend(os.environ.get("STORAGE_BACKEND", "emergent"))
    return _backend


def get_backend(name: str | None = None) -> StorageBackend:
    """Return the backend that stored a given object (from the photo doc's
    `storage_backend` field). Falls back to the current default when unknown."""
    if not name:
        return get_storage()
    name = name.strip().lower()
    if name not in _by_name:
        try:
            _by_name[name] = _make_backend(name)
        except Exception as e:
            logger.error("Cannot build storage backend %r: %s", name, e)
            return get_storage()
    return _by_name[name]


def init_storage_at_startup() -> None:
    try:
        backend = get_storage()
        if isinstance(backend, EmergentObjectStorage):
            backend._init_session()
        logger.info("Storage initialized successfully (%s)", getattr(backend, "name", "?"))
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

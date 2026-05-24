"""Storage abstraction layer.

Default backend: Emergent Object Storage.
To migrate to a self-hosted server later, implement a new backend with the same
StorageBackend interface and switch `_backend` instance.
"""
from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod
from typing import Tuple

import requests

logger = logging.getLogger(__name__)

EMERGENT_STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"


class StorageBackend(ABC):
    @abstractmethod
    def put(self, path: str, data: bytes, content_type: str) -> dict: ...

    @abstractmethod
    def get(self, path: str) -> Tuple[bytes, str]: ...


class EmergentObjectStorage(StorageBackend):
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
            timeout=120,
        )
        if resp.status_code == 403:
            # Refresh key once
            self._storage_key = None
            key = self._init_session()
            resp = requests.put(
                f"{EMERGENT_STORAGE_URL}/objects/{path}",
                headers={"X-Storage-Key": key, "Content-Type": content_type},
                data=data,
                timeout=120,
            )
        resp.raise_for_status()
        return resp.json()

    def get(self, path: str) -> Tuple[bytes, str]:
        key = self._init_session()
        resp = requests.get(
            f"{EMERGENT_STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key},
            timeout=60,
        )
        if resp.status_code == 403:
            self._storage_key = None
            key = self._init_session()
            resp = requests.get(
                f"{EMERGENT_STORAGE_URL}/objects/{path}",
                headers={"X-Storage-Key": key},
                timeout=60,
            )
        resp.raise_for_status()
        return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# Module-level singleton
_backend: StorageBackend | None = None


def get_storage() -> StorageBackend:
    global _backend
    if _backend is None:
        key = os.environ.get("EMERGENT_LLM_KEY")
        if not key:
            raise RuntimeError("EMERGENT_LLM_KEY not set")
        _backend = EmergentObjectStorage(key)
    return _backend


def init_storage_at_startup() -> None:
    try:
        backend = get_storage()
        if isinstance(backend, EmergentObjectStorage):
            backend._init_session()
        logger.info("Storage initialized successfully")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

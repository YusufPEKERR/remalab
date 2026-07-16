"""Keşif ve ayrıştırma adımlarını birleştirip katalog satırlarını üretir."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

from requests import Session

from . import config
from .discovery import discover_all_spec_pages
from .normalize import model_family
from .spec_parser import parse_spec_page

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CatalogRow:
    brand: str
    category: str
    model_family: str
    model: str
    storage: str
    color: str

    def as_tuple(self) -> tuple[str, str, str, str, str, str]:
        return (self.brand, self.category, self.model_family, self.model, self.storage, self.color)


def build_catalog(session: Session) -> list[CatalogRow]:
    spec_pages = discover_all_spec_pages(session)

    rows: list[CatalogRow] = []
    seen: set[tuple[str, str, str, str, str, str]] = set()

    for spec_page in spec_pages:
        specs = parse_spec_page(session, spec_page.spec_url, spec_page.name)
        time.sleep(config.REQUEST_DELAY_SECONDS)

        if specs is None:
            continue

        family = model_family(spec_page.name)

        for storage in specs.storages:
            for color in specs.colors:
                row = CatalogRow(
                    brand=config.BRAND,
                    category=config.CATEGORY,
                    model_family=family,
                    model=spec_page.name,
                    storage=storage,
                    color=color,
                )
                key = row.as_tuple()
                if key in seen:
                    continue
                seen.add(key)
                rows.append(row)

    logger.info("Toplam %d benzersiz katalog satırı üretildi.", len(rows))
    return rows

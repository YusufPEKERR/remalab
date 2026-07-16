"""Bir iPhone teknik özellik sayfasından Depolama (Capacity) ve
Renk (Finish/Color) listelerini çıkarır.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from bs4 import BeautifulSoup
from requests import Session

from .http_client import fetch_html
from .normalize import split_capacity_entry, split_color_entry

logger = logging.getLogger(__name__)

_FINISH_HEADERS = ("finish", "color")
_CAPACITY_HEADERS = ("capacity",)


@dataclass(frozen=True)
class ModelSpecs:
    colors: list[str]
    storages: list[str]


def _find_list_after_header(soup: BeautifulSoup, header_prefixes: tuple[str, ...]):
    for header in soup.find_all(["h3", "h2"]):
        header_text = header.get_text().strip().lower()
        if any(header_text.startswith(prefix) for prefix in header_prefixes):
            list_el = header.find_next_sibling("ul")
            if list_el is not None:
                return list_el
    return None


def parse_spec_page(session: Session, spec_url: str, model_name: str) -> ModelSpecs | None:
    html = fetch_html(session, spec_url)
    if html is None:
        logger.error("Teknik özellik sayfası alınamadı: %s (%s)", model_name, spec_url)
        return None

    soup = BeautifulSoup(html, "html.parser")

    finish_list = _find_list_after_header(soup, _FINISH_HEADERS)
    capacity_list = _find_list_after_header(soup, _CAPACITY_HEADERS)

    if finish_list is None:
        logger.warning("'Finish/Color' bölümü bulunamadı, model atlanıyor: %s (%s)", model_name, spec_url)
        return None
    if capacity_list is None:
        logger.warning("'Capacity' bölümü bulunamadı, model atlanıyor: %s (%s)", model_name, spec_url)
        return None

    colors: list[str] = []
    for item in finish_list.find_all("li"):
        colors.extend(split_color_entry(item.get_text()))

    storages: list[str] = []
    for item in capacity_list.find_all("li"):
        storages.extend(split_capacity_entry(item.get_text()))

    colors = list(dict.fromkeys(colors))
    storages = list(dict.fromkeys(storages))

    if not colors or not storages:
        logger.warning(
            "Renk veya depolama listesi boş çıktı, model atlanıyor: %s (%s)", model_name, spec_url
        )
        return None

    return ModelSpecs(colors=colors, storages=storages)

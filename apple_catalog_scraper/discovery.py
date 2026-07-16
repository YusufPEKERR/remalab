"""Apple destek sitesindeki iPhone modellerini ve teknik özellik
sayfalarının adreslerini keşfeder.

Kaynak: https://support.apple.com/en-us/docs/iphone
Bu sayfa, her iPhone modeli için `/en-us/docs/iphone/{id}` adresinde bir
ürün alt sayfasına bağlantı verir. O alt sayfanın içinde de asıl teknik
özellik makalesine (`/en-us/{article_id}`) giden bir bağlantı bulunur.
"""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass

from bs4 import BeautifulSoup
from requests import Session

from . import config
from .http_client import fetch_html

logger = logging.getLogger(__name__)

_MODEL_LINK_RE = re.compile(
    r'href="(https://support\.apple\.com/en-us/docs/iphone/\d+)"'
    r'[^>]*data-ss-analytics-link-text="([^"]+)"'
)
_TECH_SPECS_LINK_RE = re.compile(
    r'docs-product-documentation-techSpecs.*?href="([^"]+)"', re.S
)


@dataclass(frozen=True)
class ModelRef:
    name: str
    docs_url: str


@dataclass(frozen=True)
class ModelSpecPage:
    name: str
    spec_url: str


def _is_real_iphone_model(name: str) -> bool:
    if not name.startswith("iPhone"):
        return False
    return not any(keyword in name for keyword in config.ACCESSORY_KEYWORDS)


def discover_iphone_models(session: Session) -> list[ModelRef]:
    """iPhone doküman indeksinden tüm gerçek iPhone modellerini listeler."""
    html = fetch_html(session, config.DOCS_INDEX_URL)
    if html is None:
        logger.error("iPhone doküman indeksi alınamadı, keşif yapılamıyor.")
        return []

    seen: dict[str, str] = {}
    for docs_url, name in _MODEL_LINK_RE.findall(html):
        clean_name = BeautifulSoup(name, "html.parser").get_text().strip()
        if _is_real_iphone_model(clean_name):
            seen[docs_url] = clean_name

    models = [ModelRef(name=name, docs_url=url) for url, name in seen.items()]
    logger.info("İndeks sayfasında %d iPhone modeli bulundu.", len(models))
    return models


def resolve_spec_page(session: Session, model: ModelRef) -> ModelSpecPage | None:
    """Bir modelin ürün alt sayfasından asıl teknik özellik makalesini bulur."""
    html = fetch_html(session, model.docs_url)
    if html is None:
        logger.error("Model alt sayfası alınamadı: %s (%s)", model.name, model.docs_url)
        return None

    match = _TECH_SPECS_LINK_RE.search(html)
    if not match:
        logger.warning(
            "Teknik özellik bağlantısı bulunamadı, model atlanıyor: %s (%s)",
            model.name,
            model.docs_url,
        )
        return None

    return ModelSpecPage(name=model.name, spec_url=match.group(1))


def discover_all_spec_pages(session: Session) -> list[ModelSpecPage]:
    """Tüm iPhone modellerini keşfeder ve teknik özellik sayfası adreslerini döner."""
    models = discover_iphone_models(session)
    spec_pages: list[ModelSpecPage] = []

    for model in models:
        spec_page = resolve_spec_page(session, model)
        if spec_page is not None:
            spec_pages.append(spec_page)
        time.sleep(config.REQUEST_DELAY_SECONDS)

    logger.info(
        "%d / %d model için teknik özellik sayfası bulundu.",
        len(spec_pages),
        len(models),
    )
    return spec_pages

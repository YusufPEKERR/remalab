"""Model ailesi, depolama ve renk metinlerini normalize eden yardımcılar."""

from __future__ import annotations

import logging
import re

from . import config

logger = logging.getLogger(__name__)

_TRADEMARK_CHARS = str.maketrans("", "", "™®©")
_CAPACITY_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*(TB|GB|MB)", re.IGNORECASE)


def model_family(model_name: str) -> str:
    """"iPhone 13 Pro Max" -> "iPhone 13", "iPhone XS Max" -> "iPhone XS" gibi
    model ailesini, bilinen sonekleri sondan kırparak çıkarır. Sonek yoksa
    (örn. "iPhone 13", "iPhone SE (3rd generation)") model adının kendisi
    aile olarak kabul edilir.
    """
    for suffix in config.FAMILY_SUFFIXES:
        if model_name.endswith(suffix):
            return model_name[: -len(suffix)].strip()
    return model_name


def clean_color(raw_text: str) -> str:
    text = raw_text.translate(_TRADEMARK_CHARS)
    text = re.sub(r"\s+", " ", text).strip()
    text = text.rstrip(".")
    return text


def split_color_entry(raw_text: str) -> list[str]:
    """Çoğu satır tek bir renk adıdır. Bazı eski model sayfalarında
    "16GB model: Black or white" gibi düzyazı biçimli satırlar da olabilir;
    bu durumda başlığı loglayıp kalan kısmı renklere ayırıyoruz.
    """
    text = clean_color(raw_text)

    prose_match = re.match(r"^\d+\s*[A-Za-z]*\s*model:\s*(.+)$", text, re.IGNORECASE)
    is_prose = prose_match is not None
    if is_prose:
        logger.warning("Alışılmadık 'Finish/Color' metni bulundu, en iyi çaba ile ayrıştırılıyor: %r", raw_text)
        text = prose_match.group(1)

    parts = re.split(r"\s*(?:,|/|\bor\b|\band\b)\s*", text, flags=re.IGNORECASE)
    if is_prose:
        # Düzyazıdan çıkan parçalar genelde küçük harfli ("black", "white");
        # normal Finish listesindeki özel biçimlendirmeyi (örn. "(PRODUCT)RED")
        # bozmamak için sadece bu düzyazı dalında ilk harfi büyütüyoruz.
        return [p.strip().capitalize() for p in parts if p.strip()]
    return [p.strip() for p in parts if p.strip()]


def split_capacity_entry(raw_text: str) -> list[str]:
    """"128GB" -> ["128 GB"], "8GB or 16GB flash drive" -> ["8 GB", "16 GB"]."""
    text = re.sub(r"\s+", " ", raw_text).strip()
    matches = _CAPACITY_RE.findall(text)

    if not matches:
        logger.warning("Depolama metni ayrıştırılamadı, atlanıyor: %r", raw_text)
        return []

    if len(matches) > 1 or not _CAPACITY_RE.fullmatch(text.replace(" ", "")):
        logger.warning("Alışılmadık depolama metni bulundu, en iyi çaba ile ayrıştırılıyor: %r", raw_text)

    return [f"{number.replace(',', '.')} {unit.upper()}" for number, unit in matches]

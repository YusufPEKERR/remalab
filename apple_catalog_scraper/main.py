"""Apple iPhone cihaz kataloğu scraper'ı için giriş noktası.

Kullanım:
    python -m apple_catalog_scraper.main
"""

from __future__ import annotations

import logging
import os
import sys

from . import config
from .catalog_builder import build_catalog
from .excel_writer import write_catalog_to_excel
from .http_client import build_session


def setup_logging() -> None:
    log_path = os.path.join(os.path.dirname(__file__), config.LOG_FILENAME)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.FileHandler(log_path, encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
    )


def main() -> int:
    setup_logging()
    logger = logging.getLogger("apple_catalog_scraper")

    session = build_session()
    rows = build_catalog(session)

    if not rows:
        logger.error("Hiç katalog satırı üretilemedi, Excel dosyası oluşturulmadı.")
        return 1

    output_path = os.path.join(os.path.dirname(__file__), config.OUTPUT_FILENAME)
    write_catalog_to_excel(rows, output_path)
    logger.info("Tamamlandı. %d satır '%s' dosyasına yazıldı.", len(rows), output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

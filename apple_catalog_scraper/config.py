"""Sabitler ve ayarlar."""

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 RemalabCatalogBot/1.0"
)

REQUEST_TIMEOUT = 20
REQUEST_DELAY_SECONDS = 0.5
MAX_RETRIES = 3

DOCS_INDEX_URL = "https://support.apple.com/en-us/docs/iphone"

BRAND = "Apple"
CATEGORY = "Smartphone"

OUTPUT_FILENAME = "apple_device_catalog.xlsx"
LOG_FILENAME = "apple_scraper.log"

EXCEL_COLUMNS = ["Marka", "Kategori", "Model Ailesi", "Model", "Depolama", "Renk"]

# İndeks sayfasında iPhone olmayan aksesuarları (AirPods, EarPods, MagSafe,
# Smart Battery Case vb.) elemek için kullanılan anahtar kelimeler.
ACCESSORY_KEYWORDS = ("Battery", "Case", "Charger")

# "iPhone 13 Pro Max" -> "iPhone 13" gibi model ailesini çıkarmak için
# sondan denenen ekler (en uzun önce).
FAMILY_SUFFIXES = (
    " Pro Max",
    " Pro",
    " Plus",
    " mini",
    " Max",
)

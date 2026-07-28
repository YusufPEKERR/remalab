"""
Ürün ailesi (product_family) için kısa ürün kodu üretici.

Apple/iPhone ailelerinde zaten elle küratörlüğü yapılmış gerçek kodlar var
(iP12PM, iP12PR, iP16, ... - warehouse.product_family.code). Bu modül aynı
mantığı (marka/hat öneki + model numarası + varyant kısaltması) diğer
14 markaya ve Apple'ın iPhone dışı ürün hatlarına (iPad/AirPods/Watch/MacBook)
uygular. Saf, DB'siz fonksiyonlardır - test edilmesi ve backfill script'i
ile verify script'i tarafından ortak kullanılması kolay olsun diye.
"""
import re
import unicodedata

BRAND_NORMALIZE_MAP = {
    "apple": "APPLE", "asus": "ASUS", "crosscall": "CROSSCALL",
    "fairphone": "FAIRPHONE", "google": "GOOGLE", "huawei": "HUAWEI",
    "lenovo": "LENOVO", "motorola": "MOTOROLA", "nokia": "NOKIA",
    "nothing phone": "NOTHING", "nothing": "NOTHING", "oppo": "OPPO",
    "oneplus": "ONEPLUS", "samsung": "SAMSUNG", "sony": "SONY",
    "xiaomi": "XIAOMI",
}

BRAND_PREFIX_MAP = {
    "SAMSUNG": "GAL", "XIAOMI": "XI", "HUAWEI": "HW", "ONEPLUS": "OP",
    "OPPO": "OPO", "GOOGLE": "PXL", "MOTOROLA": "MOT", "NOKIA": "NOK",
    "ASUS": "ASU", "FAIRPHONE": "FRP", "LENOVO": "LEN", "CROSSCALL": "CRX",
    "SONY": "SNY", "NOTHING": "NTP", "UNKNOWN": "UNK",
}

# Marka adı ailenin short_name'inin başında tekrar ediyorsa (örn. "Huawei Mate 10")
# önekten sonra tekrar yazılmasın diye kırpılan token'lar.
BRAND_NAME_TOKENS = {
    "HUAWEI": ["huawei", "huewei"], "XIAOMI": ["xiaomi", "mi"],
    "ONEPLUS": ["oneplus"], "OPPO": ["oppo"], "GOOGLE": ["google", "pixel"],
    "MOTOROLA": ["motorola"], "SAMSUNG": ["samsung", "galaxy"], "SONY": ["sony"],
    "NOKIA": ["nokia"], "ASUS": ["asus"], "FAIRPHONE": ["fairphone"],
    "LENOVO": ["lenovo"], "CROSSCALL": ["crosscall"], "NOTHING": ["nothing", "phone"],
}

APPLE_LINE_RULES = [
    (re.compile(r"^iphone\b", re.I), "iP"),
    (re.compile(r"^ipad\b", re.I), "iPad"),
    (re.compile(r"^airpods\b", re.I), "APods"),
    (re.compile(r"^apple\s*watch\b", re.I), "AW"),
    (re.compile(r"^mac\s*book\b", re.I), "MB"),
]
APPLE_FALLBACK_PREFIX = "APL"

# En uzun eşleşen ifade önce denenir.
PHRASE_ABBREV = [
    ("pro max", "PM"), ("dual sim", "DS"), ("dual-sim", "DS"),
    ("new edition", "NE"), ("enterprise edition", "EE"),
    ("5g dual", "5GD"), ("5g", "5G"),
]

WORD_ABBREV = {
    "pro": "PR", "ultra": "U", "plus": "P", "lite": "L", "mini": "MN",
    "max": "MX", "note": "N", "edge": "E", "fusion": "FN", "redmi": "RM",
    "nord": "ND", "find": "FD", "reno": "RN", "fold": "FO", "flip": "FL",
    "tab": "TB", "xcover": "XC", "dual": "D", "duos": "D", "gen": "G",
    "generation": "G", "series": "S",
}

DROP_WORDS = {
    "inch", "inches", "for", "icin", "için", "the", "and", "ve", "with",
    "wifi", "wi-fi",
}


def normalize_brand(raw):
    return BRAND_NORMALIZE_MAP.get((raw or "").strip().lower(), "UNKNOWN")


def _strip_accents(s):
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def _clean(short_name):
    s = (short_name or "").strip()
    s = s.replace(" ", " ")
    s = re.sub(r"\s+", " ", s)
    # "10,86 Inch" -> "10.86 Inch" gibi virgüllü ondalıkları normalize et
    s = re.sub(r"(\d),(\d)", r"\1.\2", s)
    # parantezleri kaldır ama içeriğini tut: "(10th Gen)" -> "10th Gen"
    s = s.replace("(", " ").replace(")", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _strip_leading_brand_tokens(clean_name, brand_key):
    tokens = BRAND_NAME_TOKENS.get(brand_key, [])
    words = clean_name.split(" ")
    while words and words[0].lower() in tokens:
        words = words[1:]
    return " ".join(words)


def _apple_line_prefix(clean_name):
    for pattern, prefix in APPLE_LINE_RULES:
        if pattern.match(clean_name):
            remainder = pattern.sub("", clean_name, count=1).strip()
            return prefix, remainder
    return APPLE_FALLBACK_PREFIX, clean_name


def _abbreviate_remainder(remainder):
    text = remainder.lower()
    # "pro+" gibi bitişik artıları ayrı bir token yap ki "pro" kısaltılabilsin
    text = re.sub(r"(?<=[a-z])\+", " +", text)
    for phrase, abbr in PHRASE_ABBREV:
        text = re.sub(r"\b" + re.escape(phrase) + r"\b", " " + abbr + " ", text)

    # ordinal ekleri kırp: "10th" -> "10"
    text = re.sub(r"(\d+)(st|nd|rd|th)\b", r"\1", text)

    raw_tokens = re.split(r"[\s/\-]+", text)
    out = []
    for tok in raw_tokens:
        if not tok:
            continue
        if tok in DROP_WORDS:
            continue
        if tok.isupper() and len(tok) <= 3:
            out.append(tok)
            continue
        mapped = WORD_ABBREV.get(tok.lower())
        if mapped:
            out.append(mapped)
            continue
        out.append(tok)

    slug = "".join(out)
    slug = _strip_accents(slug)
    slug = re.sub(r"[^A-Za-z0-9+]", "", slug)
    return slug.upper()


def generate_family_code(brand_text, short_name, existing_codes_lower):
    """(brand_text, short_name) için kısa, benzersiz bir ürün ailesi kodu üretir.

    existing_codes_lower: lower-case mevcut kodların bulunduğu bir set. Üretilen
    kod bu sete eklenir (çağıran taraf tüm süreç boyunca aynı seti paylaşmalı ki
    art arda üretimlerde çakışma engellensin).
    """
    clean_name = _clean(short_name)
    brand_key = normalize_brand(brand_text)

    if brand_key == "APPLE":
        line_prefix, remainder = _apple_line_prefix(clean_name)
    else:
        line_prefix = BRAND_PREFIX_MAP.get(brand_key, BRAND_PREFIX_MAP["UNKNOWN"])
        remainder = _strip_leading_brand_tokens(clean_name, brand_key)

    slug = _abbreviate_remainder(remainder)

    if slug:
        candidate = f"{line_prefix}{slug}"
    else:
        candidate = line_prefix

    candidate = candidate[:24]

    if not candidate:
        candidate = "UNK"

    final = candidate
    n = 2
    while final.lower() in existing_codes_lower:
        suffix = f"-{n}"
        final = candidate[: 24 - len(suffix)] + suffix
        n += 1

    existing_codes_lower.add(final.lower())
    return final

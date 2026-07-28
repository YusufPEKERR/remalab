"""
warehouse.item / warehouse.parts tablolarındaki `code` sütunu, gerçekte
<cihaz/ürün kodu><parça kategorisi kısaltması>[<renk kısaltması>] birleşimidir
(örn. "SMS20UBGBrwn" = Samsung Galaxy S20 Ultra + Back Glass + Brown).

Bu modül, warehouse.parts'taki (brand, model, item_code) üçlülerinden - aynı
cihaza ait tüm parça kodlarının ortak başlangıcını (çoğunluk oyu ile, birkaç
aykırı satırdan etkilenmeyecek şekilde) bularak - gerçek, halihazırda
kullanılan cihaz/ürün kodunu keşfeder. Saf, DB'siz fonksiyonlardır.
"""
from collections import Counter, defaultdict

from core.product_code_generator import normalize_brand


def robust_common_prefix(codes, threshold=0.7, min_len=1):
    """codes listesindeki string'lerin, en az `threshold` oranının paylaştığı
    en uzun ortak öneki bulur (klasik LCP'den farkı: bir-iki aykırı satır
    tüm sonucu bozmaz - çoğunluk hangi karakterde hemfikirse o karakter kabul edilir)."""
    if not codes:
        return "", 0.0
    n = len(codes)
    prefix_chars = []
    idx = 0
    while True:
        counts = Counter(c[idx] for c in codes if len(c) > idx)
        if not counts:
            break
        ch, cnt = counts.most_common(1)[0]
        ratio = cnt / n
        if ratio < threshold:
            break
        prefix_chars.append(ch)
        idx += 1
    prefix = "".join(prefix_chars)
    if len(prefix) < min_len:
        return "", 0.0
    matching = sum(1 for c in codes if c.startswith(prefix))
    return prefix, matching / n


def discover_device_codes(rows, threshold=0.7, min_len=3, min_n=4):
    """rows: (brand, model, item_code) üçlülerinin listesi.
    Döner: {(norm_brand, model): {"code": str, "confidence": float, "n": int}}
    Sadece confidence>=threshold VE len(code)>=min_len VE grup boyutu>=min_n olan
    gruplar dahil edilir. min_n önemli: 1-2 örnekli bir grupta "ortak önek" trivially
    kodun tamamı olur (kategori son eki hiç ayrışamaz - örn. tek örnekli bir grupta
    "A13LCD" hepten "önek" sayılır), bu yüzden çok küçük gruplar güvenilmez kabul edilip
    dışlanır; bu satırlar kategori son-eki/kelime dağarcığı fallback'lerine bırakılır.
    """
    groups = defaultdict(list)
    for brand, model, code in rows:
        if not brand or not model or not code:
            continue
        groups[(normalize_brand(brand), model)].append(code)

    result = {}
    for key, codes in groups.items():
        if len(codes) < min_n:
            continue
        prefix, confidence = robust_common_prefix(codes, threshold=threshold, min_len=min_len)
        if prefix and confidence >= threshold:
            result[key] = {"code": prefix, "confidence": confidence, "n": len(codes)}
    return result


def build_category_suffix_map(rows, device_codes):
    """rows: (brand, model, item_code, item_category) dörtlülerinin listesi.
    device_codes: discover_device_codes() çıktısı.
    Döner: {item_category: set(suffix)} - güvenilir gruplardan öğrenilen,
    kategori bazlı sabit son ekler (örn. 'Back Glass' -> {'BG','BGBLC','BGBlu',...})."""
    suffix_map = defaultdict(set)
    for brand, model, code, category in rows:
        if not brand or not model or not code or not category:
            continue
        entry = device_codes.get((normalize_brand(brand), model))
        if not entry:
            continue
        prefix = entry["code"]
        if code.startswith(prefix) and len(code) > len(prefix):
            suffix_map[category].add(code[len(prefix):])
    return suffix_map


def build_vocabulary(device_codes, min_len=3):
    """Tüm keşfedilen cihaz kodlarını uzundan kısaya sıralı benzersiz liste olarak döner
    (genel fallback: bir kodun içinde geçen en uzun bilinen cihaz önekini bulmak için)."""
    vocab = sorted({e["code"] for e in device_codes.values() if len(e["code"]) >= min_len}, key=len, reverse=True)
    return vocab


def resolve_product_code(code, item_category, own_group_entry, category_suffix_map, vocabulary):
    """Tek bir item/parts satırı için ürün kodunu 3 kademeli olarak çözer.
    Döner: (product_code, method) - method: 'group' | 'category_suffix' | 'vocabulary_prefix' | 'unresolved'."""
    if own_group_entry and code.startswith(own_group_entry["code"]):
        return own_group_entry["code"], "group"

    if item_category:
        candidates = category_suffix_map.get(item_category, ())
        best_suffix = ""
        for suf in candidates:
            if code.endswith(suf) and len(suf) > len(best_suffix) and len(code) > len(suf):
                best_suffix = suf
        if best_suffix:
            return code[: -len(best_suffix)], "category_suffix"

    for v in vocabulary:
        if code.startswith(v) and len(code) > len(v):
            return v, "vocabulary_prefix"

    return code, "unresolved"

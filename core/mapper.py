"""
RemaLab WMS - Frontend/Backend Mapper (Adapter Layer)
Bu dosya, frontend'in beklediği eski yapıları (DTO), backend'in yeni veritabanı şemasına bağlar.
"""

def map_item_to_part(row) -> dict:
    """
    Veritabanındaki 'warehouse.item' satırını, 
    Frontend 'Parts.jsx' bileşeninin beklediği JSON formatına çevirir.
    """
    return {
        "id": str(row["id"]) if row.get("id") else "",
        "name": row.get("short_name") or "",
        "item_code": row.get("code") or "",
        "barcode": row.get("code") or "", 
        "brand": row.get("brand") or "",
        "model": row.get("model") or "",
        "color": row.get("color") or "",
        "part_category": row.get("item_category") or "",
        "part_type": row.get("item_type") or "",
        "item_category": row.get("item_category") or "",
        "department": row.get("department") or "", 
        "stock_tracking_type": "Stok Takipli",
        "default_location_id": "",
        "default_location_name": "",
        "status": "Aktif" if row.get("enabled") else "Pasif",
        "critical_limit": 50,
        "part_category_id": ""
    }

def map_part_to_item(payload: dict) -> dict:
    """
    Frontend'den gelen 'part' payload'unu, veritabanı 'warehouse.item' şemasına geri çevirir.
    """
    return {
        "short_name": payload.get("name") or "",
        "code": payload.get("item_code") or "",
        "color": payload.get("color") or "",
        "item_type": payload.get("part_type") or "",
        "item_category": payload.get("item_category") or payload.get("part_category") or "",
        "enabled": payload.get("status") == "Aktif",
    }

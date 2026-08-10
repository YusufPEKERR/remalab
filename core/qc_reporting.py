# -*- coding: utf-8 -*-
"""
QC (Kalite Kontrol) — CANLI veri kaynağı.

QC ekranı verisini doğrudan **remalab operasyon veritabanından** (uygulamanın
kullandığı ana DB, config PG_* ile aynı sunucu) canlı olarak üretir. Ayrı bir
analitik/erp_reporting DB'sine ihtiyaç yoktur — QC'nin ihtiyaç duyduğu ham veri
zaten remalab'da mevcuttur.

Ana "fail" kaynağı: warehouse.test_result_faults (başarısız testlerde tespit
edilen hatalı parça + hata çiftleri). Cihaz başına 10'a kadar çift, tek satıra
"unpivot" edilir → her hatalı parça bir QC kaydı olur.

Dönen yapı frontend QC.jsx'in beklediği şekildedir:
  { success, source, fails: [ {product_family_name, mission_group_name,
    symptom_group_name, symptom_name, test_type_name, teststaff_fullname,
    create_time} ], prod_summary: {pass, fail}, total_fail, returned }
"""
import os

FAIL_COLS = [
    "product_family_name", "mission_group_name", "symptom_group_name",
    "symptom_name", "test_type_name", "teststaff_fullname", "create_time",
]

# Hatalı parçadan onarım departmanı türetme (remalab'da fault->mission join'i
# güvenilir olmadığından, kalite kırılımı için parçadan türetiyoruz).
_FAILS_SQL = r"""
WITH f AS (
  SELECT trf.service_id, trf.imei_number, trf.internal_id,
         trf.created_by, trf.created_at, v.part, v.fault
  FROM warehouse.test_result_faults trf
  CROSS JOIN LATERAL (VALUES
    (trf.hatali_parca1, trf.hata1), (trf.hatali_parca2, trf.hata2),
    (trf.hatali_parca3, trf.hata3), (trf.hatali_parca4, trf.hata4),
    (trf.hatali_parca5, trf.hata5), (trf.hatali_parca6, trf.hata6),
    (trf.hatali_parca7, trf.hata7), (trf.hatali_parca8, trf.hata8),
    (trf.hatali_parca9, trf.hata9), (trf.hatali_parca10, trf.hata10)
  ) AS v(part, fault)
  WHERE coalesce(v.part, '') <> ''
)
SELECT
  coalesce(nullif(b.product_family, ''), nullif(b.model, ''),
           nullif(pc.model, ''), 'Bilinmiyor')                    AS product_family_name,
  CASE
    WHEN f.part ILIKE '%%kamera%%'                                        THEN 'Kamera Onarımı'
    WHEN f.part ILIKE '%%ekran%%' OR f.part ILIKE '%%lcd%%' OR f.part ILIKE '%%display%%' THEN 'Ekran Onarımı'
    WHEN f.part ILIKE '%%batarya%%' OR f.part ILIKE '%%pil%%'             THEN 'Batarya Onarımı'
    WHEN f.part ILIKE '%%cam%%' OR f.part ILIKE '%%kasa%%' OR f.part ILIKE '%%çerçeve%%'
         OR f.part ILIKE '%%cihaz geneli%%' OR f.part ILIKE '%%çerceve%%' THEN 'Kasa Onarımı'
    WHEN f.part ILIKE '%%hoparlör%%' OR f.part ILIKE '%%mikrofon%%' OR f.part ILIKE '%%ses%%' THEN 'Ses / Anakart'
    ELSE 'Diğer'
  END                                                             AS mission_group_name,
  f.part                                                          AS symptom_group_name,
  coalesce(nullif(f.fault, ''), f.part)                           AS symptom_name,
  '—'                                                             AS test_type_name,
  coalesce(nullif(u.fullname, ''), f.created_by, '—')             AS teststaff_fullname,
  f.created_at                                                    AS create_time
FROM f
LEFT JOIN warehouse.batch_entries b
       ON b.service_id::text = f.service_id::text
       OR b.imei_number = f.imei_number
       OR b.internal_id = f.internal_id
LEFT JOIN warehouse.users u ON u.username = f.created_by
LEFT JOIN LATERAL (
    SELECT model FROM warehouse.phonecheck_test_results p
    WHERE p.imei = f.imei_number
    ORDER BY p.fetched_at DESC NULLS LAST LIMIT 1
) pc ON true
ORDER BY f.created_at DESC
LIMIT %s
"""

_PROD_SQL = r"""
SELECT
  count(*) FILTER (WHERE coalesce(failed, '') IN ('', '[]', 'null', '{}'))     AS pass,
  count(*) FILTER (WHERE coalesce(failed, '') NOT IN ('', '[]', 'null', '{}')) AS fail
FROM warehouse.phonecheck_test_results
"""

_TOTAL_SQL = r"""
SELECT count(*) FROM warehouse.test_result_faults trf
CROSS JOIN LATERAL (VALUES
  (trf.hatali_parca1),(trf.hatali_parca2),(trf.hatali_parca3),(trf.hatali_parca4),(trf.hatali_parca5),
  (trf.hatali_parca6),(trf.hatali_parca7),(trf.hatali_parca8),(trf.hatali_parca9),(trf.hatali_parca10)
) AS v(part)
WHERE coalesce(v.part,'') <> ''
"""


def _connect():
    """remalab operasyon DB'sine bağlanır — uygulamanın ana DB'si (PG_* env).
    QC canlı verisi bu DB'nin ham tablolarından üretildiği için ana bağlantı
    kullanılır (ayrı bir reporting DB'sine gerek yoktur)."""
    import psycopg2
    return psycopg2.connect(
        host=os.getenv("PG_HOST", "10.200.246.238"),
        port=os.getenv("PG_PORT", "5432"),
        dbname=os.getenv("PG_DATABASE", "remalab"),
        user=os.getenv("PG_USER", "postgres"),
        password=os.getenv("PG_PASSWORD", ""),
        connect_timeout=int(os.getenv("QC_PG_TIMEOUT", "8")),
    )


def fetch_qc_data(limit=8000):
    if not limit or limit <= 0:
        limit = 8000
    conn = _connect()
    try:
        cur = conn.cursor()
        cur.execute(_FAILS_SQL, (limit,))
        rows = cur.fetchall()
        fails = []
        for r in rows:
            rec = {}
            for i, name in enumerate(FAIL_COLS):
                v = r[i]
                rec[name] = ("" if v is None else (str(v) if name == "create_time" else v))
            fails.append(rec)

        cur.execute(_TOTAL_SQL)
        total_fail = cur.fetchone()[0]

        cur.execute(_PROD_SQL)
        p = cur.fetchone()
        prod_summary = {"pass": int(p[0] or 0), "fail": int(p[1] or 0)}

        return {
            "success": True,
            "source": "remalab (canlı)",
            "fails": fails,
            "prod_summary": prod_summary,
            "total_fail": int(total_fail or 0),
            "returned": len(fails),
        }
    finally:
        try:
            conn.close()
        except Exception:
            pass

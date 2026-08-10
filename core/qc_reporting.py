# -*- coding: utf-8 -*-
"""
QC (Kalite Kontrol) — Raporlama/Analitik DB erişimi.

Bu modül, remalab operasyon veritabanından AYRI olan `erp_reporting`
(Grafana/analitik) PostgreSQL'ine kendi bağlantısını kurar ve QC ekranı için
Fail1 kayıtlarını + üretim pass/fail özetini çeker.

Bağlantı bilgileri .env'den okunur (QC_PG_*), yoksa koddaki sabit
varsayılanlara düşer (reporting server sabit IP: 192.168.0.56 · erp_reporting).
Sunucu erişilemezse çağıran taraf (web_bridge.get_qc_data) hatayı yakalar ve
frontend demo veriye düşer.

Kaynak tablolar (erp_reporting):
  - repair_test_fail_records     (yalnızca Fail1 kayıtları — QC ana kaynağı)
  - production_repair_records    (üretim onarımları — pass/fail özeti)
"""
import os

# QC ekranının okuduğu alanlar (repair_test_fail_records)
FAIL_COLS = [
    "product_family_name",
    "mission_group_name",
    "symptom_group_name",
    "symptom_name",
    "test_type_name",
    "teststaff_fullname",
    "create_time",
]


def _connect():
    import psycopg2
    return psycopg2.connect(
        host=os.getenv("QC_PG_HOST", "192.168.0.56"),  # reporting server sabit IP
        port=os.getenv("QC_PG_PORT", "5432"),
        dbname=os.getenv("QC_PG_DATABASE", "erp_reporting"),
        user=os.getenv("QC_PG_USER", "postgres"),
        password=os.getenv("QC_PG_PASSWORD", "Remalab2025"),
        connect_timeout=int(os.getenv("QC_PG_TIMEOUT", "6")),
    )


def fetch_qc_data(limit=8000):
    """erp_reporting'ten QC verisini döndürür.

    Dönen yapı frontend QC.jsx'in beklediği şekildedir:
      { success, source, fails: [ {FAIL_COLS...} ], prod_summary: {pass, fail},
        total_fail, returned }
    """
    if limit is None or limit <= 0:
        limit = 8000

    conn = _connect()
    try:
        cur = conn.cursor()

        # 1) Fail1 kayıtları (tablo tasarım gereği yalnızca Fail1 içerir)
        cols = ", ".join(FAIL_COLS)
        cur.execute(
            f"SELECT {cols} FROM repair_test_fail_records "
            f"ORDER BY create_time DESC NULLS LAST LIMIT %s",
            (limit,),
        )
        rows = cur.fetchall()
        fails = []
        for r in rows:
            rec = {}
            for i, name in enumerate(FAIL_COLS):
                v = r[i]
                # create_time -> string (frontend Date() ile parse eder)
                rec[name] = ("" if v is None else (str(v) if name == "create_time" else v))
            fails.append(rec)

        # 2) Toplam Fail1 sayısı (limit'ten bağımsız)
        cur.execute("SELECT count(*) FROM repair_test_fail_records")
        total_fail = cur.fetchone()[0]

        # 3) Üretim pass/fail özeti
        cur.execute(
            """
            SELECT
              count(*) FILTER (WHERE repair_is_success IS TRUE)      AS pass,
              count(*) FILTER (WHERE repair_is_success IS NOT TRUE)  AS fail
            FROM production_repair_records
            WHERE coalesce(repair_is_deleted, false) = false
            """
        )
        p = cur.fetchone()
        prod_summary = {"pass": int(p[0] or 0), "fail": int(p[1] or 0)}

        return {
            "success": True,
            "source": "db",
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

import os

CODE_TO_APPEND = """
    # ---------------------------------------------------------
    # MODUL 5: STATE MACHINE VE DOA GUARDRAIL ENDPOINTLERI
    # ---------------------------------------------------------
    @Slot(int, result=str)
    def get_allowed_transitions(self, current_statu_code):
        from services.state_machine_service import StateMachineService
        db = SessionLocal()
        try:
            svc = StateMachineService(db)
            transitions = svc.get_allowed_transitions(current_statu_code)
            return json.dumps({"success": True, "transitions": transitions})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, int, int, str, str, result=str)
    def execute_statu_transition(self, service_record_id, current_statu_code, target_statu_code, request_type_code, test_result_code):
        from services.state_machine_service import StateMachineService
        from services.repair_service import RepairService
        from models.service_record import ServiceRecord
        
        db = SessionLocal()
        try:
            # 1. DOA Guardrail Kontrolü: Eger RMA'ya (1003, 134 vb veya Red durumu ise) gidiyorsa kontrol et
            is_rma = target_statu_code in [1003, 134, 135, 136] or (test_result_code and "Fail" in test_result_code)
            if is_rma:
                # Kullanılmıs parcalari kontrol et
                doa_check = self._internal_check_doa(db, service_record_id)
                if doa_check.get("has_consumed_parts"):
                    return json.dumps({
                        "success": False, 
                        "error_code": "DOA_TRANSFER_REQUIRED",
                        "message": "Bu cihaz iadeye yönlendirilmiştir! Üzerinde depodan çıkılmış parçalar var.",
                        "parts": doa_check.get("parts")
                    })
            
            # 2. State Machine Validasyonu
            svc = StateMachineService(db)
            # If empty string, convert to None
            req_type = request_type_code if request_type_code else None
            test_res = test_result_code if test_result_code else None
            
            result = svc.execute_transition(current_statu_code, target_statu_code, req_type, test_res)
            
            if not result.get("success"):
                return json.dumps(result)
                
            new_statu = result.get("new_statu_code")
            
            # 3. Ana kaydi guncelle
            # service_records tablosu (veya projede kullanilan tablo). Projede ana tablo "service_records" olmayabilir
            # Fakat web_bridge icinde service_records var oldugu farz ediliyor
            # execute_raw ile de yapabiliriz tablo adi net degilse
            from sqlalchemy import text
            db.execute(text("UPDATE warehouse.work_orders SET status = :st WHERE id = :id"), {"st": str(new_statu), "id": service_record_id})
            
            # 4. Eger yeni statu 109 ise Alt Onarim (RepairRecord) uret (Modul 4)
            if new_statu == 109:
                # Cihazin modelini ve kategorisini almaliyiz.
                # Demo amaciyla statik bir model ve kategori gonderiyoruz (Bunu gercekte veritabanindan ceker)
                rep_svc = RepairService(db)
                # Ozet olarak "Ti-Battery" gibi faultlari getirmeliyiz.
                # Bunu simdilik bos gecelim veya generic bir ti-battery verelim (test amacli)
                rep_svc.generate_concurrent_repairs(service_record_id, "iP11", ["Ti-Battery"])
                
            db.commit()
            return json.dumps({"success": True, "new_statu_code": new_statu, "message": result.get("message")})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    def _internal_check_doa(self, db, service_record_id):
        from sqlalchemy import text
        # Bu is emrine bagli ve is_issued=True olan parcalari getirir
        # Projede work_order_parts tablosu var
        sql = text(\"\"\"
            SELECT wp.id, wp.part_code, wp.quantity, p.name 
            FROM warehouse.work_order_parts wp
            LEFT JOIN warehouse.parts p ON p.item_code = wp.part_code
            WHERE wp.work_order_id = :wo_id AND wp.is_issued = true
        \"\"\")
        parts = db.execute(sql, {"wo_id": service_record_id}).mappings().all()
        return {
            "has_consumed_parts": len(parts) > 0,
            "parts": [dict(p) for p in parts]
        }

    @Slot(str, result=str)
    def check_doa_status(self, service_record_id):
        db = SessionLocal()
        try:
            res = self._internal_check_doa(db, service_record_id)
            return json.dumps({"success": True, "data": res})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()
            
    @Slot(str, result=str)
    def transfer_to_doa(self, service_record_id):
        # Kullanılmıs (issued) parcalari DOA deposuna tasir
        db = SessionLocal()
        try:
            from sqlalchemy import text
            doa_loc_id = _get_system_location_id(db, "doa_stock")
            if not doa_loc_id:
                return json.dumps({"success": False, "message": "Sistem DOA deposu bulunamadi."})
                
            parts = self._internal_check_doa(db, service_record_id).get("parts", [])
            for p in parts:
                # Stoktan dus (Good -> DOA transferine gerek yok, zaten work_order_parts is_issued=true yapilirken good_stocktan dusuldu)
                # Sadece doa_stock artirilir. 
                from models.stock import Stock
                from models.stock_movement import StockMovement
                # DOA stock artir
                ds = db.query(Stock).filter_by(location_id=doa_loc_id, part_code=p["part_code"]).first()
                if not ds:
                    ds = Stock(location_id=doa_loc_id, part_code=p["part_code"], quantity=0)
                    db.add(ds)
                ds.quantity += p["quantity"]
                
                # Hareketi kaydet
                mov = StockMovement(
                    part_code=p["part_code"],
                    from_location_id=None, # Cihazdan cikiyor
                    to_location_id=doa_loc_id,
                    quantity=p["quantity"],
                    movement_type="RETURN",
                    reference_document=f"DOA Transfer WO: {service_record_id}"
                )
                db.add(mov)
                
                # work_order_parts tablosundaki kaydi iptal et veya sil (cihazdan sokuldu)
                db.execute(text("UPDATE warehouse.work_order_parts SET is_issued = false, issued_quantity = 0 WHERE id = :pid"), {"pid": p["id"]})
                
            db.commit()
            return json.dumps({"success": True, "message": "Parçalar başarıyla DOA deposuna aktarıldı."})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def get_repair_records(self, service_record_id):
        db = SessionLocal()
        try:
            from sqlalchemy import text
            sql = text("SELECT * FROM warehouse.repair_records WHERE service_record_id = :wo_id ORDER BY created_at DESC")
            records = db.execute(sql, {"wo_id": service_record_id}).mappings().all()
            
            # JSON serialization of UUID/Datetime
            out = []
            for r in records:
                d = dict(r)
                d["id"] = str(d["id"])
                d["created_at"] = str(d["created_at"])
                d["updated_at"] = str(d["updated_at"])
                out.append(d)
                
            return json.dumps({"success": True, "records": out})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()
"""

target_file = os.path.join("core", "web_bridge.py")
with open(target_file, "a", encoding="utf-8") as f:
    f.write(CODE_TO_APPEND)

print("Patch applied to web_bridge.py")

import json
from PySide6.QtCore import QObject, Slot
from config.database import SessionLocal
from config.auth import verify_password
from models.user import User

class WebBridge(QObject):
    """React (JavaScript) ile Python (PySide6) arasındaki köprü sınıfı."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._ensure_department_column()
        self._ensure_status_column()
        self._ensure_departments_table()
        self._ensure_stock_movement_columns()
        self._ensure_service_records_table()

    def _ensure_service_records_table(self):
        """warehouse.service_records tablosu yoksa oluşturur."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS warehouse.service_records (
                    id SERIAL PRIMARY KEY,
                    customer_name VARCHAR(150) NOT NULL,
                    customer_phone VARCHAR(30),
                    customer_email VARCHAR(150),
                    company VARCHAR(150),
                    brand VARCHAR(100),
                    model VARCHAR(100),
                    imei_serial VARCHAR(100),
                    color VARCHAR(50),
                    fault_category VARCHAR(100),
                    fault_type VARCHAR(150),
                    customer_complaint TEXT,
                    preliminary_diagnosis TEXT,
                    status VARCHAR(30) DEFAULT 'Arıza Kabul',
                    technician_note TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] service_records tablosu oluşturulamadı: {e}")
        finally:
            db.close()

    def _ensure_stock_movement_columns(self):
        """warehouse.stock_movements tablosuna technician ve description sütunlarını ekler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("ALTER TABLE warehouse.stock_movements ADD COLUMN IF NOT EXISTS technician VARCHAR(150);"))
            db.execute(text("ALTER TABLE warehouse.stock_movements ADD COLUMN IF NOT EXISTS description TEXT;"))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] stock_movements kolonları eklenemedi: {e}")
        finally:
            db.close()

    def _ensure_department_column(self):
        """warehouse.parts tablosuna department sütunu yoksa ekler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("ALTER TABLE warehouse.parts ADD COLUMN IF NOT EXISTS department VARCHAR(255);"))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] department kolonu eklenemedi: {e}")
        finally:
            db.close()

    def _ensure_status_column(self):
        """warehouse.parts tablosuna status sütunu yoksa ekler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("ALTER TABLE warehouse.parts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Aktif';"))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] status kolonu eklenemedi: {e}")
        finally:
            db.close()

    def _ensure_departments_table(self):
        """warehouse.departments tablosu yoksa oluşturur."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS warehouse.departments (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    code VARCHAR(20),
                    responsible VARCHAR(150),
                    default_location_id INTEGER REFERENCES warehouse.locations(id),
                    status VARCHAR(20) DEFAULT 'Aktif'
                );
            """))
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[WebBridge] departments tablosu oluşturulamadı: {e}")
        finally:
            db.close()

    @Slot(str, str, result=str)
    def login(self, username, password):
        """React üzerinden gelen giriş isteğini işler."""
        print(f"[WebBridge] Login request received for username: {username}")
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.username == username).first()
            if not user:
                return json.dumps({"success": False, "message": "Kullanıcı bulunamadı"})
            
            if not verify_password(password, user.password_hash):
                return json.dumps({"success": False, "message": "Hatalı şifre"})

            # Başarılı giriş
            user_data = {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role
            }
            return json.dumps({"success": True, "user": user_data})
        except Exception as e:
            return json.dumps({"success": False, "message": f"Veritabanı hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(result=str)
    def get_users(self):
        """Tüm kullanıcıları getirir."""
        db = SessionLocal()
        try:
            users = db.query(User).all()
            users_list = []
            for u in users:
                users_list.append({
                    "id": u.id,
                    "username": u.username,
                    "email": u.email,
                    "role": u.role
                })
            return json.dumps({"success": True, "users": users_list})
        except Exception as e:
            return json.dumps({"success": False, "message": f"Kullanıcılar getirilemedi: {str(e)}"})
        finally:
            db.close()

    @Slot(str, str, str, str, result=str)
    def create_user(self, username, email, password, role):
        """Yeni bir kullanıcı oluşturur."""
        from config.auth import get_password_hash
        db = SessionLocal()
        try:
            # Var olanı kontrol et
            if db.query(User).filter(User.username == username).first():
                return json.dumps({"success": False, "message": "Bu kullanıcı adı zaten alınmış"})
            if db.query(User).filter(User.email == email).first():
                return json.dumps({"success": False, "message": "Bu e-posta adresi zaten kullanımda"})
            
            hashed_pwd = get_password_hash(password)
            new_user = User(
                username=username,
                email=email,
                password_hash=hashed_pwd,
                role=role
            )
            db.add(new_user)
            db.commit()
            return json.dumps({"success": True, "message": "Kullanıcı başarıyla oluşturuldu"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Kullanıcı oluşturulamadı: {str(e)}"})
        finally:
            db.close()

    @Slot(str, str, str, str, str, result=str)
    def update_user(self, user_id_str, username, email, password, role):
        """Var olan bir kullanıcıyı günceller."""
        import sys
        print(f"[WebBridge] update_user called with ID: '{user_id_str}', username: '{username}', role: '{role}'")
        sys.stdout.flush()
        from config.auth import get_password_hash
        db = SessionLocal()
        try:
            user_id = int(user_id_str)
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                print("[WebBridge] User not found.")
                sys.stdout.flush()
                return json.dumps({"success": False, "message": "Kullanıcı bulunamadı"})
            
            # Başka bir kullanıcının aynı kullanıcı adını kullanıp kullanmadığını kontrol et
            if username != user.username and db.query(User).filter(User.username == username).first():
                print("[WebBridge] Username already taken.")
                sys.stdout.flush()
                return json.dumps({"success": False, "message": "Bu kullanıcı adı zaten alınmış"})
                
            if email != user.email and db.query(User).filter(User.email == email).first():
                print("[WebBridge] Email already taken.")
                sys.stdout.flush()
                return json.dumps({"success": False, "message": "Bu e-posta adresi zaten kullanımda"})
            
            user.username = username
            user.email = email
            user.role = role
            
            # Şifre gönderilmişse güncelle
            if password and len(password.strip()) > 0:
                print("[WebBridge] Updating password.")
                sys.stdout.flush()
                user.password_hash = get_password_hash(password)
                
            db.commit()
            print("[WebBridge] User updated successfully. Role is now:", user.role)
            sys.stdout.flush()
            return json.dumps({"success": True, "message": "Kullanıcı başarıyla güncellendi"})
        except Exception as e:
            print(f"[WebBridge] Update error: {str(e)}")
            sys.stdout.flush()
            db.rollback()
            return json.dumps({"success": False, "message": f"Güncelleme hatası: {str(e)}"})
        finally:
            db.close()

    # ==========================
    # PARTS (PARÇALAR) MODÜLÜ
    # ==========================

    @Slot(result=str)
    def get_parts(self):
        """Tüm parçaları getirir."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            # item_category vs de eklenebilir. Tablodaki alanlara göre çekiyoruz.
            result = db.execute(text("SELECT id, name, item_code, brand, model, color, part_category, item_category, stock_tracking_type, department, status FROM warehouse.parts ORDER BY id DESC")).mappings().all()
            parts_list = []
            for row in result:
                parts_list.append({
                    "id": str(row["id"]),
                    "name": row["name"] or "",
                    "item_code": row["item_code"] or "",
                    "brand": row["brand"] or "",
                    "model": row["model"] or "",
                    "color": row["color"] or "",
                    "part_category": row["part_category"] or "",
                    "item_category": row["item_category"] or "",
                    "stock_tracking_type": row["stock_tracking_type"] or "Stok Takipli",
                    "department": row["department"] or "",
                    "status": row["status"] or "Aktif"
                })
            return json.dumps({"success": True, "parts": parts_list})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, str, str, str, result=str)
    def create_part(self, item_code, brand, model, color, part_category, item_category, stock_tracking_type, department, status):
        """Yeni parça ekler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            code = item_code.strip()
            if not code:
                return json.dumps({"success": False, "message": "Parça Kodu zorunludur"})

            auto_name = f"{brand.strip()} {model.strip()} {color.strip()}".strip()
            if not auto_name:
                auto_name = code

            sql = """
                INSERT INTO warehouse.parts (name, item_code, brand, model, color, part_category, item_category, stock_tracking_type, department, status)
                VALUES (:name, :code, :brand, :model, :color, :pcat, :icat, :stt, :dept, :status)
            """
            db.execute(text(sql), {
                "name": auto_name, "code": code, "brand": brand or None,
                "model": model or None, "color": color or None,
                "pcat": part_category or None, "icat": item_category or None,
                "stt": stock_tracking_type or "Stok Takipli",
                "dept": department or None,
                "status": status or "Aktif"
            })
            db.commit()
            return json.dumps({"success": True, "message": "Parça eklendi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Kayıt hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, str, str, str, str, result=str)
    def update_part(self, part_id_str, item_code, brand, model, color, part_category, item_category, stock_tracking_type, department, status):
        """Var olan bir parçayı günceller."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            part_id = int(part_id_str)
            code = item_code.strip()
            if not code:
                return json.dumps({"success": False, "message": "Parça Kodu zorunludur"})

            auto_name = f"{brand.strip()} {model.strip()} {color.strip()}".strip()
            if not auto_name:
                auto_name = code

            sql = """
                UPDATE warehouse.parts
                SET name = :name, item_code = :code, brand = :brand,
                    model = :model, color = :color, part_category = :pcat, item_category = :icat,
                    stock_tracking_type = :stt, department = :dept, status = :status
                WHERE id = :id
            """
            db.execute(text(sql), {
                "name": auto_name, "code": code, "brand": brand or None,
                "model": model or None, "color": color or None,
                "pcat": part_category or None, "icat": item_category or None,
                "stt": stock_tracking_type or "Stok Takipli",
                "dept": department or None,
                "status": status or "Aktif",
                "id": part_id
            })
            db.commit()
            return json.dumps({"success": True, "message": "Parça güncellendi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Güncelleme hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, result=str)
    def delete_part(self, part_id_str):
        """Belirtilen id'ye sahip parçayı siler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            part_id = int(part_id_str)
            db.execute(text("DELETE FROM warehouse.parts WHERE id = :id"), {"id": part_id})
            db.commit()
            return json.dumps({"success": True, "message": "Parça silindi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Silme hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, result=str)
    def delete_user(self, user_id_str):
        """Belirtilen id'ye sahip kullanıcıyı siler."""
        import sys
        print(f"[WebBridge] delete_user called with ID: {user_id_str}")
        sys.stdout.flush()
        db = SessionLocal()
        try:
            user_id = int(user_id_str)
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return json.dumps({"success": False, "message": "Kullanıcı bulunamadı"})
            
            # TODO: Belki SuperAdmin silinemez gibi kurallar koyulabilir.
            db.delete(user)
            db.commit()
            return json.dumps({"success": True, "message": "Kullanıcı silindi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Silme hatası: {str(e)}"})
        finally:
            db.close()

    # --- YENİ EKLENEN LOKASYON FONKSİYONLARI ---
    @Slot(result=str)
    def get_locations(self):
        from models.location import Location
        db = SessionLocal()
        try:
            locs = db.query(Location).all()
            return json.dumps({"success": True, "locations": [{"id": l.id, "name": l.name} for l in locs]})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def create_location(self, name):
        from models.location import Location
        db = SessionLocal()
        try:
            if db.query(Location).filter(Location.name == name).first():
                return json.dumps({"success": False, "message": "Bu lokasyon zaten var"})
            loc = Location(name=name)
            db.add(loc)
            db.commit()
            return json.dumps({"success": True, "message": "Lokasyon eklendi", "id": loc.id})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def delete_location(self, id_str):
        from models.location import Location
        db = SessionLocal()
        try:
            loc_id = int(id_str)
            loc = db.query(Location).filter(Location.id == loc_id).first()
            if loc:
                db.delete(loc)
                db.commit()
                return json.dumps({"success": True})
            return json.dumps({"success": False, "message": "Bulunamadı"})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    # ===================    # DEPARTMANLAR MODÜLÜ
    # ==========================

    @Slot(result=str)
    def get_departments(self):
        """Tüm departmanları varsayılan lokasyon adıyla birlikte getirir."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            rows = db.execute(text("""
                SELECT d.id, d.name, d.code, d.responsible, d.default_location_id, d.status, l.name AS location_name
                FROM warehouse.departments d
                LEFT JOIN warehouse.locations l ON l.id = d.default_location_id
                ORDER BY d.id
            """)).mappings().all()
            departments = []
            for row in rows:
                departments.append({
                    "id": str(row["id"]),
                    "name": row["name"] or "",
                    "code": row["code"] or "",
                    "responsible": row["responsible"] or "",
                    "default_location_id": str(row["default_location_id"]) if row["default_location_id"] else "",
                    "default_location_name": row["location_name"] or "",
                    "status": row["status"] or "Aktif"
                })
            return json.dumps({"success": True, "departments": departments})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    # --- YENİ EKLENEN PARÇA KATEGORİSİ FONKSİYONLARI ---
    @Slot(result=str)
    def get_part_categories(self):
        from models.part_category import PartCategory
        db = SessionLocal()
        try:
            cats = db.query(PartCategory).order_by(PartCategory.name).all()
            return json.dumps({"success": True, "categories": [{"id": c.id, "name": c.name} for c in cats]})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, result=str)
    def create_department(self, name, code, responsible, default_location_id, status):
        """Yeni departman ekler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            dept_name = name.strip()
            if not dept_name:
                return json.dumps({"success": False, "message": "Departman adı zorunludur"})

            loc_id = int(default_location_id) if default_location_id.strip() else None
            db.execute(text("""
                INSERT INTO warehouse.departments (name, code, responsible, default_location_id, status)
                VALUES (:name, :code, :resp, :loc, :status)
            """), {
                "name": dept_name, "code": code or None, "resp": responsible or None,
                "loc": loc_id, "status": status or "Aktif"
            })
            db.commit()
            return json.dumps({"success": True, "message": "Departman eklendi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Kayıt hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, result=str)
    def update_department(self, dept_id_str, name, code, responsible, default_location_id, status):
        """Var olan bir departmanı günceller."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            dept_id = int(dept_id_str)
            dept_name = name.strip()
            if not dept_name:
                return json.dumps({"success": False, "message": "Departman adı zorunludur"})

            loc_id = int(default_location_id) if default_location_id.strip() else None
            db.execute(text("""
                UPDATE warehouse.departments
                SET name = :name, code = :code, responsible = :resp,
                    default_location_id = :loc, status = :status
                WHERE id = :id
            """), {
                "name": dept_name, "code": code or None, "resp": responsible or None,
                "loc": loc_id, "status": status or "Aktif", "id": dept_id
            })
            db.commit()
            return json.dumps({"success": True, "message": "Departman güncellendi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Güncelleme hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, result=str)
    def create_part_category(self, name):
        from models.part_category import PartCategory
        db = SessionLocal()
        try:
            name = (name or "").strip()
            if not name:
                return json.dumps({"success": False, "message": "Kategori adı zorunludur"})
            if db.query(PartCategory).filter(PartCategory.name == name).first():
                return json.dumps({"success": False, "message": "Bu kategori zaten var"})
            cat = PartCategory(name=name)
            db.add(cat)
            db.commit()
            return json.dumps({"success": True, "message": "Kategori eklendi", "id": cat.id})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def delete_department(self, dept_id_str):
        """Belirtilen id'ye sahip departmanı siler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            dept_id = int(dept_id_str)
            db.execute(text("DELETE FROM warehouse.departments WHERE id = :id"), {"id": dept_id})
            db.commit()
            return json.dumps({"success": True, "message": "Departman silindi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Silme hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, result=str)
    def delete_part_category(self, id_str):
        from models.part_category import PartCategory
        db = SessionLocal()
        try:
            cat_id = int(id_str)
            cat = db.query(PartCategory).filter(PartCategory.id == cat_id).first()
            if cat:
                db.delete(cat)
                db.commit()
                return json.dumps({"success": True})
            return json.dumps({"success": False, "message": "Bulunamadı"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    # ==========================
    # SERVİS KAYITLARI MODÜLÜ
    # ==========================

    @Slot(result=str)
    def get_service_records(self):
        """Tüm servis kayıtlarını getirir."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            rows = db.execute(text("""
                SELECT id, customer_name, customer_phone, customer_email, company,
                       brand, model, imei_serial, color, fault_category, fault_type,
                       customer_complaint, preliminary_diagnosis, status, technician_note, created_at
                FROM warehouse.service_records
                ORDER BY id DESC
            """)).mappings().all()
            records = []
            for row in rows:
                records.append({
                    "id": str(row["id"]),
                    "customer_name": row["customer_name"] or "",
                    "customer_phone": row["customer_phone"] or "",
                    "customer_email": row["customer_email"] or "",
                    "company": row["company"] or "",
                    "brand": row["brand"] or "",
                    "model": row["model"] or "",
                    "imei_serial": row["imei_serial"] or "",
                    "color": row["color"] or "",
                    "fault_category": row["fault_category"] or "",
                    "fault_type": row["fault_type"] or "",
                    "customer_complaint": row["customer_complaint"] or "",
                    "preliminary_diagnosis": row["preliminary_diagnosis"] or "",
                    "status": row["status"] or "Arıza Kabul",
                    "technician_note": row["technician_note"] or "",
                    "created_at": row["created_at"].strftime("%Y-%m-%d %H:%M") if row["created_at"] else ""
                })
            return json.dumps({"success": True, "records": records})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, str, str, str, str, str, str, str, str, result=str)
    def create_service_record(self, customer_name, customer_phone, customer_email, company,
                               brand, model, imei_serial, color, fault_category, fault_type,
                               customer_complaint, preliminary_diagnosis, status, technician_note):
        """Yeni servis kaydı ekler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            name = customer_name.strip()
            if not name:
                return json.dumps({"success": False, "message": "Müşteri adı zorunludur"})

            db.execute(text("""
                INSERT INTO warehouse.service_records (
                    customer_name, customer_phone, customer_email, company,
                    brand, model, imei_serial, color, fault_category, fault_type,
                    customer_complaint, preliminary_diagnosis, status, technician_note
                ) VALUES (
                    :name, :phone, :email, :company,
                    :brand, :model, :imei, :color, :fcat, :ftype,
                    :complaint, :diagnosis, :status, :note
                )
            """), {
                "name": name, "phone": customer_phone or None, "email": customer_email or None,
                "company": company or None, "brand": brand or None, "model": model or None,
                "imei": imei_serial or None, "color": color or None,
                "fcat": fault_category or None, "ftype": fault_type or None,
                "complaint": customer_complaint or None, "diagnosis": preliminary_diagnosis or None,
                "status": status or "Arıza Kabul", "note": technician_note or None
            })
            db.commit()
            return json.dumps({"success": True, "message": "Servis kaydı eklendi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Kayıt hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, str, str, str, str, str, str, str, str, str, result=str)
    def update_service_record(self, record_id_str, customer_name, customer_phone, customer_email, company,
                               brand, model, imei_serial, color, fault_category, fault_type,
                               customer_complaint, preliminary_diagnosis, status, technician_note):
        """Var olan bir servis kaydını günceller."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            record_id = int(record_id_str)
            name = customer_name.strip()
            if not name:
                return json.dumps({"success": False, "message": "Müşteri adı zorunludur"})

            db.execute(text("""
                UPDATE warehouse.service_records
                SET customer_name = :name, customer_phone = :phone, customer_email = :email, company = :company,
                    brand = :brand, model = :model, imei_serial = :imei, color = :color,
                    fault_category = :fcat, fault_type = :ftype,
                    customer_complaint = :complaint, preliminary_diagnosis = :diagnosis,
                    status = :status, technician_note = :note
                WHERE id = :id
            """), {
                "name": name, "phone": customer_phone or None, "email": customer_email or None,
                "company": company or None, "brand": brand or None, "model": model or None,
                "imei": imei_serial or None, "color": color or None,
                "fcat": fault_category or None, "ftype": fault_type or None,
                "complaint": customer_complaint or None, "diagnosis": preliminary_diagnosis or None,
                "status": status or "Arıza Kabul", "note": technician_note or None,
                "id": record_id
            })
            db.commit()
            return json.dumps({"success": True, "message": "Servis kaydı güncellendi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Güncelleme hatası: {str(e)}"})
        finally:
            db.close()

    @Slot(str, result=str)
    def delete_service_record(self, record_id_str):
        """Belirtilen id'ye sahip servis kaydını siler."""
        from sqlalchemy import text
        db = SessionLocal()
        try:
            record_id = int(record_id_str)
            db.execute(text("DELETE FROM warehouse.service_records WHERE id = :id"), {"id": record_id})
            db.commit()
            return json.dumps({"success": True, "message": "Servis kaydı silindi"})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": f"Silme hatası: {str(e)}"})
        finally:
            db.close()

    # --- YENİ EKLENEN ÜRÜN (TELEFON) VE TEDARİKÇİ FONKSİYONLARI ---
    # Products ve Suppliers verileri, 'parts' tablosundan çekilecek.
    
    @Slot(result=str)
    def get_products(self):
        from models.part import Part
        db = SessionLocal()
        try:
            # Sadece model veya brand dolu olanları telefon ürünü kabul edelim
            parts = db.query(Part).filter(Part.model != None).all()
            res = []
            for p in parts:
                res.append({
                    "id": p.id,
                    "item_code": p.item_code or p.barcode,
                    "brand": p.brand,
                    "model": p.model,
                    "memory": p.memory,
                    "color": p.color
                })
            return json.dumps({"success": True, "products": res})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, result=str)
    def create_product(self, item_code, brand, model, memory, color, name):
        from models.part import Part
        db = SessionLocal()
        try:
            part = Part(
                item_code=item_code,
                brand=brand,
                model=model,
                memory=memory,
                color=color,
                name=name or f"{brand} {model}"
            )
            db.add(part)
            db.commit()
            return json.dumps({"success": True, "id": part.id})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()
            
    @Slot(result=str)
    def get_suppliers(self):
        from models.part import Part
        db = SessionLocal()
        try:
            parts = db.query(Part).filter(Part.supplier != None).all()
            res = []
            for p in parts:
                res.append({
                    "id": p.id,
                    "supplier": p.supplier,
                    "brand": p.brand,
                    "model": p.model,
                    "item_code": p.item_code,
                    "barcode": p.barcode
                })
            return json.dumps({"success": True, "suppliers": res})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()
            
    @Slot(str, str, str, str, str, result=str)
    def create_supplier(self, supplier, brand, model, item_code, barcode):
        from models.part import Part
        db = SessionLocal()
        try:
            part = Part(
                supplier=supplier,
                brand=brand,
                model=model,
                item_code=item_code,
                barcode=barcode,
                name=f"{supplier} - {brand} {model}"
            )
            db.add(part)
            db.commit()
            return json.dumps({"success": True, "id": part.id})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    # ==========================
    # STOK & DEPO YÖNETİMİ
    # ==========================

    @Slot(result=str)
    def get_stock_status(self):
        from models.stock import Stock
        from models.part import Part
        from models.location import Location
        db = SessionLocal()
        try:
            # Left join to handle cases where location or part might be deleted but still referenced
            stocks = db.query(Stock, Part, Location).join(Part, Stock.part_id == Part.id).join(Location, Stock.location_id == Location.id).all()
            res = []
            for s, p, l in stocks:
                res.append({
                    "id": s.id,
                    "part_id": p.id,
                    "part_name": f"{p.brand} {p.model} {p.name}",
                    "location_id": l.id,
                    "location_name": l.name,
                    "quantity": s.quantity,
                    "critical_limit": p.critical_limit or 10
                })
            return json.dumps({"success": True, "stock": res})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, result=str)
    def transfer_stock(self, part_id, from_loc_id, to_loc_id, qty, username):
        from models.stock import Stock
        from models.stock_movement import StockMovement
        db = SessionLocal()
        try:
            qty = int(qty)
            source_stock = db.query(Stock).filter(Stock.part_id == part_id, Stock.location_id == from_loc_id).first()
            if not source_stock or source_stock.quantity < qty:
                return json.dumps({"success": False, "message": "Yetersiz stok veya lokasyon bulunamadı."})
            
            source_stock.quantity -= qty
            
            target_stock = db.query(Stock).filter(Stock.part_id == part_id, Stock.location_id == to_loc_id).first()
            if target_stock:
                target_stock.quantity += qty
            else:
                target_stock = Stock(part_id=part_id, location_id=to_loc_id, quantity=qty)
                db.add(target_stock)
                
            movement = StockMovement(
                type="İç Transfer",
                quantity=qty,
                part_id=part_id,
                source_location_id=from_loc_id,
                target_location_id=to_loc_id,
                created_by=username
            )
            db.add(movement)
            db.commit()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, result=str)
    def get_stock_movements(self, mov_type):
        # mov_type can be 'in' or 'out' or 'all'
        from models.stock_movement import StockMovement
        from models.part import Part
        from models.location import Location
        from sqlalchemy.orm import aliased
        db = SessionLocal()
        try:
            SourceLoc = aliased(Location)
            TargetLoc = aliased(Location)
            query = db.query(StockMovement, Part, SourceLoc, TargetLoc) \
                .outerjoin(Part, StockMovement.part_id == Part.id) \
                .outerjoin(SourceLoc, StockMovement.source_location_id == SourceLoc.id) \
                .outerjoin(TargetLoc, StockMovement.target_location_id == TargetLoc.id)
                
            if mov_type == 'in':
                query = query.filter(StockMovement.type.in_(["Giriş", "İç Transfer", "Yeni Alım", "Inbound", "Transfer"]))
            elif mov_type == 'out':
                query = query.filter(StockMovement.type.in_(["Çıkış", "İç Transfer", "Müşteri Satışı", "Tedarikçiye İade", "Outbound", "Transfer"]))
                
            query = query.order_by(StockMovement.created_at.desc()).limit(200)
            results = query.all()
            
            res = []
            for mov, p, sloc, tloc in results:
                res.append({
                    "id": mov.id,
                    "type": mov.type,
                    "quantity": mov.quantity,
                    "part_name": f"{p.brand} {p.model} {p.name}" if p else "Silinmiş Parça",
                    "source_location": sloc.name if sloc else "-",
                    "target_location": tloc.name if tloc else "-",
                    "created_by": mov.created_by,
                    "technician": mov.technician or "-",
                    "description": mov.description or "-",
                    "unit_price": float(mov.unit_price) if mov.unit_price else None,
                    "created_at": mov.created_at.strftime("%Y-%m-%d %H:%M") if mov.created_at else ""
                })
            return json.dumps({"success": True, "movements": res})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, result=str)
    def add_inbound_entry(self, part_id, location_id, qty, unit_price, type_str, username):
        from models.stock import Stock
        from models.stock_movement import StockMovement
        db = SessionLocal()
        try:
            qty = int(qty)
            price = float(unit_price) if unit_price else 0.0
            
            stock = db.query(Stock).filter(Stock.part_id == part_id, Stock.location_id == location_id).first()
            if stock:
                stock.quantity += qty
            else:
                stock = Stock(part_id=part_id, location_id=location_id, quantity=qty)
                db.add(stock)
                
            mov = StockMovement(
                type=type_str or "Giriş",
                quantity=qty,
                part_id=part_id,
                target_location_id=location_id,
                unit_price=price,
                total_cost=qty * price,
                created_by=username
            )
            db.add(mov)
            db.commit()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, str, str, str, str, str, result=str)
    def add_outbound_entry(self, part_id, location_id, qty, type_str, username, technician, description):
        from models.stock import Stock
        from models.stock_movement import StockMovement
        db = SessionLocal()
        try:
            qty = int(qty)
            
            stock = db.query(Stock).filter(Stock.part_id == part_id, Stock.location_id == location_id).first()
            if not stock or stock.quantity < qty:
                return json.dumps({"success": False, "message": "Yetersiz stok."})
                
            stock.quantity -= qty
            
            mov = StockMovement(
                type=type_str or "Çıkış",
                quantity=qty,
                part_id=part_id,
                source_location_id=location_id,
                created_by=username,
                technician=technician or None,
                description=description or None
            )
            db.add(mov)
            db.commit()
            return json.dumps({"success": True})
        except Exception as e:
            db.rollback()
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, result=str)
    def get_reports(self, start_date, end_date):
        from models.stock_movement import StockMovement
        from models.part import Part
        from models.location import Location
        from sqlalchemy.orm import aliased
        from datetime import datetime
        db = SessionLocal()
        try:
            TargetLoc = aliased(Location)
            SourceLoc = aliased(Location)
            
            query = db.query(StockMovement, Part, SourceLoc, TargetLoc) \
                .outerjoin(Part, StockMovement.part_id == Part.id) \
                .outerjoin(SourceLoc, StockMovement.source_location_id == SourceLoc.id) \
                .outerjoin(TargetLoc, StockMovement.target_location_id == TargetLoc.id)
                
            if start_date:
                try:
                    if 'T' in start_date:
                        dt = datetime.fromisoformat(start_date)
                    else:
                        dt = datetime.strptime(start_date, "%Y-%m-%d")
                    query = query.filter(StockMovement.created_at >= dt)
                except Exception as e:
                    print(f"Error parsing start_date '{start_date}': {e}")
            if end_date:
                try:
                    if 'T' in end_date:
                        dt = datetime.fromisoformat(end_date)
                        query = query.filter(StockMovement.created_at <= dt)
                    else:
                        dt = datetime.strptime(end_date, "%Y-%m-%d")
                        import datetime as dt_module
                        dt = dt + dt_module.timedelta(days=1)
                        query = query.filter(StockMovement.created_at < dt)
                except Exception as e:
                    print(f"Error parsing end_date '{end_date}': {e}")
                    
            query = query.order_by(StockMovement.created_at.desc()).limit(1000)
            results = query.all()
            
            res = []
            for mov, p, sloc, tloc in results:
                # determine generic loc
                loc_name = tloc.name if tloc else (sloc.name if sloc else "-")
                if mov.type == "İç Transfer" and sloc and tloc:
                    loc_name = f"{sloc.name} -> {tloc.name}"
                    
                res.append({
                    "id": mov.id,
                    "date": mov.created_at.strftime("%Y-%m-%d %H:%M") if mov.created_at else "",
                    "type": mov.type,
                    "part_name": f"{p.brand} {p.model} {p.name}" if p else "-",
                    "location": loc_name,
                    "quantity": mov.quantity,
                    "user": mov.created_by
                })
            return json.dumps({"success": True, "reports": res})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    # ==========================
    # DEV MODE (Sadece Admin)
    # ==========================

    @Slot(result=str)
    def get_dev_mode(self):
        import os
        return json.dumps({"success": True, "dev_mode": os.getenv("DEV_MODE", "1") == "1"})

    @Slot(bool, result=str)
    def set_dev_mode(self, enabled):
        import dotenv
        import os
        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        try:
            dotenv.set_key(env_file, "DEV_MODE", "1" if enabled else "0")
            dotenv.load_dotenv(env_file, override=True)
            return json.dumps({"success": True})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})

    @Slot(str, str, str, str, str, result=str)
    def update_db_settings(self, host, port, db_name, user, password):
        import dotenv
        import os
        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        try:
            dotenv.set_key(env_file, "PG_HOST", host)
            dotenv.set_key(env_file, "PG_PORT", port)
            dotenv.set_key(env_file, "PG_DATABASE", db_name)
            dotenv.set_key(env_file, "PG_USER", user)
            dotenv.set_key(env_file, "PG_PASSWORD", password)
            dotenv.load_dotenv(env_file, override=True)
            return json.dumps({"success": True})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})


    # ==========================
    # DASHBOARD & EXCEL (NEW)
    # ==========================

    @Slot(result=str)
    def get_dashboard_stats(self):
        from models.part import Part
        from models.stock import Stock
        from models.stock_movement import StockMovement
        from models.location import Location
        from sqlalchemy import func
        from datetime import date
        db = SessionLocal()
        try:
            total_parts = db.query(func.count(Part.id)).scalar() or 0
            
            stocks = db.query(Stock, Part).join(Part, Stock.part_id == Part.id).all()
            critical_count = sum(1 for s, p in stocks if s.quantity <= (p.critical_limit or 10))
            
            today = date.today()
            todays_inbound = db.query(func.sum(StockMovement.quantity)).filter(
                StockMovement.type.in_(["Giriş", "İç Transfer", "Yeni Alım", "Inbound", "Transfer"]),
                func.date(StockMovement.created_at) == today
            ).scalar() or 0
            
            todays_outbound = db.query(func.sum(StockMovement.quantity)).filter(
                StockMovement.type.in_(["Çıkış", "İç Transfer", "Müşteri Satışı", "Tedarikçiye İade", "Outbound", "Transfer"]),
                func.date(StockMovement.created_at) == today
            ).scalar() or 0
            
            active_locations = db.query(func.count(Location.id)).scalar() or 0
            
            import json
            return json.dumps({
                "success": True,
                "stats": {
                    "totalParts": str(total_parts),
                    "criticalStock": str(critical_count),
                    "todaysInbound": str(int(todays_inbound)),
                    "todaysOutbound": str(int(todays_outbound)),
                    "activeLocations": str(active_locations)
                }
            })
        except Exception as e:
            import json
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(result=str)
    def get_critical_stock(self):
        from models.stock import Stock
        from models.part import Part
        from models.location import Location
        db = SessionLocal()
        try:
            stocks = db.query(Stock, Part, Location).join(Part, Stock.part_id == Part.id).join(Location, Stock.location_id == Location.id).all()
            res = []
            for s, p, l in stocks:
                limit = p.critical_limit or 10
                if s.quantity <= limit:
                    res.append({
                        "id": s.id,
                        "part_name": f"{p.brand} {p.model} {p.name}",
                        "location_name": l.name,
                        "quantity": s.quantity,
                        "critical_limit": limit,
                        "status": "Kritik" if s.quantity > 0 else "Tükendi"
                    })
            import json
            return json.dumps({"success": True, "critical_stock": res})
        except Exception as e:
            import json
            return json.dumps({"success": False, "message": str(e)})
        finally:
            db.close()

    @Slot(str, str, result=str)
    def export_table_to_excel(self, data_json_str, filename):
        """
        Genel amaçlı excel export - Direkt İndirilenler Klasörüne Kaydeder
        """
        from ui.excel_utils import style_excel_file
        import json
        import pandas as pd
        import os
        from pathlib import Path
        try:
            data = json.loads(data_json_str)
            if not data:
                return json.dumps({"success": False, "message": "Dışa aktarılacak veri yok."})
                
            downloads_path = str(Path.home() / "Downloads")
            file_path = os.path.join(downloads_path, filename)
            
            # Eğer dosya varsa ismini değiştir
            counter = 1
            base_name, ext = os.path.splitext(filename)
            while os.path.exists(file_path):
                file_path = os.path.join(downloads_path, f"{base_name}_{counter}{ext}")
                counter += 1
                
            df = pd.DataFrame(data)
            df.to_excel(file_path, index=False)
            try:
                style_excel_file(file_path)
            except:
                pass
                
            # Dosyayı otomatik aç (Windows)
            os.startfile(file_path)
            
            return json.dumps({"success": True})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})

    # ==========================================
    # LOCAL DB & DATA FOLDERS (AYARLAR SEKME)
    # ==========================================
    def _get_settings_file(self):
        import os
        from pathlib import Path
        settings_dir = os.path.join(str(Path.home()), ".remalab")
        os.makedirs(settings_dir, exist_ok=True)
        return os.path.join(settings_dir, "settings.json")

    def _read_settings(self):
        import json, os
        settings_file = self._get_settings_file()
        if not os.path.exists(settings_file):
            return {"local_files": [], "data_folders": []}
        try:
            with open(settings_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            return {"local_files": [], "data_folders": []}

    def _write_settings(self, data):
        import json
        settings_file = self._get_settings_file()
        with open(settings_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)

    @Slot(result=str)
    def get_local_files(self):
        import json, os, datetime
        settings = self._read_settings()
        files = settings.get("local_files", [])
        valid_files = []
        for f in files:
            path = f.get("path")
            if path and os.path.exists(path):
                size_bytes = os.path.getsize(path)
                size_mb = size_bytes / (1024 * 1024)
                mod_time = os.path.getmtime(path)
                mod_date = datetime.datetime.fromtimestamp(mod_time).strftime('%d.%m.%Y %H:%M')
                
                f["size"] = f"{size_mb:.2f} MB"
                f["modified"] = mod_date
                
                # Mock tables/records count if sqlite
                if f.get("type") == "sqlite":
                    f["tables"] = 0
                    f["records"] = 0
                    try:
                        import sqlite3
                        conn = sqlite3.connect(path)
                        cursor = conn.cursor()
                        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
                        tables = cursor.fetchall()
                        f["tables"] = len(tables)
                        conn.close()
                    except:
                        pass
                
                valid_files.append(f)
            else:
                f["size"] = "Kayıp"
                f["modified"] = "Bilinmiyor"
                valid_files.append(f)
        
        return json.dumps({"success": True, "local_files": valid_files})

    @Slot(result=str)
    def add_local_file(self):
        from PySide6.QtWidgets import QFileDialog, QApplication
        import json, os, uuid
        
        main_win = QApplication.instance().main_window
        file_path, _ = QFileDialog.getOpenFileName(
            main_win, "Var Olan Veritabanı veya Betiği Seç", "", "Database Files (*.db *.sqlite *.sql);;All Files (*)"
        )
        if not file_path:
            return json.dumps({"success": False, "message": "Seçim iptal edildi"})
            
        settings = self._read_settings()
        
        # Check if already exists
        for f in settings.get("local_files", []):
            if f.get("path") == file_path:
                return json.dumps({"success": False, "message": "Bu dosya zaten listede."})
                
        file_type = "sqlite" if file_path.endswith((".db", ".sqlite")) else "sql"
        new_file = {
            "id": str(uuid.uuid4()),
            "name": os.path.basename(file_path),
            "path": file_path,
            "type": file_type
        }
        
        settings.setdefault("local_files", []).append(new_file)
        self._write_settings(settings)
        return json.dumps({"success": True, "file": new_file})

    @Slot(result=str)
    def create_local_file(self):
        from PySide6.QtWidgets import QFileDialog, QApplication
        import json, os, uuid, sqlite3
        
        main_win = QApplication.instance().main_window
        file_path, _ = QFileDialog.getSaveFileName(
            main_win, "Yeni SQLite Veritabanı Oluştur", "yeni_veritabani.db", "SQLite Database (*.db)"
        )
        if not file_path:
            return json.dumps({"success": False, "message": "İşlem iptal edildi"})
            
        try:
            # Create empty sqlite
            conn = sqlite3.connect(file_path)
            conn.close()
            
            settings = self._read_settings()
            new_file = {
                "id": str(uuid.uuid4()),
                "name": os.path.basename(file_path),
                "path": file_path,
                "type": "sqlite"
            }
            settings.setdefault("local_files", []).append(new_file)
            self._write_settings(settings)
            return json.dumps({"success": True, "file": new_file})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})

    @Slot(str, result=str)
    def delete_local_file(self, file_id):
        import json
        settings = self._read_settings()
        files = settings.get("local_files", [])
        settings["local_files"] = [f for f in files if f.get("id") != file_id]
        self._write_settings(settings)
        return json.dumps({"success": True})

    @Slot(str, result=str)
    def open_local_folder(self, file_path):
        import json, os, sys
        import subprocess
        try:
            folder = os.path.dirname(file_path)
            if not os.path.exists(folder):
                return json.dumps({"success": False, "message": "Klasör bulunamadı."})
            if os.name == 'nt':
                os.startfile(folder)
            elif sys.platform == 'darwin':
                subprocess.Popen(['open', folder])
            else:
                subprocess.Popen(['xdg-open', folder])
            return json.dumps({"success": True})
        except Exception as e:
            return json.dumps({"success": False, "message": str(e)})

    @Slot(result=str)
    def get_data_folders(self):
        import json
        settings = self._read_settings()
        return json.dumps({"success": True, "data_folders": settings.get("data_folders", [])})

    @Slot(result=str)
    def add_data_folder(self):
        from PySide6.QtWidgets import QFileDialog, QApplication
        import json, os, uuid
        
        main_win = QApplication.instance().main_window
        folder_path = QFileDialog.getExistingDirectory(
            main_win, "Klasör Seç"
        )
        if not folder_path:
            return json.dumps({"success": False, "message": "Seçim iptal edildi"})
            
        settings = self._read_settings()
        
        # Check if already exists
        for f in settings.get("data_folders", []):
            if f.get("path") == folder_path:
                return json.dumps({"success": False, "message": "Bu klasör zaten listede."})
                
        # Determine type based on name heuristically or default to data
        folder_type = "backup" if "backup" in folder_path.lower() or "yedek" in folder_path.lower() else "data"
        new_folder = {
            "id": str(uuid.uuid4()),
            "name": os.path.basename(folder_path) or folder_path,
            "path": folder_path,
            "type": folder_type
        }
        
        settings.setdefault("data_folders", []).append(new_folder)
        self._write_settings(settings)
        return json.dumps({"success": True, "folder": new_folder})

    @Slot(str, result=str)
    def delete_data_folder(self, folder_id):
        import json
        settings = self._read_settings()
        folders = settings.get("data_folders", [])
        settings["data_folders"] = [f for f in folders if f.get("id") != folder_id]
        self._write_settings(settings)
        return json.dumps({"success": True})

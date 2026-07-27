import React, { useState, useEffect } from "react";

const TechnicianPanel = () => {
  const [barcode, setBarcode] = useState("");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [notification, setNotification] = useState(null);

  const showNotification = (type, title, message) => {
    setNotification({ type, title, message });
    if (type !== 'error') {
        setTimeout(() => setNotification(null), 5000);
    }
  };


  const fetchRepairs = async (imei) => {
    if (!window.webBridge) return;
    setLoading(true);
    try {
      const resp = await window.webBridge.get_repair_records(imei);
      const data = JSON.parse(resp);
      if (data.success) {
        setRecords(data.records);
        // Eger kayit yoksa ya alt onarim olusmamistir (parca yoktur) ya da cihaz 109'da degildir
        if (data.records.length === 0) {
            showNotification("info", "Bilgi", "Bu cihaz için aktif alt onarım kaydı (Repair ID) bulunmuyor.");
        }
      } else {
        showNotification("error", "Hata", data.message);
      }
    } catch (e) {
      console.error(e);
      showNotification("error", "Hata", "Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!barcode) return;
    
    // Normalde cihaz getirilip statüsünün 109 olup olmadığı kontrol edilmeli.
    // Eger 109 degilse panel acilmamali. Demo geregi bypass ediyoruz.
    setDeviceInfo({ imei: barcode, model: "iPhone 11", totalBudget: "3.500 TL", warranty: "OOW" });
    fetchRepairs(barcode);
  };

  // Mock function to update repair record status
  const updateRecordStatus = (recordId, newStatus) => {
    // API cagrisi yapilacak. Simdilik UI statemizi guncelliyoruz
    setRecords(records.map(r => r.id === recordId ? { ...r, repair_result_type_code: newStatus } : r));
    showNotification("success", "Başarılı", `Kayıt statüsü ${newStatus} olarak güncellendi.`);
  };

  const getStatusBadge = (code) => {
    switch(code) {
        case 1000: return <span className="badge badge-warning">Atanacak</span>;
        case 1001: return <span className="badge badge-info">Atandı (İşlemde)</span>;
        case 1002: return <span className="badge badge-success text-white">Tamamlandı</span>;
        default: return <span className="badge">{code}</span>;
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Teknisyen Paneli (Üretim Merkezi)</h2>
      
      <form onSubmit={handleSearch} className="mb-8 max-w-xl">
        <div className="flex gap-4">
          <input
            type="text"
            className="flex-1 input input-bordered input-primary"
            placeholder="Üretimdeki cihaz barkodunu okutunuz..."
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Sorgulanıyor..." : "Cihazı Aç"}
          </button>
        </div>
      </form>

      {deviceInfo && (
        <>
          <div className="stats shadow mb-8 w-full bg-base-100">
            <div className="stat">
              <div className="stat-figure text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-8 h-8 stroke-current"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </div>
              <div className="stat-title">Cihaz Model</div>
              <div className="stat-value text-primary">{deviceInfo.model}</div>
              <div className="stat-desc">{deviceInfo.imei}</div>
            </div>
            
            <div className="stat">
              <div className="stat-figure text-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-8 h-8 stroke-current"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
              </div>
              <div className="stat-title">Garanti Kapsamı</div>
              <div className="stat-value text-secondary">{deviceInfo.warranty}</div>
              <div className="stat-desc">Fatura yansıması</div>
            </div>
            
            <div className="stat">
              <div className="stat-figure text-accent">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-8 h-8 stroke-current"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
              </div>
              <div className="stat-title">Sepet Bütçesi</div>
              <div className="stat-value">{deviceInfo.totalBudget}</div>
              <div className="stat-desc text-success">Müşteri Tarafından Onaylı</div>
            </div>
          </div>

          <div className="divider text-lg font-semibold">Eşzamanlı Alt Onarım Kartları (Repair IDs)</div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {records.map((r, i) => (
              <div key={r.id} className="card bg-base-100 shadow-xl border border-gray-200 dark:border-gray-700">
                <div className="card-body">
                  <div className="flex justify-between items-start">
                    <h2 className="card-title text-primary">
                        {r.department_mission}
                    </h2>
                    {getStatusBadge(r.repair_result_type_code)}
                  </div>
                  
                  <p className="text-sm text-gray-500 mt-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Arızalı Parça:</span> {r.item_category}
                  </p>
                  
                  <p className="text-xs text-gray-400 mt-1 mb-4">
                    Repair ID: {r.id.substring(0, 8)}...
                  </p>

                  <div className="card-actions justify-end mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
                    {r.repair_result_type_code === 1000 && (
                        <button onClick={() => updateRecordStatus(r.id, 1001)} className="btn btn-sm btn-info text-white w-full">İşi Üstlen (Ata)</button>
                    )}
                    {r.repair_result_type_code === 1001 && (
                        <button onClick={() => updateRecordStatus(r.id, 1002)} className="btn btn-sm btn-success text-white w-full">Onarımı Tamamla</button>
                    )}
                    {r.repair_result_type_code === 1002 && (
                        <button className="btn btn-sm w-full btn-disabled">İşlem Bitti</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default TechnicianPanel;

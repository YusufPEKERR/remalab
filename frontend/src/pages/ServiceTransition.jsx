import React, { useState, useEffect } from "react";

const ServiceTransition = () => {
  const [barcode, setBarcode] = useState("");
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [transitions, setTransitions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (type, title, message) => {
    // type: 'success', 'error', 'warning', 'info'
    setNotification({ type, title, message });
    if (type !== 'error') {
        setTimeout(() => setNotification(null), 5000);
    }
  };


  // Sahte bir cihaz bulma fonksiyonu (gercekte barkodla cihaz sorgulanacak)
  // Demo amaciyla sadece statuyu manuel secebilecegimiz bir input yapalim veya 
  // cihazin mevcut statüsünü set edelim.
  const [currentStatu, setCurrentStatu] = useState(100);

  const fetchTransitions = async (statuCode) => {
    if (!window.webBridge) return;
    setLoading(true);
    try {
      const resp = await window.webBridge.get_allowed_transitions(statuCode);
      const data = JSON.parse(resp);
      if (data.success) {
        setTransitions(data.transitions);
      } else {
        showNotification("error", "Geçişler alınamadı", data.message);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!barcode) return;
    // Normalde API'den cihaz bulunup statüsü alinmali.
    // Simdilik demo cihazi statüsü currentStatu olarak aliniyor.
    if (currentStatu === 109) {
      showNotification("warning", "Uyarı", "Bu cihaz üretimdedir, teknisyen panelinden işlem yapınız!");
      setDeviceInfo(null);
      setTransitions([]);
      return;
    }
    
    setDeviceInfo({
      imei: barcode,
      model: "iPhone 11",
      statu: currentStatu
    });
    fetchTransitions(currentStatu);
  };

  const executeTransition = async (targetStatu) => {
    if (!window.webBridge) return;
    try {
      // execute_statu_transition(service_record_id, current, target, req_type, test_result)
      // demo record_id olarak barkodu gonderiyoruz
      const resp = await window.webBridge.execute_statu_transition(
        barcode,
        currentStatu,
        targetStatu,
        "", // request_type
        ""  // test_result
      );
      const data = JSON.parse(resp);
      
      if (data.success) {
        showNotification("success", "Başarılı", data.message || "Statü güncellendi!");
        setCurrentStatu(data.new_statu_code);
        setDeviceInfo(prev => ({...prev, statu: data.new_statu_code}));
        
        if (data.new_statu_code === 109) {
            showNotification("warning", "Bilgi", "Cihaz üretime geçti. Teknisyen Paneline yönlendiriliyorsunuz.");
            setTransitions([]);
        } else {
            fetchTransitions(data.new_statu_code);
        }
      } else {
        if (data.error_code === "DOA_TRANSFER_REQUIRED") {
            // DOA Guardrail Modal trigger (Simdilik alert yapalim veya ozel UI gosterelim)
            const confirmDoa = window.confirm(data.message + "\nDOA Store'a aktarmak için Tamam'a basın.");
            if (confirmDoa) {
                const doaResp = await window.webBridge.transfer_to_doa(barcode);
                const doaData = JSON.parse(doaResp);
                if (doaData.success) {
                    showNotification("success", "DOA Aktarımı", "Parçalar DOA'ya aktarıldı. Şimdi işlemi tekrar deneyebilirsiniz.");
                } else {
                    showNotification("error", "DOA Hata", doaData.message);
                }
            }
        } else {
            showNotification("error", "Hata", data.message);
        }
      }
    } catch (e) {
      console.error(e);
      showNotification("error", "Sistem Hatası", "Beklenmeyen bir hata oluştu.");
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Hızlı İşlem / Barkod Ekranı</h2>
      
      <form onSubmit={handleSearch} className="mb-8 max-w-xl">
        <div className="flex gap-4">
          <input
            type="text"
            className="flex-1 input input-bordered input-primary"
            placeholder="Barkod veya IMEI okutunuz..."
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
          />
          
          <input 
            type="number"
            className="w-24 input input-bordered"
            title="Demo Statu Simülasyonu"
            value={currentStatu}
            onChange={(e) => setCurrentStatu(parseInt(e.target.value))}
          />
          
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Sorgulanıyor..." : "Sorgula"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">* Demo modunda yan kutudaki sayi cihazin statüsünü belirler.</p>
      </form>

      {deviceInfo && currentStatu !== 109 && (
        <div className="card bg-base-100 shadow-xl border-t-4 border-primary">
          <div className="card-body">
            <h3 className="card-title text-xl">Cihaz: {deviceInfo.imei} ({deviceInfo.model})</h3>
            <div className="badge badge-lg badge-neutral my-2">Mevcut Statü: {deviceInfo.statu}</div>
            
            <div className="divider">İzin Verilen Geçişler</div>
            
            {transitions.length === 0 ? (
              <p className="text-gray-500 italic">Bu statüden yapılabilecek işlem bulunamadı.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {transitions.map((t, idx) => (
                  <button
                    key={idx}
                    onClick={() => executeTransition(t.target_statu_code)}
                    className={`btn h-auto py-4 ${t.is_positive ? 'btn-success text-white' : 'btn-error text-white'}`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="font-bold">{t.target_statu_name}</span>
                      <span className="text-xs opacity-75 mt-1">Kod: {t.target_statu_code}</span>
                      {(t.kontrol_1 || t.kontrol_2) && (
                        <span className="text-[10px] mt-2 italic block text-center">
                          {t.kontrol_1} &rarr; {t.kontrol_2}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceTransition;

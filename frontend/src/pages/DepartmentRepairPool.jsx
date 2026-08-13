import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Wrench,
  Search,
  RefreshCw,
  Battery,
  Camera,
  Monitor,
  Box,
  Cpu,
  Zap,
  HardDrive,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ChevronRight,
  User,
  Barcode,
  Tag,
  ClipboardCheck
} from 'lucide-react';
import { api } from '../services/api';

const DEPARTMENTS_CONFIG = {
  BATTERY: { title: 'Batarya Onarımı', icon: Battery, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' },
  CAMERA: { title: 'Kamera Onarımı', icon: Camera, color: 'text-purple-500 bg-purple-500/10 border-purple-500/30' },
  DISPLAY: { title: 'Ekran Onarımı', icon: Monitor, color: 'text-blue-500 bg-blue-500/10 border-blue-500/30' },
  CASE: { title: 'Kasa Onarımı', icon: Box, color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
  L1REPAIR: { title: 'L1 Onarımı', icon: Cpu, color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30' },
  L2REPAIR: { title: 'L2 Onarımı', icon: Zap, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30' },
  L3REPAIR: { title: 'L3 Onarımı', icon: HardDrive, color: 'text-rose-500 bg-rose-500/10 border-rose-500/30' },
};

// Backend cihazin IMEI'si bulunamazsa geri donus olarak servis kayit numarasini
// (cogu kez bir UUID) yolluyor. Bunu "IMEI:" diye etiketlemek yaniltici oluyordu -
// ekranda "IMEI: 15d675ee-f8a2-447d-a93d-7bdfdb2efc94" gibi satirlar cikiyordu.
const cihazEtiketi = (deger) => {
  const v = (deger || "").trim();
  if (!v || v === "-") return { etiket: "IMEI", metin: "-" };
  return /^\d{8,}$/.test(v)
    ? { etiket: "IMEI", metin: v }
    : { etiket: "Servis kaydı", metin: v };
};

// Teknisyen kutusu içi sıralama: önce ONARIMDA olanlar, sonra TAMAMLANDI, en altta İPTAL.
const durumSirasi = (item) =>
  (item.isCancelled || Number(item.statusCode) === 1003) ? 2
    : (item.isSuccess || Number(item.statusCode) === 1002) ? 1
      : 0;

const DepartmentRepairPool = () => {
  const { deptCode } = useParams();
  const navigate = useNavigate();

  const currentDeptCode = (deptCode || 'BATTERY').toUpperCase();
  const deptConfig = DEPARTMENTS_CONFIG[currentDeptCode] || {
    title: `${currentDeptCode} Onarımı`,
    icon: Wrench,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
  };
  const DeptIcon = deptConfig.icon;

  const [items, setItems] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanInputs, setScanInputs] = useState({});
  const [assigningUser, setAssigningUser] = useState(null);
  const [message, setMessage] = useState(null);
  const [search, setSearch] = useState('');

  const fetchPoolData = useCallback(async () => {
    setLoading(true);
    try {
      const [poolRes, techRes] = await Promise.all([
        api.getRepairPoolByDepartment(currentDeptCode),
        api.getDepartmentTechnicians(currentDeptCode)
      ]);

      if (poolRes && poolRes.success) {
        setItems(poolRes.items || []);
      } else {
        setItems([]);
      }

      if (techRes && techRes.success) {
        setTechnicians(techRes.technicians || []);
      } else {
        setTechnicians([]);
      }
    } catch (err) {
      console.error('Pool fetch error:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [currentDeptCode]);

  useEffect(() => {
    fetchPoolData();
  }, [fetchPoolData]);

  // Teknisyene okutma ile atama yapma
  const handleAssignScan = async (e, techUsername) => {
    if (e.key !== 'Enter') return;
    const value = (scanInputs[techUsername] || '').trim();
    if (!value) return;

    setAssigningUser(techUsername);
    setMessage(null);

    try {
      const res = await api.assignRepairToTechnician(currentDeptCode, value, techUsername);
      if (res && res.success) {
        setMessage({ type: 'success', text: res.message });
        setScanInputs(prev => ({ ...prev, [techUsername]: '' }));
        fetchPoolData();
      } else {
        setMessage({ type: 'error', text: res ? res.message : 'Atama yapılamadı.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Sistem hatası: ' + err.message });
    } finally {
      setAssigningUser(null);
    }
  };

  // Tüm aktif (iptal edilmemiş ve tamamlanmamış) onarımlar — en son eklenen en üstte
  // (backend sırasından bağımsız garanti: ham zaman damgasına göre azalan).
  const poolItems = items
    .filter(item => !item.isCancelled && !item.isSuccess)
    .slice()
    .sort((a, b) => (b.createdAtRaw || 0) - (a.createdAtRaw || 0));

  // Arama: imei, cihaz, müşteri, parti, arıza, işlem/parça ve teknisyen üzerinde
  const aramaSorgu = search.trim().toLowerCase();
  const eslesiyorMu = (item) =>
    !aramaSorgu ||
    [
      item.imei, item.productInfo, item.customerName, item.batchNo,
      item.operationTypeName, item.operationTypeCode,
      item.assignedTechnicianName, item.assignedTechnician,
      // Satır bir ONARIMI temsil ettiği için arama onun TÜM parçalarını kapsamalı;
      // yalnızca ilk parçaya bakılırsa ikinci parçanın kodu/arızası aranamaz.
      ...(item.parts || []).flatMap(p => [p.partName, p.partItemCode, p.faultName]),
    ].some(alan => (alan ?? '').toString().toLowerCase().includes(aramaSorgu));

  const filteredPool = poolItems.filter(eslesiyorMu);

  // Teknisyen kartları da aramadan etkilenir: ismi eşleşen YA DA üzerinde eşleşen
  // cihaz bulunan teknisyenler gösterilir; kart içindeki cihaz listesi de filtrelenir.
  const teknisyenIsmiEslesti = (tech) =>
    [tech.fullname, tech.username].some(a => (a ?? '').toString().toLowerCase().includes(aramaSorgu));
  const visibleTechnicians = aramaSorgu
    ? technicians.filter(
        (tech) =>
          teknisyenIsmiEslesti(tech) ||
          items.some((item) => item.assignedTechnician === tech.username && eslesiyorMu(item))
      )
    : technicians;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* ── Üst Başlık & Departman Sekmeleri ────────────────────────── */}
      <div className="bg-white dark:bg-[#12141c] rounded-2xl p-5 border border-slate-200 dark:border-[#1e222d] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl border ${deptConfig.color}`}>
              <DeptIcon size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                {deptConfig.title} Havuzu
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Teknisyen bazlı canlı okutma ve sıralı atama paneli
              </p>
            </div>
          </div>

          <button
            onClick={fetchPoolData}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#1a1d27] hover:bg-slate-200 dark:hover:bg-[#242836] text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Yenile
          </button>
        </div>

        {/* Departman Hızlı Sekmeleri */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-[#1e222d]">
          {Object.entries(DEPARTMENTS_CONFIG).map(([code, config]) => {
            const Icon = config.icon;
            const isActive = code === currentDeptCode;
            return (
              <button
                key={code}
                onClick={() => navigate(`/onarim-havuzu/${code}`)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 dark:bg-[#1a1d27] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#242836]'
                }`}
              >
                <Icon size={14} />
                {config.title.replace(' Onarımı', '')}
              </button>
            );
          })}
        </div>

        {/* ── Sayfa Geneli Onarım Arama ── */}
        <div className="relative mt-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Onarım ara — IMEI, cihaz, müşteri, parti, arıza, işlem/parça veya teknisyen..."
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-[#171a26] border border-slate-200 dark:border-[#1e222d] rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#12141c] transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer text-sm"
              title="Aramayı temizle"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Bildirim Mesajı ───────────────────────────────────────── */}
      {message && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300' 
            : 'bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
        </div>
      )}

      {/* ── 1. DEPARTMAN TEKNİSYENLERİ & BARKOD OKUTMA KUTULARI ───────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <User size={16} className="text-blue-500" />
          Departman Teknisyenleri ve Anlık Atama Kutuları ({visibleTechnicians.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleTechnicians.length === 0 ? (
            <div className="col-span-full p-6 text-center text-slate-400 bg-white dark:bg-[#12141c] rounded-2xl border border-slate-200 dark:border-[#1e222d] text-xs italic">
              {aramaSorgu
                ? `“${search}” aramasıyla eşleşen teknisyen veya cihaz bulunamadı.`
                : 'Bu departmana atanmış kayıtlı teknisyen bulunamadı.'}
            </div>
          ) : (
            visibleTechnicians.map((tech) => {
              const techAllAssigned = items.filter(item => item.assignedTechnician === tech.username);
              // Arama filtresi + durum sırası (onarımda → tamamlandı → iptal).
              // sort kararlı olduğundan aynı durum grubunda backend sırası (en yeni önce) korunur.
              const techAssignedItems = (aramaSorgu ? techAllAssigned.filter(eslesiyorMu) : techAllAssigned)
                .slice()
                .sort((a, b) =>
                  durumSirasi(a) - durumSirasi(b) ||
                  (b.createdAtRaw || 0) - (a.createdAtRaw || 0)
                );
              const isScanning = assigningUser === tech.username;

              return (
                <div 
                  key={tech.username}
                  className="bg-white dark:bg-[#12141c] rounded-2xl p-4 border border-slate-200 dark:border-[#1e222d] shadow-sm flex flex-col justify-between space-y-3"
                >
                  <div>
                    {/* Teknisyen Adı ve Sayı Badge */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                          {tech.fullname ? tech.fullname.charAt(0).toUpperCase() : tech.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                            {tech.fullname || tech.username}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            @{tech.username}
                          </div>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        {techAssignedItems.length} Cihaz
                      </span>
                    </div>

                    {/* Teknisyen Özel Barkod / IMEI Okutma Kutusu */}
                    <div className="relative mt-2">
                      <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input
                        type="text"
                        placeholder="IMEI okut ve Enter..."
                        value={scanInputs[tech.username] || ''}
                        disabled={isScanning}
                        onChange={(e) => setScanInputs({ ...scanInputs, [tech.username]: e.target.value })}
                        onKeyDown={(e) => handleAssignScan(e, tech.username)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#171a26] border border-slate-200 dark:border-[#1e222d] rounded-xl text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#12141c] transition-all"
                      />
                    </div>
                  </div>

                  {/* Teknisyen Üzerindeki Cihazların Küçük Listesi */}
                  <div className="border-t border-slate-100 dark:border-[#1e222d] pt-2 space-y-1.5 max-h-[160px] overflow-y-auto">
                    {techAssignedItems.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic text-center py-2">
                        {aramaSorgu && techAllAssigned.length > 0
                          ? 'Bu aramayla eşleşen cihaz yok'
                          : 'Henüz üzerine cihaz atanmadı'}
                      </p>
                    ) : (
                      techAssignedItems.map((item) => {
                        const tamamlandi = item.isSuccess || Number(item.statusCode) === 1002;
                        const iptal = item.isCancelled || Number(item.statusCode) === 1003;
                        const bitisTesti = Number(item.statusCode) === 1006;
                        return (
                          <div
                            key={item.repairId}
                            className="p-2 rounded-lg bg-slate-50 dark:bg-[#171a26] flex items-center justify-between gap-2 text-[11px]"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-slate-700 dark:text-slate-200 truncate">
                                {item.productInfo}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono truncate">
                                {item.imei}
                              </div>
                            </div>
                            {tamamlandi ? (
                              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                                <CheckCircle2 size={11} /> Tamamlandı
                              </span>
                            ) : iptal ? (
                              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                                <XCircle size={11} /> İptal
                              </span>
                            ) : bitisTesti ? (
                              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                                <ClipboardCheck size={11} /> Bitiş Testinde
                              </span>
                            ) : (
                              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                <Clock size={11} /> Onarımda
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── 2. DEPARTMAN ONARIM HAVUZU LİSTESİ ── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Clock size={16} className="text-amber-500" />
            Departman Onarım Havuzu (Giriş Tarihi Sırasıyla En Yeniden En Eskiye)
          </h2>
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
            {aramaSorgu ? `${filteredPool.length} / ${poolItems.length}` : `Toplam ${poolItems.length}`} cihaz
          </span>
        </div>

        <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-slate-200 dark:border-[#1e222d] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#1e222d] bg-slate-50/50 dark:bg-[#171a26] text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Sıra & Tarih</th>
                  <th className="px-4 py-3">Cihaz & IMEI</th>
                  <th className="px-4 py-3">Müşteri / Parti</th>
                  <th className="px-4 py-3">Tespit Edilen Arıza</th>
                  <th className="px-4 py-3">İşlem / Parça</th>
                  <th className="px-4 py-3">Atanan Teknisyen</th>
                  <th className="px-4 py-3">Statü</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1e222d] text-xs">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-slate-400">
                      <RefreshCw className="animate-spin mx-auto mb-2 text-blue-500" size={20} />
                      Havuz verileri yükleniyor...
                    </td>
                  </tr>
                ) : poolItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-slate-400 dark:text-slate-600 italic">
                      Bu departmanda henüz kayıtlı onarım bulunmuyor.
                    </td>
                  </tr>
                ) : filteredPool.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-slate-400 dark:text-slate-600 italic">
                      “{search}” aramasıyla eşleşen onarım bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredPool.map((item, idx) => (
                    <tr
                      key={item.repairId}
                      className="hover:bg-slate-50/80 dark:hover:bg-[#171a26]/50 transition-colors"
                    >
                      {/* Sıra & Tarih */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-[#1a1d27] text-slate-600 dark:text-slate-400 font-bold text-[11px] flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 text-[11px]" title={`Oluşturulma: ${item.createdAt}`}>
                            {item.updatedAt || item.createdAt}
                          </span>
                        </div>
                      </td>

                      {/* Cihaz & IMEI */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-800 dark:text-slate-100">
                          {item.productInfo}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {cihazEtiketi(item.imei).etiket}: {cihazEtiketi(item.imei).metin}
                        </div>
                      </td>

                      {/* Müşteri / Parti */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-700 dark:text-slate-300">
                          {item.customerName || '-'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {item.batchNo || '-'}
                        </div>
                      </td>

                      {/* Arıza — onarımın TÜM parçalarının arızaları.
                          Satır artık bir parçayı değil bir ONARIMI temsil ediyor. */}
                      <td className="px-4 py-3.5">
                        {(() => {
                          const arizalar = [...new Set((item.parts || [])
                            .map(p => p.faultName).filter(Boolean))];
                          if (!arizalar.length) return <span className="text-slate-400 italic">Belirtilmedi</span>;
                          return (
                            <div className="space-y-0.5">
                              {arizalar.map((a, i) => (
                                <div key={i} className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                                  <AlertTriangle size={12} className="text-amber-500 shrink-0" />
                                  {a}
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </td>

                      {/* İşlem / Parçalar */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          {item.operationTypeName || item.operationTypeCode || '-'}
                          {(item.partCount || 1) > 1 && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                              {item.partCount} parça
                            </span>
                          )}
                        </div>
                        {(item.parts || []).filter(p => p.partName || p.partItemCode).map((p) => (
                          <div key={p.partRecordId} className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Tag size={10} className="shrink-0" />
                            {p.partName || p.partItemCode}
                          </div>
                        ))}
                      </td>

                      {/* Atanan Teknisyen */}
                      <td className="px-4 py-3.5">
                        {item.assignedTechnician ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            <User size={12} />
                            {item.assignedTechnicianName || item.assignedTechnician}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-400 bg-slate-100 dark:bg-[#1a1d27]">
                            Atanacak (Bekliyor)
                          </span>
                        )}
                      </td>

                      {/* Statü */}
                      <td className="px-4 py-3.5">
                        {item.isSuccess || Number(item.statusCode) === 1002 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                            <CheckCircle2 size={12} />
                            Tamamlandı (1002)
                          </span>
                        ) : item.isCancelled || Number(item.statusCode) === 1003 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                            İptal Edildi (1003)
                          </span>
                        ) : Number(item.statusCode) === 1006 ? (
                          // Onarım bitiş testine aktarıldı — sonuç Onarım Bitiş Testi ekranından verilir.
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                            <ClipboardCheck size={12} />
                            Bitiş Testinde (1006)
                          </span>
                        ) : Number(item.statusCode) === 1004 ? (
                          // Görev grubu sırası: RMA → L3 → Batarya/Kamera/Kasa/Ekran → L1/L2.
                          // Sırası gelmeyen onarım havuzda beklemede durur; üst seviye
                          // kapandığında backend kaydı kendiliğinden 1000/1001'e döndürür.
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20"
                            title="Üst seviye onarımlar bitmeden bu onarıma başlanamaz."
                          >
                            <Clock size={12} />
                            Yüksek Seviye Onarım Bekleniyor (1004)
                          </span>
                        ) : item.assignedTechnician ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            Atandı / Onarımda (1001)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Clock size={12} />
                            Teknisyene Atanacak (1000)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DepartmentRepairPool;

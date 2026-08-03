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
  Tag
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

  // Teknisyene atanacak (havuzda bekleyen) cihazlar (Sisteme giriş tarihine göre sıralı)
  const unassignedItems = items.filter(item => !item.assignedTechnician && !item.isCancelled && !item.isSuccess);

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
          Departman Teknisyenleri ve Anlık Atama Kutuları ({technicians.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {technicians.length === 0 ? (
            <div className="col-span-full p-6 text-center text-slate-400 bg-white dark:bg-[#12141c] rounded-2xl border border-slate-200 dark:border-[#1e222d] text-xs italic">
              Bu departmana atanmış kayıtlı teknisyen bulunamadı.
            </div>
          ) : (
            technicians.map((tech) => {
              const techAssignedItems = items.filter(item => item.assignedTechnician === tech.username);
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
                        Henüz üzerine cihaz atanmadı
                      </p>
                    ) : (
                      techAssignedItems.map((item) => (
                        <div 
                          key={item.repairId}
                          className="p-2 rounded-lg bg-slate-50 dark:bg-[#171a26] flex items-center justify-between text-[11px]"
                        >
                          <div>
                            <div className="font-bold text-slate-700 dark:text-slate-200">
                              {item.productInfo}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {item.imei}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── 2. BEKLEYEN ONARIM HAVUZU (SİSTEME GİRİŞ TARİHİ SIRASINA GÖRE) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Clock size={16} className="text-amber-500" />
            Teknisyene Atanacak Onarımlar (Giriş Tarihi Sırasıyla En Eskiden En Yeniye)
          </h2>
          <span className="text-xs font-semibold text-slate-500">
            Toplam {unassignedItems.length} bekleyen cihaz
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
                  <th className="px-4 py-3">Statü</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1e222d] text-xs">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-12 text-center text-slate-400">
                      <RefreshCw className="animate-spin mx-auto mb-2 text-blue-500" size={20} />
                      Havuz verileri yükleniyor...
                    </td>
                  </tr>
                ) : unassignedItems.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-12 text-center text-slate-400 dark:text-slate-600 italic">
                      Atanmayı bekleyen yeni onarım kaydı bulunmuyor. Tüm cihazlar teknisyenlere dağıtıldı!
                    </td>
                  </tr>
                ) : (
                  unassignedItems.map((item, idx) => (
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
                          <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                            {item.createdAt}
                          </span>
                        </div>
                      </td>

                      {/* Cihaz & IMEI */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-800 dark:text-slate-100">
                          {item.productInfo}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          IMEI: {item.imei}
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

                      {/* Arıza */}
                      <td className="px-4 py-3.5">
                        {item.faultName ? (
                          <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                            <AlertTriangle size={12} className="text-amber-500" />
                            {item.faultName}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Belirtilmedi</span>
                        )}
                      </td>

                      {/* İşlem / Parça */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.operationTypeName || item.operationTypeCode || '-'}
                        </div>
                        {item.partName && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Tag size={10} />
                            {item.partName}
                          </div>
                        )}
                      </td>

                      {/* Statü */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <Clock size={12} />
                          {item.statusName || 'Teknisyene Atanacak'}
                        </span>
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

import React, { useState, useEffect } from "react";
import { 
  FileCheck2, 
  Search, 
  Calendar, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Filter,
  Layers,
  Wrench
} from "lucide-react";
import { api } from "../services/api";

const TestRaporu = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterType, setFilterType] = useState("ALL"); // ALL, PASS, FAIL

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await api.getTestReportRecords(startDate, endDate, searchTerm);
      if (res.success) {
        setRecords(res.items || []);
      } else {
        alert(res.message || "Test raporu yüklenirken hata oluştu.");
      }
    } catch (err) {
      console.error("Test Raporu Yükleme Hatası:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchRecords();
  };

  const handleExportExcel = async () => {
    if (records.length === 0) {
      alert("Dışa aktarılacak veri bulunmamaktadır.");
      return;
    }
    const exportData = filteredRecords.map((r) => ({
      "IMEI": r.imei,
      "Internal ID": r.internalid,
      "Seri No": r.seri_no,
      "Model": r.model,
      "Test ID": r.test_id,
      "Test Tipi": r.test_tipi,
      "Test Sonucu": r.test_sonuc,
      "Hatalı Parçalar": r.failed_parts,
      "Hata Detay / Not": r.failed_detay,
      "Onarımı Yapan Teknisyen": r.teknisyen_ismi,
      "Tarih": r.tarih
    }));

    try {
      await api.exportTableToExcel(exportData, `Test_Raporu_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      console.error("Excel aktarım hatası:", e);
      alert("Excel aktarımı gerçekleştirilemedi.");
    }
  };

  const filteredRecords = records.filter((r) => {
    if (filterType === "PASS") return r.is_pass === true;
    if (filterType === "FAIL") return r.is_pass === false;
    return true;
  });

  const totalCount = records.length;
  const passCount = records.filter((r) => r.is_pass === true).length;
  const failCount = records.filter((r) => r.is_pass === false).length;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-h-screen text-slate-800 dark:text-slate-100">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Test Raporu Ekranı
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                Ara Test & Son Test
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cihazların Ara Test ve Son Test kalite kontrol kayıtları ve onarımı gerçekleştiren L1/L2 teknisyen detayları.
            </p>
          </div>
        </div>

        {/* QUICK STATS CARDS */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-slate-100 dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-slate-500" />
            <div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Toplam</div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{totalCount}</div>
            </div>
          </div>

          <div className="px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold tracking-wider">Başarılı</div>
              <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{passCount}</div>
            </div>
          </div>

          <div className="px-4 py-2 bg-rose-500/10 rounded-xl border border-rose-500/20 flex items-center gap-2.5">
            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <div>
              <div className="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-bold tracking-wider">Başarısız</div>
              <div className="text-sm font-bold text-rose-700 dark:text-rose-300">{failCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER & CONTROL BAR */}
      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4">
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3">
          {/* SEARCH INPUT */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="IMEI, Internal ID, Seri No, Model veya Teknisyen ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
            />
          </div>

          {/* DATE RANGE */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
            />
            <span className="text-slate-400 text-xs">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
            />
          </div>

          {/* PASS/FAIL FILTER PILLS */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => setFilterType("ALL")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                filterType === "ALL"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Tümü
            </button>
            <button
              type="button"
              onClick={() => setFilterType("PASS")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                filterType === "PASS"
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400"
              }`}
            >
              Başarılı
            </button>
            <button
              type="button"
              onClick={() => setFilterType("FAIL")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                filterType === "FAIL"
                  ? "bg-rose-500 text-white shadow-sm"
                  : "text-slate-500 hover:text-rose-600 dark:hover:text-rose-400"
              }`}
            >
              Başarısız
            </button>
          </div>

          {/* BUTTONS */}
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Filter className="w-3.5 h-3.5" />
            Filtrele
          </button>

          <button
            type="button"
            onClick={fetchRecords}
            className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-900/80 rounded-xl transition-colors"
            title="Yenile"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="ml-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Excel'e Aktar
          </button>
        </form>
      </div>

      {/* DATA TABLE SECTION */}
      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 dark:bg-slate-900/60 uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3.5">IMEI</th>
                <th className="px-4 py-3.5">Internal ID</th>
                <th className="px-4 py-3.5">Seri No</th>
                <th className="px-4 py-3.5">Model</th>
                <th className="px-4 py-3.5">Test ID</th>
                <th className="px-4 py-3.5">Test Tipi</th>
                <th className="px-4 py-3.5">Test Sonuç</th>
                <th className="px-4 py-3.5">Failed Parts</th>
                <th className="px-4 py-3.5">Failed Detay</th>
                <th className="px-4 py-3.5">Teknisyen İsmi</th>
                <th className="px-4 py-3.5">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/70 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
                      Test raporları yükleniyor...
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    Kriterlere uygun test kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, idx) => (
                  <tr
                    key={r.id || idx}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    {/* IMEI */}
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900 dark:text-white">
                      {r.imei}
                    </td>

                    {/* Internal ID */}
                    <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                      {r.internalid}
                    </td>

                    {/* Seri No */}
                    <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                      {r.seri_no}
                    </td>

                    {/* Model */}
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                      {r.model}
                    </td>

                    {/* Test ID */}
                    <td className="px-4 py-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                      {r.test_id}
                    </td>

                    {/* Test Tipi */}
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-700/50">
                        {r.test_tipi}
                      </span>
                    </td>

                    {/* Test Sonucu */}
                    <td className="px-4 py-3">
                      {r.is_pass === true ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          {r.test_sonuc}
                        </span>
                      ) : r.is_pass === false ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                          <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          {r.test_sonuc}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          <Clock className="w-3.5 h-3.5" />
                          {r.test_sonuc}
                        </span>
                      )}
                    </td>

                    {/* Failed Parts */}
                    <td className="px-4 py-3 max-w-[200px] truncate text-slate-700 dark:text-slate-300" title={r.failed_parts}>
                      {r.failed_parts !== "-" ? (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">{r.failed_parts}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Failed Detay */}
                    <td className="px-4 py-3 max-w-[240px] truncate text-slate-600 dark:text-slate-400" title={r.failed_detay}>
                      {r.failed_detay}
                    </td>

                    {/* Teknisyen İsmi */}
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      <div className="flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>{r.teknisyen_ismi}</span>
                      </div>
                    </td>

                    {/* Tarih */}
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-[11px]">
                      {r.tarih}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TestRaporu;

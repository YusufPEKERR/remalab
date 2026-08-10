import { ShieldCheck, Table2 } from 'lucide-react';

/**
 * QC (Quality Control) Modülü
 *
 * Kontrol Paneli'nin altında yer alan yeni modül. Şimdilik yalnızca sayfa
 * iskeleti hazır; ilerleyen adımda buraya SQL sorguları gömülüp veriler
 * tablo haline getirilecek.
 */
export default function QC() {
  return (
    <div className="p-6">
      {/* Başlık */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">QC</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Kalite Kontrol (Quality Control)
          </p>
        </div>
      </div>

      {/* İçerik alanı — tablo buraya gelecek */}
      <div className="bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-2xl">
        <div className="flex flex-col items-center justify-center text-center py-24 px-6">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700/60 flex items-center justify-center mb-4">
            <Table2 className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
            Tablo henüz hazır değil
          </h2>
          <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
            Bu alana ilerleyen adımda SQL sorguları gömülerek QC verileri tablo
            olarak gösterilecek. Şimdilik yalnızca modül sayfası oluşturuldu.
          </p>
        </div>
      </div>
    </div>
  );
}

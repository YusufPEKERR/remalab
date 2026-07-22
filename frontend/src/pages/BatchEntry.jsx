import { useState } from 'react';
import { Layers, Plus, X, Save, Settings, Smartphone } from 'lucide-react';

const EMPTY_BATCH_FORM = {
  imei: '',
  serial_id: '',
  internal_id: '',
  batch_no: '',
  model: '',
  gb: ''
};

export default function BatchEntry() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_BATCH_FORM);

  const handleOpenForm = () => {
    setFormData(EMPTY_BATCH_FORM);
    setShowForm(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    alert('Batch kaydı (Demo) başarıyla simüle edildi.');
    setShowForm(false);
  };

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-[#1e2330] p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <Layers className="text-indigo-400" size={24} /> Batch Girişi
        </h1>
        <p className="text-slate-400 mt-1">Cihazlar için toplu veya hızlı yeni kayıt (batch) girişi oluşturun.</p>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-6 space-y-6">
        {!showForm ? (
          <>
            <div className="flex justify-end items-center">
              <button
                onClick={handleOpenForm}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-indigo-900/20 font-medium text-sm"
              >
                <Plus size={16} /> Yeni Batch Girişi
              </button>
            </div>
            
            <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden p-12 flex flex-col items-center justify-center text-slate-500">
              <Layers size={48} className="mb-4 text-slate-300 dark:text-slate-700" />
              <p>Henüz batch kaydı bulunmuyor. Yeni bir kayıt eklemek için yukarıdaki butonu kullanın.</p>
            </div>
          </>
        ) : (
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Yeni Batch Girişi
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              
              {/* Servis Bilgileri */}
              <div>
                <h3 className="text-sm font-semibold text-indigo-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
                  <Settings size={16} /> Servis Bilgileri
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">IMEI Numarası</label>
                    <input type="text" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500" value={formData.imei} onChange={e => setFormData({...formData, imei: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Serial ID Number</label>
                    <input type="text" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500" value={formData.serial_id} onChange={e => setFormData({...formData, serial_id: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Internal ID</label>
                    <input type="text" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500" value={formData.internal_id} onChange={e => setFormData({...formData, internal_id: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Batch No</label>
                    <input type="text" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500" value={formData.batch_no} onChange={e => setFormData({...formData, batch_no: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* Cihaz Bilgileri */}
              <div className="border-t border-slate-200 dark:border-slate-700/50 pt-6">
                <h3 className="text-sm font-semibold text-indigo-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
                  <Smartphone size={16} /> Cihaz Bilgileri
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Model</label>
                    <input type="text" placeholder="Örn: iPhone 13" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">GB (Kapasite)</label>
                    <input type="text" placeholder="Örn: 128 GB" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500" value={formData.gb} onChange={e => setFormData({...formData, gb: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700/50">
                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#2a3142] rounded-xl transition-colors">
                  İptal
                </button>
                <button type="submit" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-900/20 font-medium text-sm">
                  <Save size={16} /> Batch Kaydını Başlat
                </button>
              </div>

            </form>
          </div>
        )}
      </div>
    </div>
  );
}

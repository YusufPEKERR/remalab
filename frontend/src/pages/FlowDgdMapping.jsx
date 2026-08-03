import { useState, useEffect } from 'react';
import { Wrench, Plus, Trash2, Edit, X, Save } from 'lucide-react';
import { api } from '../services/api';

const EMPTY_FORM = { flow_code: '', dgd_item_code: '' };

export default function FlowDgdMapping() {
  const [mappings, setMappings] = useState([]);
  const [flowValues, setFlowValues] = useState([]);
  const [dgdItems, setDgdItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingMapping, setEditingMapping] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const fetchMappings = async () => {
    const res = await api.getFlowDgdMappings();
    if (res.success) setMappings(res.mappings || []);
  };

  useEffect(() => {
    fetchMappings();
    api.getFlowValues().then(res => {
      if (res.success) setFlowValues((res.flow_values || res.flows || []).filter(Boolean));
    });
    api.getPriceMatrixItems('').then(res => {
      if (res.success) setDgdItems((res.items || []).filter(i => i.item_type === 'İşçilik'));
    });
  }, []);

  const handleOpenForm = (mapping = null) => {
    if (mapping) {
      setEditingMapping(mapping);
      setFormData({ flow_code: mapping.flow_code || '', dgd_item_code: mapping.dgd_item_code || '' });
    } else {
      setEditingMapping(null);
      setFormData(EMPTY_FORM);
    }
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const res = editingMapping
      ? await api.updateFlowDgdMapping(editingMapping.id, formData.flow_code, formData.dgd_item_code)
      : await api.createFlowDgdMapping(formData.flow_code, formData.dgd_item_code);
    if (res.success) {
      setShowForm(false);
      fetchMappings();
    } else {
      alert(res.message || 'İşlem başarısız oldu.');
    }
  };

  const handleDelete = async (mapping) => {
    if (window.confirm(`"${mapping.flow_code}" Flow eşleşmesini silmek istediğinize emin misiniz?`)) {
      const res = await api.deleteFlowDgdMapping(mapping.id);
      if (res.success) {
        fetchMappings();
      } else {
        alert(res.message || 'Silme işlemi başarısız oldu.');
      }
    }
  };

  return (
    <div className="flex flex-col space-y-6 pb-12 text-[#12141c] dark:text-[#F6F8FF] max-w-[1600px] mx-auto animate-in fade-in duration-300">

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF1FA] dark:from-[#090a0f] via-[#DDE2F2] dark:via-[#12141c] to-[#FFFFFF] dark:to-[#1e222d] p-6 sm:p-8 text-[#181a24] dark:text-white shadow-xl border border-[#DCE1F1] dark:border-[#1e222d]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(91, 110, 196,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(91, 110, 196,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-400/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold tracking-wide">
              <Wrench size={13} className="text-indigo-400" /> DEMONTAJ
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181a24] dark:text-white">
              Flow → DGD İşçilik Kodu Eşleşmesi
            </h1>
            <p className="text-sm text-[#4A5A9E] dark:text-slate-300 leading-relaxed">
              Her Flow (akış) değeri, Demontaj ekranında cihaza otomatik eklenecek DGD işçilik kodunu 1:1 belirler.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6">
        {!showForm ? (
          <>
            <div className="flex justify-end items-center">
              <button
                onClick={() => handleOpenForm()}
                className="flex items-center gap-2 bg-[#00B2FF] hover:bg-[#1e222d] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <Plus size={16} /> Yeni Eşleşme Ekle
              </button>
            </div>

            <div className="glass-card rounded-2xl shadow-md overflow-hidden">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-[#F5F7FC] dark:bg-[#181a24] text-[#5A6685] dark:text-[#8892B5] font-semibold uppercase tracking-wider border-b border-[#DCE1F1] dark:border-[#1e222d] sticky top-0 z-10 select-none">
                  <tr>
                    <th className="px-6 py-4">Flow</th>
                    <th className="px-6 py-4">DGD Kodu</th>
                    <th className="px-6 py-4">Durum</th>
                    <th className="px-6 py-4 text-center">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE1F1] dark:divide-[#1e222d]">
                  {mappings.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-slate-500">Kayıt bulunamadı.</td>
                    </tr>
                  ) : (
                    mappings.map(m => (
                      <tr key={m.id} className="hover:bg-slate-100 dark:bg-[#1e222d] transition-colors text-slate-700 dark:text-slate-300">
                        <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{m.flow_code}</td>
                        <td className="px-6 py-4 font-mono text-slate-400">{m.dgd_item_code}</td>
                        <td className="px-6 py-4">
                          {m.enabled
                            ? <span className="px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold">Aktif</span>
                            : <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-500/10 text-slate-500 text-[11px] font-semibold">Pasif</span>}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-3">
                            <button onClick={() => handleOpenForm(m)} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors" title="Düzenle">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleDelete(m)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Sil">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                {editingMapping ? 'Eşleşmeyi Düzenle' : 'Yeni Eşleşme Ekle'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Flow <span className="text-red-400">*</span></label>
                  <select
                    required
                    className="w-full bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    value={formData.flow_code}
                    onChange={e => setFormData({ ...formData, flow_code: e.target.value })}
                  >
                    <option value="">Seçiniz</option>
                    {flowValues.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">DGD Kodu <span className="text-red-400">*</span></label>
                  <input
                    type="text" required list="dgd-item-codes-list"
                    className="w-full bg-slate-50 dark:bg-[#181a24] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    value={formData.dgd_item_code}
                    onChange={e => setFormData({ ...formData, dgd_item_code: e.target.value })}
                    placeholder="Örn: DGD"
                  />
                  <datalist id="dgd-item-codes-list">
                    {dgdItems.map(i => <option key={i.item_code} value={i.item_code} />)}
                  </datalist>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700/50 mt-6">
                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 bg-slate-50 dark:bg-[#181a24] hover:bg-slate-100 dark:bg-[#1e222d] text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors border border-slate-300 dark:border-slate-600">İptal</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-900/20 flex items-center gap-2"><Save size={18}/> Kaydet</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

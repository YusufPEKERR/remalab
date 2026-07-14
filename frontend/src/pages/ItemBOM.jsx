import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, RefreshCw, X } from 'lucide-react';
import { api } from '../services/api';

export default function ItemBOM() {
  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentBOM, setCurrentBOM] = useState(null);
  const [formData, setFormData] = useState({ parent_item_id: '', child_item_id: '', quantity: 1 });

  const fetchBOMs = async () => {
    setLoading(true);
    const res = await api.getItemBOMs();
    if (res.success) setBoms(res.item_boms || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchBOMs();
  }, []);

  const handleOpenModal = (bom = null) => {
    if (bom) {
      setFormData(bom);
      setCurrentBOM(bom);
    } else {
      setFormData({ parent_item_id: '', child_item_id: '', quantity: 1 });
      setCurrentBOM(null);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = currentBOM 
      ? await api.updateItemBOM(currentBOM.id, formData)
      : await api.createItemBOM(formData);
    
    if (res.success) {
      setIsModalOpen(false);
      fetchBOMs();
    } else {
      alert("Hata: " + (res.message || "Bilinmeyen hata"));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("BOM kaydını silmek istediğinize emin misiniz?")) {
      const res = await api.deleteItemBOM(id);
      if (res.success) {
        fetchBOMs();
      } else {
        alert("Silme başarısız.");
      }
    }
  };

  return (
    <div className="p-6 h-full flex flex-col space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-[#1e2330] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/50">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">BOM (Ürün Ağacı) Yönetimi</h1>
          <p className="text-slate-400 mt-1">Parça hiyerarşisi ve ürün ağaçlarını buradan yönetin.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium shadow-lg shadow-blue-500/30"
        >
          <Plus size={18} />
          Yeni Ekle
        </button>
      </div>

      <div className="bg-white dark:bg-[#1e2330] rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-lg flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs sticky top-0">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Ana Parça (Parent)</th>
                <th className="px-6 py-4">Alt Parça (Child)</th>
                <th className="px-6 py-4">Miktar</th>
                <th className="px-6 py-4 text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center"><RefreshCw className="animate-spin mx-auto text-blue-400" /></td></tr>
              ) : boms.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">Kayıt bulunamadı.</td></tr>
              ) : (
                boms.map(bom => (
                  <tr key={bom.id} className="hover:bg-slate-100 dark:hover:bg-[#2a3142] text-slate-700 dark:text-slate-300 transition-colors">
                    <td className="px-6 py-4 font-mono">{bom.id}</td>
                    <td className="px-6 py-4 font-medium">{bom.parent_item_id}</td>
                    <td className="px-6 py-4 font-medium">{bom.child_item_id}</td>
                    <td className="px-6 py-4">{bom.quantity}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-3">
                        <button onClick={() => handleOpenModal(bom)} className="text-blue-400 hover:text-blue-300"><Edit size={16} /></button>
                        <button onClick={() => handleDelete(bom.id)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">BOM Kaydı</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Ana Parça ID</label>
                <input required type="text" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-lg px-3 py-2 text-white" value={formData.parent_item_id} onChange={e => setFormData({...formData, parent_item_id: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Alt Parça ID</label>
                <input required type="text" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-lg px-3 py-2 text-white" value={formData.child_item_id} onChange={e => setFormData({...formData, child_item_id: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Miktar</label>
                <input required type="number" min="1" className="w-full bg-slate-50 dark:bg-[#242a38] border border-slate-700 rounded-lg px-3 py-2 text-white" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)})} />
              </div>
              <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg mt-4">Kaydet</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { ArrowRightLeft, X, QrCode, Search, Package, MapPin, DatabaseZap } from 'lucide-react';
import { api } from '../services/api';

export default function StockTransferModal({ isOpen, onClose, onTransfer, locations = [], systemLocations = [] }) {
  // State for Form fields
  const [qrCode, setQrCode] = useState('');
  
  const [sourceLocId, setSourceLocId] = useState('');
  const [brandModel, setBrandModel] = useState('');
  const [productId, setProductId] = useState('');
  
  const [targetLocId, setTargetLocId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [maxQuantity, setMaxQuantity] = useState(0);

  // Mock dependent dropdown data
  const [sourceLocations, setSourceLocations] = useState([]);
  const [brands, setBrands] = useState([]);
  const [fullStock, setFullStock] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadStock();
    }
  }, [isOpen]);

  const restrictedKinds = new Set(['scrap_stock', 'doa_stock', 'out_stock']);
  const restrictedIdSet = new Set(
    systemLocations.filter(loc => restrictedKinds.has(loc.kind)).map(l => String(l.id))
  );

  const loadStock = async () => {
    try {
      const res = await api.getStockStatus();
      if (res.success) {
        setFullStock(res.stock);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setQrCode('');
      setSourceLocId('');
      setBrandModel('');
      setProductId('');
      setTargetLocId('');
      setQuantity(0);
      setMaxQuantity(0);
    }
  }, [isOpen, locations]);

  const handleSourceLocChange = (val) => {
    const locId = Number(val);
    setSourceLocId(val);
    setBrandModel('');
    setProductId('');
    setMaxQuantity(0);
    setQuantity(0);
    
    if (locId) {
      // get unique brandModels for this loc
      const locStocks = fullStock.filter(s => s.location_id === locId && s.quantity > 0);
      const bSet = new Set();
      locStocks.forEach(s => bSet.add(s.part_name));
      setBrands(Array.from(bSet));
    } else {
      setBrands([]);
    }
  };

  const handleBrandModelChange = (val) => {
    setBrandModel(val);
    setProductId('');
    setMaxQuantity(0);
    setQuantity(0);
    
    if (val) {
      const locId = Number(sourceLocId);
      const prods = fullStock.filter(s => s.location_id === locId && s.part_name === val && s.quantity > 0)
                             .map(s => ({ id: s.part_id, name: s.part_name, qty: s.quantity }));
      setProducts(prods);
    } else {
      setProducts([]);
    }
  };

  const handleProductChange = (val) => {
    setProductId(val);
    const prod = products.find(p => String(p.id) === String(val));
    if (prod) {
      setMaxQuantity(prod.qty);
      setQuantity(1);
    } else {
      setMaxQuantity(0);
      setQuantity(0);
    }
  };

  const handleQrScan = (e) => {
    e.preventDefault();
    if (!qrCode.trim()) return;
    
    // Simulate QR scan result
    console.log("QR Scanned:", qrCode);
    alert(`QR Okundu: ${qrCode}\nSimüle ediliyor...`);
    
    // Future: implement actual QR lookup to auto-select
  };

  const handleSubmit = () => {
    if (!sourceLocId || !productId || !targetLocId || quantity <= 0 || quantity > maxQuantity) {
      alert("Lütfen tüm alanları geçerli şekilde doldurun.");
      return;
    }
    
    if (sourceLocId === targetLocId) {
      alert("Aynı lokasyondan (depodan) aynı lokasyona transfer yapılamaz!");
      return;
    }
    
    onTransfer({
      sourceStockId: productId, // actually part_id
      sourceLocId: sourceLocId,
      targetLocationId: targetLocId,
      quantity: quantity
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#0f1219]/80 backdrop-blur-sm flex items-center justify-center z-[99] p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#1e2330] border border-slate-700 shadow-2xl rounded-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200 my-8">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center bg-slate-50 dark:bg-[#242a38] rounded-t-2xl">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ArrowRightLeft size={20} className="text-yellow-500"/> Stok Transferi
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-white dark:bg-[#1e2330] p-1.5 rounded-lg border border-slate-700">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* QR/Barcode Section */}
          <div className="bg-slate-50 dark:bg-[#242a38] p-4 rounded-xl border border-slate-200 dark:border-slate-700/50">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <QrCode size={16} className="text-blue-400"/> QR / Barkod / Ürün Kodu Okutma
            </label>
            <form onSubmit={handleQrScan} className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-slate-500" />
              </div>
              <input 
                type="text" 
                value={qrCode}
                onChange={e => setQrCode(e.target.value)}
                placeholder="Okutun veya yazıp Enter'a basın..."
                className="w-full bg-white dark:bg-[#1e2330] border border-slate-300 dark:border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm"
              />
            </form>
          </div>

          {/* Source Section */}
          <div className="bg-blue-900/10 p-4 rounded-xl border border-blue-900/30">
            <h3 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
              <MapPin size={16}/> Kaynak Bilgileri
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Kaynak Lokasyon</label>
                <select 
                  value={sourceLocId} 
                  onChange={e => handleSourceLocChange(e.target.value)}
                  className="w-full bg-white dark:bg-[#1e2330] border border-slate-700/70 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">--- Lokasyon Seçin ---</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Marka ve Model</label>
                <select 
                  value={brandModel} 
                  onChange={e => handleBrandModelChange(e.target.value)}
                  disabled={!sourceLocId}
                  className="w-full bg-white dark:bg-[#1e2330] border border-slate-700/70 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">--- Marka/Model Seçin ---</option>
                  {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Ürün (Parça)</label>
                <select 
                  value={productId} 
                  onChange={e => handleProductChange(e.target.value)}
                  disabled={!brandModel}
                  className="w-full bg-white dark:bg-[#1e2330] border border-slate-700/70 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">--- Ürün Seçin ---</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (Mevcut: {p.qty})</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Transfer Section */}
          <div className="bg-yellow-900/10 p-4 rounded-xl border border-yellow-900/30 relative">
            <h3 className="text-sm font-semibold text-yellow-500 mb-3 flex items-center gap-2 uppercase tracking-wider">
              <DatabaseZap size={16}/> Transfer Bilgileri
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Hedef Lokasyon</label>
                <select 
                  value={targetLocId} 
                  onChange={e => setTargetLocId(e.target.value)}
                  className="w-full bg-white dark:bg-[#1e2330] border border-slate-700/70 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-yellow-500"
                >
                  <option value="">--- Lokasyon Seçin ---</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Transfer Miktarı</label>
                  <input 
                    type="number" 
                    min="0" 
                    max={maxQuantity}
                    value={quantity} 
                    onChange={e => setQuantity(Number(e.target.value))}
                    disabled={!productId}
                    className="w-full bg-white dark:bg-[#1e2330] border border-slate-700/70 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-yellow-500 disabled:opacity-50 font-bold" 
                  />
                </div>
                <div className="pb-2">
                  <span className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${maxQuantity > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                    Mevcut Stok: {maxQuantity}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700/50 flex justify-end gap-3 bg-slate-50 dark:bg-[#242a38] rounded-b-2xl">
          <button onClick={onClose} className="px-5 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-800 rounded-xl font-medium transition-colors border border-slate-300 dark:border-slate-600">İptal</button>
          <button 
            onClick={handleSubmit} 
            disabled={!productId || quantity <= 0 || !targetLocId || quantity > maxQuantity}
            className="px-5 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-slate-900 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-900/20 flex items-center gap-2"
          >
            <ArrowRightLeft size={18} />
            Transferi Tamamla
          </button>
        </div>
      </div>
    </div>
  );
}

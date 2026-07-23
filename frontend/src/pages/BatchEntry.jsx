import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Plus, Trash2, Edit2, X, FileSpreadsheet, Search, RefreshCw, RotateCcw, User, Wrench, Smartphone, AlertCircle, Layers, Check, Download, Truck, FileText, Upload, AlertTriangle, CheckCircle, Table } from 'lucide-react';
import { api } from '../services/api';
import ExcelMappingModal from '../components/ExcelMappingModal';

const FLOW_OPTIONS = ['Hepsi', 'Refurbish', 'Repair', 'RMA', 'Battery Replacement'];
const GB_OPTIONS = ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB', '2TB'];

const FLOW_STYLES = {
  'Hepsi': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  'Refurbish': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Repair': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'RMA': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Battery Replacement': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
};

const CURRENCY_OPTIONS = ['TRY', 'EUR', 'USD', 'CHF', 'GBP'];

const CURRENCY_SYMBOLS = {
  'TRY': '₺', 'EUR': '€', 'USD': '$', 'CHF': 'CHF', 'GBP': '£'
};

const EMPTY_FORM = {
  customer_no: '',
  customer_name: '',
  imei_number: '',
  serial_number: '',
  internal_id: '',
  batch_no: '',
  model: '',
  gb: '',
  color: '',
  unit_price: '',
  currency: 'TRY',
  defects: '',
  screen_test: '',
  power_test: '',
  flow: 'Refurbish'
};

export default function BatchEntry() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [customerList, setCustomerList] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  // Modal Tabs & Excel Preview State
  const [modalTab, setModalTab] = useState('excel'); // 'excel' | 'form'
  const [excelFileData, setExcelFileData] = useState(null);
  const [excelFileName, setExcelFileName] = useState('');
  const [excelValidationErrors, setExcelValidationErrors] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Ana tabloda müşteri bazlı gruplu görünüm
  const [customerGroups, setCustomerGroups] = useState([]);

  const fetchCustomerGroups = async () => {
    const res = await api.getBatchSummary();
    if (res.success) setCustomerGroups(res.batches || []);
  };

  // Batch Summary Table Modal State
  const [isBatchSummaryModalOpen, setIsBatchSummaryModalOpen] = useState(false);
  const [batchSummaryList, setBatchSummaryList] = useState([]);
  const [loadingBatchSummary, setLoadingBatchSummary] = useState(false);
  const [summarySearch, setSummarySearch] = useState('');

  // Customers (Müşteriler) entegrasyonu
  const [customers, setCustomers] = useState([]);
  
  const fetchCustomers = async () => {
    try {
      const res = await api.getCustomers();
      if (res && res.success) {
        setCustomers(res.customers || []);
      }
    } catch (err) {
      console.error("Müşteriler alınamadı", err);
    }
  };

  const handleFetchBatchSummary = async () => {
    setIsBatchSummaryModalOpen(true);
    setLoadingBatchSummary(true);
    const res = await api.getBatchSummary();
    if (res.success) {
      setBatchSummaryList(res.batches || []);
    }
    setLoadingBatchSummary(false);
  };

  const handleExportSummaryExcel = async () => {
    try {
      const exportData = batchSummaryList.map(b => ({
        "DocumentDate": b.document_date || (b.last_created ? b.last_created.split(' ')[0] : '-'),
        "DocumentNumber": b.document_number || b.batch_no || b.internal_id || b.serial_number || b.imei_number || '-',
        "CustomerName": b.account_name || b.customer_name || '-',
        "IsSuccess": b.is_success ? "True" : "False",
        "ItemQuantity": b.item_quantity ?? b.total_devices ?? 0,
        "Currency": b.currency || 'EUR',
        "CreateBy": b.create_by || 'io'
      }));
      await api.exportTableToExcel(exportData, "Batch_Tablosu.xlsx");
    } catch (e) {
      console.error("Export summary excel error:", e);
      alert("Excel aktarımı sırasında bir hata oluştu.");
    }
  };

  const handleBillShipment = () => {
    alert("Sevkiyat faturalandırma işlemi başlatıldı.");
  };

  const handleDownloadTemplate = async () => {
    let templateData = [];

    if (editingRecord && excelFileData && excelFileData.length > 0) {
      // Düzenlenen kaydın var olan dolu bilgilerini şablona aktar
      templateData = excelFileData.map(item => ({
        customer_no: item.customer_no || '',
        customer_name: item.customer_name || '',
        batch_no: item.batch_no || '',
        internal_id: item.internal_id || '',
        imei_number: item.imei_number || '',
        serial_number: item.serial_number || '',
        model: item.model || '',
        gb: item.gb || '',
        color: item.color || '',
        screen_test: item.screen_test || '',
        power_test: item.power_test || '',
        defects: item.defects || '',
        flow: item.flow || 'Refurbish'
      }));
    } else {
      const custName = selectedCustomer?.name || 'Örnek Müşteri Ltd.';
      const custNo = selectedCustomer?.no || 'CUST-001';

      templateData = [
        {
          customer_no: custNo,
          customer_name: custName,
          batch_no: 'BATCH-2026-01',
          internal_id: 'INT-9901',
          imei_number: '358901234567890',
          serial_number: 'SN99887766',
          model: 'iPhone 13 Pro',
          gb: '128GB',
          color: 'Graphite',
          defects: 'Dokunmatik yanıt vermiyor',
          screen_test: 'BAŞARISIZ',
          power_test: 'BAŞARILI',
          flow: 'Refurbish'
        }
      ];
    }

    const safeName = editingRecord
      ? `Kayit_${editingRecord.id}_Sablon.xlsx`
      : `Batch_Template_${(selectedCustomer?.name || 'Genel').replace(/[^a-zA-Z0-9_\-]/g, '_')}.xlsx`;

    await api.exportTableToExcel(templateData, safeName);
  };

  const handleExcelPreviewUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet);

        if (!rows || rows.length === 0) {
          setExcelValidationErrors([{ row: 0, column: 'Genel', message: 'Seçilen Excel dosyasında veri bulunamadı.' }]);
          setExcelFileData([]);
          return;
        }

        const mappedRows = rows.map(r => {
          const getVal = (keys) => {
            for (const k of keys) {
              if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
                return String(r[k]).trim();
              }
            }
            return '';
          };

          return {
            customer_no: getVal(['customer_no', 'Customer No', 'Müşteri No', 'Müşteri Kodu', 'Code']),
            customer_name: getVal(['customer_name', 'Customer Name', 'Müşteri Adı', 'CustomerName', 'AccountName']),
            batch_no: getVal(['batch_no', 'Batch No', 'BatchNo', 'Parti No', 'DocumentNumber']),
            internal_id: getVal(['internal_id', 'Internal ID', 'InternalID', 'Dahili ID']),
            imei_number: getVal(['imei_number', 'IMEI Number', 'IMEI', 'IMEINumber', 'Imei']),
            serial_number: getVal(['serial_number', 'Serial Number', 'Seri No', 'SerialNumber', 'SN']),
            model: getVal(['model', 'Model', 'Cihaz Modeli', 'Cihaz']),
            gb: getVal(['gb', 'GB', 'Hafıza', 'Kapasite']),
            color: getVal(['color', 'Color', 'Renk']),
            defects: getVal(['defects', 'Defects', 'Kusur', 'Arıza']),
            screen_test: getVal(['screen_test', 'Screen Test', 'ScreenTest', 'Ekran Testi']),
            power_test: getVal(['power_test', 'Power Test', 'PowerTest', 'Güç Testi']),
            flow: getVal(['flow', 'Flow', 'Akış', 'Durum']) || 'Refurbish'
          };
        });

        const errors = [];
        mappedRows.forEach((r, idx) => {
          const rowNum = idx + 1;
          if (!r.customer_name) {
            errors.push({ row: rowNum, column: 'Customer Name (Müşteri Adı)', message: 'Müşteri Adı boş olamaz.' });
          }
          if (!r.imei_number && !r.serial_number && !r.internal_id && !r.batch_no) {
            errors.push({ row: rowNum, column: 'Servis Bilgileri (Tanımlayıcı)', message: 'IMEI, Seri No, Dahili Kimlik veya Batch No alanlarından en az biri girilmelidir.' });
          }
          if (r.imei_number && (!/^\d+$/.test(r.imei_number) || r.imei_number.length !== 15)) {
            errors.push({ row: rowNum, column: 'IMEI Number (IMEI Numarası)', message: `IMEI 15 haneli ve yalnız rakamlardan oluşmalıdır (Girilen: "${r.imei_number}").` });
          }
        });

        setExcelFileData(mappedRows);
        setExcelValidationErrors(errors);
      } catch (err) {
        setExcelValidationErrors([{ row: 0, column: 'Dosya Okuma', message: 'Excel dosyası okunurken hata oluştu: ' + err.message }]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCellChange = (rowIndex, field, newValue) => {
    if (!excelFileData) return;
    const updated = [...excelFileData];
    updated[rowIndex] = { ...updated[rowIndex], [field]: newValue };

    const errors = [];
    updated.forEach((r, idx) => {
      const rowNum = idx + 1;
      if (!r.customer_name) {
        errors.push({ row: rowNum, column: 'Customer Name (Müşteri Adı)', message: 'Müşteri Adı boş olamaz.' });
      }
      if (!r.imei_number && !r.serial_number && !r.internal_id && !r.batch_no) {
        errors.push({ row: rowNum, column: 'Servis Bilgileri (Tanımlayıcı)', message: 'IMEI, Seri No, Dahili Kimlik veya Batch No alanlarından en az biri girilmelidir.' });
      }
      if (r.imei_number && (!/^\d+$/.test(r.imei_number) || r.imei_number.length !== 15)) {
        errors.push({ row: rowNum, column: 'IMEI Number (IMEI Numarası)', message: `IMEI 15 haneli ve yalnız rakamlardan oluşmalıdır (Girilen: "${r.imei_number}").` });
      }
    });

    setExcelFileData(updated);
    setExcelValidationErrors(errors);
  };

  const handleConfirmExcelImport = async () => {
    if (!excelFileData || excelFileData.length === 0) {
      alert("İçe aktarılacak veri bulunamadı.");
      return;
    }

    setLoading(true);
    let updatedCount = 0;
    let createdCount = 0;

    for (const item of excelFileData) {
      // 1. Düzenleme modundaysak mevcut kaydı güncelle
      if (editingRecord && (excelFileData.length === 1 || item.imei_number === editingRecord.imei_number || item.serial_number === editingRecord.serial_number || item.internal_id === editingRecord.internal_id)) {
        const res = await api.updateBatchEntry(editingRecord.id, item);
        if (res.success) updatedCount++;
      } else {
        // 2. Yüklenen Excel satırı sistemdeki mevcut bir kayıtla (IMEI, Seri No, Dahili ID) eşleşiyorsa güncelle
        const existing = records.find(r => 
          (item.imei_number && r.imei_number === item.imei_number) ||
          (item.serial_number && r.serial_number === item.serial_number) ||
          (item.internal_id && r.internal_id === item.internal_id)
        );

        if (existing) {
          const res = await api.updateBatchEntry(existing.id, item);
          if (res.success) updatedCount++;
        } else {
          const res = await api.createBatchEntry(item);
          if (res.success) createdCount++;
        }
      }
    }

    setLoading(false);
    let msg = "İşlem Tamamlandı:\n";
    if (updatedCount > 0) msg += `• ${updatedCount} adet kayıt Excel verisiyle güncellendi.\n`;
    if (createdCount > 0) msg += `• ${createdCount} adet yeni kayıt sisteme eklendi.`;
    if (updatedCount === 0 && createdCount === 0) msg = "İşlem gerçekleştirilemedi veya değişiklik algılanmadı.";

    alert(msg);
    setIsModalOpen(false);
    setExcelFileData(null);
    setExcelFileName('');
    setExcelValidationErrors([]);
    setEditingRecord(null);
    fetchRecords();
  };

  // Pagination & Filters & Bulk Selection
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFlow, setSelectedFlow] = useState('Tümü');
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState('');
  const availableCustomers = Array.from(
    new Map([
      ...customerList.map(c => [
        (c.customer_name || c.name || '').trim(),
        {
          name: (c.customer_name || c.name || '').trim(),
          no: c.customer_no || c.code || `CUST-${String(c.id || '001').padStart(3, '0')}`
        }
      ]),
      ...batchSummaryList.map(c => [
        (c.account_name || c.customer_name || '').trim(),
        {
          name: (c.account_name || c.customer_name || '').trim(),
          no: c.customer_no || c.account_no || `CUST-${String(c.id || '001').padStart(3, '0')}`
        }
      ]),
      ...records.map(c => [
        (c.customer_name || '').trim(),
        {
          name: (c.customer_name || '').trim(),
          no: c.customer_no || `CUST-${String(c.id || '001').padStart(3, '0')}`
        }
      ])
    ].filter(([name]) => Boolean(name))).values()
  );

  // Arama veya filtre aktifse tüm kayıtları göster, yoksa müşteri başına tek kayıt göster
  const filteredSummaryList = useMemo(() => {
    let list = batchSummaryList;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(b => 
        (b.document_number || b.batch_no || '').toLowerCase().includes(q) ||
        (b.account_name || b.customer_name || '').toLowerCase().includes(q) ||
        (b.create_by || '').toLowerCase().includes(q)
      );
    }
    if (selectedCustomerFilter) {
      list = list.filter(b => b.account_name === selectedCustomerFilter || b.customer_name === selectedCustomerFilter);
    }
    return list;
  }, [batchSummaryList, searchTerm, selectedCustomerFilter]);

  const paginatedSummary = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSummaryList.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSummaryList, currentPage, itemsPerPage]);

  const summaryTotalPages = Math.ceil(filteredSummaryList.length / itemsPerPage) || 1;
  const summaryTotalCount = filteredSummaryList.length;

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const res = await api.getCustomers();
        if (res && res.success) {
          setCustomerList(res.customers || []);
        }
      } catch (err) {
        console.error("Müşteriler alınamadı:", err);
      }
    };
    loadCustomers();
  }, []);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const pageIds = records.map(r => r.id);
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])));
    } else {
      const pageIds = records.map(r => r.id);
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const isAllSelected = records.length > 0 && records.every(r => selectedIds.includes(r.id));

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (window.confirm(`Seçilen ${selectedIds.length} adet kaydı silmek istediğinize emin misiniz?`)) {
      setLoading(true);
      const res = await api.bulkDeleteBatchEntries(selectedIds);
      if (res.success) {
        setSelectedIds([]);
        fetchRecords();
        fetchCustomerGroups();
      } else {
        alert("Toplu silme hatası: " + (res.message || ""));
      }
      setLoading(false);
    }
  };

  const handleBulkFlowChange = async (newFlow) => {
    if (!selectedIds.length || !newFlow) return;
    setLoading(true);
    const res = await api.bulkUpdateBatchFlow(selectedIds, newFlow);
    if (res.success) {
      setSelectedIds([]);
      fetchRecords();
      fetchCustomerGroups();
    } else {
      alert("Toplu akış güncelleme hatası: " + (res.message || ""));
    }
    setLoading(false);
  };

  const dbColumns = [
    "customer_no", "customer_name", "batch_no", "internal_id", "imei_number",
    "serial_number", "model", "gb", "color", "defects", "screen_test",
    "power_test", "flow", "unit_price"
  ];

  const friendlyNames = {
    customer_no: "Müşteri No (Customer no)",
    customer_name: "Müşteri Adı (Customer Name)",
    batch_no: "Batch No (Batch No)",
    internal_id: "Internal ID (Internal ID)",
    imei_number: "IMEI Numarası (IMEI Number)",
    serial_number: "Seri Numarası (Serial Number)",
    model: "Model (Model)",
    gb: "GB (GB)",
    color: "Renk (Color)",
    defects: "Kusur/Arıza (Defects)",
    screen_test: "Ekran Testi (Screen Test)",
    power_test: "Güç Testi (Power Test)",
    flow: "Akış Durumu (Flow)",
    unit_price: "Birim Fiyat (Unit Price)"
  };

  const fetchRecords = async (page = currentPage, pageSize = itemsPerPage, search = searchTerm, flow = selectedFlow) => {
    setLoading(true);
    const res = await api.getBatchEntries(page, pageSize, search, flow);
    if (res.success) {
      setRecords(res.records || []);
      setTotalCount(res.total || 0);
    }
    setLoading(false);
    
    // Arka planda özet tablosunu da her zaman güncel tut
    api.getBatchSummary().then(sumRes => {
      if (sumRes && sumRes.success) {
        setBatchSummaryList(sumRes.batches || []);
      }
    });
  };

  useEffect(() => {
    fetchRecords(currentPage, itemsPerPage, searchTerm, selectedFlow);
    fetchCustomers();
  }, [currentPage, itemsPerPage, searchTerm, selectedFlow]);



  const handleCustomerNameChange = (e) => {
    const val = e.target.value;
    const found = customers.find(c => c.customer_name === val);
    setFormData(prev => ({
      ...prev,
      customer_name: val,
      customer_no: found ? (found.code || found.customer_no || prev.customer_no) : prev.customer_no
    }));
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;

  const [autoFilledMessage, setAutoFilledMessage] = useState('');

  const handleAutoLookup = async (fieldKey, value) => {
    const updated = { ...formData, [fieldKey]: value };
    setFormData(updated);

    const term = String(value || '').trim();
    if (term.length >= 2) {
      const res = await api.lookupBatchEntry(term);
      if (res.success && res.found && res.data) {
        setFormData(prev => ({
          ...res.data,
          [fieldKey]: value
        }));
        setAutoFilledMessage(`Kayıtlı cihaz bulundu! "${term}" eşleşmesine göre tüm bilgiler otomatik dolduruldu.`);
        setTimeout(() => setAutoFilledMessage(''), 6000);
      }
    }
  };

  const handleOpenModal = (record = null) => {
    setAutoFilledMessage('');
    if (record) {
      setEditingRecord(record);
      const recData = {
        id: record.id,
        customer_no: record.customer_no || '',
        customer_name: record.customer_name || '',
        imei_number: record.imei_number || '',
        serial_number: record.serial_number || '',
        internal_id: record.internal_id || '',
        batch_no: record.batch_no || '',
        model: record.model || '',
        gb: record.gb || '',
        color: record.color || '',
        defects: record.defects || '',
        screen_test: record.screen_test || '',
        power_test: record.power_test || '',
        flow: record.flow || 'Refurbish'
      };

      setFormData(recData);
      setExcelFileData([recData]);
      setExcelFileName(`Kayıt_${record.id}_${record.model || 'Cihaz'}.xlsx`);

      const custName = record.customer_name || '';
      const custNo = record.customer_no || '';
      if (custName) {
        setSelectedCustomer({ name: custName, no: custNo || 'CUST-001' });
      }

      const errors = [];
      if (!recData.customer_name) {
        errors.push({ row: 1, column: 'Customer Name (Müşteri Adı)', message: 'Müşteri Adı bilgisi eksik.' });
      }
      if (!recData.imei_number && !recData.serial_number && !recData.internal_id && !recData.batch_no) {
        errors.push({ row: 1, column: 'Servis Bilgileri (Tanımlayıcı)', message: 'IMEI, Seri No, Dahili Kimlik veya Batch No alanlarından en az biri girilmelidir.' });
      }
      if (recData.imei_number && (!/^\d+$/.test(recData.imei_number) || recData.imei_number.length !== 15)) {
        errors.push({ row: 1, column: 'IMEI Number (IMEI Numarası)', message: `IMEI 15 haneli ve yalnız rakamlardan oluşmalıdır (Girilen: "${recData.imei_number}").` });
      }
      setExcelValidationErrors(errors);
    } else {
      setEditingRecord(null);
      setFormData(EMPTY_FORM);
      setSelectedCustomer(null);
      setExcelFileData(null);
      setExcelFileName('');
      setExcelValidationErrors([]);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const imei = (formData.imei_number || '').trim();
    const serial = (formData.serial_number || '').trim();
    const internal = (formData.internal_id || '').trim();
    const batchNo = (formData.batch_no || '').trim();

    if (!imei && !serial && !internal && !batchNo) {
      alert("Hata: Servis bilgilerinden (IMEI, Seri No, Internal ID veya Batch No) en az bir tanesini girmelisiniz.");
      return;
    }

    let res;
    if (editingRecord) {
      res = await api.updateBatchEntry(editingRecord.id, formData);
    } else {
      res = await api.createBatchEntry(formData);
    }

    if (res.success) {
      setIsModalOpen(false);
      fetchRecords();
      fetchCustomerGroups();
    } else {
      alert("Hata: " + (res.message || "İşlem gerçekleştirilemedi."));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Bu Batch kaydını silmek istediğinize emin misiniz?")) {
      const res = await api.deleteBatchEntry(id);
      if (res.success) {
        fetchRecords();
        fetchCustomerGroups();
      } else {
        alert("Silme başarısız: " + (res.message || ""));
      }
    }
  };

  const handleExcelAction = async (e) => {
    const action = e.target.value;
    e.target.value = '';

    if (action === 'download_template') {
      await handleDownloadTemplate();
    } else if (action === 'export') {
      setLoading(true);
      const allRes = await api.getBatchEntries(1, 10000, searchTerm, selectedFlow);
      setLoading(false);
      if (allRes.success && allRes.records) {
        const exportData = allRes.records.map(r => ({
          "DocumentDate": r.document_date || (r.created_at ? r.created_at.split(' ')[0] : '-'),
          "Customer No": r.customer_no || '',
          "Customer Name": r.customer_name || '',
          "Batch No": r.batch_no || '',
          "Internal ID": r.internal_id || '',
          "IMEI Number": r.imei_number || '',
          "Serial Number": r.serial_number || '',
          "Model": r.model || '',
          "GB": r.gb || '',
          "Color": r.color || '',
          "Defects": r.defects || '',
          "Screen Test": r.screen_test || '',
          "Power Test": r.power_test || '',
          "Flow": r.flow || ''
        }));
        await api.exportTableToExcel(exportData, "batch_giris_listesi.xlsx");
      }
    } else if (action === 'import') {
      setIsExcelModalOpen(true);
    }
  };

  const handleExcelImport = async (data) => {
    const getVal = (item, keys, fallback = '') => {
      for (const k of keys) {
        if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
          return String(item[k]).trim();
        }
      }
      return fallback;
    };

    for (const item of data) {
      await api.createBatchEntry({
        customer_no: getVal(item, ["customer_no", "Customer no", "Customer No", "Customer NO", "Müşteri No", "Musteri No", "Müşt. No"]),
        customer_name: getVal(item, ["customer_name", "Customer Name", "Customer name", "Customer NAME", "Müşteri Adı", "Musteri Adi", "Müşteri Unvanı"]),
        batch_no: getVal(item, ["batch_no", "Batch No", "Batch no", "Batch NO", "Parti No"]),
        internal_id: getVal(item, ["internal_id", "Internal ID", "Internal Id", "Internal id", "Dahili ID"]),
        imei_number: getVal(item, ["imei_number", "IMEI Number", "IMEI number", "IMEI", "Imei"]),
        serial_number: getVal(item, ["serial_number", "Serial Number", "Serial number", "SN", "Seri No"]),
        model: getVal(item, ["model", "Model", "MODEL", "Cihaz Modeli"]),
        gb: getVal(item, ["gb", "GB", "Gb", "Kapasite"]),
        color: getVal(item, ["color", "Color", "Renk"]),
        defects: getVal(item, ["defects", "Defects", "Arıza", "Kusur"]),
        screen_test: getVal(item, ["screen_test", "Screen Test", "Ekran Testi"]),
        power_test: getVal(item, ["power_test", "Power Test", "Güç Testi"]),
        flow: getVal(item, ["flow", "Flow", "Akış", "Durum"], "Refurbish"),
        unit_price: parseFloat(getVal(item, ["unit_price", "Unit Price", "Birim Fiyat", "Fiyat"], "0")) || 0
      });
    }
    setIsExcelModalOpen(false);
    fetchRecords();
    fetchCustomerGroups();
  };

  return (
    <div className="p-6 h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white dark:bg-[#1e2330] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/50">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Batch Girişi Yönetimi</h1>
          <p className="text-slate-400 mt-1">Müşteri parti cihazlarını, servis ve arıza akış bilgilerini buradan yönetin.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleFetchBatchSummary}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 border border-emerald-500/30 rounded-xl transition-all font-medium text-sm shadow-sm"
          >
            <Layers size={16} />
            Batch Tablosu (Özet)
          </button>
          <div className="relative">
            <select
              onChange={handleExcelAction}
              className="appearance-none bg-slate-50 dark:bg-[#242a38] hover:bg-slate-100 dark:hover:bg-[#2a3142] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2 pr-8 transition-colors font-medium cursor-pointer focus:outline-none focus:border-blue-500 text-sm"
            >
              <option value="">Excel İşlemi Seç...</option>
              <option value="download_template">Boş Şablon İndir</option>
              <option value="export">Tümünü Dışa Aktar</option>
              <option value="import">Excel'den İçe Aktar</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-400">
              <FileSpreadsheet size={16} />
            </div>
          </div>
          <button
            onClick={() => handleOpenModal(null)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-semibold text-sm shadow-lg shadow-blue-500/20 cursor-pointer"
          >
            <Plus size={18} />
            Yeni Batch Girişi
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-[#1e2330] rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-lg flex-1 overflow-hidden flex flex-col">
        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-[#1a1f2b] flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Müşteri, IMEI, Seri No, Batch No veya Model ile ara..."
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="w-52">
            <select
              value={selectedCustomerFilter}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCustomerFilter(val);
                setSearchTerm(val);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-white dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 shadow-sm cursor-pointer"
            >
              <option value="">Müşteri: Tümü</option>
              {(customerList || []).map((c, idx) => {
                const label = c.short_name || c.customer_name || c.code || 'Müşteri';
                return <option key={c.id || idx} value={label}>{c.code ? `[${c.code}] ` : ''}{label}</option>;
              })}
            </select>
          </div>

          <div className="w-44">
            <select
              value={selectedFlow}
              onChange={(e) => { setSelectedFlow(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-white dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 shadow-sm cursor-pointer"
            >
              <option value="Tümü">Akış: Tümü</option>
              {FLOW_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {(searchTerm || selectedFlow !== 'Tümü' || selectedCustomerFilter) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCustomerFilter('');
                setSelectedFlow('Tümü');
                setCurrentPage(1);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-xl transition-colors font-medium"
            >
              <RotateCcw size={14} />
              Temizle
            </button>
          )}

          {/* Bulk Actions Panel */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 px-4 py-1.5 rounded-xl text-xs font-medium animate-in fade-in ml-auto">
              <span><b>{selectedIds.length}</b> kayıt seçildi</span>
              <div className="h-4 w-px bg-blue-500/30 mx-1" />
              <select
                onChange={e => {
                  if (e.target.value) handleBulkFlowChange(e.target.value);
                  e.target.value = '';
                }}
                className="bg-white dark:bg-[#242a38] text-slate-800 dark:text-slate-200 border border-blue-500/30 rounded-lg px-2.5 py-1 text-xs cursor-pointer focus:outline-none"
              >
                <option value="">Toplu Akış Değiştir...</option>
                {FLOW_OPTIONS.filter(f => f !== 'Hepsi').map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-xs font-semibold transition-colors shadow-sm"
              >
                <Trash2 size={13} /> Seçilenleri Sil
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="text-slate-400 hover:text-slate-200 p-1"
                title="Seçimi Temizle"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-[#242a38] text-slate-400 font-medium uppercase tracking-wider text-xs sticky top-0 z-10">
              <tr>
                <th className="px-4 py-4 text-center w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="px-6 py-4">Tarih</th>
                <th className="px-6 py-4">Batch Bilgisi</th>
                <th className="px-6 py-4">Müşteri</th>
                <th className="px-6 py-4 text-center">Durum</th>
                <th className="px-6 py-4 text-right">Miktar</th>
                <th className="px-6 py-4">Oluşturan</th>
                <th className="px-6 py-4 text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loadingBatchSummary ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center"><RefreshCw className="animate-spin mx-auto text-blue-400" /></td>
                </tr>
              ) : paginatedSummary.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-slate-500">Kayıt bulunamadı.</td>
                </tr>
              ) : (
                paginatedSummary.map(rec => (
                  <tr key={rec.id} className={`hover:bg-slate-100 dark:hover:bg-[#2a3142] text-slate-700 dark:text-slate-300 transition-colors ${selectedIds.includes(rec.id) ? 'bg-blue-500/5 dark:bg-blue-500/10' : ''}`}>
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(rec.id)}
                        onChange={() => handleToggleSelect(rec.id)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4 text-xs font-mono">{rec.document_date || '-'}</td>
                    <td className="px-6 py-4 font-semibold text-blue-400">{rec.document_number || rec.batch_no || '-'}</td>
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100">{rec.customer_name || rec.account_name || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${rec.is_success ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                        {rec.is_success ? 'Başarılı' : 'Beklemede'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300">{rec.item_quantity || 0}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{rec.create_by || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-3">
                        <button onClick={() => {
                          const fullRecord = records.find(r => r.id === rec.id) || rec;
                          handleOpenModal(fullRecord);
                        }} className="text-slate-400 hover:text-green-400 transition-colors" title="Düzenle">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(rec.id)} className="text-red-400 hover:text-red-300 transition-colors" title="Sil">
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

        {/* Footer Pagination */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-[#1a1f2b] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Sayfa Başına:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 bg-white dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-medium cursor-pointer focus:outline-none"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40 rounded-lg text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              ← Önceki
            </button>

            <div className="flex items-center gap-1.5">
              <span>Sayfa:</span>
              <input
                type="number"
                min={1}
                max={summaryTotalPages || 1}
                value={currentPage}
                onChange={(e) => {
                  const p = parseInt(e.target.value, 10);
                  if (p >= 1 && p <= (summaryTotalPages || 1)) setCurrentPage(p);
                }}
                className="w-14 px-2 py-1 bg-white dark:bg-[#242a38] border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
              />
              <span>/ {summaryTotalPages} <span className="text-slate-500 font-normal">({summaryTotalCount} Kayıt)</span></span>
            </div>

            <button
              disabled={currentPage >= summaryTotalPages}
              onClick={() => setCurrentPage(p => Math.min(summaryTotalPages, p + 1))}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40 rounded-lg text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Sonraki →
            </button>
          </div>
        </div>
      </div>

      {/* BATCH GİRİŞİ MODALI */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-[#1e2330]">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet size={20} className="text-blue-500" />
                {editingRecord ? 'Batch Kaydını Düzenle & Excel Ön İzleme' : 'Yeni Batch Girişi'}
              </h2>

              <div className="flex items-center gap-3">
                {editingRecord && (
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
                  >
                    <Download size={14} /> Excel Şablonu İndir
                  </button>
                )}

                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {!editingRecord ? (
                /* YENİ BATCH GİRİŞİ: 4 SECTION CARD MANUAL FORM */
                <form onSubmit={handleSubmit} className="space-y-4">
                  {autoFilledMessage && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                      <CheckCircle size={16} />
                      <span>{autoFilledMessage}</span>
                    </div>
                  )}

                  {/* 1. MÜŞTERİ BİLGİLERİ CARD */}
                  <div className="bg-slate-100/60 dark:bg-[#1a202c] p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-500 dark:text-blue-400 tracking-wide uppercase">
                      <User size={16} />
                      <span>1. MÜŞTERİ BİLGİLERİ</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                          Customer No (Müşteri No)
                        </label>
                        <input
                          type="text"
                          value={formData.customer_no || ''}
                          onChange={e => setFormData({ ...formData, customer_no: e.target.value })}
                          className="w-full bg-white dark:bg-[#12151e] border border-slate-300 dark:border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                          placeholder="Örn: CUST-001"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                          Customer Name (Müşteri Adı)
                        </label>
                        <input
                          type="text"
                          list="customer-names-list"
                          value={formData.customer_name || ''}
                          onChange={e => {
                            const val = e.target.value;
                            const foundCust = (customerList || []).find(c => (c.customer_name || c.short_name || c.code) === val);
                            setFormData(prev => ({
                              ...prev,
                              customer_name: val,
                              customer_no: foundCust?.code || prev.customer_no || ''
                            }));
                          }}
                          className="w-full bg-white dark:bg-[#12151e] border border-slate-300 dark:border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                          placeholder="Müşteri listesinden seçin veya yazın"
                        />
                        <datalist id="customer-names-list">
                          {(customerList || []).map((c, idx) => (
                            <option key={idx} value={c.customer_name || c.short_name || c.code} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                  </div>

                  {/* 2. SERVİS BİLGİLERİ CARD */}
                  <div className="bg-slate-100/60 dark:bg-[#1a202c] p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-purple-500 dark:text-purple-400 tracking-wide uppercase">
                        <Wrench size={16} />
                        <span>2. SERVİS BİLGİLERİ</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5">
                        *(IMEI, Seri No, Dahili Kimlik veya Batch No bilgilerinden herhangi birinin girilmesi cihazın tanınması ve kaydedilmesi için yeterlidir)
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                          IMEI Number (IMEI Numarası)
                        </label>
                        <input
                          type="text"
                          value={formData.imei_number || ''}
                          onChange={e => handleAutoLookup('imei_number', e.target.value)}
                          className="w-full bg-white dark:bg-[#12151e] border border-slate-300 dark:border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                          placeholder="IMEI giriniz (örn: 358901234567890)"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                          Serial Number (Seri Numarası)
                        </label>
                        <input
                          type="text"
                          value={formData.serial_number || ''}
                          onChange={e => handleAutoLookup('serial_number', e.target.value)}
                          className="w-full bg-white dark:bg-[#12151e] border border-slate-300 dark:border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                          placeholder="Cihaz seri numarası"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                          Internal ID (Dahili Kimlik)
                        </label>
                        <input
                          type="text"
                          value={formData.internal_id || ''}
                          onChange={e => handleAutoLookup('internal_id', e.target.value)}
                          className="w-full bg-white dark:bg-[#12151e] border border-slate-300 dark:border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                          placeholder="İç takip ID"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                          Batch No (Parti Numarası)
                        </label>
                        <input
                          type="text"
                          value={formData.batch_no || ''}
                          onChange={e => setFormData({ ...formData, batch_no: e.target.value })}
                          className="w-full bg-white dark:bg-[#12151e] border border-slate-300 dark:border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                          placeholder="Batch grup numarası"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. CİHAZ BİLGİLERİ CARD */}
                  <div className="bg-slate-100/60 dark:bg-[#1a202c] p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-500 dark:text-purple-400 tracking-wide uppercase">
                      <Smartphone size={16} />
                      <span>3. CİHAZ BİLGİLERİ</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                          Model (Cihaz Modeli)
                        </label>
                        <input
                          type="text"
                          value={formData.model || ''}
                          onChange={e => setFormData({ ...formData, model: e.target.value })}
                          className="w-full bg-white dark:bg-[#12151e] border border-slate-300 dark:border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                          placeholder="Örn: iPhone 13 Pro"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                          GB (Depolama / Hafıza)
                        </label>
                        <select
                          value={formData.gb || ''}
                          onChange={e => setFormData({ ...formData, gb: e.target.value })}
                          className="w-full bg-white dark:bg-[#12151e] border border-slate-300 dark:border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="">Hafıza Seçiniz...</option>
                          <option value="64GB">64GB</option>
                          <option value="128GB">128GB</option>
                          <option value="256GB">256GB</option>
                          <option value="512GB">512GB</option>
                          <option value="1TB">1TB</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                          Color (Renk)
                        </label>
                        <input
                          type="text"
                          value={formData.color || ''}
                          onChange={e => setFormData({ ...formData, color: e.target.value })}
                          className="w-full bg-white dark:bg-[#12151e] border border-slate-300 dark:border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                          placeholder="Örn: Graphite, Siyah"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. CİHAZIN SERVİSE GELİŞ NEDENİ & DURUM CARD */}
                  <div className="bg-slate-100/60 dark:bg-[#1a202c] p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-500 dark:text-amber-400 tracking-wide uppercase">
                      <AlertCircle size={16} />
                      <span>4. CİHAZIN SERVİSE GELİŞ NEDENİ & DURUM</span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                          Defects (Kusur / Arıza Detayı)
                        </label>
                        <textarea
                          rows={2}
                          value={formData.defects || ''}
                          onChange={e => setFormData({ ...formData, defects: e.target.value })}
                          className="w-full bg-white dark:bg-[#12151e] border border-slate-300 dark:border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                          placeholder="Müşterinin belirttiği kusur veya arızalar..."
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                            Screen Test (Ekran Testi)
                          </label>
                          <input
                            type="text"
                            value={formData.screen_test || ''}
                            onChange={e => setFormData({ ...formData, screen_test: e.target.value })}
                            className="w-full bg-white dark:bg-[#12151e] border border-slate-300 dark:border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                            placeholder="Örn: Tamamlandı / Hasarlı"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                            Power Test (Güç Testi)
                          </label>
                          <input
                            type="text"
                            value={formData.power_test || ''}
                            onChange={e => setFormData({ ...formData, power_test: e.target.value })}
                            className="w-full bg-white dark:bg-[#12151e] border border-slate-300 dark:border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                            placeholder="Örn: Açılıyor / Şarj Olmuyor"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                            Flow (Akış / Durum Takibi)
                          </label>
                          <select
                            value={formData.flow || 'Refurbish'}
                            onChange={e => setFormData({ ...formData, flow: e.target.value })}
                            className="w-full bg-white dark:bg-[#12151e] border border-slate-300 dark:border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 cursor-pointer"
                          >
                            {FLOW_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Buttons */}
                  <div className="pt-3 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-5 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium text-xs hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                    >
                      İptal
                    </button>

                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-semibold text-xs shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Check size={16} /> Kaydet
                    </button>
                  </div>
                </form>
              ) : (
                /* BATCH KAYDINI DÜZENLE: EXCEL ÖN İZLEMESİ & HATA GÖSTEREN KUTUCUK & ŞABLON İNDİRME */
                <div className="space-y-5">
                  {/* Info Header */}
                  <div className="flex items-center justify-between bg-slate-100 dark:bg-[#242a38] p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                      <FileSpreadsheet size={18} className="text-emerald-500" />
                      <span>Düzenlenen Kayıt Detayı: <strong className="font-semibold text-blue-400">Kayıt #{editingRecord.id} ({editingRecord.customer_name || 'Müşteri'})</strong></span>
                    </div>
                    <label className="text-xs text-blue-500 hover:underline cursor-pointer font-semibold flex items-center gap-1">
                      <RotateCcw size={13} /> Güncellenmiş Excel Dosyası Yükle
                      <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelPreviewUpload} />
                    </label>
                  </div>

                  {/* HATA GÖSTEREN KUTUCUK (Validation Report Box) */}
                  {excelValidationErrors.length > 0 ? (
                    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-xl space-y-3">
                      <div className="flex items-center justify-between font-bold text-xs">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={18} className="text-rose-500" />
                          <span>Hata Gösteren Kutucuk ({excelValidationErrors.length} Sütun / Satır Sorunu Tespit Edildi)</span>
                        </div>
                        <span className="text-[11px] bg-rose-500/20 px-2.5 py-0.5 rounded-full font-medium text-rose-300">
                          Sorunlu Sütun ve Satırlar Aşağıda Listelenmiştir
                        </span>
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1.5 pr-2 text-xs divide-y divide-rose-500/20 font-mono">
                        {excelValidationErrors.map((err, i) => (
                          <div key={i} className="pt-1.5 flex items-start gap-2">
                            <span className="font-bold text-rose-300 bg-rose-500/20 px-1.5 py-0.5 rounded shrink-0">
                              Satır {err.row}
                            </span>
                            <span>
                              <strong className="text-rose-200 font-sans">[{err.column}]:</strong> {err.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
                      <CheckCircle size={18} />
                      <span>Tüm veriler başarıyla doğrulandı! Sütun veya satır hatası bulunamadı.</span>
                    </div>
                  )}

                  {/* EXCEL ÖN İZLEMESİ TABLOSU */}
                  <div className="bg-slate-50 dark:bg-[#171b26] rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-slate-100 dark:bg-[#202636] border-b border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-100">
                      <span className="flex items-center gap-2 text-sm">
                        <Table size={16} className="text-blue-400" /> Excel Veri Ön İzlemesi ({excelFileData?.length || 0} Kayıt)
                      </span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        Kayıt verilerinin Excel ön izleme görünümüdür.
                      </span>
                    </div>
                    <div className="overflow-x-auto max-h-80">
                      <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                        <thead className="bg-slate-200/80 dark:bg-[#242a38] text-slate-700 dark:text-slate-200 uppercase tracking-wider sticky top-0 font-bold border-b border-slate-300 dark:border-slate-700 text-[11px]">
                          <tr>
                            <th className="px-3.5 py-2.5 text-center w-10">#</th>
                            <th className="px-3.5 py-2.5">Müşteri Adı</th>
                            <th className="px-3.5 py-2.5">IMEI Number</th>
                            <th className="px-3.5 py-2.5">Seri No</th>
                            <th className="px-3.5 py-2.5">Internal ID</th>
                            <th className="px-3.5 py-2.5">Batch No</th>
                            <th className="px-3.5 py-2.5">Model</th>
                            <th className="px-3.5 py-2.5">GB</th>
                            <th className="px-3.5 py-2.5">Color</th>
                            <th className="px-3.5 py-2.5">Screen Test</th>
                            <th className="px-3.5 py-2.5">Power Test</th>
                            <th className="px-3.5 py-2.5">Arıza / Kusur</th>
                            <th className="px-3.5 py-2.5">Akış (Flow)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                          {(excelFileData || []).map((row, idx) => {
                            const rowErrors = excelValidationErrors.filter(e => e.row === idx + 1);
                            const hasErr = rowErrors.length > 0;
                            return (
                              <tr key={idx} className={`hover:bg-slate-100 dark:hover:bg-[#202636] transition-colors ${hasErr ? 'bg-rose-500/10' : 'bg-white dark:bg-[#1e2330]'}`}>
                                <td className="px-3.5 py-2.5 text-center font-bold text-slate-400 font-mono">{idx + 1}</td>
                                <td className={`px-3.5 py-2.5 font-bold ${!row.customer_name ? 'text-rose-400 font-bold bg-rose-500/20 px-2 py-1 rounded' : 'text-slate-800 dark:text-slate-100'}`}>
                                  {row.customer_name || '<BOŞ>'}
                                </td>
                                <td className={`px-3.5 py-2.5 font-mono font-medium ${row.imei_number && (row.imei_number.length !== 15 || !/^\d+$/.test(row.imei_number)) ? 'text-rose-400 font-bold bg-rose-500/20 px-2 py-1 rounded' : 'text-slate-700 dark:text-slate-200'}`}>
                                  {row.imei_number || '-'}
                                </td>
                                <td className="px-3.5 py-2.5 font-mono text-slate-700 dark:text-slate-300">{row.serial_number || '-'}</td>
                                <td className="px-3.5 py-2.5 font-mono text-slate-700 dark:text-slate-300">{row.internal_id || '-'}</td>
                                <td className="px-3.5 py-2.5 font-mono text-slate-700 dark:text-slate-300">{row.batch_no || '-'}</td>
                                <td className="px-3.5 py-2.5 font-bold text-blue-500 dark:text-blue-400">{row.model || '-'}</td>
                                <td className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300">{row.gb || '-'}</td>
                                <td className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300">{row.color || '-'}</td>
                                <td className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300">{row.screen_test || '-'}</td>
                                <td className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300">{row.power_test || '-'}</td>
                                <td className="px-3.5 py-2.5 max-w-xs truncate text-slate-700 dark:text-slate-300">{row.defects || '-'}</td>
                                <td className="px-3.5 py-2.5">
                                  <select
                                    value={row.flow || 'Refurbish'}
                                    onChange={(e) => handleCellChange(idx, 'flow', e.target.value)}
                                    className="bg-white dark:bg-[#242a38] border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus:border-blue-500"
                                  >
                                    {FLOW_OPTIONS.filter(f => f !== 'Hepsi').map(f => (
                                      <option key={f} value={f}>{f}</option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Edit Mode Footer Buttons */}
                  <div className="pt-3 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-5 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium text-xs hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                    >
                      İptal
                    </button>

                    <button
                      type="button"
                      disabled={loading || !excelFileData || excelFileData.length === 0}
                      onClick={handleConfirmExcelImport}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-semibold text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Check size={16} /> Değişiklikleri Kaydet
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}



      {/* Excel Mapping Modal */}
      <ExcelMappingModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onImport={handleExcelImport}
        dbColumns={dbColumns}
        friendlyNames={friendlyNames}
      />
    </div>
  );
}

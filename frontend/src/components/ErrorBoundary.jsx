import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Beyaz ekran yerine bu hatayı burada görürüz; kök nedeni bulmak için kritik.
    console.error('Uygulama hatası yakalandı:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0f1219] p-6">
          <div className="max-w-lg w-full bg-white dark:bg-[#1e2330] border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-lg p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="text-red-500" size={28} />
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Bir şeyler ters gitti</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Beklenmeyen bir hata oluştu ve ekran görüntülenemedi. Sayfayı yenilemeyi deneyin; sorun devam ederse geliştirici konsolundaki hata mesajı destek ekibine iletilebilir.
            </p>
            {this.state.error?.message && (
              <pre className="text-left text-xs font-mono text-red-500 bg-red-500/5 border border-red-500/20 rounded-xl p-3 mb-6 overflow-x-auto whitespace-pre-wrap">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-900/20"
            >
              <RefreshCw size={16} /> Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

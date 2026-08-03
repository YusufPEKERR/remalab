#!/bin/bash

# macOS .app Otomatik Paketleme Betiği
set -e

echo "=================================================="
echo "🍎 ERP Web App - macOS .app Intel (x86_64) Derleme Başlatılıyor..."
echo "=================================================="

# Script'in bulunduğu dizine geç
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Python3 kontrolü
if ! command -v python3 &> /dev/null
then
    echo "❌ Hata: python3 bulunamadı! Lütfen Python 3'ü yükleyin."
    exit 1
fi

# Gerekli bağımlılıkları Intel x86_64 (A1708 MacBook Pro Uyumlu) olarak indir ve kur
echo "📦 Intel (x86_64) tekerlekleri indiriliyor (A1708 MacBook Pro Uyumlu)..."
python3 -m pip install --upgrade pip
python3 -m pip install PyQt6 PyQt6-WebEngine pyinstaller

# Eski derleme kalıntılarını temizle
echo "🧹 Temizlik yapılıyor..."
rm -rf build dist

# PyInstaller ile .app bundle derle (Intel x86_64 ikili dosyalarını paketler)
echo "🚀 PyInstaller ile Intel (x86_64) .app paketleniyor..."
python3 -m PyInstaller --noconfirm \
            --onedir \
            --windowed \
            --name="ERPWebApp" \
            --target-architecture x86_64 \
            --collect-all PyQt6 \
            --collect-all PyQt6_WebEngine \
            --add-data "sites.json:." \
            --add-data "logo.png:." \
            main.py

if [ -d "dist/ERPWebApp.app" ]; then
    echo "🔑 QtWebEngineProcess ve tüm iç kütüphanelere çalıştırıcı izinleri veriliyor..."
    chmod -R 755 "dist/ERPWebApp.app"
    find "dist/ERPWebApp.app" -type f -exec chmod +x {} +

    # GitHub Actions workflow paket adımı için kopyasını oluştur
    cp -R "dist/ERPWebApp.app" "dist/ERP Web App.app"

    echo "=================================================="
    echo "✅ TEBRİKLER! Intel (x86_64) .app Paketi Başarıyla Oluşturuldu!"
    echo "📍 Konum: $DIR/dist/ERPWebApp.app"
    echo "=================================================="
else
    echo "❌ Hata: Derleme sırasında bir sorun oluştu."
    exit 1
fi

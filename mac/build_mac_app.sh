#!/bin/bash

# macOS .app Otomatik Paketleme Betiği
set -e

echo "=================================================="
echo "🍎 ERP Web App - macOS .app Intel (x86_64) Derleme Başlatılıyor..."
echo "=================================================="

# Script'in bulunduğu dizine geç
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Intel x86_64 Homebrew / Python tespiti (A1708 MacBook Pro Uyumlu)
PYTHON_CMD="python3"

if [ -f "/usr/local/bin/python3" ]; then
    echo "🎯 Intel (x86_64) Python3 tespit edildi: /usr/local/bin/python3"
    PYTHON_CMD="/usr/local/bin/python3"
elif [ -f "/usr/local/bin/brew" ]; then
    echo "📦 Intel (x86_64) Homebrew üzerinden Intel Python kuruluyor..."
    /usr/local/bin/brew install python@3.11 || true
    if [ -f "/usr/local/bin/python3" ]; then
        PYTHON_CMD="/usr/local/bin/python3"
    fi
fi

echo "🚀 Kullanılan Python Mimarisi: $($PYTHON_CMD -c 'import platform; print(platform.machine())')"

# Gerekli bağımlılıkları Intel x86_64 olarak yükle
echo "📦 Intel (x86_64) bağımlılıkları yükleniyor..."
$PYTHON_CMD -m pip install --upgrade pip
$PYTHON_CMD -m pip install PyQt6 PyQt6-WebEngine pyinstaller

# Eski derleme kalıntılarını temizle
echo "🧹 Temizlik yapılıyor..."
rm -rf build dist

# PyInstaller ile .app bundle derle
echo "🚀 PyInstaller ile Intel (x86_64) .app paketleniyor..."
$PYTHON_CMD -m PyInstaller --noconfirm \
            --onedir \
            --windowed \
            --name="ERPWebApp" \
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

#!/bin/bash

# macOS .app Otomatik Paketleme Betiği
set -e

echo "=================================================="
echo "🍎 ERP Web App - macOS .app Derleme Başlatılıyor..."
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

# Bu makinenin gerçek CPU mimarisini tespit et (Intel Mac'lerde x86_64, Apple Silicon'da arm64).
# ÖNEMLİ: Derleme HER ZAMAN çalıştığı makinenin NATIVE mimarisinde yapılır.
# Farklı bir mimari zorlanırsa (örn. arm64 bir makinede x86_64 hedeflenirse) pip o
# mimariye ait olmayan wheel'ler indirir ve üretilen .app hedef Mac'te
# "Bad CPU type in executable" hatasıyla hiç açılmaz.
NATIVE_ARCH="$(uname -m)"
echo "🖥️  Bu makinenin native mimarisi: $NATIVE_ARCH"

# Gerekli bağımlılıkları native mimaride indir ve kur
echo "📦 $NATIVE_ARCH mimarisine uygun wheel'ler indiriliyor..."
python3 -m pip install --upgrade pip
python3 -m pip install PyQt6 PyQt6-WebEngine pyinstaller

# Eski derleme kalıntılarını temizle
echo "🧹 Temizlik yapılıyor..."
rm -rf build dist

# PyInstaller ile .app bundle derle (native mimaride)
echo "🚀 PyInstaller ile $NATIVE_ARCH .app paketleniyor..."
python3 -m PyInstaller --noconfirm \
            --onedir \
            --windowed \
            --name="ERPWebApp" \
            --target-architecture "$NATIVE_ARCH" \
            --collect-all PyQt6 \
            --collect-all PyQt6_WebEngine \
            --add-data "sites.json:." \
            --add-data "logo.png:." \
            main.py

if [ -d "dist/ERPWebApp.app" ]; then
    echo "🔑 QtWebEngineProcess ve tüm iç kütüphanelere çalıştırıcı izinleri veriliyor..."
    chmod -R 755 "dist/ERPWebApp.app"
    find "dist/ERPWebApp.app" -type f -exec chmod +x {} +

    # Mimari doğrulama: bundle'ın gerçekten beklenen mimaride derlendiğinden emin ol.
    # Bu kontrol olmadan yanlış mimarili bir .app sessizce "başarılı" görünüp
    # kullanıcının Mac'inde hiç açılmayabilir (tam da geçmişte yaşanan sorun).
    MAIN_BIN="dist/ERPWebApp.app/Contents/MacOS/ERPWebApp"
    BUILT_ARCH="$(lipo -archs "$MAIN_BIN" 2>/dev/null || file -b "$MAIN_BIN")"
    echo "🔍 Derlenen çalıştırılabilir dosyanın mimarisi: $BUILT_ARCH"
    if [[ "$BUILT_ARCH" != *"$NATIVE_ARCH"* ]]; then
        echo "❌ Hata: Beklenen mimari ($NATIVE_ARCH) ile derlenen ikili ($BUILT_ARCH) uyuşmuyor! Build durduruldu."
        exit 1
    fi

    # Ad-hoc code signing: zip/kopyalama sonrası imza tutarsızlığından kaynaklanan
    # "... is damaged and can't be opened" Gatekeeper hatasını önler.
    # (Not: Bu, Apple Developer ID ile tam notarization YERİNE geçmez; ilk açılışta
    # yine de "geliştirici doğrulanamadı" uyarısı çıkabilir, bkz. README.)
    echo "🔏 Ad-hoc code signing uygulanıyor..."
    codesign --force --deep --sign - "dist/ERPWebApp.app" || echo "⚠️ Code signing uyarısı (yoksayılabilir)"

    echo "=================================================="
    echo "✅ TEBRİKLER! $NATIVE_ARCH .app Paketi Başarıyla Oluşturuldu!"
    echo "📍 Konum: $DIR/dist/ERPWebApp.app"
    echo "=================================================="
else
    echo "❌ Hata: Derleme sırasında bir sorun oluştu."
    exit 1
fi

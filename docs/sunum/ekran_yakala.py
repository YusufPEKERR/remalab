# -*- coding: utf-8 -*-
"""RemaLab WMS ekranlarinin gercek goruntusunu yakalar (sunum icin).

Uygulamanin kendi WebBridge'ini ve statik sunucusunu kullanir; yani ekranlarda
GERCEK veritabani verisi gorunur. Hicbir yazma islemi yapilmaz - yalnizca
sayfalar acilip resmi alinir.

Gizli bilgi yazdirilmaz.
"""
import os
import sys
import json

BASE = r"C:\Users\DELL\Desktop\remalab-feature-users-module\remalab-feature-users-module"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ekran_goruntuleri")
sys.path.insert(0, BASE)
os.chdir(BASE)
os.makedirs(OUT, exist_ok=True)

from dotenv import load_dotenv
load_dotenv(os.path.join(BASE, ".env"))

# GPU kompozisyonu kapatilirsa QWebEngineView.grab() bos kare yerine gercek
# icerigi verir (yazilimsal rasterizasyon ekran disi tampona ciziyor).
os.environ["QTWEBENGINE_CHROMIUM_FLAGS"] = "--lang=tr-TR --disable-gpu"

from PySide6.QtWidgets import QApplication
from PySide6.QtCore import QUrl, QTimer, QLocale
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWebChannel import QWebChannel

from core.main_window import _start_static_server
from core.web_bridge import WebBridge

# Giris ekrani disindaki her sayfa oturum ister; yonlendirme koruması olmadigi
# icin localStorage'a gercek bir kullanici satiri yazmak yeterli.
KULLANICI = {
    "id": 3, "username": "yusufpeker", "tc_no": "", "fullname": "Yusuf PEKER",
    "role": "Admin", "gorev": "", "account_enabled": True,
    "team_leader": "", "operation_manager": "", "administrative_manager": "",
}

# (dosya adi, rota, tema, bekleme ms)
SAYFALAR = [
    ("09_hizli_batarya",    "/hizli-onarim-bitir/BATTERY",     "dark",  4500),
    ("10_sontest",          "/statu-gecis/QAC/125_126",        "dark",  6000),
    ("11_kayitkabul",       "/statu-gecis/SPA_P/100_101",      "dark",  6000),
    ("12_onarimhavuzu",     "/onarim-havuzu/BATTERY",          "dark",  7000),
    ("19_aratest",          "/statu-gecis/MNG1_AS/138_124",    "dark",  6000),
    ("20_demontaj_kabul",   "/statu-gecis/TEC_DISMANTLE/104_105", "dark", 6000),
]


def main():
    QLocale.setDefault(QLocale(QLocale.Turkish, QLocale.Turkey))
    app = QApplication(sys.argv)

    dist = os.path.join(BASE, "frontend", "dist")
    httpd = _start_static_server(dist)
    port = httpd.server_address[1]
    kok = f"http://127.0.0.1:{port}"
    print(f"[INFO] Statik sunucu: {kok}")

    view = QWebEngineView()
    view.resize(1600, 1000)

    bridge = WebBridge()
    kanal = QWebChannel()
    kanal.registerObject("backend", bridge)
    view.page().setWebChannel(kanal)

    view.show()

    durum = {"i": -1, "hazir": False}

    def sonraki():
        durum["i"] += 1
        if durum["i"] >= len(SAYFALAR):
            print("[OK] Tum ekranlar alindi.")
            app.quit()
            return
        ad, rota, tema, _bekle = SAYFALAR[durum["i"]]
        print(f"[{durum['i']+1}/{len(SAYFALAR)}] {ad}  {rota}  ({tema})")
        # Oturum ve tema her yuklemeden ONCE yazilmali; sayfa acildiktan sonra
        # yazilirsa React zaten "Misafir" olarak render etmis oluyor.
        js = (
            f"localStorage.setItem('user', {json.dumps(json.dumps(KULLANICI))});"
            f"localStorage.setItem('username', 'yusufpeker');"
            f"localStorage.setItem('global_theme', '{tema}');"
            f"localStorage.setItem('theme_yusufpeker', '{tema}');"
        )
        if rota == "/login":
            js = ("localStorage.removeItem('user');sessionStorage.removeItem('user');"
                  f"localStorage.setItem('global_theme', '{tema}');")
        view.page().runJavaScript(js, lambda _r: view.load(QUrl(kok + rota)))

    def yuklendi(ok):
        if not durum["hazir"]:
            # Ilk yukleme yalnizca origin'i acmak icindi; simdi sirayi baslat.
            durum["hazir"] = True
            QTimer.singleShot(400, sonraki)
            return
        if not ok:
            print("   [UYARI] sayfa yuklenemedi")
        ad, _rota, _tema, bekle = SAYFALAR[durum["i"]]
        QTimer.singleShot(bekle, lambda: yakala(ad))

    def yakala(ad):
        yol = os.path.join(OUT, ad + ".png")
        pix = view.grab()
        pix.save(yol, "PNG")
        boyut = os.path.getsize(yol)
        print(f"   -> {ad}.png  ({boyut//1024} KB)")
        QTimer.singleShot(300, sonraki)

    view.loadFinished.connect(yuklendi)
    view.load(QUrl(kok + "/login"))

    # Guvenlik agi: bir sayfa takilirsa surec sonsuza kadar acik kalmasin.
    QTimer.singleShot(240000, app.quit)
    app.exec()
    httpd.shutdown()


if __name__ == "__main__":
    main()

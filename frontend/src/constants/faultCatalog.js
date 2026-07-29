// Hatalı parça / hata kodu kataloğu — sadece ilgili kaynak listedeki
// kategoriler ve arızalar (tamamı Türkçe).
export const FAULT_CATALOG = [
  {
    category: 'Arka Cam',
    items: [
      'Arka cam çizik / kırık',
      'Arka cam esniyor',
      'Arka cam havada',
      'Arka cam ile kasa arasında açıklık/aralık',
      'Arka cam yabancı madde'
    ]
  },
  {
    category: 'Arka Kamera',
    items: [
      'Arka kamera açılmıyor',
      'Arka kamera bulanık / odaklamıyor',
      'Arka kamera lekeli',
      'Arka kamera piksel var',
      'Arka kamera titriyor',
      'Arka kamera toz / yabancı madde var',
      'Telephoto açılmıyor',
      'Telephoto kamera bulanık / odaklamıyor',
      'Telephoto kamera lekeli',
      'Telephoto kamera titriyor',
      'Telephoto kamera toz / yabancı madde var',
      'Telephoto piksel var',
      'Ultrawide bulanık / odaklamıyor',
      'Ultrawide titriyor',
      'Ultrawide toz / yabancı madde var',
      'Ultrawide açılmıyor',
      'Ultrawide kamera lekeli',
      'Ultrawide piksel var'
    ]
  },
  {
    category: 'Arka Kamera Camı/Çerçevesi',
    items: [
      'Çerçeve dönüyor',
      'Çerçeve rengi farklı',
      'Kamera camı çizik',
      'Kamera camı havada',
      'Kamera camı kırık',
      'Kamera camı ile kasa arasında açıklık var',
      'Kamera camı toz var / lekeli'
    ]
  },
  {
    category: 'Batarya',
    items: [
      'Batarya durumu kötü',
      'Batarya sağlığı düşük',
      'Batarya sallanıyor',
      'Batarya sayaç yüksek'
    ]
  },
  {
    category: 'Cihaz Geneli',
    items: [
      'Cihaz donuyor',
      'Cihaz kapanıp açılıyor',
      'Yazılım gerekli'
    ]
  },
  {
    category: 'Ekran',
    items: [
      'Backlight var',
      'Bombe',
      'Boşluk / aralık var',
      'Çalışmıyor',
      'Dış cam çizik',
      'Dış cam kırık',
      'Dokunmatik / digitizer hatası',
      'Ekranda toz / yabancı madde',
      'Esniyor',
      'Gölge var',
      'Havada',
      'İç ekran çizik',
      'İç ekran kırık',
      'OCA atması var',
      'Piksel var',
      'Renk bozukluğu / eşitsizliği (pembe, mavi, sarı) var'
    ]
  },
  {
    category: 'Filtre',
    items: [
      'Alt filtre delik / kesik',
      'Alt filtre yamuk / geride',
      'Arka filtre delik / kesik',
      'Arka filtre yamuk / geride',
      'Üst filtre delik / kesik',
      'Üst filtre yamuk / geride'
    ]
  },
  {
    category: 'Fonksiyon',
    items: [
      'Face ID çalışmıyor',
      'Flash çalışmıyor',
      'GSM geliyor / arama yapılamıyor',
      'GSM gelmiyor / arama yapılabiliyor',
      'GSM gelmiyor / arama yapılamıyor',
      'Gyroskop / ekran dönmüyor',
      'NFC çalışmıyor',
      'Phonecheck yüklenmiyor / yazılım',
      'Proximity sensör çalışmıyor',
      'Şarj olmuyor / temassız / kablo seçiyor',
      'Vibrasyon çalışmıyor',
      'Wifi çalışmıyor'
    ]
  },
  {
    category: 'Hoparlör',
    items: [
      'Alt hoparlör cızırtılı',
      'Alt hoparlör ses gelmiyor',
      'Üst hoparlör cızırtılı',
      'Üst hoparlör ses gelmiyor'
    ]
  },
  {
    category: 'Kasa',
    items: [
      'Boya atması var',
      'CE logosu yok',
      'Kasada çizik var',
      'Kasada darbe var',
      'Kırık',
      'Şarj soketi rengi farklı',
      'Şarj soketi yamuk',
      'Vida eksik',
      'Yamuk'
    ]
  },
  {
    category: 'Mikrofon',
    items: [
      'Alt mikrofon çalışmıyor',
      'Alt mikrofon cızırtılı',
      'Arka mikrofon çalışmıyor',
      'Arka mikrofon cızırtılı',
      'Earpiece mikrofon çalışmıyor',
      'Earpiece mikrofon cızırtılı',
      'Üst mikrofon çalışmıyor',
      'Üst mikrofon cızırtılı'
    ]
  },
  {
    category: 'Ön Kamera',
    items: [
      'Açılmıyor',
      'Bulanık',
      'Koyu / siyah kenarlar',
      'Ön kamera camı lekeli / tozlu',
      'Ön kamera çizik / lekeli',
      'Ön kamera lekeli',
      'Ön kamera tozlu',
      'Piksel var'
    ]
  },
  {
    category: 'Sim Tepsi',
    items: [
      'Dışarıda',
      'İçeride',
      'İğne derine gidiyor',
      'Rengi farklı',
      'Yamuk'
    ]
  },
  {
    category: 'Tuşlar',
    items: [
      'Flip-switch rengi farklı',
      'Flip-switch sesi farklı',
      'Flip-switch zor basıyor',
      'Power rengi farklı',
      'Power sesi farklı',
      'Power zor basıyor',
      'Ses aç rengi farklı',
      'Ses aç sesi farklı',
      'Ses aç zor basıyor',
      'Ses kapat rengi farklı',
      'Ses kapat sesi farklı',
      'Ses kapat zor basıyor'
    ]
  }
];

// Düz liste: her satır { id, partName, faultText } — id checkbox seçimi için stabil anahtar.
export const FAULT_LIST = FAULT_CATALOG.flatMap(({ category, items }) =>
  items.map((text) => ({
    id: `${category}::${text}`,
    partName: category,
    faultText: text
  }))
);

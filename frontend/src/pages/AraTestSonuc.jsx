import TestResultScreen from '../components/TestResultScreen';

export default function AraTestSonuc() {
  return (
    <TestResultScreen
      title="Ara Test Sonuç"
      subtitle="Ara Test Sonuçlandırma — Test başarılı ise son teste aktarılır, başarısız ise açıklama ve hatalı parça/hata kodu seçilerek teknik departmana geri gönderilir."
      sourceStatuCode={138}
      successStatuCode={124}
      failStatuCode={109}
      /* Ara test de artık test kaydı yazar (Son Test gibi). Kayıt olmadan Servis >
         Durum sekmesinde ara testin yapıldığı, kimin yaptığı ve başarısızsa gerekçesi
         hiçbir yerde görünmüyordu - phonecheck_test_results'ta 138_124 aşamasına ait
         TEK BİR satır bile yoktu.
         Yan etki (bilinçli): bu bayrak aynı zamanda başarısız deneme sayacını da
         devreye alır. Sayaç yalnızca BİLGİDİR - üst sınır kaldırıldı; sınır varken
         hakkı dolan cihazda testçi ne başarılı ne başarısız sonuç kaydedebiliyor,
         cihaz o adımda kilitleniyordu. */
      logExitTest
    />
  );
}

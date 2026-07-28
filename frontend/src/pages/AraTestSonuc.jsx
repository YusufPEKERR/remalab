import TestResultScreen from '../components/TestResultScreen';

export default function AraTestSonuc() {
  return (
    <TestResultScreen
      title="Ara Test Sonuç"
      subtitle="Ara Test Sonuçlandırma — Test başarılı ise son teste aktarılır, başarısız ise açıklama ve hatalı parça/hata kodu seçilerek teknik departmana geri gönderilir."
      sourceStatuCode={138}
      successStatuCode={124}
      failStatuCode={109}
    />
  );
}

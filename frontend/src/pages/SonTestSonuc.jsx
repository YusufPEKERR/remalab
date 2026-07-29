import TestResultScreen from '../components/TestResultScreen';

export default function SonTestSonuc() {
  return (
    <TestResultScreen
      title="Son Test Sonuç"
      subtitle="Son Test Sonuçlandırma — Test başarılı ise depoya aktarılır, başarısız ise açıklama ve hatalı parça/hata kodu seçilerek teknik departmana geri gönderilir."
      sourceStatuCode={125}
      successStatuCode={126}
      failStatuCode={109}
      logExitTest
    />
  );
}

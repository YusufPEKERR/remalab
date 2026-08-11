param (
    [string]$Url,
    [string]$OutFile,
    [string]$Token = ""
)

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

try {
    $req = [System.Net.HttpWebRequest]::Create($Url)
    $req.UserAgent = 'RemaLabUpdater'
    if ($Token) {
        $req.Headers.Add('Authorization', "Bearer $Token")
    }

    $resp = $req.GetResponse()
    $totalBytes = $resp.ContentLength
    $stream = $resp.GetResponseStream()
    $fs = [System.IO.File]::Create($OutFile)

    $buffer = New-Object byte[] 65536
    $downloaded = 0
    $lastPct = -1

    while (($read = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
        $fs.Write($buffer, 0, $read)
        $downloaded += $read
        $mbDl = [math]::Round($downloaded / 1MB, 2)
        
        if ($totalBytes -gt 0) {
            $mbTot = [math]::Round($totalBytes / 1MB, 2)
            $pct = [math]::Floor(($downloaded / $totalBytes) * 100)
            if ($pct -ne $lastPct) {
                Write-Host ("`r[INDIRILIYOR] {0} MB / {1} MB (%{2})" -f $mbDl, $mbTot, $pct) -NoNewline
                $lastPct = $pct
            }
        } else {
            Write-Host ("`r[INDIRILIYOR] {0} MB" -f $mbDl) -NoNewline
        }
    }

    $fs.Close()
    $stream.Close()
    $resp.Close()
    Write-Host "`n[TAMAMLANDI] Indirme tamamlandi! Paket hazir."
} catch {
    Write-Host "`n[HATA] Indirme basarisiz oldu: $_" -ForegroundColor Red
    exit 1
}

$ErrorActionPreference = "Stop"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "ERP Web App - Otomatik APK Derleme Sistemi" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$ToolsDir = Join-Path $ScriptDir ".tools"
if (-not (Test-Path $ToolsDir)) {
    New-Item -ItemType Directory -Path $ToolsDir -Force | Out-Null
}

# -------------------------------------------------------------
# 1. Java / JDK 17 Hazırlığı
# -------------------------------------------------------------
$javaCmd = Get-Command java -ErrorAction SilentlyContinue
if ($javaCmd) {
    Write-Host "[OK] Sistemde Java bulundu." -ForegroundColor Green
} elseif ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
    Write-Host "[OK] JAVA_HOME ortam degiskeni gecerli." -ForegroundColor Green
} else {
    $portableJdkDir = Join-Path $ToolsDir "jdk"
    if (-not (Test-Path (Join-Path $portableJdkDir "bin\java.exe"))) {
        $jdkZipUrl = "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.10%2B7/OpenJDK17U-jdk_x64_windows_hotspot_17.0.10_7.zip"
        $jdkZipFile = Join-Path $ToolsDir "jdk17.zip"

        if (Test-Path $jdkZipFile) { Remove-Item $jdkZipFile -Force }

        Write-Host "Java (JDK 17) indiriliyor... (Lutfen bekleyin)" -ForegroundColor Yellow
        curl.exe -L -o "$jdkZipFile" "$jdkZipUrl"

        Write-Host "Java (JDK 17) ayiklaniyor..." -ForegroundColor Yellow
        $extractTemp = Join-Path $ToolsDir "jdk_temp"
        if (Test-Path $extractTemp) { Remove-Item $extractTemp -Recurse -Force }
        New-Item -ItemType Directory -Path $extractTemp -Force | Out-Null

        tar.exe -xf "$jdkZipFile" -C "$extractTemp"
        
        $subFolder = Get-ChildItem -Path "$extractTemp" -Directory | Select-Object -First 1
        if ($subFolder) {
            if (-not (Test-Path $portableJdkDir)) { New-Item -ItemType Directory -Path $portableJdkDir -Force | Out-Null }
            Move-Item -Path "$($subFolder.FullName)\*" -Destination "$portableJdkDir" -Force
            Remove-Item -Path "$extractTemp" -Recurse -Force
        }
        if (Test-Path $jdkZipFile) { Remove-Item -Path "$jdkZipFile" -Force }
        Write-Host "[OK] Portatif JDK 17 kuruldu." -ForegroundColor Green
    }
    $env:JAVA_HOME = $portableJdkDir
    $env:PATH = "$portableJdkDir\bin;" + $env:PATH
}

# -------------------------------------------------------------
# 2. Android SDK Hazırlığı
# -------------------------------------------------------------
if (-not $env:ANDROID_HOME) {
    $localSdkPath = Join-Path $env:LOCALAPPDATA "Android\Sdk"
    if (Test-Path $localSdkPath) {
        $env:ANDROID_HOME = $localSdkPath
        Write-Host "[OK] Android SDK bulundu." -ForegroundColor Green
    } else {
        $portableSdkDir = Join-Path $ToolsDir "sdk"
        $cmdlineDest = Join-Path $portableSdkDir "cmdline-tools\latest"
        
        if (-not (Test-Path (Join-Path $cmdlineDest "bin\sdkmanager.bat"))) {
            New-Item -ItemType Directory -Path $portableSdkDir -Force | Out-Null
            
            $cmdToolsZipUrl = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
            $cmdToolsZipFile = Join-Path $ToolsDir "cmdline-tools.zip"

            if (Test-Path $cmdToolsZipFile) { Remove-Item $cmdToolsZipFile -Force }

            Write-Host "Android SDK Indiriliyor... (Lutfen bekleyin)" -ForegroundColor Yellow
            curl.exe -L -o "$cmdToolsZipFile" "$cmdToolsZipUrl"

            Write-Host "Android SDK ayiklaniyor..." -ForegroundColor Yellow
            New-Item -ItemType Directory -Path $cmdlineDest -Force | Out-Null
            
            $tempCmdDir = Join-Path $ToolsDir "cmd_temp"
            if (Test-Path $tempCmdDir) { Remove-Item $tempCmdDir -Recurse -Force }
            New-Item -ItemType Directory -Path $tempCmdDir -Force | Out-Null

            tar.exe -xf "$cmdToolsZipFile" -C "$tempCmdDir"
            Move-Item -Path "$tempCmdDir\cmdline-tools\*" -Destination "$cmdlineDest" -Force
            Remove-Item -Path "$tempCmdDir" -Recurse -Force
            if (Test-Path $cmdToolsZipFile) { Remove-Item -Path "$cmdToolsZipFile" -Force }

            Write-Host "Android SDK bilesenleri yukleniyor (Android 34 ve Build-Tools)..." -ForegroundColor Yellow
            $sdkManager = Join-Path $cmdlineDest "bin\sdkmanager.bat"
            
            # Lisansları kabul et ve yükle
            "y`ny`ny`ny`ny`ny`n" | & "$sdkManager" --licenses "--sdk_root=$portableSdkDir" | Out-Null
            & "$sdkManager" "platforms;android-34" "build-tools;34.0.0" "--sdk_root=$portableSdkDir"
            Write-Host "[OK] Portatif Android SDK kuruldu." -ForegroundColor Green
        }
        $env:ANDROID_HOME = $portableSdkDir
    }
}

# -------------------------------------------------------------
# 3. Gradle Motoru Hazırlığı
# -------------------------------------------------------------
$gradleBin = Join-Path $ToolsDir "gradle\bin\gradle.bat"
if (-not (Test-Path $gradleBin)) {
    $gradleZipUrl = "https://services.gradle.org/distributions/gradle-8.4-bin.zip"
    $gradleZipFile = Join-Path $ToolsDir "gradle.zip"
    
    if (Test-Path $gradleZipFile) { Remove-Item $gradleZipFile -Force }
    Write-Host "Gradle 8.4 motoru indiriliyor... (Lutfen bekleyin)" -ForegroundColor Yellow
    curl.exe -L -o "$gradleZipFile" "$gradleZipUrl"

    Write-Host "Gradle 8.4 motoru ayiklaniyor..." -ForegroundColor Yellow
    $gradleTemp = Join-Path $ToolsDir "gradle_temp"
    if (Test-Path $gradleTemp) { Remove-Item $gradleTemp -Recurse -Force }
    New-Item -ItemType Directory -Path $gradleTemp -Force | Out-Null

    tar.exe -xf "$gradleZipFile" -C "$gradleTemp"
    
    $gradleSubDir = Get-ChildItem -Path "$gradleTemp" -Directory | Select-Object -First 1
    if ($gradleSubDir) {
        $gradleTargetDir = Join-Path $ToolsDir "gradle"
        if (-not (Test-Path $gradleTargetDir)) { New-Item -ItemType Directory -Path $gradleTargetDir -Force | Out-Null }
        Move-Item -Path "$($gradleSubDir.FullName)\*" -Destination "$gradleTargetDir" -Force
        Remove-Item -Path $gradleTemp -Recurse -Force
    }
    if (Test-Path $gradleZipFile) { Remove-Item -Path $gradleZipFile -Force }
    Write-Host "[OK] Gradle motoru kuruldu." -ForegroundColor Green
}

# -------------------------------------------------------------
# 4. local.properties Oluşturma
# -------------------------------------------------------------
$localPropsFile = Join-Path $ScriptDir "local.properties"
$escapedSdk = $env:ANDROID_HOME.Replace("\", "\\")
"sdk.dir=$escapedSdk" | Out-File -FilePath $localPropsFile -Encoding UTF8

# -------------------------------------------------------------
# 5. Gradle İle APK Derleme
# -------------------------------------------------------------
Write-Host ""
Write-Host "🚀 ERP Web App APK derlemesi baslatiliyor..." -ForegroundColor Yellow

try {
    & "$gradleBin" assembleDebug
    
    $apkPath = Join-Path $ScriptDir "app\build\outputs\apk\debug\app-debug.apk"
    $targetApk = Join-Path $ScriptDir "ERP_Web_App.apk"

    if (Test-Path $apkPath) {
        Copy-Item "$apkPath" "$targetApk" -Force
        Write-Host ""
        Write-Host "===================================================" -ForegroundColor Green
        Write-Host "TEBRIKLER! APK Basariyla Olusturuldu!" -ForegroundColor Green
        Write-Host "===================================================" -ForegroundColor Green
        Write-Host "APK Dosya Konumu: $targetApk" -ForegroundColor Cyan
        Write-Host "Bu dosyayi telefonunuza aktarip dogrudan kurabilirsiniz." -ForegroundColor White
    } else {
        Write-Host "[WARNING] Derleme tamamlandi ancak APK ciktisi bulunamadi." -ForegroundColor Red
    }
} catch {
    Write-Host ""
    Write-Host "Derleme sirasinda bir hata olustu: $_" -ForegroundColor Red
    Write-Host "Ipucu: Projeyi Android Studio ile acarak da APK uretebilirsiniz." -ForegroundColor Yellow
}

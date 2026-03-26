# gen-htpasswd.ps1 - Swagger UI Basic認証用 .htpasswd 生成
# 使い方: .\nginx\gen-htpasswd.ps1

param(
    [string]$User = "",
    [string]$Password = ""
)

$ScriptDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile      = Join-Path (Split-Path -Parent $ScriptDir) ".env"
$HtpasswdFile = Join-Path $ScriptDir ".htpasswd"

# .env から読み込む
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            $k = $Matches[1].Trim()
            $v = $Matches[2].Trim()
            if ($k -eq "SWAGGER_USER"     -and $User     -eq "") { $script:User     = $v }
            if ($k -eq "SWAGGER_PASSWORD" -and $Password -eq "") { $script:Password = $v }
        }
    }
}

if ($User     -eq "") { $User     = "swagger"     }
if ($Password -eq "") { $Password = "swagger1234" }

# .htpasswd がディレクトリになっている場合は削除
if (Test-Path $HtpasswdFile) {
    $item = Get-Item $HtpasswdFile
    if ($item.PSIsContainer) {
        Write-Host "[WARN] .htpasswd is a directory. Removing it..." -ForegroundColor Yellow
        Remove-Item $HtpasswdFile -Recurse -Force
    }
}

# Docker で htpasswd を生成
Write-Host "Generating .htpasswd using Docker..."
$output = & docker run --rm httpd:alpine htpasswd -nb $User $Password 2>&1
$line   = $output | Where-Object { $_ -match '^\S+:\$apr1\$' } | Select-Object -First 1

if ($line) {
    [System.IO.File]::WriteAllText($HtpasswdFile, $line.ToString() + "`n", [System.Text.Encoding]::ASCII)
    Write-Host "[OK] Generated: $HtpasswdFile" -ForegroundColor Green
    Write-Host "     User    : $User"
    Write-Host "     Password: $Password"
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  docker compose down"
    Write-Host "  docker compose up -d"
} else {
    Write-Host "[ERROR] Could not generate hash. Output was:" -ForegroundColor Red
    $output | ForEach-Object { Write-Host "  $_" }
}

$ErrorActionPreference = 'Stop'
$webUrl = 'http://127.0.0.1:5189'
try {
    $ready = $false
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $webUrl -TimeoutSec 2
        if ($response.Content -notmatch 'Anime local') { throw 'El puerto 5189 pertenece a otra aplicacion.' }
        $ready = $true
    } catch {
        if ($_.Exception.Message -match 'otra aplicacion') { throw }
    }
    if (-not $ready) {
        $nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
        $process = Start-Process -FilePath $nodeExe -ArgumentList 'server.mjs' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'web.stdout.log') -RedirectStandardError (Join-Path $PSScriptRoot 'web.stderr.log') -PassThru
        for ($attempt = 0; $attempt -lt 20; $attempt++) {
            Start-Sleep -Milliseconds 250
            if ($process.HasExited) { throw 'El servidor no pudo iniciar. Consulta web.stderr.log.' }
            try {
                $response = Invoke-WebRequest -UseBasicParsing -Uri $webUrl -TimeoutSec 1
                if ($response.Content -match 'Anime local') { $ready = $true; break }
            } catch {}
        }
        if (-not $ready) { throw 'El servidor no respondio a tiempo.' }
    }
    Start-Process $webUrl
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host 'Pulsa Enter para cerrar'
    exit 1
}

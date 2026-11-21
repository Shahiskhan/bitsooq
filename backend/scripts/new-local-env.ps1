$ErrorActionPreference = 'Stop'
$backendRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = Split-Path -Parent $backendRoot
$backendTarget = Join-Path $backendRoot '.env'
$rootTarget = Join-Path $repositoryRoot '.env'
function New-Secret {
    $bytes = [byte[]]::new(32)
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($bytes) } finally { $random.Dispose() }
    return ([BitConverter]::ToString($bytes)).Replace('-','').ToLowerInvariant()
}
function Read-EnvFile([string]$Path) {
    $values = @{}
    if (Test-Path -LiteralPath $Path) {
        foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
            if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
                $value = $Matches[2].Trim()
                if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) { $value = $value.Substring(1,$value.Length-2) }
                $values[$Matches[1]] = $value
            }
        }
    }
    return $values
}
if (!(Test-Path -LiteralPath $backendTarget)) {
    $lines = @('FIREBASE_PROJECT_ID=replace-with-your-project-id', "INTERNAL_HMAC_SECRET=$(New-Secret)", 'CONFIG_USERNAME=config', "CONFIG_PASSWORD=$(New-Secret)", 'EUREKA_USERNAME=discovery', "EUREKA_PASSWORD=$(New-Secret)", "MYSQL_ROOT_PASSWORD=$(New-Secret)", "USER_DB_PASSWORD=$(New-Secret)", "PRODUCT_DB_PASSWORD=$(New-Secret)", "ORDER_DB_PASSWORD=$(New-Secret)", "PAYMENT_DB_PASSWORD=$(New-Secret)", "NOTIFICATION_DB_PASSWORD=$(New-Secret)", "REDIS_PASSWORD=$(New-Secret)")
    [System.IO.File]::WriteAllLines($backendTarget, $lines)
}
$frontendRoot = Join-Path $repositoryRoot 'bitsooq-ui'
$frontendEnv = Join-Path $frontendRoot '.env.local'
if (!(Test-Path -LiteralPath $frontendEnv)) { Copy-Item -LiteralPath (Join-Path $frontendRoot '.env.example') -Destination $frontendEnv }
if (!(Test-Path -LiteralPath $rootTarget)) {
    $backendValues = Read-EnvFile $backendTarget
    $frontendValues = Read-EnvFile $frontendEnv
    if ($frontendValues['VITE_FIREBASE_PROJECT_ID'] -and (!$backendValues['FIREBASE_PROJECT_ID'] -or $backendValues['FIREBASE_PROJECT_ID'] -eq 'replace-with-your-project-id')) { $backendValues['FIREBASE_PROJECT_ID'] = $frontendValues['VITE_FIREBASE_PROJECT_ID'] }
    if ($frontendValues['VITE_FIREBASE_PROJECT_ID'] -and $backendValues['FIREBASE_PROJECT_ID'] -ne $frontendValues['VITE_FIREBASE_PROJECT_ID']) { throw 'Firebase project IDs differ between backend and frontend. Reconcile the configuration before generating root .env.' }
    $lines = @($backendValues.Keys | Sort-Object | ForEach-Object { "$_=$($backendValues[$_])" })
    foreach ($name in @('VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_APP_ID','VITE_FIREBASE_STORAGE_BUCKET','VITE_FIREBASE_MESSAGING_SENDER_ID','VITE_FIREBASE_MEASUREMENT_ID')) { $lines += "$name=$($frontendValues[$name])" }
    $lines += 'FIREBASE_ADMIN_CREDENTIALS_FILE='
    [System.IO.File]::WriteAllLines($rootTarget, $lines)
}
Write-Host 'Local environment files are ready; existing files and credentials were preserved. Complete Firebase values in root .env, then run docker compose up --build --wait from the repository root.'

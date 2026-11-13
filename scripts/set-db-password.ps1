$ErrorActionPreference = 'Stop'
$taskProjectPath = Split-Path -Parent $PSScriptRoot
$taskEnvPath = Join-Path $taskProjectPath '.env.database.local'
$taskPassword = Read-Host 'Incolla la password DATABASE appena impostata su Supabase (input nascosto)' -AsSecureString
$taskBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskPassword)
try {
    $taskPlainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskBstr)
    if ([string]::IsNullOrEmpty($taskPlainPassword)) { throw 'Password vuota: file non modificato.' }
    $taskEncodedPassword = [Uri]::EscapeDataString($taskPlainPassword)
    $taskDbUri = 'postgresql://postgres.oppbprlmfkbqknbarnso:' + $taskEncodedPassword + '@aws-1-eu-west-1.pooler.supabase.com:5432/postgres'
    $taskLines = if (Test-Path -LiteralPath $taskEnvPath) { @(Get-Content -LiteralPath $taskEnvPath | Where-Object { $_ -notmatch '^\s*DATABASE_URL\s*=' }) } else { @() }
    $taskLines += 'DATABASE_URL="' + $taskDbUri + '"'
    [IO.File]::WriteAllLines($taskEnvPath, $taskLines, [Text.UTF8Encoding]::new($false))
    Write-Host 'Password salvata nel file locale. Nessuna credenziale mostrata.'
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskBstr)
    $taskPlainPassword = $null
    $taskEncodedPassword = $null
    $taskDbUri = $null
    $taskPassword.Dispose()
}

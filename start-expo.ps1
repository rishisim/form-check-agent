# PowerShell script to start Expo - finds Node even if not in PATH
$npxPath = $null

# Check if npx is in PATH
try {
    $null = Get-Command npx -ErrorAction Stop
    Write-Host "Found npx in PATH"
    npx expo start
    exit
} catch { }

# Common Node.js locations
$paths = @(
    "C:\Program Files\nodejs\npx.cmd",
    "C:\Program Files (x86)\nodejs\npx.cmd",
    "$env:LOCALAPPDATA\Programs\node\npx.cmd",
    "$env:ProgramFiles\nodejs\npx.cmd"
)

foreach ($p in $paths) {
    if (Test-Path $p) {
        $npxPath = $p
        break
    }
}

# Check nvm
if (-not $npxPath -and (Test-Path "$env:APPDATA\nvm")) {
    $nvmDir = Get-ChildItem "$env:APPDATA\nvm" -Directory | Where-Object { $_.Name -match "^v\d" } | Sort-Object Name -Descending | Select-Object -First 1
    if ($nvmDir) {
        $npx = Join-Path $nvmDir.FullName "npx.cmd"
        if (Test-Path $npx) { $npxPath = $npx }
    }
}

if ($npxPath) {
    Write-Host "Found Node.js at: $npxPath"
    & $npxPath expo start
} else {
    Write-Host ""
    Write-Host "Node.js not found. Please install from https://nodejs.org" -ForegroundColor Yellow
    Write-Host "Check 'Add to PATH' during installation, then restart Cursor." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to close"
}

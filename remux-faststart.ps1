Param(
    [Parameter(Mandatory=$true)][string]$input
)

$ffmpeg = "ffmpeg"

# Check if ffmpeg is available
try {
    & $ffmpeg -version > $null 2>&1
} catch {
    Write-Error "ffmpeg tidak ditemukan. Install ffmpeg dan pastikan ada di PATH."
    exit 1
}

if (-not (Test-Path $input)) {
    Write-Error "File input tidak ditemukan: $input"
    exit 1
}

$dir = Split-Path -Parent $input
$base = [System.IO.Path]::GetFileNameWithoutExtension($input)
$ext = [System.IO.Path]::GetExtension($input)
$output = Join-Path $dir ("${base}_faststart${ext}")

Write-Output "Menjalankan: ffmpeg -i \"$input\" -c copy -movflags +faststart \"$output\""
& $ffmpeg -y -i $input -c copy -movflags +faststart $output

if ($LASTEXITCODE -eq 0) {
    Write-Output "Selesai. Output: $output"
} else {
    Write-Error "ffmpeg gagal (exit code $LASTEXITCODE)"
}

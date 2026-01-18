# Build script for gesture-wasm
# Requires: cargo, wasm-pack

Write-Host "Building gesture-wasm..." -ForegroundColor Cyan

# Build with wasm-pack targeting bundler (for Next.js)
wasm-pack build --target bundler --out-dir ../public/wasm

Write-Host "Build complete! Output in frontend/public/wasm" -ForegroundColor Green

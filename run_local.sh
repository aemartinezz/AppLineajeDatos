#!/bin/bash
set -e

echo "================================================================="
echo "  INICIANDO PLATAFORMA DE LINAJE END-TO-END DE FORMA LOCAL       "
echo "================================================================="

# Directorio raíz del proyecto
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BASE_DIR"

# 1. Ejecutar pruebas de sanidad iniciales
echo "[1/4] Ejecutando suite de pruebas locales en scriptsPrueba/..."
./venv/bin/python3 scriptsPrueba/run_all_tests.py

# 2. Iniciar Backend en segundo plano
echo "[2/4] Iniciando Backend FastAPI en http://localhost:8000..."
export USE_MOCK_GCP=true
export PORT=8000
./venv/bin/python3 backend/app/main.py &
BACKEND_PID=$!

# Trap para matar procesos al presionar Ctrl+C
trap "kill $BACKEND_PID 2>/dev/null || true; exit 0" SIGINT SIGTERM EXIT

# 3. Esperar a que el backend esté listo
echo "[3/4] Esperando a que el backend responda..."
sleep 2

# 4. Iniciar Frontend
echo "[4/4] Iniciando Frontend React en http://localhost:3000..."
cd "$BASE_DIR/frontend"
if [ ! -d "node_modules" ]; then
    echo "Instalando dependencias de frontend con npm..."
    npm install
fi
npm run dev -- --host 0.0.0.0 --port 3000

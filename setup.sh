#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Nexus IDE Workspace Initialization Script
# - Verifies Docker daemon availability
# - Starts FalkorDB container via Docker Compose
# - Creates backend virtual environment and installs dependencies
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
VENV_DIR="${BACKEND_DIR}/.venv"

# Ensure common Docker CLI paths on macOS are included in PATH
export PATH="${HOME}/.docker/bin:/Applications/Docker.app/Contents/Resources/bin:${PATH}"

echo "=========================================================="
echo "🚀 Initializing Nexus IDE Workspace"
echo "Root: ${ROOT_DIR}"
echo "=========================================================="

SKIP_DOCKER=false
for arg in "$@"; do
    if [ "$arg" = "--skip-docker" ]; then
        SKIP_DOCKER=true
    fi
done

if [ "$SKIP_DOCKER" = false ]; then
    # 1. Check Docker CLI
    echo "🔍 [1/3] Checking Docker installation..."
    if ! command -v docker >/dev/null 2>&1; then
        echo "❌ Error: 'docker' CLI is not installed or not in PATH."
        echo "💡 Please install Docker Desktop (or OrbStack) from https://www.docker.com/products/docker-desktop"
        echo "   or run './setup.sh --skip-docker' to only set up the Python environment."
        exit 1
    fi

    # 2. Check Docker Daemon
    echo "🔍 Checking Docker daemon status..."
    if ! docker info >/dev/null 2>&1; then
        echo "⚠️ Warning: Docker CLI is present, but Docker daemon is not active."
        echo "💡 Please start Docker Desktop or OrbStack, wait for it to boot, and re-run this script."
        exit 1
    fi
    echo "✅ Docker daemon is active and responsive."

    # 3. Start FalkorDB Container
    echo "🐳 [2/3] Launching FalkorDB service via Docker Compose..."
    if docker compose version >/dev/null 2>&1; then
        docker compose -f "${ROOT_DIR}/docker-compose.yml" up -d
    elif command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f "${ROOT_DIR}/docker-compose.yml" up -d
    else
        echo "❌ Error: Neither 'docker compose' nor 'docker-compose' was found."
        exit 1
    fi
    echo "✅ FalkorDB container 'nexus-falkordb' started on port 6379."
else
    echo "⏭️  Skipping Docker checks & container startup (--skip-docker flag provided)."
fi

# 4. Set up Python virtual environment
echo "🐍 [3/3] Setting up Python virtual environment in backend/.venv..."
PYTHON_BIN=""
for candidate in python3.12 python3.11 python3.10 python3; do
    if command -v "$candidate" >/dev/null 2>&1; then
        PYTHON_BIN="$candidate"
        break
    fi
done

if [ -z "$PYTHON_BIN" ]; then
    echo "❌ Error: Python 3 is required but not installed."
    exit 1
fi

echo "Using Python: $($PYTHON_BIN --version)"

VENV_PYTHON="${VENV_DIR}/bin/python"
VENV_PIP="${VENV_DIR}/bin/pip"

if [ ! -f "${VENV_PIP}" ]; then
    echo "Bootstrapping fresh virtualenv at ${VENV_DIR}..."
    rm -rf "${VENV_DIR}"
    "${PYTHON_BIN}" -m venv "${VENV_DIR}"
else
    echo "Virtual environment already exists at ${VENV_DIR}."
fi

echo "Upgrading pip and installing dependencies..."
"${VENV_PIP}" install --upgrade pip --quiet
"${VENV_PIP}" install -r "${BACKEND_DIR}/requirements.txt" --quiet

echo ""
echo "=========================================================="
echo "🎉 Nexus IDE setup completed successfully!"
echo "=========================================================="
echo "To run the backend:"
echo "  cd ${BACKEND_DIR}"
echo "  source .venv/bin/activate"
echo "  python main.py"
echo ""
echo "FalkorDB is accessible at localhost:6379"
echo "API docs available at: http://localhost:8000/docs"
echo "=========================================================="

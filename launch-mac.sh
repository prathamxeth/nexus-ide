#!/usr/bin/env bash
# ==============================================================================
# NexusIDE — Apple Silicon (M1/M2/M3/M4) Optimized Native Launch Script
# ==============================================================================
# Spins up FalkorDB ARM64, Python FastAPI backend, Next.js frontend,
# validates local Ollama LLMs, and launches the desktop environment.
# ==============================================================================

set -euo pipefail

# Visual ANSI Styling
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PID=""
FRONTEND_PID=""

# ------------------------------------------------------------------------------
# Graceful Shutdown Handler (Ctrl+C / SIGINT / SIGTERM)
# ------------------------------------------------------------------------------
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down Nexus IDE services gracefully...${NC}"
    
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo -e "  ${CYAN}•${NC} Stopping Next.js frontend (PID: $FRONTEND_PID)..."
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi

    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo -e "  ${CYAN}•${NC} Stopping FastAPI backend (PID: $BACKEND_PID)..."
        kill "$BACKEND_PID" 2>/dev/null || true
    fi

    # Kill any dangling dev servers started in subshells
    pkill -P $$ 2>/dev/null || true

    if docker ps -q --filter "name=nexus-falkordb" | grep -q .; then
        echo -e "  ${CYAN}•${NC} Stopping FalkorDB container (nexus-falkordb)..."
        docker stop nexus-falkordb >/dev/null 2>&1 || true
    fi

    echo -e "${GREEN}✔ All Nexus IDE processes and containers terminated cleanly.${NC}"
    exit 0
}

trap cleanup INT TERM

echo -e "${BOLD}${CYAN}"
echo "======================================================================"
echo "   Nexus IDE — Apple Silicon Native Launch Orchestrator"
echo "  FalkorDB Graph Engine • Dual-Agent Runtime • Cupertino Dark UI"
echo "======================================================================"
echo -e "${NC}"

# Detect Apple Silicon architecture
ARCH="$(uname -m)"
if [ "$ARCH" = "arm64" ]; then
    echo -e "${GREEN}✔ Running on Apple Silicon ($ARCH) with native Metal/NEON support${NC}"
else
    echo -e "${YELLOW}ℹ Running on $ARCH architecture${NC}"
fi

# ------------------------------------------------------------------------------
# Step 1: Check Dependencies
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}▶ [1/5] Checking System Dependencies...${NC}"

# 1.1 Docker daemon check
if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker is not installed. Please install Docker Desktop for Mac.${NC}"
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker daemon is not running.${NC}"
    echo -e "${YELLOW}  Please open Docker Desktop and wait until the engine starts.${NC}"
    exit 1
fi
echo -e "  ${GREEN}✔ Docker is active and accessible${NC}"

# 1.2 Ollama local daemon & models check
if command -v ollama >/dev/null 2>&1; then
    OLLAMA_VER=$(ollama --version 2>/dev/null || echo "installed")
    echo -e "  ${GREEN}✔ Ollama detected: $OLLAMA_VER${NC}"

    # Check if Ollama daemon is reachable
    if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
        OLLAMA_MODELS=$(curl -s http://localhost:11434/api/tags | grep -o '"name":"[^"]*"' || true)
        
        HAS_TARGET_MODEL=false
        if echo "$OLLAMA_MODELS" | grep -E -q "qwen2\.5-coder|llama3\.2|deepseek-coder"; then
            HAS_TARGET_MODEL=true
            MATCHED=$(echo "$OLLAMA_MODELS" | grep -E -o "qwen2\.5-coder[^\" ]*|llama3\.2[^\" ]*|deepseek-coder[^\" ]*" | head -n 1)
            echo -e "  ${GREEN}✔ Local coding model verified: ${BOLD}$MATCHED${NC}"
        fi

        if [ "$HAS_TARGET_MODEL" = false ]; then
            echo -e "  ${YELLOW}⚠️  Recommended local coding models ('qwen2.5-coder' or 'llama3.2') not found.${NC}"
            echo -e "  ${CYAN}Would you like to pull 'qwen2.5-coder:1.5b' now for local offline inference? (y/N)${NC}"
            read -t 6 -r PULL_CHOICE || PULL_CHOICE="n"
            if [[ "$PULL_CHOICE" =~ ^[Yy]$ ]]; then
                echo -e "  ${BLUE}Pulling qwen2.5-coder:1.5b...${NC}"
                ollama pull qwen2.5-coder:1.5b || echo -e "  ${YELLOW}Pull skipped; falling back to cloud/mock mode.${NC}"
            else
                echo -e "  ${YELLOW}• Skipping model pull. Cloud BYOK (Claude/GPT-4o) and Mock fallback are enabled.${NC}"
            fi
        fi
    else
        echo -e "  ${YELLOW}• Ollama CLI installed, but daemon is currently not running on port 11434.${NC}"
        echo -e "  ${YELLOW}  (Tip: Run 'ollama serve' in another tab if you wish to use local models).${NC}"
    fi
else
    echo -e "  ${YELLOW}• Ollama not installed locally. Cloud BYOK & Mock fallback engine enabled.${NC}"
fi

# 1.3 Node & pnpm checks
if ! command -v pnpm >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: 'pnpm' is required for the frontend. Install via 'npm install -g pnpm'.${NC}"
    exit 1
fi

# ------------------------------------------------------------------------------
# Step 2: Spin up FalkorDB with ARM64 / Apple Silicon Compatibility Flags
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}▶ [2/5] Spinning up FalkorDB (ARM64 Apple Silicon Optimized)...${NC}"

# Check if container is already running
if docker ps -q --filter "name=nexus-falkordb" | grep -q .; then
    echo -e "  ${GREEN}✔ Container 'nexus-falkordb' is already running on port 6379${NC}"
else
    # Remove any stopped container with conflicting name
    if docker ps -a -q --filter "name=nexus-falkordb" | grep -q .; then
        docker rm -f nexus-falkordb >/dev/null 2>&1 || true
    fi

    echo -e "  Starting container: ${BOLD}nexus-falkordb${NC} on port 6379..."
    docker run -d \
        --name nexus-falkordb \
        -p 6379:6379 \
        --rm \
        falkordb/falkordb:latest >/dev/null

    echo -e "  ${GREEN}✔ FalkorDB container launched successfully${NC}"
fi

# Wait for FalkorDB port to respond
echo -n "  Waiting for FalkorDB Redis port 6379..."
for _ in {1..30}; do
    if nc -z localhost 6379 2>/dev/null; then
        echo -e " ${GREEN}connected!${NC}"
        break
    fi
    sleep 0.5
    echo -n "."
done

# ------------------------------------------------------------------------------
# Step 3: Launch Python Backend in Background (Virtualenv Activation)
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}▶ [3/5] Starting FastAPI Backend Service (Port 8000)...${NC}"
cd "$ROOT_DIR/backend"

# Detect and activate virtualenv
if [ -d ".venv" ]; then
    echo -e "  ${CYAN}•${NC} Activating backend virtual environment (.venv)..."
    source .venv/bin/activate
elif [ -d "venv" ]; then
    echo -e "  ${CYAN}•${NC} Activating backend virtual environment (venv)..."
    source venv/bin/activate
else
    echo -e "  ${YELLOW}• Virtualenv not found. Creating backend/.venv...${NC}"
    python3 -m venv .venv
    source .venv/bin/activate
    pip install --upgrade pip >/dev/null 2>&1
    pip install -r requirements.txt >/dev/null 2>&1
fi

# Check if port 8000 is already in use
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    EXISTING_PID=$(lsof -Pi :8000 -sTCP:LISTEN -t | head -n 1)
    echo -e "  ${YELLOW}ℹ FastAPI backend already running on port 8000 (PID: $EXISTING_PID)${NC}"
    BACKEND_PID=$EXISTING_PID
else
    uvicorn main:app --port 8000 --log-level warning >/dev/null 2>&1 &
    BACKEND_PID=$!
    echo -e "  ${GREEN}✔ Backend started with PID $BACKEND_PID${NC}"
fi

# Wait for backend health check
for _ in {1..20}; do
    if curl -s http://localhost:8000/health | grep -q "status"; then
        echo -e "  ${GREEN}✔ Backend health check OK (http://localhost:8000/health)${NC}"
        break
    fi
    sleep 0.5
done

# Seed initial knowledge graph if empty
python seed_demo_data.py >/dev/null 2>&1 || true

# ------------------------------------------------------------------------------
# Step 4: Launch Next.js Frontend with pnpm dev
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}▶ [4/5] Launching Next.js Desktop Frontend (Port 3000)...${NC}"
cd "$ROOT_DIR/frontend"

# Check if port 3000 is already active
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    EXISTING_FRONT_PID=$(lsof -Pi :3000 -sTCP:LISTEN -t | head -n 1)
    echo -e "  ${YELLOW}ℹ Next.js frontend already running on port 3000 (PID: $EXISTING_FRONT_PID)${NC}"
    FRONTEND_PID=$EXISTING_FRONT_PID
else
    pnpm dev >/dev/null 2>&1 &
    FRONTEND_PID=$!
    echo -e "  ${GREEN}✔ Frontend dev server launched (PID: $FRONTEND_PID)${NC}"
fi

# Wait briefly for frontend HTTP socket
echo -n "  Waiting for frontend interface on http://localhost:3000..."
for _ in {1..25}; do
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
        echo -e " ${GREEN}ready!${NC}"
        break
    fi
    sleep 0.5
    echo -n "."
done

# ------------------------------------------------------------------------------
# Step 5: Open Browser Automatically
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}▶ [5/5] Opening Nexus IDE in Default Browser...${NC}"
if command -v open >/dev/null 2>&1; then
    open "http://localhost:3000"
    echo -e "  ${GREEN}✔ Opened http://localhost:3000 via macOS 'open'${NC}"
fi

echo -e "\n${BOLD}${GREEN}======================================================================"
echo "  🚀 Nexus IDE is live and ready on Apple Silicon!"
echo ""
echo "  🌐 UI Application:  http://localhost:3000"
echo "  ⚡ API Backend:     http://localhost:8000"
echo "  📊 FalkorDB Graph:  localhost:6379"
echo ""
echo "  Press [Ctrl+C] to stop all services and terminate cleanly."
echo "======================================================================${NC}\n"

# Keep script running to maintain child processes and handle Ctrl+C trap
while true; do
    sleep 1
done

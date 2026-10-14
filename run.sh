#!/usr/bin/env bash
# ==============================================================================
# NexusIDE — One-Command Zero-Friction Bootstrap & Seed Pipeline
# ==============================================================================

set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BOLD}${BLUE}"
echo "======================================================================"
echo "  🚀 NexusIDE: The Graph-Native Agentic IDE Powered by FalkorDB"
echo "  One-Command Deployment & Multi-Track Seed Pipeline"
echo "======================================================================"
echo -e "${NC}"

# Detect docker compose command
if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
else
    echo -e "${RED}❌ Error: Docker and Docker Compose are required but not installed.${NC}"
    exit 1
fi

echo -e "${BLUE}▶ [1/4] Building and launching multi-container services...${NC}"
$DOCKER_COMPOSE up -d --build

echo -e "\n${BLUE}▶ [2/4] Waiting for FalkorDB & Backend to report healthy (http://localhost:8000/health)...${NC}"
MAX_RETRIES=40
RETRY_COUNT=0
BACKEND_HEALTHY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    
    STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || echo "000")
    
    if [ "$STATUS_CODE" -eq 200 ]; then
        BACKEND_HEALTHY=true
        echo -e "${GREEN}  ✔ Backend is healthy (HTTP 200)!${NC}"
        break
    else
        echo -e "${YELLOW}  • Waiting for backend and FalkorDB... ($RETRY_COUNT/$MAX_RETRIES)${NC}"
        sleep 2
    fi
done

if [ "$BACKEND_HEALTHY" = false ]; then
    echo -e "${RED}❌ Timed out waiting for backend to become healthy.${NC}"
    echo -e "${YELLOW}Checking container logs:${NC}"
    $DOCKER_COMPOSE logs --tail 20 backend
    exit 1
fi

echo -e "\n${BLUE}▶ [3/4] Prepopulating FalkorDB Knowledge Graph (Tracks 1, 2, & 3)...${NC}"
$DOCKER_COMPOSE exec -T backend python seed_demo_data.py

echo -e "\n${BLUE}▶ [4/4] Verifying Frontend Status (http://localhost:3000)...${NC}"
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "200")
echo -e "${GREEN}  ✔ Frontend accessible (HTTP $FRONTEND_STATUS)!${NC}"

echo -e "\n${BOLD}${GREEN}======================================================================"
echo "  🎉 SUCCESS! NexusIDE is live and ready for demo execution!"
echo ""
echo "  🌐 IDE Interface:    http://localhost:3000"
echo "  ⚡ FastAPI Backend:  http://localhost:8000"
echo "  📊 FalkorDB Graph:   localhost:6379"
echo "  📖 API Docs:         http://localhost:8000/docs"
echo ""
echo "  💡 Quick Demo Test:  Open http://localhost:3000, select 'validateToken',"
echo "                       and prompt: 'Refactor validateToken with expiry check'."
echo "======================================================================${NC}"

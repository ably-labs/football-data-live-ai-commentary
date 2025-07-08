#!/bin/bash

# Comprehensive pre-deployment check script

echo "🔍 Running pre-deployment checks..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Function to check command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check required tools
echo "📋 Checking required tools..."
if ! command_exists pnpm; then
    echo -e "${RED}❌ pnpm is not installed${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ pnpm is installed${NC}"
fi

if ! command_exists docker; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ Docker is installed${NC}"
fi

if ! command_exists fly; then
    echo -e "${YELLOW}⚠️  Fly CLI is not installed (optional for local testing)${NC}"
else
    echo -e "${GREEN}✅ Fly CLI is installed${NC}"
fi

echo ""

# Check environment files
echo "📋 Checking environment files..."
if [ -f ".env.local" ]; then
    echo -e "${GREEN}✅ .env.local exists${NC}"
    
    # Check for required env vars
    REQUIRED_VARS=("ABLY_API_KEY" "OPEN_AI_API_KEY" "JWT_SECRET")
    for var in "${REQUIRED_VARS[@]}"; do
        if grep -q "^${var}=" .env.local; then
            echo -e "${GREEN}   ✓ ${var} is set${NC}"
        else
            echo -e "${RED}   ✗ ${var} is missing${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    done
else
    echo -e "${RED}❌ .env.local is missing${NC}"
    ERRORS=$((ERRORS + 1))
fi

if [ -f ".env.example" ]; then
    echo -e "${GREEN}✅ .env.example exists${NC}"
else
    echo -e "${YELLOW}⚠️  .env.example is missing (recommended)${NC}"
fi

echo ""

# Check if node_modules are installed
echo "📋 Checking dependencies..."
if [ -d "node_modules" ] && [ -d "client/node_modules" ] && [ -d "server/node_modules" ]; then
    echo -e "${GREEN}✅ Dependencies are installed${NC}"
else
    echo -e "${YELLOW}⚠️  Some dependencies are missing. Running pnpm install...${NC}"
    pnpm install
fi

echo ""

# Run TypeScript checks
echo "📋 Running TypeScript checks..."
echo "   Client TypeScript check..."
if (cd client && npx tsc --noEmit) 2>/dev/null; then
    echo -e "${GREEN}   ✅ Client TypeScript check passed${NC}"
else
    echo -e "${RED}   ❌ Client TypeScript errors found${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo "   Server TypeScript check..."
if (cd server && npx tsc --noEmit) 2>/dev/null; then
    echo -e "${GREEN}   ✅ Server TypeScript check passed${NC}"
else
    echo -e "${RED}   ❌ Server TypeScript errors found${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Test builds
echo "📋 Testing builds..."
echo "   Testing client build..."
if pnpm run build:client > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Client build successful${NC}"
else
    echo -e "${RED}   ❌ Client build failed${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo "   Testing server build..."
if pnpm run build:server > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Server build successful${NC}"
else
    echo -e "${RED}   ❌ Server build failed${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Check required directories
echo "📋 Checking required directories..."
REQUIRED_DIRS=("server/data" "server/prompts" "client/public/images")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✅ $dir exists${NC}"
    else
        echo -e "${RED}❌ $dir is missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""

# Test Docker build
echo "📋 Testing Docker build..."
if docker build -t pre-deploy-test . > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Docker build successful${NC}"
    # Clean up test image
    docker rmi pre-deploy-test > /dev/null 2>&1
else
    echo -e "${RED}❌ Docker build failed${NC}"
    echo "   Run './scripts/test-docker-build.sh' for detailed error messages"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "========================================"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Ready to deploy.${NC}"
    echo ""
    echo "To deploy to Fly.io, run: fly deploy"
else
    echo -e "${RED}❌ Found $ERRORS error(s). Please fix them before deploying.${NC}"
    exit 1
fi
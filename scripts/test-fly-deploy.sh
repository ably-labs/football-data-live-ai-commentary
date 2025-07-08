#!/bin/bash

# Script to simulate Fly.io deployment locally

echo "🚀 Simulating Fly.io deployment..."
echo ""

# Build the Docker image with same settings as Fly
echo "📦 Building Docker image (simulating Fly build)..."
docker build -t fly-deploy-test . || {
    echo "❌ Docker build failed!"
    exit 1
}

echo ""
echo "✅ Build successful!"
echo ""

# Test the production start command
echo "🧪 Testing production start command..."
docker run --rm \
    --name fly-deploy-test-container \
    -p 3001:3001 \
    --env-file .env.local \
    fly-deploy-test \
    pnpm start &

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 5

# Test health endpoint
echo "🏥 Testing health endpoint..."
if curl -s http://localhost:3001/api/health | grep -q "ok"; then
    echo "✅ Health check passed!"
else
    echo "❌ Health check failed!"
fi

# Cleanup
echo ""
echo "🧹 Cleaning up..."
docker stop fly-deploy-test-container 2>/dev/null
docker rm fly-deploy-test-container 2>/dev/null

echo ""
echo "✅ Fly deployment simulation complete!"
echo ""
echo "If all checks passed, you can deploy with: fly deploy"
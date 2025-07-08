#!/bin/bash

# Script to test Docker build locally before deploying to Fly.io

echo "🔨 Testing Docker build locally..."
echo ""

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t football-commentary-test . || {
    echo "❌ Docker build failed!"
    exit 1
}

echo ""
echo "✅ Docker build successful!"
echo ""

# Optional: Run the container to test
read -p "Would you like to run the container locally? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "🚀 Starting container..."
    echo "   Note: Make sure you have a .env.local file with required environment variables"
    echo ""
    
    # Stop any existing container
    docker stop football-commentary-test-container 2>/dev/null
    docker rm football-commentary-test-container 2>/dev/null
    
    # Run the container
    docker run -d \
        --name football-commentary-test-container \
        -p 3001:3001 \
        --env-file .env.local \
        football-commentary-test
    
    echo "🎉 Container is running!"
    echo "   Access the app at: http://localhost:3001"
    echo "   View logs: docker logs -f football-commentary-test-container"
    echo "   Stop container: docker stop football-commentary-test-container"
fi
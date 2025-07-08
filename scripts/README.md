# Deployment Scripts

This folder contains helpful scripts for testing and deploying the application.

## Available Scripts

### `pre-deploy-check.sh`
Runs a comprehensive set of checks before deployment:
- Verifies all required tools are installed
- Checks environment variables
- Runs TypeScript type checking
- Tests both client and server builds
- Validates Docker build
- Ensures all required directories exist

Run this before deploying to catch any issues early:
```bash
./scripts/pre-deploy-check.sh
```

### `test-docker-build.sh`
Tests the Docker build locally and optionally runs the container:
```bash
./scripts/test-docker-build.sh
```

This helps verify that the Docker build will work on Fly.io before actually deploying.

### `test-fly-deploy.sh`
Simulates a Fly.io deployment locally:
- Builds the Docker image with production settings
- Runs the container with the production start command
- Tests the health endpoint
- Provides feedback on deployment readiness

```bash
./scripts/test-fly-deploy.sh
```

## Deployment Workflow

1. Run pre-deployment checks:
   ```bash
   ./scripts/pre-deploy-check.sh
   ```

2. If all checks pass, deploy to Fly.io:
   ```bash
   fly deploy
   ```

3. If you encounter issues, use the test-docker-build script to debug:
   ```bash
   ./scripts/test-docker-build.sh
   ```
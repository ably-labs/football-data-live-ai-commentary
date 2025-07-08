# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build client and server
RUN pnpm run build

# Production stage
FROM node:20-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built server
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/data ./server/data
COPY --from=builder /app/server/prompts ./server/prompts

# Copy built client
COPY --from=builder /app/client/dist ./client/dist

# Copy env example (NOT .env.local which contains secrets)
COPY .env.example ./

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["pnpm", "start"]
# Multi-stage build for TypeScript application
# Stage 1: Build stage
FROM node:21-slim AS builder

# Set memory limit for TypeScript compiler
ENV NODE_OPTIONS="--max-old-space-size=1536"

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy source code and build scripts
COPY src ./src
COPY scripts ./scripts

# Build TypeScript
RUN npm run build

# Stage 2: Production stage  
FROM node:21-slim

# Update CA certificates for Google API calls
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies AND ts-node (required by start script)
RUN npm ci --only=production && \
    npm install ts-node typescript @types/node

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy source files (required by ts-node)
COPY --from=builder /app/src ./src

# Copy tsconfig for ts-node
COPY tsconfig.json ./

# Expose port
EXPOSE 3000

# Use the existing start script that uses ts-node
CMD ["npm", "run", "start"]

# Use Node.js 20
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Create .env file with build-time environment variables
# Railway provides these as environment variables during build
RUN echo "VITE_FACEBOOK_APP_ID=${VITE_FACEBOOK_APP_ID}" > .env && \
    echo "VITE_FACEBOOK_APP_SECRET=${VITE_FACEBOOK_APP_SECRET}" >> .env && \
    echo "VITE_OPENAI_API_KEY=${VITE_OPENAI_API_KEY}" >> .env

# Build the app (Vite will read from .env file)
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --production

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Copy server, routes, lib, and prompts
COPY server.js ./
COPY routes ./routes
COPY lib ./lib
COPY prompts ./prompts
COPY data ./data

# Expose port
EXPOSE 8080

# Start the server
CMD ["npm", "start"]

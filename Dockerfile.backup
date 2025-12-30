# Use Node.js 20
FROM node:20-alpine AS builder

# Declare build arguments - Railway will pass these automatically
ARG VITE_FACEBOOK_APP_ID
ARG VITE_FACEBOOK_APP_SECRET
ARG VITE_OPENAI_API_KEY

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Create .env file with build arguments
# If ARGs are empty, this will create empty values (which is the problem)
# So we add a debug step
RUN echo "DEBUG: Building with env vars:" && \
    echo "VITE_FACEBOOK_APP_ID=${VITE_FACEBOOK_APP_ID}" && \
    echo "VITE_FACEBOOK_APP_ID=${VITE_FACEBOOK_APP_ID}" > .env && \
    echo "VITE_FACEBOOK_APP_SECRET=${VITE_FACEBOOK_APP_SECRET}" >> .env && \
    echo "VITE_OPENAI_API_KEY=${VITE_OPENAI_API_KEY}" >> .env && \
    cat .env

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

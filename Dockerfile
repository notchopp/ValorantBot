FROM node:20-alpine

WORKDIR /app

# Install Chromium for Puppeteer profile rendering
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for TypeScript build)
RUN npm ci

# Copy source files
COPY . .

# Build TypeScript
RUN npm run build

# Remove devDependencies to reduce image size
RUN npm prune --production

# Configure Puppeteer to use system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Expose port for Fly.io health checks
EXPOSE 8080

# Start the bot
CMD ["npm", "start"]

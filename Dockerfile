FROM node:20-alpine

WORKDIR /app

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

# Expose port for Fly.io health checks
EXPOSE 8080

# Start the bot
CMD ["npm", "start"]

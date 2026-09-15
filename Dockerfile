FROM node:22-alpine

WORKDIR /app

# Copy package descriptors and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application files
COPY . .

# Expose default port
EXPOSE 3000

# Start production server
CMD ["node", "src/server.js"]

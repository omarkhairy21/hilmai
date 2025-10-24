FROM node:20.9.0

WORKDIR /app

# Copy package files
COPY package*.json package-lock.json ./

# Install dependencies (with clean install to avoid version conflicts)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose Mastra server port
EXPOSE 4111

# Start the application
CMD ["npm", "run", "start"]

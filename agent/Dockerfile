FROM node:20

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose Mastra server port
EXPOSE 4111

# Start the application
CMD ["npm", "run", "start"]

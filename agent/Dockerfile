FROM node:22

WORKDIR /app

# Enable corepack for yarn
RUN corepack enable

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies using yarn
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN yarn build

# Expose Mastra server port
EXPOSE 4111

# Set environment to production
ENV NODE_ENV=production

# Start the application
CMD ["yarn", "start"]

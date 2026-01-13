# Use the official Node.js image as a base
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Add package files first for better caching
COPY package*.json ./

# Install dependencies in a single layer
RUN npm install \
    react react-dom next \
    next-auth @next-auth/prisma-adapter @prisma/client \
    isomorphic-ws \
    react-icons react-loader-spinner \
    react-dropzone react-hook-form \
    react-audio-voice-recorder \
    dotenv \
    @types/websocket \
    @types/react \
    eslint \
    eslint-config-next \
    typescript \
    @types/node \
    autoprefixer \
    postcss \
    tailwindcss

# Copy the entire project directory
COPY . .

# Basic environment setup
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# Expose port
EXPOSE 3000

# Start development server
CMD ["npm", "run", "dev"]

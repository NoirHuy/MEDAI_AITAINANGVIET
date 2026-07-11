# ---- BUILD STAGE ----
FROM node:24-alpine AS build
WORKDIR /app

# Copy package files for both root (frontend) and back_end
COPY package*.json ./
RUN npm ci

COPY back_end/package*.json ./back_end/
RUN cd back_end && npm ci --omit=dev

# Copy entire source
COPY . .

# Set VITE_API_URL to empty to enforce relative paths (single-origin)
ENV VITE_API_URL=""
ENV NODE_ENV=production

# Build frontend static files to /app/dist
RUN npm run build

# ---- RUNTIME STAGE ----
FROM node:24-alpine
WORKDIR /app

# Copy built frontend assets
COPY --from=build /app/dist ./dist

# Copy backend source and dependencies
COPY --from=build /app/back_end ./back_end

# Set environment
ENV NODE_ENV=production
# Hugging Face Spaces listens on port 7860 by default
ENV PORT=7860
EXPOSE 7860

# Run Node.js backend
CMD ["node", "back_end/src/server.js"]

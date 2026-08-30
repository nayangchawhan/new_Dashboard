FROM node:20-alpine

WORKDIR /app

# Install dependencies first for Docker caching
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source code
COPY . .

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

CMD ["node", "src/server.js"]

FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
RUN npm ci

COPY . .
RUN npm run build --workspace client

EXPOSE 5000
CMD ["npm", "run", "start", "--workspace", "server"]

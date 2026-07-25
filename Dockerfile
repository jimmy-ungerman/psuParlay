# Stage 1: build the React frontend
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json .
RUN npm install
COPY vite.config.js postcss.config.js ./
COPY client ./client
COPY public ./public
RUN npm run build
RUN npm prune --production

# Stage 2: lean runtime image
FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY src ./src
COPY package.json .
EXPOSE 3001
CMD ["node", "src/index.js"]

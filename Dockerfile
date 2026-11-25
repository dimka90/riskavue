FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY app ./app
COPY server ./server
COPY shared ./shared
COPY scripts ./scripts
RUN npm run build
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 DATA_DIR=/data
EXPOSE 3001
CMD ["npm","start"]

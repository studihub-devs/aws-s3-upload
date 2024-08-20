FROM node:18-alpine AS builder
WORKDIR /app
ADD package.json /app/
COPY . /app

RUN npm install && npm run build

FROM node:18-alpine
EXPOSE 5000
WORKDIR /app
COPY package.json package-lock.json /app/

RUN npm install husky -g &&  npm i --force --only=production
COPY --from=builder /app/dist ./dist

CMD node --max-old-space-size=4096 dist/server.js
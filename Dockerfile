# syntax=docker/dockerfile:1

FROM node:16.7.0

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./

RUN npm install --production

RUN npm install -g forever

COPY . .

# CMD [ "forever", "start", "index.js" ]
CMD [ "node", "index.js" ]
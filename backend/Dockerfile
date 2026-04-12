# --- BASE STAGE ---
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install

# --- DEVELOPMENT STAGE (Target: dev) ---
FROM base as dev
RUN npm install -g nodemon
COPY . .
# AUTOMATISMO: Qui forziamo development
ENV NODE_ENV=development
EXPOSE 3000
CMD ["nodemon", "server.js"]

# --- PRODUCTION STAGE (Target: prod) ---
FROM base as prod
COPY . .
# AUTOMATISMO: Qui forziamo production
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]

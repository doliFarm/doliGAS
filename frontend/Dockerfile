# --- BASE STAGE ---
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install

# --- DEVELOPMENT STAGE (Target: dev) ---
FROM base as dev
COPY . .
# Vite userà questa variabile
ENV NODE_ENV=development
EXPOSE 80
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "80"]

# --- BUILD STAGE ---
FROM base as build
COPY . .
RUN npm run build

# --- PRODUCTION STAGE (Target: prod) ---
FROM nginx:alpine as prod
COPY --from=build /app/dist /usr/share/nginx/html
# Nginx è solo server statico, NODE_ENV qui non serve a runtime ma è buona norma
ENV NODE_ENV=production
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

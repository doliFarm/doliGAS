# --- BASE STAGE ---
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install

# --- DEVELOPMENT STAGE (Target: dev) ---
FROM base as dev
COPY . .
# Vite will use this variable
ENV NODE_ENV=development
EXPOSE 80
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "80"]

# --- BUILD STAGE ---
FROM base as build
# VITE_* variables are read by Vite at build time: in the prod target the result
# is static, so they must arrive here as build args (not at runtime)
ARG VITE_API_URL
ARG VITE_APP_ENV
ARG VITE_DEMO_MODE
COPY . .
RUN npm run build

# --- PRODUCTION STAGE (Target: prod) ---
FROM nginx:alpine as prod
COPY --from=build /app/dist /usr/share/nginx/html
# Nginx only serves static files: NODE_ENV is not needed at runtime, but it is good practice
ENV NODE_ENV=production
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

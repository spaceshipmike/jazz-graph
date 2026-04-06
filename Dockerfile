FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_SPOTIFY_CLIENT_ID=""
ENV VITE_SPOTIFY_CLIENT_ID=$VITE_SPOTIFY_CLIENT_ID
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Remove default nginx config that conflicts
RUN rm -f /etc/nginx/conf.d/default.conf.bak
EXPOSE 80

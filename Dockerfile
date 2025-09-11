# Stage 1: Build Angular
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files first (for caching)
COPY package*.json ./

# Install dependencies (use legacy-peer-deps)
RUN npm install --legacy-peer-deps

# Copy rest of the source code
COPY . .

# Build Angular production
RUN npm run build -- --configuration production

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Remove default nginx html
RUN rm -rf /usr/share/nginx/html/*

# Copy Angular build from previous stage
COPY --from=build /app/dist/angular-workstation /usr/share/nginx/html

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

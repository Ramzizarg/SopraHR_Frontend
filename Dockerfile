# Étape 1 : Build Angular
FROM node:18-alpine AS build

WORKDIR /app

# Copier package.json et package-lock.json
COPY package*.json ./

# Upgrade npm and install dependencies
RUN npm install -g npm@11.6.0
RUN npm install --legacy-peer-deps

# Copier le reste du code
COPY . .

# Build Angular en production
RUN npm run build -- --configuration production

# Étape 2 : Serveur Nginx
FROM nginx:alpine

# Supprimer contenu par défaut
RUN rm -rf /usr/share/nginx/html/*

# Copier build Angular
COPY --from=build /app/dist/angular-workstation /usr/share/nginx/html

# Exposer le port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

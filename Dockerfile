
# Utiliser une image Node officielle comme base
FROM node:18-alpine

# Définir le répertoire de travail dans le conteneur
WORKDIR /app

# Copier les fichiers package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier le reste des fichiers du projet
COPY . .

# Exposer le port sur lequel l'API Gateway va tourner
EXPOSE 8000

# Commande pour démarrer l'API Gateway
CMD ["npm", "start"]

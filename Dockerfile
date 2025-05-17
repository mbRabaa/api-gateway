# Utilise une image Node.js légère basée sur Alpine Linux (version 18)
# Alpine est recommandé pour les images de production (taille réduite)
FROM node:18-alpine

# Définit le répertoire de travail dans le conteneur
# Toutes les commandes suivantes seront exécutées depuis ce dossier
WORKDIR /app

# Étape 1 : Copie des fichiers de dépendances (optimisation du cache Docker)
# On copie d'abord uniquement package.json et package-lock.json
# Cela permet de ne pas réinstaller les dépendances si seul le code change
COPY package*.json ./

# Étape 2 : Installation des dépendances
# npm install installe toutes les dépendances listées dans package.json
# (Inclut les dépendances de développement dans ce cas)
RUN npm install

# Étape 3 : Copie du reste de l'application
# Maintenant qu'on a installé les dépendances, on copie tout le code source
COPY . .

# Définit une variable d'environnement pour le port
# Peut être surchargée à l'exécution via -e PORT=...
ENV PORT=8000

# Documente le port que l'application utilise
# (N'a pas d'effet fonctionnel, purement informatif)
EXPOSE 8000

# Commande de démarrage de l'application
# Lance le serveur Node.js avec votre fichier principal
CMD ["node", "server.js"]
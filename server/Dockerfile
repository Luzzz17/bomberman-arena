# 1. Image de base officielle Node.js 22 alpine (légère et sécurisée)
FROM node:22-alpine

# 2. Répertoire de travail de l'application
WORKDIR /app

# 3. Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=3000

# 4. Copie des descripteurs de dépendances avec les bons droits
COPY --chown=node:node package.json package-lock.json ./

# 5. Installation stricte des dépendances de production uniquement
RUN npm ci --omit=dev

# 6. Copie du code source du serveur avec les bons droits
COPY --chown=node:node src ./src

# 7. Utilisation de l'utilisateur non-root pour respecter les standards de sécurité
USER node

# 8. Exposition du port réseau WebSocket
EXPOSE 3000

# 9. Commande de démarrage du serveur
CMD ["node", "src/index.js"]

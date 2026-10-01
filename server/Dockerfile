# 1. Image de base officielle Node.js 22 alpine (légère et sécurisée)
FROM node:22-alpine

# 2. Répertoire de travail racine du monorepo
WORKDIR /app

# 3. Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=3000

# 4. Copie des descripteurs de dépendances du serveur
COPY --chown=node:node server/package.json server/package-lock.json ./server/

# 5. Installation stricte des dépendances de production uniquement
WORKDIR /app/server
RUN npm ci --omit=dev

# 6. Copie des codes sources du serveur et du dossier partagé (protocole WebSocket)
WORKDIR /app
COPY --chown=node:node server/src ./server/src
COPY --chown=node:node shared ./shared

# 7. Utilisation de l'utilisateur non-root pour respecter les standards de sécurité
USER node

# 8. Répertoire d'exécution du serveur
WORKDIR /app/server

# 9. Exposition du port réseau WebSocket
EXPOSE 3000

# 10. Commande de démarrage du serveur
CMD ["node", "src/index.js"]

# Bomberman Arena

Jeu multijoueur en réseau inspiré de Bomberman, développé en BUT 3 Informatique (Qualité de Développement - UPJV).

Le projet adopte une architecture Client-Serveur stricte au sein d'un monorepo :
- **Serveur (`server/`)** : Moteur de jeu et serveur WebSocket en Node.js (Socket.io).
- **Client (`client/`)** : Application de bureau hybride en Electron et TypeScript.
- **Partagé (`shared/`)** : Définition partagée du protocole réseau et constantes d'échanges.

---

## 📋 Prérequis

- **Node.js** : version 22 ou supérieure
- **npm** : version 10 ou supérieure
- **Docker** et **Docker Compose** (pour l'exécution conteneurisée du serveur)

---

## 🚀 Lancement du projet

### 1. Démarrer le Serveur (Backend)

Le serveur s'exécute dans un conteneur Docker isolé :

```bash
# Démarrer le conteneur serveur en tâche de fond
docker compose up --build -d

# Consulter les logs du serveur
docker compose logs -f server

# Arrêter le conteneur
docker compose down
```

Le serveur écoute sur le port **3000** (`http://localhost:3000`).

*(En développement local sans Docker : `cd server && npm ci && npm run dev`)*

---

### 2. Démarrer le Client (Frontend)

Le client Electron s'exécute directement sur votre machine hôte :

```bash
# Se placer dans le répertoire client
cd client

# Installer les dépendances
npm ci

# Compiler et lancer l'application de bureau
npm start
```

---

## 🧪 Tests et Vérifications

```bash
# Tests unitaires et d'intégration du serveur
npm --prefix server test

# Tests du client
npm --prefix client test

# Vérification du style de code (Linter)
npm --prefix server run lint
npm --prefix client run lint

# Vérification du typage TypeScript
npm --prefix client run typecheck
```

---

## 📚 Documentation Technique

- Protocole de communication WebSocket : [`docs/protocol.md`](docs/protocol.md)

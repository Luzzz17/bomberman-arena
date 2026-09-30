# Serveur Bomberman Arena

Serveur de jeu Node.js basé sur socket.io. Il accepte les connexions WebSocket des clients. La logique de partie et le protocole définitif ne sont pas encore implémentés.

## Lancer le serveur

Prérequis : Node.js 20 ou plus récent et npm.

```bash
cd server
npm ci
npm run dev
```

Le serveur écoute sur le port `3000`, modifiable avec la variable d'environnement `PORT`. `npm run dev` relance le serveur à chaque modification, `npm start` le lance sans rechargement.

À chaque connexion, le serveur affiche `Client connecté : <id>` et envoie au client l'événement provisoire `server:welcome` avec `{ id }`.

## Vérifications

```bash
npm run lint
npm test
```

## Organisation

- `src/index.js` : point d'entrée, lecture du port ;
- `src/network/server.js` : démarrage de socket.io et gestion des connexions ;
- `tests/` : tests Vitest.

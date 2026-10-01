# Client Bomberman Arena

Client de bureau Electron en TypeScript. L'accueil cartoon permet de se connecter au serveur Socket.IO, de vérifier la version du protocole et de se déconnecter. Le lobby et le jeu ne sont pas encore branchés.

## Lancer le client

Prérequis : Node.js 22.12 ou plus récent et npm. Depuis la racine du dépôt :

```bash
cd client
npm ci
npm start
```

`npm start` compile le processus principal et le renderer, copie le HTML/CSS dans `dist/`, puis ouvre Electron en plein écran. Si le binaire Electron manque après l'installation : `node node_modules/electron/install.js`.

## Essayer la connexion

Dans un autre terminal, lancer le backend selon `server/README.md` (`npm ci`, puis `npm start` depuis `server/`).

1. Garder `http://localhost:3000` dans le client si le serveur tourne sur le même ordinateur.
2. Cliquer sur **Se connecter**. L'état connecté apparaît uniquement après réception d'un `server:welcome` valide, avec une version égale à `PROTOCOL_VERSION`.
3. Cliquer sur **Se déconnecter**, ou arrêter le serveur pour observer l'erreur et réessayer.

Sur deux ordinateurs du même réseau, saisir l'adresse du serveur, par exemple `http://192.168.1.20:3000`. Le port doit être accessible. L'adresse doit être une origine HTTP(S), sans chemin, identifiants, paramètres ni fragment.

La connexion utilise exclusivement WebSocket via Socket.IO. Le délai de confirmation est de cinq secondes ; la reconnexion est manuelle. La politique `connect-src` autorise `ws:` et `wss:` pour les adresses choisies par l'utilisateur ; les scripts restent limités aux fichiers de l'application.

## Architecture

```text
Vue HTML → intentions du bus → coordinateur → adaptateur Socket.IO → serveur
Vue HTML ← état de session ← coordinateur ← observations de l'adaptateur
```

- `src/main.ts` : fenêtre Electron sécurisée.
- `src/renderer.ts` : assemblage des composants et nettoyage à la fermeture.
- `src/core/event-bus.ts` : publication et abonnements typés.
- `src/session/` : état de connexion et coordination ; identité supprimée à la déconnexion.
- `src/network/socket-client.ts` : transport, validation de la bienvenue et gestion des délais/erreurs.
- `src/ui/connection-view.ts` : formulaire et affichage, sans import Socket.IO.
- `../shared/index.js` : constantes partagées importées sans recopier les noms réseau. TypeScript lit les sources JavaScript grâce à `allowJs`.
- `scripts/build.mjs` : bundles Electron et navigateur ; le renderer embarque ses dépendances sans exposer Node.js à la page.

Le contrat de transport pourra accueillir un adaptateur mock ; aucun mock de jeu ni gestionnaire de lobby n'est livré ici.

## Vérifications

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Les tests couvrent le bus, les états du formulaire et la connexion à des serveurs Socket.IO locaux éphémères : bienvenue, version incompatible, données invalides, expiration du délai, indisponibilité, perte de connexion et nouvelles tentatives. Ils nécessitent l'autorisation d'ouvrir des ports locaux. Aucun serveur lancé manuellement n'est nécessaire pour les tests.

`socket.io` et `happy-dom` sont des dépendances de test uniquement ; le renderer embarque `socket.io-client`.

# Client Bomberman Arena

Squelette du client de bureau Electron en TypeScript. Il ouvre une fenêtre en plein écran sur un accueil statique. Le jeu et la connexion au serveur ne sont pas encore implémentés.

## Lancer le client

Prérequis : Node.js 22.12 ou plus récent et npm.

```bash
cd client
npm ci
npm start
```

`npm start` compile le processus principal dans `dist/`, copie la page HTML et sa feuille de style, puis ouvre Electron.

Si l'installation npm n'a pas téléchargé le binaire Electron, exécuter `node node_modules/electron/install.js` puis relancer `npm start`.

## Vérifications

```bash
npm run typecheck
npm run lint
npm test -- --passWithNoTests
npm run build
```

Le script de test est conservé pour le pipeline CI. Aucune suite frontend n'est encore définie pour ce squelette. L'option `--passWithNoTests` évite un échec tant qu'il n'y a aucun test.

## Organisation

- `src/main.ts` : fenêtre Electron ;
- `src/index.html` et `src/styles.css` : accueil statique ;
- `scripts/build.mjs` : compilation du processus principal et copie des fichiers d'interface.

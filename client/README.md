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

## Jalon 2 : deux lots frontend

Le jalon 1 (Electron, accueil, bus, connexion et tests associés) est conservé. Le lot livré ici couvre uniquement le rendu ; le jalon 2 complet exige encore le raccordement et le moteur backend.

| Lot | Responsable | Travail et tests |
|---|---|---|
| A : affichage | Jay | Vue PixiJS, grille et obstacles, positions des joueurs, apparition/retrait des bombes depuis des observations, dimensionnement, ressources graphiques et tests du rendu |
| B : interaction et synchronisation | Binôme frontend | Intentions clavier, envoi via Socket.IO, validation des états reçus, coordination du montage et de la déconnexion, raccordement au bus et à Electron, tests des commandes et du réseau |

Le lot B reste à développer : les anciens modules clavier, liaison au bus et contrat d'événements de gameplay ont été retirés. Aucun calcul de déplacement autorisé, collision, pose autorisée ou durée de vie des bombes ne se fait dans la vue. Ces décisions et les tests unitaires du moteur appartiennent au backend.

### Tester le lot A sans serveur

Depuis `client/` :

```bash
npm run arena:preview
```

Ouvrir l'adresse affichée, normalement `http://127.0.0.1:4173`. Les boutons permettent de vérifier les positions de départ, les positions actualisées, l'apparition de deux bombes et leur retrait. **Vider** efface l'affichage ; sélectionner un état l'affiche à nouveau. Aucune touche de jeu n'est implémentée dans ce lot. `Ctrl+C` arrête l'aperçu.

Les états sont fixes, sans simulation ni connexion réseau. Cet outil vérifie le rendu, sans constituer le mode mock complet prévu au jalon 3 ni démontrer la synchronisation entre deux clients. Le parcours `npm start` reste l'accueil du jalon 1.

Les fichiers `dev/` sont compilés dans `dist/arena-preview/`, hors du bundle de l'accueil. Relancer l'aperçu après `npm run build` (qui nettoie `dist/`) ou après une modification HTML/CSS. Les modifications TypeScript sont recompilées automatiquement ; recharger le navigateur.

### Interface à utiliser par le binôme

- `src/arena/types.ts` : `ArenaSnapshot`, limité à `grid`, `players`, `bombs` de `StatePayload` dans `shared/index.js`.
- `src/arena/view.ts` : `createArenaView(host, playerId, signal?)` et `ArenaView`.
- `src/arena/scene.ts` : objets graphiques conservés par ID et rendu des observations.
- `src/arena/textures.ts` et `artwork.ts` : chargement, découpage et sprites.

`createArenaView` est asynchrone. Le conteneur doit avoir une largeur et une hauteur ; l'identité vient de la bienvenue serveur. Le rendu attend des observations déjà validées par le transport et le coordinateur.

```ts
import { createArenaView } from './arena/view';
import type { StartPayload, StatePayload } from '../../shared/index.js';

const view = await createArenaView(host, playerId, signal);

// Après validation du démarrage par le coordinateur :
function showStart(start: StartPayload): void {
  view.setSnapshot({ grid: start.grid, players: start.players, bombs: [] });
  view.focus();
}

// Après validation de chaque état par le coordinateur :
function showState(state: StatePayload): void {
  view.setSnapshot(state);
}

// À la sortie de partie ou à la déconnexion :
view.destroy();
```

Cet extrait décrit l'API, pas un raccordement livré. Le binôme doit organiser les abonnements au bus : conserver le démarrage et le dernier état reçu pendant le montage, les présenter dans cet ordre, filtrer les ticks anciens et les états hors partie, puis nettoyer les abonnements et les contrôles à l'arrêt. Une annulation via `signal` détruit également le montage. Une nouvelle identité nécessite une nouvelle vue.

La vue propose `element` (canvas focalisable), `setSnapshot`, `clear`, `focus` et `destroy`. `clear` conserve les textures pour réutiliser la vue ; `destroy` libère le canvas, les images et le GPU. Elle ne décide pas quand activer les inputs et ne filtre pas les ticks.

Les intentions de déplacement et de bombe doivent utiliser `CLIENT_EVENTS.MOVE` et `CLIENT_EVENTS.BOMB` et les types partagés. Les observations de partie utilisent `SERVER_EVENTS.START` et `SERVER_EVENTS.STATE`. Les noms d'événements internes au bus sont à définir par le binôme ; aucun nouveau protocole réseau n'est introduit ici. La cadence de maintien d'une touche doit être décidée avec le backend.

Si l'entrée en partie exige une intention de préparation, utiliser le contrat partagé existant. Le lobby soigné, les menus finaux, explosions, bonus et résultat relèvent du jalon 3.

### Rendu et validation

Le fond est une seule image (`src/assets/arena-floor.png`). Les quatre personnages, le mur, la caisse, la bombe et le repère local proviennent de `arena-atlas.png`. Les obstacles sont indépendants du fond et reflètent la grille reçue. Les positions sont affichées exactement, sans prédiction ni interpolation.

Chaque montage possède ses images et textures. Leur chargement respecte les URL locales `file:` et la CSP existante. Le module officiel `pixi.js/unsafe-eval` remplace la génération dynamique de code ; aucun `unsafe-eval` n'est ajouté à la CSP.

Les quatre suites de rendu couvrent les coordonnées, la réutilisation et le retrait des objets, le redimensionnement, le découpage des images, le cycle de vie des sources, les erreurs et l'annulation du montage. Les tests du jalon 1 restent présents. Les tests avec la frontière GPU substituée doivent être complétés par l'aperçu sur WebGL réel.

Après développement du lot B et du backend, tester deux clients réels : une intention de A doit produire un état serveur visible chez A et B ; une bombe autorisée doit apparaître chez les deux. Cette validation reste à effectuer.

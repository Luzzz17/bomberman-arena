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

### Passage de relais : deux parties pour le binôme

Répartition du travail frontend restant, préparée le 13 octobre 2026 depuis `8626dd6`. Le rendu de Jay est déjà commité ; les deux parties ci-dessous ne sont pas implémentées. Elles sont à réaliser dans cet ordre, avec leurs tests, en conservant le parcours de connexion existant.

#### Organisation parallèle retenue

Après intégration du rendu dans `develop`, Jay et son collègue créent chacun leur branche depuis `develop`. Jay prend `feature/frontend-gameplay-inputs` pour le clavier ; son collègue prend `feature/frontend-gameplay-sync` pour le transport et la coordination. Les titres ci-dessous décrivent les deux responsabilités ; elles peuvent avancer en parallèle.

Avant de coder, convenir du contrat des callbacks : le clavier appelle `onMove(direction)` et `onBomb()`, fournis par le coordinateur. Ces noms sont une proposition interne, pas des messages serveur. Jay teste avec des callbacks substitués ; son collègue teste avec des intentions substituées. Le collègue est seul responsable des modifications de `src/network/socket-client.ts`, de `src/renderer.ts` et de la coordination du jeu. L'intégration finale rassemble les deux modules, puis vérifie deux clients réels avec le backend.

#### Partie 1 : Jay, commandes et production des intentions

Fichiers concernés : créer `src/inputs/keyboard.ts` et `tests/keyboard.test.ts`. Le contrat des callbacks et du cycle de vie du clavier est à convenir avec le collègue avant le développement ; aucun nouveau protocole serveur n'est introduit.

- [ ] Produire des intentions de déplacement avec les flèches et WASD/ZQSD selon le clavier, et une intention de bombe avec espace. Décider avec le backend la cadence lors du maintien d'une touche.
- [ ] Activer les commandes uniquement pendant une partie et lorsque le canvas possède le focus. Ignorer les champs de saisie, empêcher le défilement uniquement pour les touches prises en charge, réinitialiser les touches au changement de focus et retirer les écouteurs à la destruction.
- [ ] Transmettre les intentions aux callbacks convenus avec le collègue. Exposer l'activation, la désactivation et la destruction des contrôles pour que son coordinateur gère leur cycle de vie.
- [ ] Tester les touches, la répétition selon la cadence retenue, le focus, la désactivation et le nettoyage avec des callbacks substitués.

Critère d'acceptation : les callbacks reçoivent les bonnes intentions sans modifier localement les positions ni créer une bombe dans PixiJS. Cette partie peut être vérifiée avant que le transport de jeu et le moteur backend soient disponibles.

#### Partie 2 : collègue, transport et synchronisation de l'arène

Fichiers concernés : compléter `src/network/socket-client.ts`, ajouter la coordination du jeu dans `src/game/`, puis raccorder les modules dans `src/renderer.ts` en utilisant le bus et la session existants. Ajouter `tests/game-session.test.ts`, compléter `tests/game-transport.test.ts` et documenter la vérification à deux clients.

- [ ] Créer `tests/game-transport.test.ts` et étendre le transport pour émettre `CLIENT_EVENTS.MOVE` avec `{ direction }` et `CLIENT_EVENTS.BOMB` avec `{}` sur la connexion existante. Bloquer l'envoi hors partie ou après déconnexion. Avec un serveur Socket.IO de test sur port éphémère, vérifier les noms et contenus envoyés ainsi que l'absence d'envoi après arrêt. Ne pas ouvrir une seconde connexion pour le jeu.

- [ ] Prévoir l'accès minimal à une partie avec le pseudo et l'état prêt via `CLIENT_EVENTS.JOIN` et `CLIENT_EVENTS.READY`, selon le contrat partagé. Préserver l'accueil ; le lobby final soigné reste au jalon 3.
- [ ] Recevoir et valider `SERVER_EVENTS.START` et `SERVER_EVENTS.STATE` selon les types partagés : grille rectangulaire avec cases reconnues, joueurs et bombes avec identités uniques et coordonnées entières dans la grille, champs requis du protocole et tick entier valide. Rejeter les messages malformés avant de les transmettre au rendu.
- [ ] Monter `createArenaView(host, playerId, signal)` au démarrage, transmettre la grille et les joueurs de départ avec une liste de bombes vide, puis appeler `setSnapshot` à chaque état accepté. Activer les commandes de la partie 1 une fois le montage terminé.
- [ ] Conserver le démarrage et le dernier état reçu pendant le montage asynchrone ; ignorer les ticks anciens ou dupliqués et les états hors partie. Annuler les montages devenus obsolètes et nettoyer vue, commandes et abonnements à la déconnexion ou à la sortie. Une nouvelle identité doit obtenir une nouvelle vue.
- [ ] Tester les états invalides, leur ordre, le montage différé, la déconnexion pendant le montage et la reconnexion. Conserver les tests existants du jalon 1 et du rendu.
- [ ] Avec le backend disponible, ouvrir deux clients réels : faire bouger A et vérifier la même position chez A et B ; poser une bombe et vérifier son apparition chez les deux. Vérifier aussi qu'un déplacement refusé par le serveur ne déplace pas le personnage côté client.

Critère d'acceptation : déplacements et bombes sont visibles sur deux clients depuis les états du serveur. Les serveurs de test valident le raccordement ; ils ne remplacent pas cette vérification avec le backend réel.

#### Dépendances et validation de la phase 2

Le pôle backend doit livrer l'accès à une partie, la grille initiale, les déplacements autorisés et collisions, la pose de bombes, la diffusion des états et les tests unitaires du moteur. Le serveur présent sur cette branche ne gère actuellement que la bienvenue et les connexions. Ces travaux backend ne sont pas attribués au binôme frontend par cette répartition.

Pour chacune des deux parties, lancer depuis `client/` : `npm run typecheck`, `npm run lint`, `npm test` et `npm run build`. Faire des commits distincts au format `type: description`. La phase 2 complète exige aussi les tests du moteur passants et la démonstration à deux clients. Explosions, bonus, résultats et finition du lobby restent au jalon 3.

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

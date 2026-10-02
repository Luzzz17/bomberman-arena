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

## Arène et contrôles (phase 2, partie rendu)

La branche `feature/frontend-arena-inputs` ajoute une scène PixiJS passive et ses contrôles. Le parcours normal de `npm start` reste l'accueil de connexion : le coordinateur réseau et le lobby doivent encore brancher ces modules.

### Inspecter le rendu sans serveur

Depuis `client/` :

```bash
npm ci
npm run arena:preview
```

Ouvrir l'adresse locale affichée, normalement `http://127.0.0.1:4173`. `Ctrl+C` arrête le serveur de prévisualisation. Le port n'est exposé que sur la boucle locale.

- Les boutons chargent les états fixes « Départ », « Déplacements », « Bombes » et « Retrait ».
- Cliquer dans l'arène ou y accéder au clavier pour donner le focus au canvas.
- Flèches ou positions physiques WASD (ZQSD sur AZERTY) : une intention de déplacement par pression.
- Espace : une intention de pose de bombe par pression.
- Les intentions apparaissent sous l'arène. Elles ne modifient pas les positions : seul un nouvel état reçu peut le faire.
- « Arrêter » vide l'arène et désactive les inputs. Choisir un scénario la relance.

Le clavier ignore la répétition native, les raccourcis Ctrl/Alt/Cmd, les formulaires et les événements de composition. Le maintien d'une touche ne produit donc pas de mouvement continu : cette cadence reste à décider avec le backend. Les données de l'aperçu ne calculent ni collisions ni explosions. Ce dispositif ne remplace pas le futur adaptateur mock de session.

Le fond de carte est une seule image (`src/assets/arena-floor.png`). Les quatre personnages, le mur, la caisse, la bombe et le repère du joueur local sont découpés dans une planche transparente (`src/assets/arena-atlas.png`). Les obstacles sont affichés séparément selon la grille reçue : le fond ne détermine ni les collisions ni les positions.

Les fichiers de développement sont dans `dev/` et sont compilés sous `dist/arena-preview/`. Ils ne sont pas inclus dans le bundle de l'accueil. Relancer l'aperçu après `npm run build`, qui nettoie `dist/`. Les changements TypeScript sont recompilés automatiquement ; recharger le navigateur pour les voir. Relancer la commande après modification du HTML/CSS.

### Modules à raccorder par le binôme

| Module | Responsabilité |
|---|---|
| `src/game/arena-events.ts` | Contrat interne `ArenaEvents`, types de données importés depuis `shared/index.js` |
| `src/arena/artwork.ts` | Sprites cartoon, pseudonymes et repère du joueur local |
| `src/arena/textures.ts` | Chargement des deux PNG locaux et découpage de la planche de huit sprites |
| `src/arena/scene.ts` | Grille et objets PixiJS conservés par ID, dimensionnement et destruction |
| `src/arena/view.ts` | Initialisation WebGL asynchrone, canvas, ResizeObserver et rendu à la demande |
| `src/inputs/keyboard.ts` | Clavier focalisé, activation explicite et intentions uniquement |
| `src/game/bind-arena.ts` | Liaison bus/rendu, filtrage des ticks anciens et activation pour le joueur local vivant |

Contrat **interne au frontend**, à intégrer au coordinateur existant :

| Événement interne | Données | Émetteur |
|---|---|---|
| `arena:started` | `StartPayload` | Coordinateur, après un `server:start` validé |
| `arena:updated` | `StatePayload` | Coordinateur, après un `server:state` validé |
| `arena:stopped` | `undefined` | Coordinateur, à la déconnexion ou à la sortie de partie |
| `controls:enabled` | `boolean` | Coordinateur, pour suspendre/reprendre les inputs |
| `player:move-requested` | `MovePayload` | Clavier, à transmettre via `CLIENT_EVENTS.MOVE` |
| `player:bomb-requested` | `BombPayload` | Clavier, à transmettre via `CLIENT_EVENTS.BOMB` |

Ces noms n'ajoutent aucun événement réseau. La validation des messages et leur traduction restent dans le transport et le coordinateur. Composer les types avec `SessionEvents & ArenaEvents` pour utiliser un seul bus.

Exemple d'assemblage, à exécuter avec un conteneur dimensionné et l'identifiant obtenu lors de la bienvenue :

```ts
import type { EventBus } from './core/event-bus';
import type { SessionEvents } from './session/types';
import type { ArenaEvents } from './game/arena-events';
import { createArenaView } from './arena/view';
import { createKeyboardControls } from './inputs/keyboard';
import { bindArena } from './game/bind-arena';

export async function mountGame(
  host: HTMLElement,
  playerId: string,
  bus: EventBus<SessionEvents & ArenaEvents>,
  signal: AbortSignal,
): Promise<() => void> {
  const view = await createArenaView(host, playerId, signal);
  const controls = createKeyboardControls(view.element, bus);
  const dispose = bindArena(bus, view, controls, playerId);
  signal.addEventListener('abort', dispose, { once: true });
  return () => {
    signal.removeEventListener('abort', dispose);
    dispose();
  };
}
```

Attendre la résolution du montage **avant** de publier `arena:started`, puis transmettre les états suivants. Si le démarrage serveur arrive pendant l'initialisation, le coordinateur doit conserver le démarrage et le dernier état valide puis les publier dans cet ordre une fois le montage terminé. Ne pas perdre ces messages pendant l'attente du GPU.

À chaque nouvelle partie, le compteur de tick local est réinitialisé. Les mises à jour reçues avant le démarrage, après l'arrêt, ou avec un tick inférieur ou égal au dernier sont ignorées. Un nouveau démarrage réautorise les contrôles ; le coordinateur peut les suspendre ensuite. Les inputs restent inactifs si le joueur local est absent ou mort. Pour une nouvelle identité après reconnexion, détruire l'ancien montage et en créer un nouveau.

Le rendu conserve la position serveur exacte, sans prédiction ni interpolation. Il ne calcule pas la durée de vie des bombes : elles disparaissent quand l'observation les retire. Explosions, bonus et fin de partie sont hors de cette tranche. Les dimensions visuelles viennent de la grille reçue ; les codes des cases viennent de `shared`.

Chaque montage charge ses deux images avec des éléments `img`, compatibles avec `img-src 'self'` et les URL `file:` d’Electron. Il possède ses textures et leurs deux sources GPU : retirer un objet conserve ces ressources, détruire la vue les libère. Un échec ou une annulation pendant le montage nettoie aussi le canvas et le GPU.

La scène utilise le module officiel `pixi.js/unsafe-eval`, malgré son nom, pour **remplacer** la génération dynamique de code et fonctionner avec `script-src 'self'`. Aucun `unsafe-eval` n'est ajouté à la CSP. Le canvas reçoit un résumé accessible des joueurs et bombes ; ce résumé n'est pas un mode de jeu non visuel complet.

### Tests de cette partie

- `keyboard.test.ts` : intentions, répétitions, focus, formulaires et destruction.
- `arena-scene.test.ts` : vrais objets PixiJS sans GPU, coordonnées, réutilisation, retrait et redimensionnement.
- `bind-arena.test.ts` : démarrage, ticks, joueur mort/absent, suspension, arrêt et désabonnement.
- `arena-view.test.ts` : montage DOM, resize, chargement et annulation asynchrone avec les frontières image/GPU substituées.
- `arena-textures.test.ts` : découpage de la planche, fond unique, affichage des sprites et conservation des textures pendant le retrait des objets.
- `arena-texture-loading.test.ts` : URLs locales, sources indépendantes par montage, erreur image et annulation.

Compléter les tests automatisés par l'aperçu sur un vrai contexte WebGL : ils ne valident pas les pixels ni les pilotes graphiques. La synchronisation entre deux clients réels reste à tester avec la partie réseau du binôme et le backend.

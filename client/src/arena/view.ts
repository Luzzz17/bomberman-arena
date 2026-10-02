import { Application } from 'pixi.js';
// Ce module remplace la génération dynamique de code et respecte script-src 'self'.
import 'pixi.js/unsafe-eval';
import type { ArenaPresentation } from '../game/bind-arena';
import { createArenaScene } from './scene';
import type { ArenaScene } from './scene';
import { loadArenaTextures } from './textures';
import type { ArenaTextureResources } from './textures';

export interface ArenaView extends ArenaPresentation { readonly element: HTMLCanvasElement }

/** Initialise le GPU et les images ; l'appelant peut annuler le montage. */
export async function createArenaView(host: HTMLElement, playerId: string, signal?: AbortSignal): Promise<ArenaView> {
  signal?.throwIfAborted();
  const element = host.ownerDocument.createElement('canvas');
  const app = new Application();
  let resources: ArenaTextureResources | undefined;
  let scene: ArenaScene | undefined;
  let observer: ResizeObserver | undefined;
  let destroyed = false;
  const focus = () => { if (!destroyed) element.focus({ preventScroll: true }); };
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    signal?.removeEventListener('abort', destroy);
    observer?.disconnect(); element.removeEventListener('pointerdown', focus);
    scene?.destroy();
    // Une initialisation GPU interrompue peut laisser le renderer absent.
    if (app.renderer) app.destroy({ removeView: true }, { children: true });
    else app.stage.destroy({ children: true });
    element.remove(); resources?.destroy();
  };
  try {
    await app.init({ canvas: element, preference: 'webgl', backgroundAlpha: 0, antialias: true,
      resolution: Math.min(host.ownerDocument.defaultView?.devicePixelRatio ?? 1, 2),
      autoDensity: true, autoStart: false, sharedTicker: false });
    signal?.throwIfAborted();
    resources = await loadArenaTextures(host.ownerDocument, signal);
    signal?.throwIfAborted();
    scene = createArenaScene(playerId, resources.textures);
    app.stage.addChild(scene.root);
    element.tabIndex = 0;
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', 'Arène Bomberman. Flèches ou ZQSD pour se déplacer, espace pour poser une bombe.');
    element.style.display = 'block';
    host.append(element);
    element.addEventListener('pointerdown', focus);
    const resize = () => {
      if (destroyed) return;
      const width = Math.max(1, host.clientWidth); const height = Math.max(1, host.clientHeight);
      app.renderer.resize(width, height); scene?.resize(width, height); app.render();
    };
    observer = new ResizeObserver(resize);
    observer.observe(host); resize();
    signal?.addEventListener('abort', destroy, { once: true });
  } catch (error) { destroy(); throw error; }
  return {
    element, focus, destroy,
    setSnapshot(snapshot) {
      if (destroyed) return;
      scene?.setSnapshot(snapshot); app.render();
      const players = snapshot.players.filter((p) => p.alive).map((p) => `${p.pseudo} (${p.x}, ${p.y})`).join(', ');
      element.setAttribute('aria-label', `Arène Bomberman. Joueurs : ${players || 'aucun'}. ${snapshot.bombs.length} bombe(s). Flèches ou ZQSD, espace.`);
    },
    clear() { if (!destroyed) { scene?.clear(); app.render(); element.setAttribute('aria-label', 'Arène en attente de partie.'); } },
  };
}

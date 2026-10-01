// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../src/core/event-bus';
import type { SessionEvents } from '../src/session/types';
import { mountConnectionView } from '../src/ui/connection-view';

const html = readFileSync('src/index.html', 'utf8');
beforeEach(() => { document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')); });

function setup() {
  const bus = createEventBus<SessionEvents>();
  const dispose = mountConnectionView(document, bus, { status: 'disconnected' });
  const form = document.querySelector<HTMLFormElement>('#connection-form')!;
  const address = document.querySelector<HTMLInputElement>('#server-address')!;
  const connect = document.querySelector<HTMLButtonElement>('#connect-button')!;
  const disconnect = document.querySelector<HTMLButtonElement>('#disconnect-button')!;
  const status = document.querySelector<HTMLElement>('#connection-status')!;
  return { bus, dispose, form, address, connect, disconnect, status };
}

describe('Vue de connexion', () => {
  it('transmet les intentions de connexion et de fermeture sans connaître le réseau', () => {
    const { bus, form, address, disconnect, dispose } = setup();
    const requested = vi.fn();
    const closed = vi.fn();
    bus.on('connection:requested', requested);
    bus.on('connection:closed', closed);
    address.value = 'http://192.168.1.20:3000';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(requested).toHaveBeenCalledExactlyOnceWith(address.value);
    bus.emit('session:changed', { status: 'connecting', address: address.value });
    disconnect.click();
    expect(closed).toHaveBeenCalledExactlyOnceWith(undefined);
    dispose();
  });

  it('affiche les transitions et empêche les soumissions pendant une connexion', () => {
    const { bus, form, address, connect, disconnect, status, dispose } = setup();
    const requested = vi.fn();
    bus.on('connection:requested', requested);
    expect(address.value).toBe('http://localhost:3000');
    expect(disconnect.hidden).toBe(true);
    bus.emit('session:changed', { status: 'connecting', address: address.value });
    expect(status.textContent).toContain('Connexion en cours');
    expect(connect.disabled).toBe(true);
    expect(address.disabled).toBe(true);
    expect(disconnect.textContent).toBe('Annuler');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(requested).not.toHaveBeenCalled();
    bus.emit('session:changed', { status: 'connected', address: address.value, playerId: 'joueur-1' });
    expect(status.textContent).toContain('Connecté au serveur');
    expect(disconnect.textContent).toBe('Se déconnecter');
    bus.emit('session:changed', { status: 'disconnected' });
    expect(connect.disabled).toBe(false);
    expect(address.disabled).toBe(false);
    expect(disconnect.hidden).toBe(true);
    dispose();
  });

  it('affiche les erreurs comme du texte et permet de réessayer', () => {
    const { bus, connect, status, dispose } = setup();
    bus.emit('session:changed', { status: 'error', message: '<img src=x onerror=alert(1)>' });
    expect(status.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(status.querySelector('img')).toBeNull();
    expect(connect.textContent).toBe('Réessayer');
    expect(connect.disabled).toBe(false);
    dispose();
    bus.emit('session:changed', { status: 'connected', address: 'http://localhost:3000', playerId: 'autre' });
    expect(status.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});

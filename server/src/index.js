/**
 * Point d'entrée du serveur : lit le port d'écoute et démarre le serveur WebSocket.
 */
import process from 'node:process';
import { startServer } from './network/server.js';

const PORT = Number(process.env.PORT) || 3000;

startServer(PORT);
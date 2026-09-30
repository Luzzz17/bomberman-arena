import process from 'node:process';
import { startServer } from './network/server.js';

const PORT = Number(process.env.PORT) || 3000;

startServer(PORT);
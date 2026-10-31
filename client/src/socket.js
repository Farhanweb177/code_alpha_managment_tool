import { io } from 'socket.io-client';
import { getToken } from './api';

let socket = null;

export function connectSocket() {
  const token = getToken();
  if (!token) return null;
  if (socket) {
    if (socket.auth?.token === token && socket.connected) return socket;
    socket.disconnect();
  }
  socket = io('/', { auth: { token }, autoConnect: true });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}

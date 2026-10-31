import { useEffect, useRef } from 'react';
import { getSocket } from './socket';

export function useSocketEvent(event, handler) {
  const saved = useRef(handler);
  saved.current = handler;
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const fn = (...args) => saved.current(...args);
    socket.on(event, fn);
    return () => socket.off(event, fn);
  }, [event]);
}

export function subscribeProject(projectId) {
  const socket = getSocket();
  if (socket && projectId) socket.emit('project:subscribe', projectId);
}

export function unsubscribeProject(projectId) {
  const socket = getSocket();
  if (socket && projectId) socket.emit('project:unsubscribe', projectId);
}

'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth.store';

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
});

// Empty → same origin: socket.io connects to the current host and the request
// is proxied to the API via next.config.ts rewrites (/socket.io/*).
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || undefined;

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!user || !accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    const socket = io(WS_URL, {
      auth: { token: accessToken },
      // polling first so it works through the Next.js proxy, then upgrade.
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 1500,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join', user.id);
    });

    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    socketRef.current = socket;

    return () => {
      socket.emit('leave', user.id);
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user?.id, accessToken]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

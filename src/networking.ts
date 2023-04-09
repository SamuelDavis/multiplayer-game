import Peer, { type DataConnection } from "peerjs";
import { createMemo, createRoot, createSignal } from "solid-js";

class NetworkError extends Error {
  public readonly date = new Date();
}

class SignalingServerConnectionFailure extends NetworkError {
  constructor() {
    super("Failed to establish connection with signaling server.");
  }
}

class SignalingServerConnectionLost extends NetworkError {
  constructor() {
    super("Lost connection with signaling server.");
  }
}

class PeerConnectionFailure extends NetworkError {
  constructor(id: Peer["id"]) {
    super(`Failed to establish incoming connection with peer: ${id}`);
  }
}

class PeerConnectionLost extends NetworkError {
  constructor(id: Peer["id"]) {
    super(`Lost connection with peer: ${id}`);
  }
}

class HostConnectionFailure extends NetworkError {
  constructor(id: Peer["id"]) {
    super(`Failed to establish incoming connection with host: ${id}`);
  }
}

class HostConnectionLost extends NetworkError {
  constructor(id: Peer["id"]) {
    super(`Lost connection with host: ${id}`);
  }
}

export default createRoot(() => {
  const CONNECTION_TIMEOUT = 3000;
  const RELIABLE = true;
  const peer = new Peer({
    host: "localhost",
    port: 9000,
    path: "/",
    key: "local",
  });
  const [getPeer, setPeer] = createSignal<Peer>();
  const [getConnections, setConnections] = createSignal<DataConnection[]>([]);
  const [getErrors, setErrors] = createSignal<NetworkError[]>([]);
  const [getIncomingConnection, setIncomingConnection] =
    createSignal<DataConnection>();
  const getPeerId = createMemo(() => getPeer()?.id);
  const isConnected = createMemo(() => Boolean(getPeerId()));
  const getPeers = createMemo(() =>
    getConnections().map((connection) => connection.peer)
  );

  function pushError(error: NetworkError) {
    console.error(error);
    setErrors((rest) => [...rest, error]);
  }

  const timeout = setTimeout(() => {
    peer.destroy();
    pushError(new SignalingServerConnectionFailure());
  }, CONNECTION_TIMEOUT);
  peer.on("open", () => {
    clearTimeout(timeout);
    return setPeer(peer);
  });
  peer.on("close", () => {
    peer.destroy();
    pushError(new SignalingServerConnectionLost());
  });

  function initializeAsHost() {
    peer.on("connection", (connection) => {
      if (getPeers().includes(connection.peer)) return;
      const timeout = setTimeout(() => {
        connection.close();
        pushError(new PeerConnectionFailure(connection.peer));
      }, CONNECTION_TIMEOUT);
      connection.on("open", () => {
        clearTimeout(timeout);
        setConnections((rest) => [...rest, connection]);
        setIncomingConnection(connection);
        connection.on("close", () => {
          setConnections((rest) =>
            rest.filter((conn) => conn.peer !== connection.peer)
          );
          pushError(new PeerConnectionLost(connection.peer));
        });
      });
    });
  }

  function initializeAsPeer(host: string) {
    return new Promise<DataConnection>((resolve, reject) => {
      const connection = peer.connect(host, { reliable: RELIABLE });
      const timeout = setTimeout(() => {
        const error = new HostConnectionFailure(host);
        connection.close();
        pushError(error);
        reject(error);
      }, CONNECTION_TIMEOUT);
      connection.on("open", () => {
        clearTimeout(timeout);
        resolve(connection);
        connection.on("close", () => {
          pushError(new HostConnectionLost(host));
        });
      });
    });
  }

  return {
    getIncomingConnection,
    isConnected,
    initializeAsHost,
    initializeAsPeer,
    getPeerId,
    getConnections,
    getErrors,
    getPeers,
  };
});

import Peer, { type DataConnection } from "peerjs";
import { createMemo, createRoot, createSignal } from "solid-js";

const CONNECTION_TIMEOUT = 3000;
const RELIABLE = true;

class NetworkError extends Error {
  public readonly date = new Date();
}

export class NotConnectedError extends NetworkError {
  constructor() {
    super("Not connected to signaling server.");
  }
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
  const [getPeer, setPeer] = createSignal<Peer>();
  const [getConnections, setConnections] = createSignal<DataConnection[]>([]);
  const [getIncomingConnection, setIncomingConnection] =
    createSignal<DataConnection>();
  const getPeerId = createMemo(() => getPeer()?.id);
  const isConnected = createMemo(() => Boolean(getPeerId()));
  const getPeers = createMemo(() =>
    getConnections().map((connection) => connection.peer)
  );

  function initializePeer() {
    return new Promise<Peer>((resolve) => {
      const peer =
        window.location.hostname === "localhost"
          ? new Peer({
              host: "localhost",
              port: 9000,
              path: "/",
              key: "local",
            })
          : new Peer();

      const timeout = setTimeout(() => {
        peer.destroy();
        throw new SignalingServerConnectionFailure();
      }, CONNECTION_TIMEOUT);

      peer.on("open", () => {
        clearTimeout(timeout);
        peer.on("close", () => {
          peer.destroy();
          throw new SignalingServerConnectionLost();
        });
        resolve(peer);
      });
    });
  }

  function initializeAsHost() {
    const peer = getPeer();
    if (!peer) throw new NotConnectedError();
    peer.on("connection", (connection) => {
      if (getPeers().includes(connection.peer)) return;
      const timeout = setTimeout(() => {
        connection.close();
        throw new PeerConnectionFailure(connection.peer);
      }, CONNECTION_TIMEOUT);
      connection.on("open", () => {
        clearTimeout(timeout);
        connection.on("close", () => {
          setConnections((rest) =>
            rest.filter((conn) => conn.peer !== connection.peer)
          );
          throw new PeerConnectionLost(connection.peer);
        });
        setConnections((rest) => [...rest, connection]);
        setIncomingConnection(connection);
      });
    });
  }

  function initializeAsPeer(host: string) {
    if (getPeers().includes(host)) return;
    const peer = getPeer();
    if (!peer) throw new NotConnectedError();
    return new Promise<DataConnection>((resolve) => {
      const connection = peer.connect(host, { reliable: RELIABLE });
      const timeout = setTimeout(() => {
        connection.close();
        throw new HostConnectionFailure(host);
      }, CONNECTION_TIMEOUT);
      connection.on("open", () => {
        clearTimeout(timeout);
        connection.on("close", () => {
          throw new HostConnectionLost(host);
        });
        resolve(connection);
      });
    });
  }

  initializePeer().then(setPeer);

  return {
    getIncomingConnection,
    isConnected,
    initializeAsHost,
    initializeAsPeer,
    getPeerId,
    getConnections,
    getPeers,
  };
});

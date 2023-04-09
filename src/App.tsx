import {
  Component,
  createEffect,
  createMemo,
  createSignal,
  For,
} from "solid-js";
import world, { update } from "./game";
import networking from "./networking";
import Peer from "peerjs";

class NotConnectedError extends Error {
  constructor() {
    super("Not connected to signaling server.");
  }
}

type Message = {
  peer: Peer["id"];
  date: Date;
  text: string;
};

function isMessage(value: any): value is Message {
  return (
    typeof value === "object" &&
    ["peer", "date", "text"].every(value.hasOwnProperty.bind(value))
  );
}

const App: Component = () => {
  function pushMessage(message: Message) {
    setWorld((world) => ({
      ...world,
      messages: [
        ...world.messages,
        { ...message, date: new Date(message.date) },
      ].sort((a, b) => {
        if (!b) return 0;
        return a.date.getTime() - b.date.getTime();
      }),
    }));
  }

  const [getOnMessage, setOnMessage] = createSignal<(message: Message) => void>(
    () => {}
  );
  const [getWorld, setWorld] = createSignal(world, { equals: false });
  const getMessages = createMemo(() => getWorld().messages);
  createEffect(() => {
    networking
      .getConnections()
      .forEach((connection) => connection.send(getWorld()));
  });
  createEffect(() => {
    const incoming = networking.getIncomingConnection();
    if (!incoming) return;
    incoming.on("data", (data) => {
      if (isMessage(data)) pushMessage(data);
    });
  });

  const getTime = createMemo(
    () => {
      const { time } = getWorld();
      return time;
    },
    undefined,
    { equals: false }
  );

  function onUpdate() {
    setWorld(update);
  }

  function onHost() {
    const id = networking.getPeerId();
    if (!id) throw new NotConnectedError();
    window.navigator.clipboard
      .writeText(id)
      .then(() => networking.initializeAsHost());
    setOnMessage(() => pushMessage);
  }

  function onJoin() {
    const host = prompt("host");
    if (host)
      networking.initializeAsPeer(host).then((connection) => {
        connection.on("data", setWorld);
        setOnMessage(() => (message) => {
          connection.send(message);
        });
      });
  }

  function onSubmit(e: SubmitEvent & { currentTarget: HTMLFormElement }) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const text = data.get("text")?.toString();
    if (!text) throw new Error("Unable to read text.");
    const peer = networking.getPeerId();
    if (!peer) throw new NotConnectedError();
    const date = new Date();
    const message: Message = { peer, date, text };
    getOnMessage()(message);
    e.currentTarget.reset();
  }

  return (
    <main>
      <header>
        <button onClick={onUpdate}>Update</button>
      </header>
      <details open={networking.isConnected()}>
        <summary>Connect</summary>
        <menu>
          <li>
            <button onClick={onHost}>Host</button>
          </li>
          <li>
            <button onClick={onJoin}>Join</button>
          </li>
        </menu>
      </details>
      <details>
        <summary>Game</summary>
        <pre>{JSON.stringify(getTime(), null, 2)}</pre>
      </details>
      <details open={networking.getPeers().length > 0}>
        <summary>Peers</summary>
        <ol>
          <For each={networking.getPeers()}>{(peer) => <li>{peer}</li>}</For>
        </ol>
      </details>
      <form onSubmit={onSubmit}>
        <output>
          <table>
            <tbody>
              <For each={getMessages()}>
                {(message) => (
                  <>
                    <tr>
                      <td>
                        <small>{message.date.toLocaleString()}</small>
                      </td>
                      <td>
                        <small>{message.peer}</small>
                      </td>
                    </tr>
                    <tr>
                      <td colspan={2}>{message.text}</td>
                    </tr>
                  </>
                )}
              </For>
            </tbody>
          </table>
          <ol></ol>
        </output>
        <label>
          Text
          <input id="text" type="text" name="text" />
        </label>
        <input type="submit" />
      </form>
    </main>
  );
};

export default App;

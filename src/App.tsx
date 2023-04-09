import {
  Component,
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
} from "solid-js";
import world, { update, World } from "./game";
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
  const [getWorld, setWorld] = createSignal(world, { equals: false });
  const [getLocalMessages, setLocalMessages] = createSignal<Message[]>([]);
  const [getRemoteMessages, setRemoteMessages] = createSignal<Message[]>([]);
  const getMessages = createMemo(() =>
    [...getLocalMessages(), ...getRemoteMessages()].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    )
  );
  createEffect(() => {
    networking
      .getConnections()
      .forEach((connection) => connection.send(getWorld()));
  });
  createEffect(() => {
    const incoming = networking.getIncomingConnection();
    if (!incoming) return;
    incoming.on("data", (data) => {
      if (isMessage(data)) {
        const message: Message = { ...data, date: new Date(data.date) };
        setRemoteMessages((rest) => [...rest, message]);
        networking.getConnections().forEach((connection) => {
          if (connection.peer === incoming.peer) return;
          connection.send(message);
        });
      }
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
  }

  function onJoin() {
    const host = prompt("host");
    if (host)
      networking.initializeAsPeer(host).then((connection) => {
        connection.on("data", (data) => {
          if (isMessage(data)) {
            setRemoteMessages((rest) => [
              ...rest,
              { ...data, date: new Date(data.date) },
            ]);
          } else {
            setWorld(data as World);
          }
        });
        createEffect(() => {
          const message = getLocalMessages().pop();
          console.debug(message);
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
    networking
      .getConnections()
      .forEach((connection) => connection.send(message));
    setLocalMessages((rest) => [...rest, message]);
    e.currentTarget.reset();
  }

  return (
    <main>
      <header>
        <button onClick={onUpdate}>Update</button>
      </header>
      <Show when={networking.isConnected()} keyed={false}>
        <menu>
          <li>
            <button onClick={onHost}>Host</button>
          </li>
          <li>
            <button onClick={onJoin}>Join</button>
          </li>
        </menu>
      </Show>
      <pre>{JSON.stringify(getTime(), null, 2)}</pre>
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

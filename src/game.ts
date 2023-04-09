import { createWorld, defineSystem, IWorld, pipe } from "bitecs";

export interface World extends IWorld {
  turn: number;
  time: {
    delta: number;
    elapsed: number;
    then: number;
  };
}

const timeSystem = defineSystem<[], World>((world) => {
  const { time } = world;
  const now = performance.now();
  const delta = now - time.then;
  time.delta = delta;
  time.elapsed += delta;
  time.then = now;
  return world;
});
const turnSystem = defineSystem<[], World>((world) => {
  world.turn++;
  return world;
});
export const update: (world: World) => World = pipe(timeSystem, turnSystem);

export default createWorld<World>({
  turn: 0,
  time: {
    delta: 0,
    elapsed: 0,
    then: performance.now(),
  },
});

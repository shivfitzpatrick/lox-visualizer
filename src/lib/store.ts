export interface Store<T> {
  get(): T;
  set(patch: Partial<T>): void;
  subscribe(fn: (state: T) => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const subscribers = new Set<(state: T) => void>();

  return {
    get() {
      return state;
    },

    set(patch: Partial<T>) {
      let changed = false;
      for (const key in patch) {
        if (patch[key] !== state[key]) {
          changed = true;
          break;
        }
      }
      if (!changed) {
        return;
      }

      state = { ...state, ...patch };
      for (const fn of [...subscribers]) {
        fn(state);
      }
    },

    subscribe(fn: (state: T) => void) {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
  };
}

export interface ConcurrencySlot {
  release: () => void;
}

export function createConcurrencyLimiter(max: number) {
  let active = 0;
  return {
    tryAcquire(): ConcurrencySlot | null {
      if (active >= max) return null;
      active += 1;
      let released = false;
      return {
        release() {
          if (released) return;
          released = true;
          active -= 1;
        },
      };
    },
  };
}

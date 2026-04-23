export type PollSubscription = {
  stop: () => void;
};

export function createPollingSubscription(
  run: () => Promise<void>,
  intervalMs = 5000,
): PollSubscription {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active = true;

  const tick = async () => {
    if (!active) return;
    try {
      await run();
    } finally {
      if (active) {
        timer = setTimeout(tick, intervalMs);
      }
    }
  };

  void tick();

  return {
    stop: () => {
      active = false;
      if (timer) clearTimeout(timer);
    },
  };
}

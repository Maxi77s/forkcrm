export function createLimiter(max = 4) {
  let running = 0;
  const q: Array<() => void> = [];

  const run = () => {
    if (running >= max || q.length === 0) return;
    running++;
    const job = q.shift()!;
    job();
  };

  return <T>(fn: () => Promise<T>) =>
    new Promise<T>((res, rej) => {
      const task = () =>
        fn()
          .then(res)
          .catch(rej)
          .finally(() => {
            running--;
            run();
          });
      q.push(task);
      run();
    });
}

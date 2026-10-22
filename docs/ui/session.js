// Tracks the one conversion that may still publish a result. cancel() aborts the in-flight request and invalidates its token.
export function createSession() {
  let gen = 0;
  let controller = null;
  return {
    start() {
      controller?.abort();
      gen += 1;
      controller = new AbortController();
      return { token: gen, signal: controller.signal };
    },
    cancel() {
      controller?.abort();
      controller = null;
      gen += 1;
    },
    valid: (token) => token === gen,
  };
}

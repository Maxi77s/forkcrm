import { WS_EVENT_SEND } from "./config";

export { WS_EVENT_SEND };

export function emitWithAck(
  socket: any,
  event: string,
  payload: any,
  timeoutMs = 2000
) {
  return new Promise<any>((resolve, reject) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error(`ACK timeout ${event}`));
    }, timeoutMs);
    try {
      socket.emit(event, payload, (ack: any) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(ack);
      });
    } catch (e) {
      if (done) return;
      done = true;
      clearTimeout(t);
      reject(e);
    }
  });
}

// A small MQTT 3.1.1 client over WebSocket. The public brokers only carry room messages.
// The game itself stays in the browser.

const BROKERS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://broker.emqx.io:8084/mqtt',
];

function encodeRemaining(n) {
  const out = [];
  do {
    let byte = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) byte += 128;
    out.push(byte);
  } while (n > 0);
  return out;
}

function utf8(text) {
  const bytes = new TextEncoder().encode(text);
  return [bytes.length >> 8, bytes.length & 0xff, ...bytes];
}

function packet(type, body) {
  return new Uint8Array([type, ...encodeRemaining(body.length), ...body]);
}

function connectPacket(clientId) {
  const body = [
    0x00, 0x04, 0x4d, 0x51, 0x54, 0x54,
    0x04,
    0x02,
    0x00, 0x1e,
    ...utf8(clientId),
  ];
  return packet(0x10, body);
}

function subscribePacket(id, topic) {
  return packet(0x82, [id >> 8, id & 0xff, ...utf8(topic), 0]);
}

function publishPacket(topic, payload) {
  const bytes = new TextEncoder().encode(payload);
  return packet(0x30, [...utf8(topic), ...bytes]);
}

function decodeRemaining(view, start) {
  let value = 0;
  let shift = 0;
  let i = start;
  let byte = 0;
  do {
    if (i >= view.length) return null;
    byte = view[i];
    i += 1;
    value += (byte & 127) * (2 ** shift);
    shift += 7;
  } while (byte & 128);
  return { value, next: i };
}

function readUtf8(view, i) {
  const len = (view[i] << 8) + view[i + 1];
  const bytes = view.slice(i + 2, i + 2 + len);
  return { text: new TextDecoder().decode(bytes), next: i + 2 + len };
}

/** Open the first broker that answers. `onMessage(topic, text)` receives publishes. */
export function connectBroker(onMessage) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    const tryNext = (index) => {
      if (index >= BROKERS.length) {
        fail(new Error('no-broker'));
        return;
      }
      let ws;
      try {
        ws = new WebSocket(BROKERS[index], ['mqtt']);
      } catch {
        tryNext(index + 1);
        return;
      }
      ws.binaryType = 'arraybuffer';
      const clientId = `gonogo-${Math.random().toString(36).slice(2, 10)}`;
      let buffer = new Uint8Array(0);
      let ping = null;
      let advanced = false;
      const advance = () => {
        if (advanced || settled) return;
        advanced = true;
        clearTimeout(timer);
        clearInterval(ping);
        try { ws.close(); } catch { /* already closed */ }
        tryNext(index + 1);
      };
      const timer = setTimeout(advance, 5000);

      const client = {
        send(topic, payload) {
          if (ws.readyState === WebSocket.OPEN) ws.send(publishPacket(topic, payload));
        },
        subscribe(topic) {
          if (ws.readyState === WebSocket.OPEN) ws.send(subscribePacket(1, topic));
        },
        close() {
          clearInterval(ping);
          try { ws.close(); } catch { /* already closed */ }
        },
      };

      ws.onerror = () => advance();
      ws.onclose = () => {
        clearInterval(ping);
        advance();
      };
      ws.onopen = () => {
        ws.send(connectPacket(clientId));
      };
      ws.onmessage = (ev) => {
        const chunk = new Uint8Array(ev.data);
        const merged = new Uint8Array(buffer.length + chunk.length);
        merged.set(buffer);
        merged.set(chunk, buffer.length);
        buffer = merged;
        while (buffer.length > 2) {
          const head = decodeRemaining(buffer, 1);
          if (!head) return;
          const total = head.next + head.value;
          if (buffer.length < total) return;
          const type = buffer[0] >> 4;
          const body = buffer.slice(head.next, total);
          buffer = buffer.slice(total);
          if (type === 2) {
            if (advanced) return;
            clearTimeout(timer);
            if (body[1] !== 0) {
              advance();
              return;
            }
            ping = setInterval(() => {
              if (ws.readyState === WebSocket.OPEN) ws.send(new Uint8Array([0xc0, 0x00]));
            }, 20000);
            if (!settled) {
              settled = true;
              resolve(client);
            }
          } else if (type === 3) {
            const topic = readUtf8(body, 0);
            const text = new TextDecoder().decode(body.slice(topic.next));
            onMessage(topic.text, text);
          }
        }
      };
    };
    tryNext(0);
  });
}

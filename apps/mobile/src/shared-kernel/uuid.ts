export function createUuid() {
  return globalThis.crypto?.randomUUID?.() ?? createFallbackUuidV4();
}

function createFallbackUuidV4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (value) => (
    Number(value) ^ Math.floor(Math.random() * 16) >> Number(value) / 4
  ).toString(16));
}

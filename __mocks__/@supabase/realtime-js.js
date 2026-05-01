// __mocks__/@supabase/realtime-js.js — Mock para Jest (realtime-js es ESM puro)
module.exports = {
  getNativeWebSocket: () => null,
  RealtimeClient: class RealtimeClient {
    constructor() {}
    connect() {}
    disconnect() {}
    channel() { return { on: () => this, subscribe: () => this } }
  },
}

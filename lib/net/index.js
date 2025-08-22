// Networking utilities for DeepFly
// Provides stub implementations for REST and realtime connections.
// Games can call these APIs; when backend services are wired up,
// these functions can be replaced with actual implementations.

export const net = {
  // Example REST call (throws by default)
  async rest(path, options = {}) {
    throw new Error('REST backend is not configured');
  },
  // Realtime client stub
  rt: {
    connect(channel) {
      // Returns a dummy realtime connection with no-op methods
      return {
        publish(event, payload) {},
        subscribe(event, handler) {},
        close() {}
      };
    }
  }
};
// Input handling utilities for DeepFly
// Normalizes pointer and keyboard events for games. Games can subscribe
// to high-level input without worrying about DOM specifics.

export const input = {
  // Subscribes to a pointer event on a target element
  onPointer(target, type, handler) {
    target.addEventListener(type, handler);
  },
  offPointer(target, type, handler) {
    target.removeEventListener(type, handler);
  },
  // Subscribes to keyboard events on the window
  onKey(type, handler) {
    window.addEventListener(type, handler);
  },
  offKey(type, handler) {
    window.removeEventListener(type, handler);
  }
};
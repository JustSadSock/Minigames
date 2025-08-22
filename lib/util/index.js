// Miscellaneous utilities for DeepFly

// Returns a random number between 0 (inclusive) and n (exclusive)
export function rnd(n) {
  return Math.random() * n;
}

// Simple clamp function
export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Linearly interpolates between a and b by t (0..1)
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
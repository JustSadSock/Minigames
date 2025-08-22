// Local storage wrapper with namespace support for DeepFly

const PREFIX = 'deepfly.';

export const store = {
  get(key, def) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v ? JSON.parse(v) : def;
    } catch (_) {
      return def;
    }
  },
  set(key, value) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  },
  del(key) {
    localStorage.removeItem(PREFIX + key);
  }
};
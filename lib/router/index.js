// Router utilities for DeepFly hub
// Parses the location hash (e.g. "#game=pong") and returns the slug.
export function parseGameSlug(hash) {
  const m = hash.match(/game=([\w-]+)/);
  return m ? m[1] : null;
}

// Generates a hash string for a given game slug
export function makeHashForGame(slug) {
  return `#game=${slug}`;
}
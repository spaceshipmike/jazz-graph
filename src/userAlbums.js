/**
 * User-added albums — localStorage persistence layer.
 */

const STORAGE_KEY = "jazzgraph-user-albums";

export function loadUserAlbums() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveUserAlbums(albums) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(albums));
}

export function addUserAlbum(album) {
  const existing = loadUserAlbums();
  if (existing.some((a) => a.id === album.id)) return existing;
  const updated = [...existing, { ...album, userAdded: true }];
  saveUserAlbums(updated);
  return updated;
}

export function removeUserAlbum(albumId) {
  const existing = loadUserAlbums();
  const updated = existing.filter((a) => a.id !== albumId);
  saveUserAlbums(updated);
  return updated;
}

export function mergeAlbums(canonical, userAdded) {
  const ids = new Set(canonical.map((a) => a.id));
  const unique = userAdded.filter((a) => !ids.has(a.id));
  return [...canonical, ...unique];
}

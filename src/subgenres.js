/**
 * Subgenre taxonomy, shape system, and helpers.
 */

export const SUBGENRES = {
  // Circle family — bop lineage
  "bebop":            { shape: "circle-filled",   family: "circle" },
  "hard bop":         { shape: "circle-outline",  family: "circle" },
  "post-bop":         { shape: "circle-half",     family: "circle" },
  "modal jazz":       { shape: "circle-dot",      family: "circle" },

  // Triangle family — boundary-pushing
  "free jazz":        { shape: "triangle-filled",   family: "triangle" },
  "avant-garde jazz": { shape: "triangle-outline",  family: "triangle" },
  "spiritual jazz":   { shape: "triangle-inverted", family: "triangle" },

  // Diamond family — groove / feel-driven
  "soul jazz":        { shape: "diamond-filled",  family: "diamond" },
  "jazz-funk":        { shape: "diamond-outline", family: "diamond" },
  "bossa nova":       { shape: "diamond-small",   family: "diamond" },

  // Square family — ensemble / fusion
  "big band":         { shape: "square-filled",   family: "square" },
  "swing":            { shape: "square-outline",  family: "square" },
  "jazz fusion":      { shape: "square-half",     family: "square" },

  // Hexagon / other — cool / latin
  "cool jazz":        { shape: "hexagon",    family: "hex" },
  "latin jazz":       { shape: "star-four",  family: "hex" },
};

export const SUBGENRE_LIST = Object.keys(SUBGENRES);

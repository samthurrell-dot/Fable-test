// ui/faces.js
// Cut-paper faces for the staff and for you, drawn as small SVGs. One head shape, a hat that says
// the job, and a mouth and brows that say the mood. The mood is all the player ever sees of a
// person's loyalty, so the six moods must be told apart at 24 pixels.
//   faceSVG(role, mood)   role: a staff role or 'you';  mood: happy | content | flat | sour | angry | grin | dead | none

const INK = '#25261f';
export const TOKEN = {
  security: '#7d8fa3', chef: '#f0e7d2', engineer: '#e79f4a', doctor: '#a3d3c4', farmer: '#a3bf6c',
  pa: '#bfa9dc', cleaner: '#e6aea3', heir: '#93c4e6', you: '#e8c352',
};

const HATS = {
  // a peaked cap
  security: '<path d="M6.5 12.5 Q16 3 25.5 12.5 Z" fill="#3b4654"/><path d="M5 12.2 H27 L29.5 15 H5 Z" fill="#232b35"/><circle cx="16" cy="9" r="1.4" fill="#e8c352"/>',
  // a toque
  chef: '<path d="M8 12 Q3.5 9 7 5.5 Q9 1.5 13 3.5 Q16 0.5 19 3.5 Q23 1.5 25 5.5 Q28.5 9 24 12 Z" fill="#fffdf6" stroke="#cfc6ad" stroke-width="0.7"/><rect x="8" y="11" width="16" height="3" fill="#fffdf6" stroke="#cfc6ad" stroke-width="0.7"/>',
  // a hard hat
  engineer: '<path d="M6.5 13.5 Q6.5 4 16 4 Q25.5 4 25.5 13.5 Z" fill="#f2c230"/><rect x="14.6" y="3.2" width="2.8" height="10" rx="1.2" fill="#d9a514"/><rect x="4.5" y="12.8" width="23" height="2.4" rx="1.2" fill="#d9a514"/>',
  // a head mirror on a band
  doctor: '<path d="M6.2 15 Q7 6.5 16 6.5 Q25 6.5 25.8 15 Q16 10.5 6.2 15 Z" fill="#5b4a3a"/><rect x="6" y="11.4" width="20" height="2" fill="#f7f4ea"/><circle cx="16" cy="10.6" r="3.3" fill="#f7f4ea" stroke="#b9b3a2" stroke-width="0.8"/><circle cx="16" cy="10.6" r="1.1" fill="#b9b3a2"/>',
  // a straw hat
  farmer: '<path d="M9 12.5 Q9 4.5 16 4.5 Q23 4.5 23 12.5 Z" fill="#e3c877"/><ellipse cx="16" cy="13" rx="14.5" ry="2.8" fill="#d7b95e"/><rect x="9" y="9.8" width="14" height="1.8" fill="#9c5a3c"/>',
  // a bun and glasses
  pa: '<circle cx="16" cy="6.2" r="4" fill="#3a2f45"/><path d="M5.8 17 Q5.8 8 16 8 Q26.2 8 26.2 17 Q21 11.5 16 11.5 Q11 11.5 5.8 17 Z" fill="#3a2f45"/>',
  // a knotted headscarf
  cleaner: '<path d="M5.6 17.5 Q5 7 16 7 Q27 7 26.4 17.5 Q21.5 12 16 12 Q10.5 12 5.6 17.5 Z" fill="#c9503c"/><path d="M24.5 9.5 L30 6.5 L28.6 11.6 Z" fill="#c9503c"/><circle cx="11" cy="10.4" r="0.9" fill="#f7f4ea"/><circle cx="16" cy="9" r="0.9" fill="#f7f4ea"/><circle cx="21" cy="10.4" r="0.9" fill="#f7f4ea"/>',
  // a paper party crown, slipping
  heir: '<path d="M8 13.5 L7 5 L11.5 9 L14.5 3.5 L18 8.8 L22.5 4 L23.5 12.5 Z" fill="#d94f6a" transform="rotate(-8 16 9)"/>',
  // a top hat
  you: '<rect x="9.5" y="0.8" width="13" height="11.5" rx="1" fill="#25261f"/><rect x="9.5" y="8.4" width="13" height="2.6" fill="#b5482e"/><rect x="5" y="11.6" width="22" height="2.6" rx="1.3" fill="#25261f"/>',
};

const eye = (x, y, r = 1.5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/>`;
const MOODS = {
  happy: `${eye(12, 21)}${eye(20, 21)}<path d="M10 25 Q16 32 22 25 Z" fill="${INK}"/><path d="M12 26.2 Q16 30 20 26.2 Z" fill="#e2664f"/>`,
  content: `${eye(12, 21)}${eye(20, 21)}<path d="M11.5 26 Q16 29.5 20.5 26" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>`,
  flat: `${eye(12, 21)}${eye(20, 21)}<path d="M12 27 H20" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>`,
  sour: `${eye(12, 21.5)}${eye(20, 21.5)}<path d="M9.5 18.2 L13.8 19.2 M22.5 18.2 L18.2 19.2" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/><path d="M12 28.2 Q16 25.2 20 28.2" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>`,
  angry: `${eye(12, 22)}${eye(20, 22)}<path d="M8.8 17.4 L14.2 20 M23.2 17.4 L17.8 20" stroke="${INK}" stroke-width="1.9" stroke-linecap="round"/><path d="M11 29 Q16 24 21 29 Z" fill="${INK}"/>`,
  // the fixed smile of someone too frightened to show anything else
  grin: `<circle cx="12" cy="20.6" r="2.7" fill="#fffdf6" stroke="${INK}" stroke-width="0.9"/><circle cx="20" cy="20.6" r="2.7" fill="#fffdf6" stroke="${INK}" stroke-width="0.9"/>${eye(12, 20.6, 0.9)}${eye(20, 20.6, 0.9)}<rect x="9.6" y="25" width="12.8" height="4.6" rx="2" fill="#fffdf6" stroke="${INK}" stroke-width="1.1"/><path d="M12.8 25 V29.6 M16 25 V29.6 M19.2 25 V29.6" stroke="${INK}" stroke-width="0.8"/><path d="M26.2 15.5 q1.8 2.8 0 4 q-1.8 -1.2 0 -4" fill="#7fc3e6"/>`,
  dead: `<path d="M10.4 19.4 l3.2 3.2 m0 -3.2 l-3.2 3.2 M18.4 19.4 l3.2 3.2 m0 -3.2 l-3.2 3.2" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/><path d="M12 27.5 H20" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>`,
  smug: `<path d="M10.2 21.4 Q12 19.4 13.8 21.4 M18.2 21.4 Q20 19.4 21.8 21.4" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/><path d="M12 26 Q17 29.5 21 25" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/><circle cx="20" cy="21.4" r="3.6" fill="none" stroke="${INK}" stroke-width="0.9"/><path d="M23.4 22.8 L25.5 30" stroke="${INK}" stroke-width="0.6"/>`,
  none: '',
};

export function faceSVG(role, mood = 'flat') {
  const col = TOKEN[role] || '#ddd';
  const glasses = role === 'pa' && mood !== 'grin' ? `<circle cx="12" cy="21" r="3.3" fill="none" stroke="${INK}" stroke-width="0.9"/><circle cx="20" cy="21" r="3.3" fill="none" stroke="${INK}" stroke-width="0.9"/><path d="M15.3 21 H16.7" stroke="${INK}" stroke-width="0.9"/>` : '';
  return `<svg class="face" viewBox="0 0 32 36" aria-hidden="true"><circle cx="16" cy="23" r="11.2" fill="${col}"/><circle cx="16" cy="23" r="11.2" fill="none" stroke="rgba(37,38,31,.28)" stroke-width="0.8"/>${MOODS[mood] || MOODS.flat}${glasses}${HATS[role] || ''}</svg>`;
}

export const MOOD_WORDS = { happy: 'beaming', content: 'content', flat: 'hard to read', sour: 'sour', angry: 'angry', grin: 'smiling, fixedly' };

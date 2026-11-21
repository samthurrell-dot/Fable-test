// data/cards.js
// Starting cards: how you came to power. Each sets starting loyalty and fear, the promises you
// already owe, and one person with a grudge. (In the full game, Act 1 deals this card.)

export const CARDS = [
  {
    id: 'inherited', name: 'Inherited it',
    line: 'Your father built the bunker. You got the keys, the staff and his dressing gown.',
    blurb: 'Low fear, average loyalty. You owe nobody anything.',
    level: 'Fair', loyalty: 55, fear: 22, promises: [], grudge: 'heir',
    grudgeLine: 'Your own family, who wanted it.',
  },
  {
    id: 'bought', name: 'Bought your way in',
    line: 'The last owner sold up the week before the sirens. The staff came with the fittings.',
    blurb: 'High loyalty, for as long as you pay.',
    level: 'Gentle', loyalty: 67, fear: 28, promises: ['wages'], grudge: 'pa',
    grudgeLine: 'Your assistant, who knows what you paid.',
  },
  {
    id: 'force', name: 'Took it by force',
    line: 'There was a list. Some people were on it. You have promised there is no second list.',
    blurb: 'High fear, low loyalty. They have already seen what you will do: your deck starts with ruthless cards two steps down.',
    level: 'Brutal', loyalty: 40, fear: 72, promises: ['purges'], grudge: 'doctor', regime: 3,
    grudgeLine: 'The doctor, who treated the people on your list.',
  },
  {
    id: 'vote', name: 'Promised them a vote',
    line: 'You won the argument at the hatch by promising an election. Then you shut the hatch.',
    blurb: 'High loyalty, almost no fear, and a date in the diary.',
    level: 'Gentle', loyalty: 60, fear: 14, promises: ['vote'], grudge: 'security',
    grudgeLine: 'The head of security, the candidate you beat.',
  },
  {
    id: 'founder', name: 'Founder of the bunker',
    line: 'Your name is on the door, the brochure and the air filters. You hired every one of them.',
    blurb: 'Full stores, low loyalty. They have read the brochure.',
    level: 'Hard', loyalty: 46, fear: 34, promises: ['seat'], grudge: 'engineer', stores: 18,
    grudgeLine: 'The engineer, who does the work your name is on.',
  },
];

export const cardById = (id) => CARDS.find((c) => c.id === id) || CARDS[0];

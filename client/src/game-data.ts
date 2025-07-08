export interface Player {
  id: number
  name: string
  position: string
  imageSrc: string
  stats: {
    goals: number
    assists: number
    saves: number
    yellowCards: number
  }
  actions: { label: string; event: keyof Player["stats"] }[]
}

export interface Commentary {
  commentator: "Barry Banter" | "Ronnie Roast"
  text: string
  avatar: string
  timestamp: number
}

export const initialPlayers: Player[] = [
  {
    id: 1,
    name: "Peter Schmeichel",
    position: "Goalkeeper",
    imageSrc: "/images/schmeichel.png",
    stats: { goals: 0, assists: 0, saves: 0, yellowCards: 0 },
    actions: [
      { label: "Save", event: "saves" },
      { label: "Yellow Card", event: "yellowCards" },
    ],
  },
  {
    id: 2,
    name: "David Beckham",
    position: "Right Midfielder",
    imageSrc: "/images/beckham.png",
    stats: { goals: 0, assists: 0, saves: 0, yellowCards: 0 },
    actions: [
      { label: "Free Kick Goal", event: "goals" },
      { label: "Assist", event: "assists" },
    ],
  },
  {
    id: 3,
    name: "Steven Gerrard",
    position: "Central Midfielder",
    imageSrc: "/images/gerrard.png",
    stats: { goals: 0, assists: 0, saves: 0, yellowCards: 0 },
    actions: [
      { label: "Long Shot Goal", event: "goals" },
      { label: "Yellow Card", event: "yellowCards" },
    ],
  },
  {
    id: 4,
    name: "Thierry Henry",
    position: "Forward",
    imageSrc: "/images/henry.png",
    stats: { goals: 0, assists: 0, saves: 0, yellowCards: 0 },
    actions: [
      { label: "Curled Goal", event: "goals" },
      { label: "Assist", event: "assists" },
    ],
  },
  {
    id: 5,
    name: "Cristiano Ronaldo",
    position: "Forward",
    imageSrc: "/images/ronaldo.png",
    stats: { goals: 0, assists: 0, saves: 0, yellowCards: 0 },
    actions: [
      { label: "Header Goal", event: "goals" },
      { label: "Penalty Goal", event: "goals" },
    ],
  },
]

export const commentaryLines = {
  goal: [
    "GOAL! {player} rolls back the years with that one!",
    "He's still got it! {player} finds the back of the net!",
    "Unbelievable! {player} with a finish straight out of the top drawer!",
    "SIIIIUUU! Oh wait, wrong player. But what a goal from {player}!",
  ],
  goalReaction: [
    "Textbook stuff from {player}. You just can't teach that... unless you're him.",
    "The keeper didn't even move. He was probably asking {player} for an autograph.",
    "That's why he's on the pitch, Ronnie. Pure class.",
    "Even I have to applaud that one. Reluctantly.",
  ],
  assist: [
    "What a pass from {player}! A thing of beauty!",
    "That's a 'Hollywood' ball from {player} if I've ever seen one.",
    "Served up on a silver platter by {player}. Delicious!",
  ],
  save: [
    "WHAT A SAVE! {player} with hands like buckets!",
    "Denied! {player} is a giant wall back there!",
    "He's still got the reflexes of a cat! A very large, very angry Danish cat.",
  ],
  yellowCard: [
    "Oof, {player} goes into the book. A bit of that old-school 'passion' on display.",
    "That's a cynical one from {player}. He knew exactly what he was doing.",
    "The referee has a word with {player}. I think he's just asking for his shirt after the game.",
  ],
  idle: [
    "Inter YerNan are passing it around the back. They look a bit lost.",
    "The pace of this game is... deliberate. Very deliberate.",
    "You can hear the joints creaking from up here in the commentary box.",
    "I wonder what the combined age of this team is. Must be close to a millennium.",
    "Ronnie, do you think they get a senior discount on yellow cards?",
    "Barry, I think their pre-match meal was a bowl of Werther's Originals.",
  ],
}

export const prepNotes = {
  mike: {
    title: "Prep Note for the Upcoming Session with Mike",
    content: [
      "Last time, Mike described a tense exchange with his new manager over a looming project deadline, which left him feeling overwhelmed and guilty.",
      "He also mentioned an argument with a close friend who urged him to trust himself more and rely less on external approval.",
      "We practiced a guided imagery exercise during the session, and although it offered some temporary calm, his harsh self-criticism remains strong. He recently started going for short morning runs and has tried journaling a few times, but he's unsure these are making a difference.",
      "He noted feeling more isolated because most of his close friends live out of town. In the upcoming session, I plan to revisit the grounding technique, explore boundary-setting, and help him cultivate more self-compassion.",
      "I'll also check on how he's challenging his negative self-talk and see if any small perspective shifts are taking hold.",
    ]
  },
} as const

export type DemoClientId = keyof typeof prepNotes
export type ClientId = string

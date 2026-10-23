// Public GIPHY media links for the built-in reaction library. No API key is needed.
const REACTIONS = [
  ['hvRJCLFzcasrR4ia7z', 'Hello', 'hi hey wave waving greeting goodbye bye', 194],
  ['111ebonMs90YLu', 'Thumbs up', 'yes ok okay great good nice agree thanks thank you', 150],
  ['l0MYt5jPR6QX5pnqM', 'Party time', 'happy dance dancing celebrate celebration excited birthday yay office', 112],
  ['g9582DNuQppxC', 'Cheers', 'congratulations congrats toast thanks thank you celebrate', 113],
  ['R6gvnAxj2ISzJdbA63', 'I love you', 'love heart hearts happy hug hugs cute', 200],
  ['26ufcYAkp8e66vanu', 'Love you hearts', 'love heart hearts affection thank you thanks', 200],
  ['26BRv0ThflsHCqDrG', 'Valentine love', 'love heart hearts valentines cute', 200],
  ['3o7aD2saalBwwftBIY', 'Black cat', 'cat cats pet pets animal animals cute funny', 121],
  ['L0O3TQpp0WnSXmxV8p', 'Woo hoo', 'happy yay excited celebrate celebration friends funny', 167],
  ['13HgwGsXF0aiGY', 'Programming', 'code coding computer work working developer funny frustrated', 113],
];

export function searchGifLibrary(query = '') {
  const terms = String(query).toLowerCase().trim().split(/\s+/).filter(Boolean);
  return REACTIONS.filter(([, title, tags]) => {
    const keywords = (title + ' ' + tags).toLowerCase();
    return terms.every((term) => keywords.includes(term));
  }).map(([id, title, , height]) => ({
    id,
    title,
    url: `https://media.giphy.com/media/${id}/200w.gif`,
    width: 200,
    height,
  }));
}

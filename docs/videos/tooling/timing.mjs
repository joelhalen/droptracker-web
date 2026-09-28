// Where a stretch of a voiced line is spoken. voice.py aligns the script to
// the take's transcript and stores one [start, end, word] per script word
// (vo/<ep>/NN.json "words"), so any stretch of the line — a caption chunk,
// a shot's cue — is timed by counting words. Shared by shots.mjs and build.mjs.

const wordsOf = (s) => s.split(/\s+/).filter(Boolean);

// A clock over one line, or null when the take has no word times for it.
export function wordClock(line, words) {
  if (!words?.length || words.length !== wordsOf(line).length) return null;
  return {
    // [start, end] of words from..to (0-based, inclusive).
    span: (from, to) => [words[from][0], words[Math.min(to, words.length - 1)][1]],
    // When the word at character offset `k` of the line starts.
    at: (k) => words[Math.min(wordsOf(line.slice(0, k)).length, words.length - 1)][0],
  };
}

export const wordCount = (s) => wordsOf(s).length;

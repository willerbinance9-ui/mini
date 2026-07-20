/**
 * Light cleanup for agent → partner chat replies so casual typing reads more professionally.
 * Keeps intentional newlines; avoids mangling URLs / emails / codes.
 */
function formatAgentChatMessage(raw) {
  let text = String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim();
  if (!text) return '';

  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Soften full-line shouting (keep short acronyms like OK, VIP, API).
  text = text
    .split('\n')
    .map((line) => {
      const letters = line.replace(/[^A-Za-z]/g, '');
      if (letters.length >= 6 && letters === letters.toUpperCase()) {
        return sentenceCaseLine(line.toLowerCase());
      }
      return line;
    })
    .join('\n');

  text = capitalizeSentences(text);
  text = text.replace(/(^|[^\w])i(?=[^\w]|$)/g, (_, p) => `${p}I`);

  // Add a period for a single casual sentence with no closing punctuation.
  if (
    !text.includes('\n') &&
    text.length >= 8 &&
    !/[.!?…]$/.test(text) &&
    !/\S+@\S+\.\S+/.test(text) &&
    !/https?:\/\//i.test(text) &&
    !/\/\S+$/.test(text)
  ) {
    text += '.';
  }

  return text;
}

function sentenceCaseLine(line) {
  if (!line) return line;
  return line.replace(/^[a-z]/, (c) => c.toUpperCase());
}

function capitalizeSentences(text) {
  return text.replace(/(^|[.!?…]\s+|\n+)([a-z])/g, (_, lead, ch) => `${lead}${ch.toUpperCase()}`);
}

module.exports = { formatAgentChatMessage };

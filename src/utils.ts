import { protos, ImageAnnotatorClient } from '@google-cloud/vision';
import { SymbolLine } from 'typings/types';

const client = new ImageAnnotatorClient();

export const getClient = () => client;

export const isEmpty = (item: any | null | undefined) => {
  return item === null || item === undefined;
};

export const getInlineWords = (languageCode: string, block: protos.google.cloud.vision.v1.IBlock) => {
  const paragraphs = block.paragraphs;

  // empty check
  if (paragraphs === null || paragraphs === undefined) return undefined;

  const inlineWords = paragraphs
    .map((paragraph) => {
      const words = paragraph.words;

      // empty check
      if (words === null || words === undefined) return undefined;

      const items = words.map(({ symbols, boundingBox }) => {
        // empty check
        if (symbols === null || symbols === undefined) return undefined;

        // filter by language code
        const results = filterLanguageCode(languageCode, symbols);
        // empty check
        if (results.length === 0) return undefined;

        return filterSymbolsJP(results, boundingBox?.normalizedVertices);
      });

      const lines = items.filter((s): s is Exclude<typeof s, undefined> => s !== undefined);

      if (lines.length === 0) return undefined;

      const hirakana = filterHirakana(lines);

      // console.log('hirakana', hirakana);

      return hirakana;
    })
    .filter((item): item is Exclude<typeof item, undefined> => item !== undefined);

  if (inlineWords?.length === 0) return undefined;

  return inlineWords;
};

const reg = new RegExp(/^[A-Za-z]+$/);

// filter by language code
export const filterLanguageCode = (languageCode: string, symbols: protos.google.cloud.vision.v1.ISymbol[]) => {
  return symbols.filter((symbol) => {
    if (symbol.property === null) return true;
    if (symbol.property?.detectedLanguages && symbol.property?.detectedLanguages.length === 0) return true;

    const length = symbol.property?.detectedLanguages?.filter((item) => item.languageCode === languageCode).length;

    return length && length > 0;
  });
};

export const filterSymbols = (symbols: protos.google.cloud.vision.v1.ISymbol[]) => {
  const word = symbols
    ?.map((item) => {
      let endfix = '';

      switch (item.property?.detectedBreak?.type) {
        case 'SPACE':
          endfix = ' ';
          break;
        case 'EOL_SURE_SPACE':
          endfix = '\n';
          break;
        default:
          break;
      }

      return `${item.text}${endfix}`;
    })
    .join('')
    .trim();

  // check symbol mark
  if (!reg.test(word) || word.length <= 2) return '';

  return word;
};

export const filterSymbolsJP = (
  symbols: protos.google.cloud.vision.v1.ISymbol[],
  vertices: protos.google.cloud.vision.v1.INormalizedVertex[] | null | undefined
): SymbolLine => {
  const word = symbols
    ?.map((item) => {
      let endfix = '';

      switch (item.property?.detectedBreak?.type) {
        case 'SPACE':
          endfix = ' ';
          break;
        case 'EOL_SURE_SPACE':
          // endfix = '\n';
          break;
        default:
          break;
      }

      return `${item.text}${endfix}`;
    })
    .join('');

  // check symbol mark
  const positions = getPositions(vertices);

  return {
    x: positions[0],
    y: positions[1],
    word: word,
  };
};

const getPositions = (vertices: protos.google.cloud.vision.v1.INormalizedVertex[] | null | undefined) => {
  let x = 99999999;
  let y = 99999999;

  // required check
  if (vertices === null || vertices === undefined) return [x, y];

  vertices.forEach((v) => {
    if (v.x !== null && v.x !== undefined && v.x < x) x = v.x;
    if (v.y !== null && v.y !== undefined && v.y < y) y = v.y;
  });

  return [Math.floor(x * 1000), Math.floor(y * 1000)];
};

const KANA = [
  'あ',
  'い',
  'う',
  'え',
  'お',
  'か',
  'き',
  'く',
  'け',
  'こ',
  'さ',
  'し',
  'す',
  'せ',
  'そ',
  'た',
  'ち',
  'つ',
  'て',
  'と',
  'は',
  'ひ',
  'ふ',
  'へ',
  'ほ',
  'ま',
  'み',
  'む',
  'め',
  'も',
  'や',
  'ゆ',
  'よ',
  'ら',
  'り',
  'る',
  'れ',
  'ろ',
  'わ',
  'を',
  'ん',
  'が',
  'ぎ',
  'ぐ',
  'げ',
  'ご',
  'ざ',
  'じ',
  'ず',
  'ぜ',
  'ぞ',
  'だ',
  'ぢ',
  'づ',
  'で',
  'ど',
  'ば',
  'び',
  'ぶ',
  'べ',
  'ぼ',
  'ぱ',
  'ぴ',
  'ぷ',
  'ぺ',
  'ぽ',
];

export const filterHirakana = (lines: SymbolLine[]): SymbolLine | undefined => {
  return hirakanaJoin(lines);
};

const hirakanaJoin = (lines: SymbolLine[]): SymbolLine => {
  const line = lines.map((item) => item.word).join('');

  return {
    x: lines[0].x,
    y: lines[0].y,
    word: line,
  };
};

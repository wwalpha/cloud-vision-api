import { protos, ImageAnnotatorClient } from '@google-cloud/vision';

const client = new ImageAnnotatorClient();

export const getClient = () => client;

export const getInlineWords = (languageCode: string, block: protos.google.cloud.vision.v1.IBlock) => {
  const words = block.paragraphs
    ?.map((paragraph) =>
      paragraph.words
        ?.map(({ symbols }) => {
          // empty check
          if (symbols === null || symbols === undefined) return '';

          // filter by language code
          const results = filterLanguageCode(languageCode, symbols);

          // empty check
          if (results.length === 0) return '';

          return filterSymbols(results);
        })
        .filter((item) => item.length !== 0)
    )
    .filter((item) => item?.length !== 0)
    .map((item) => item!);

  if (!words || words?.length === 0) return undefined;

  // two dimensional array into one dimensional array
  const merged = words.reduce((prev, next) => prev.concat(next));

  return merged;
};

const reg = new RegExp(/^[A-Za-z]+$/);

// filter by language code
export const filterLanguageCode = (languageCode: string, symbols: protos.google.cloud.vision.v1.ISymbol[]) => {
  return symbols.filter((symbol) => {
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

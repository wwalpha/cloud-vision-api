import { Request, Response } from 'express';
import { getClient } from './utils';
import { Image2LinesResponse, Image2LinesRequest, SymbolLine } from 'typings/types';
import { protos } from '@google-cloud/vision';
import _, { orderBy } from 'lodash';
import * as fs from 'fs';

export default async (req: Request<any, any, Image2LinesRequest, any>, res: Response<Image2LinesResponse>) => {
  const request = req.body;

  const [response] = await getClient().textDetection({
    image: {
      content: request.content,
    },
  });

  const pages = response.fullTextAnnotation?.pages;

  // fs.writeFileSync('./pages.json', JSON.stringify(pages));

  if (pages === null || pages === undefined) {
    res.status(200).send();
    return;
  }

  const results = start(pages);

  res.status(200).send(results);
};

const start = (pages: protos.google.cloud.vision.v1.IPage[] | null | undefined) => {
  const values = pages
    ?.map((page) => {
      // page blocks to lines
      const words = page.blocks
        ?.map((block) => getInlineWords(block))
        .filter((item): item is Exclude<typeof item, undefined> => item !== undefined);

      // string[][] -> string[]
      const merged = words?.reduce((prev, next) => prev.concat(next), []);

      return merged;
    })
    .filter((item): item is Exclude<typeof item, undefined> => item !== undefined);

  const symbols = getSymbols(values);

  const fixedOffset = _.chain(symbols)
    .groupBy('y')
    .map((value, key) => {
      const offset = Math.floor(Number(key) / 4);

      return value.map((item) => ({ ...item, y: offset * 4 }));
    })
    .value()
    .reduce((prev, next) => prev.concat(next), []);

  const response = _.chain(fixedOffset)
    .groupBy('y')
    .map((value, key) => {
      const content = orderBy(value, 'x')
        .map((v) => v.word)
        .join('');

      return content;
    })
    .value()
    .filter((item): item is Exclude<typeof item, undefined> => item !== undefined);

  return response;
};

const getInlineWords = (block: protos.google.cloud.vision.v1.IBlock) => {
  const paragraphs = block.paragraphs;

  const inlineWords = paragraphs
    ?.map((paragraph) => {
      const words = paragraph.words;

      const lines = words
        ?.map(({ symbols, boundingBox }) => {
          // empty check
          if (symbols === null || symbols === undefined) return undefined;

          // filter by language code
          // const results = filterLanguageCode(languageCode, symbols);
          // empty check
          if (symbols.length === 0) return undefined;

          return filterSymbolsJP(symbols, boundingBox?.vertices);
        })
        .filter((s): s is Exclude<typeof s, undefined> => s !== undefined);

      if (lines === undefined || lines.length === 0) return undefined;

      return symbolsJoin(lines);
    })
    .filter((item): item is Exclude<typeof item, undefined> => item !== undefined);

  if (inlineWords === undefined || inlineWords.length === 0) return undefined;

  return inlineWords.reduce((prev, next) => prev.concat(next), []);
};

const getSymbols = (values: SymbolLine[][] | undefined): SymbolLine[] => {
  if (!values) return [];

  const excludeSymbols = ['·'];

  const symbols = values
    .reduce((prev, next) => prev.concat(next), [])
    .filter((item) => {
      if (64 <= item.y && item.y <= 67 && item.x >= 800) return false;
      if (103 <= item.y && item.y <= 118) return false;
      if (item.y < 120 && excludeSymbols.includes(item.word)) return false;

      return true;
    });

  return symbols;
};

const filterSymbolsJP = (
  symbols: protos.google.cloud.vision.v1.ISymbol[],
  vertices: protos.google.cloud.vision.v1.INormalizedVertex[] | null | undefined
): SymbolLine => {
  // const singles = symbols.filter((item) => item.property?.detectedBreak?.type !== 'EOL_SURE_SPACE');
  // const multiples = symbols.filter((item) => item.property?.detectedBreak?.type === 'EOL_SURE_SPACE');

  const word = symbols
    ?.map((item) => {
      let endfix = '';

      if (item.property?.detectedBreak?.type === 'SPACE') {
        endfix = ' ';
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

  return [x, y];
};

const symbolsJoin = (symbols: SymbolLine[]): SymbolLine[] => {
  const values = _.chain(symbols)
    .groupBy('y')
    .map<SymbolLine>((value) => {
      let filters: SymbolLine[] = value;

      if (value.length > 1 && value.find((item) => 606 <= item.x || item.x <= 608)) {
        filters = value.filter((item) => 606 > item.x || item.x > 608);
      }

      const newArray = orderBy(filters, ['x'], ['asc']);
      const newWord = newArray.map((item) => item.word).join('');

      return {
        x: newArray[0].x,
        y: value[0].y,
        word: newWord,
      };
    })
    .value();

  return values;
};

const debug = () => {
  const pages: protos.google.cloud.vision.v1.IPage[] = JSON.parse(fs.readFileSync('./pages.json', 'utf-8').toString());

  const results = start(pages);
  console.log(results);
};

// debug();

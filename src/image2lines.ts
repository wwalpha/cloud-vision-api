import { Request, Response } from 'express';
import { getClient } from './utils';
import { Image2LinesResponse, Image2LinesRequest, SymbolLine } from 'typings/types';
import { protos } from '@google-cloud/vision';
import _, { orderBy } from 'lodash';
import * as fs from 'fs';
import { imageSize } from 'image-size';
import { ISizeCalculationResult } from 'image-size/dist/types/interface';

export default async (req: Request<any, any, Image2LinesRequest, any>, res: Response<Image2LinesResponse>) => {
  const request = req.body;

  const dimension = imageSize(Buffer.from(request.content, 'base64'));

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

  const results = start(pages, dimension);

  res.status(200).send(results);
};

const start = (pages: protos.google.cloud.vision.v1.IPage[] | null | undefined, dimension: ISizeCalculationResult) => {
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

  if (values === undefined || values.length === 0) return;

  const lines = values.reduce((prev, next) => prev.concat(next), []);
  let results: string[] = [];

  if (dimension.width === undefined || dimension.height === undefined) {
    return results;
  }

  if (dimension.width > dimension.height) {
    results = _.chain(lines)
      .sortBy('y')
      .groupBy('y')
      .map((line) => {
        const value = line
          .sort((a, b) => a.x - b.x)
          .map((item) => {
            return item.word;
          })
          .join('');

        return value;
      })
      .value();
  } else {
    results = lines.map((item) => item.word);
  }

  return results;
};

const getInlineWords = (block: protos.google.cloud.vision.v1.IBlock) => {
  const paragraphs = block.paragraphs;

  const inlineWords = paragraphs
    ?.map<SymbolLine | undefined>((paragraph) => {
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

      const vertices = paragraph.boundingBox?.vertices;
      if (vertices === null || vertices === undefined || vertices.length === 0) return undefined;

      return {
        x: vertices[0].x || 0,
        y: Math.round((vertices[0].y || 0) / 10) * 10,
        word: symbolsJoin(lines),
      };
    })
    .filter((item): item is Exclude<typeof item, undefined> => item !== undefined);

  if (inlineWords === undefined || inlineWords.length === 0) return undefined;

  return inlineWords;
};

const filterSymbolsJP = (
  symbols: protos.google.cloud.vision.v1.ISymbol[],
  vertices: protos.google.cloud.vision.v1.INormalizedVertex[] | null | undefined
): SymbolLine | undefined => {
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

  if (word.trim().length === 0) return;

  return {
    x: 0,
    y: 0,
    word: word,
  };
};

const symbolsJoin = (symbols: SymbolLine[]): string => {
  return symbols.map((item) => item.word).join('');
};

const debug = () => {
  const pages: protos.google.cloud.vision.v1.IPage[] = JSON.parse(fs.readFileSync('./pages.json', 'utf-8').toString());

  const results = start(pages, {
    width: 100,
    height: 200,
  });
  console.log(results);
};

// debug();

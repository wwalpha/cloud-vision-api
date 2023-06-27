import { Request, Response } from 'express';
import { getClient } from './utils';
import { Pdf2LinesResponse, Pdf2LinesRequest, SymbolLine } from 'typings/types';
import { protos } from '@google-cloud/vision';
import _, { orderBy } from 'lodash';
import * as fs from 'fs';

export default async (req: Request<any, any, Pdf2LinesRequest, any>, res: Response<Pdf2LinesResponse>) => {
  const request = req.body;

  const [response] = await getClient().batchAnnotateFiles({
    requests: [
      {
        inputConfig: {
          content: request.content,
          mimeType: 'application/pdf',
        },
        features: [
          {
            type: 'DOCUMENT_TEXT_DETECTION',
          },
        ],
      },
    ],
  });

  const pages = response.responses?.[0].responses;

  if (pages === null || pages === undefined) {
    res.status(200).send();
    return;
  }

  // fs.writeFileSync('./pages5.json', JSON.stringify(pages));

  const results = pages
    .map((page) => {
      const singlePage = page.fullTextAnnotation?.pages;

      return start(singlePage);
    })
    .reduce((prev, next) => prev.concat(next), []);

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

  let symbols = getSymbols(values);
  // 回数
  const num = symbols?.find((s) => s.y === 30);
  // 科目
  const subject = symbols?.find((s) => (s.y === 65 || s.y === 64) && s.x >= 140);

  // 不要な情報を削除する
  symbols = removeSymbol(symbols, num);
  // 不要な情報を削除する
  symbols = removeSymbol(symbols, subject);

  const fixedOffset = _.chain(symbols)
    .groupBy('y')
    .map((value, key) => {
      if (Number(key) < 120) return value;
      if (Number(key) % 15 === 0) return value;

      const offset = Math.round(Number(key) / 15);

      return value.map((item) => ({ ...item, y: offset * 15 }));
    })
    .value()
    .reduce((prev, next) => prev.concat(next), []);

  const response = _.chain(fixedOffset)
    .groupBy('y')
    .map((value, key) => {
      if (Number(key) < 120) return value.map((v) => v.word).join('');

      const question = orderBy(
        value.filter((v) => 80 <= v.x && v.x <= 200),
        'x'
      )
        .map((v) => v.word)
        .join('');

      const content = orderBy(
        value.filter((v) => 220 <= v.x && v.x <= 600),
        'x'
      )
        .map((v) => v.word)
        .join('');

      const rate = orderBy(
        value.filter((v) => 620 <= v.x && v.x <= 660),
        'x'
      )
        .map((v) => v.word)
        .join('');

      // empty string
      if (content.trim().length === 0 && rate.trim().length === 0 && question.trim().length === 0) {
        return;
      }

      const contents = content.split('・');

      const row = `${subject?.word.slice(-2)}
      |${num?.word.split('実施')[1]}
      |${contents[0]}
      |${contents.length > 1 ? contents[1] : contents[0]}
      |${rate}
      |${convertQuestion(question)}
      `
        .replace(/ /g, '')
        .replace(/\n/g, '')
        .replace(/【復習】/g, '');

      return row;
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

          return filterSymbolsJP(symbols, boundingBox?.normalizedVertices);
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
      if (item.y === 64) return false;
      if (item.y === 67 && item.x > 820) return false;
      if (103 <= item.y && item.y <= 118) return false;
      if (item.y < 120 && excludeSymbols.includes(item.word)) return false;

      return true;
    });

  // fs.writeFileSync('./symbols.json', JSON.stringify(symbols));
  return symbols;
};

const removeSymbol = (symbols: SymbolLine[], object: SymbolLine | undefined) => {
  if (!object) return symbols;

  return symbols.filter((s) => {
    if (s.x !== object.x) return true;
    if (s.y !== object.y) return true;

    return s.word !== object.word;
  });
};

const filterSymbolsJP = (
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
  // return [x, y];
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

const convertQuestion = (text: string): string => {
  const str = text.replace(/ /g, '-').replace(/問/g, '');

  const index = str.indexOf('(');
  if (index === -1) return str;

  return str
    .replace(/-\(1\)/g, '-1')
    .replace(/-\(2\)/g, '-2')
    .replace(/-\(3\)/g, '-3')
    .replace(/-\(4\)/g, '-4')
    .replace(/-\(5\)/g, '-5')
    .replace(/-\(6\)/g, '-6')
    .replace(/-\(7\)/g, '-7')
    .replace(/-\(8\)/g, '-8')
    .replace(/-\(9\)/g, '-9')
    .replace(/\(1\)/g, '-1')
    .replace(/\(2\)/g, '-2')
    .replace(/\(3\)/g, '-3')
    .replace(/\(4\)/g, '-4')
    .replace(/\(5\)/g, '-5')
    .replace(/\(6\)/g, '-6')
    .replace(/\(7\)/g, '-7')
    .replace(/\(8\)/g, '-8')
    .replace(/\(9\)/g, '-9');
};

const debug = () => {
  const pages: protos.google.cloud.vision.v1.IAnnotateImageResponse[] = JSON.parse(
    fs.readFileSync('./pages5.json', 'utf-8').toString()
  );

  // const results = pages
  //   .map((page) => {
  //     const singlePage = page.fullTextAnnotation?.pages;

  //     return start(singlePage);
  //   })
  //   .reduce((prev, next) => prev.concat(next), []);

  const singlePage = pages[0].fullTextAnnotation?.pages;

  const results = start(singlePage);
  console.log(results);
};

// debug();

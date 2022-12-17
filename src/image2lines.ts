import { Request, Response } from 'express';
import { getInlineWords, getClient } from './utils';
import { Image2LinesResponse, Image2LinesRequest } from 'typings/types';
import { orderBy } from 'lodash';

export default async (req: Request<any, any, Image2LinesRequest, any>, res: Response<Image2LinesResponse>) => {
  const request = req.body;

  const [result] = await getClient().textDetection({
    image: {
      content: request.content,
    },
  });

  const pages = result.fullTextAnnotation?.pages;

  if (pages === null || pages === undefined) {
    res.status(200).send();
    return;
  }

  const values = pages
    .map((page) => {
      const blocks = page.blocks;

      if (blocks === null || blocks === undefined) {
        return undefined;
      }

      // page blocks to lines
      const lines = blocks
        .map((block) => {
          return getInlineWords(request.language, block);
        })
        .filter((item): item is Exclude<typeof item, undefined> => item !== undefined);

      // string[][] -> string[]
      const merged = lines.reduce((prev, next) => prev.concat(next), []);

      return merged;
    })
    .filter((item): item is Exclude<typeof item, undefined> => item !== undefined);

  // string[][] -> string[]
  const merged = values.reduce((prev, next) => prev.concat(next), []);

  const ordered = orderBy(merged, ['y', 'x']);

  const lines: string[] = [];

  ordered.forEach((item, idx, array) => {
    if (idx === 0) {
      lines.push(item.word);
    } else {
      const prev = array[idx - 1].y;
      const curr = item.y;

      if (prev !== curr) {
        lines.push('\n');
      }

      lines.push(item.word);
    }
  });

  res.status(200).send([lines.join('')]);
};

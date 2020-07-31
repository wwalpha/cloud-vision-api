import { Request, Response } from 'express';
import { getInlineWords, getClient } from './utils';
import { Image2LinesResponse, Image2LinesRequest } from 'typings/types';

export default async (req: Request<any, any, Image2LinesRequest, any>, res: Response<Image2LinesResponse>) => {
  const request = req.body;

  const [result] = await getClient().textDetection({
    image: {
      content: request.content,
    },
  });

  const values = result.fullTextAnnotation?.pages
    ?.map((page) => {
      // page blocks to lines
      const lines = page.blocks
        ?.map((block) => getInlineWords(request.language, block))
        .filter((item) => item)
        .map((item) => item!);

      // string[][] -> string[]
      const merged = lines?.reduce((prev, next) => prev.concat(next));

      return merged;
    })
    .filter((item) => item)
    .map((item) => item!);

  // string[][] -> string[]
  const merged = values?.reduce((prev, next) => prev.concat(next));

  res.status(200).send(Array.from(new Set(merged)));
};

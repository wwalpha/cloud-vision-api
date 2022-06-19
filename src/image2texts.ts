import { Request, Response } from 'express';
import { getClient } from './utils';
import { Image2LinesResponse, Image2LinesRequest } from 'typings/types';

export default async (req: Request<any, any, Image2LinesRequest, any>, res: Response<Image2LinesResponse>) => {
  const request = req.body;

  const [result] = await getClient().textDetection({
    image: {
      content: request.content,
    },
  });

  const texts = result.fullTextAnnotation?.text;

  res.status(200).send(texts?.split('\n'));
};

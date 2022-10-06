import { Request, Response } from 'express';
import { HandwritingRequest, HandwritingResponse } from 'typings/types';
import { getClient } from './utils';

export default async (req: Request<any, any, HandwritingRequest, any>, res: Response<HandwritingResponse>) => {
  const request = req.body;

  const [result] = await getClient().documentTextDetection({
    image: {
      content: request.content,
    },
  });

  console.log(result);
};

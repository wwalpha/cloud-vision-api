import express, { Request, Response, NextFunction } from 'express';
import BodyParser from 'body-parser';
import cors from 'cors';
import Image2Lines from './image2lines';
import Image2Words from './image2words';

const app = express();

app.use(BodyParser.json({ limit: '50mb' }));
app.use(BodyParser.urlencoded({ extended: true }));
app.use(cors());

app.use((req: Request, res: Response, next: NextFunction) => {
  console.info(`${req.method} ${req.originalUrl}`);
  console.info('Headers', JSON.stringify(req.headers));
  // console.info('Body', JSON.stringify(req.body));

  next();
});

// health check
app.get('/', (_, res) => res.send('v1.0.0'));

// image to lines
app.post('/image2lines', (req, res) => Image2Lines(req, res));

// image to words
app.post('/image2words', (req, res) => Image2Words(req, res));

app.listen(process.env.EXPOSE_PORT || 8080, () => {
  console.log('Started...');
  console.log('Port: ', process.env.EXPOSE_PORT || 8080);
});

export default app;

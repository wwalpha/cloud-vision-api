import axios from 'axios';
import * as fs from 'fs';

const start = async () => {
  const content = fs.readFileSync('./test/476.jpg', {
    encoding: 'base64',
  });
  const res = await axios.post('http://localhost:8080/image2texts', {
    content: content,
    language: 'jp',
  });
  // const content = fs.readFileSync('./test/6-16.pdf', {
  //   encoding: 'base64',
  // });

  // const res = await axios.post('http://localhost:8080/pdf2lines', {
  //   content: content,
  //   language: 'jp',
  // });

  console.log(res.data);
};

start();

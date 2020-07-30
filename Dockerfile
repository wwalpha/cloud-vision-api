FROM node:12.16-alpine

WORKDIR /usr/local/app
# Port
EXPOSE 8080

# Source Copy
COPY dist .
COPY package.json .

RUN npm -i g yarn
RUN yarn install --production

CMD [ "node", "index" ]
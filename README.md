# Chrome as a Service

Chraas: an Express server running headless Chrome as a service.
1. Supports setting of custom headers, cookies and proxies through a JSON API.
2. Returns cookies set by the server as Set-Cookie headers
3. Implements stealth tactics provided by the great [berstend/puppeteer-extra](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth)

## Usage

Can be used as a gateway for scraping websites where javascript needs to be
rendered or where resources are blocked if javascript is not executed.

## Install

With [npm](https://npmjs.org/) installed, run

```sh
$ npm install
$ apt-get update
$ apt-get install -y gconf-service libasound2 libatk1.0-0 libcairo2 libcups2 libfontconfig1 libgdk-pixbuf2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libxss1 fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
$ wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
$ dpkg -i google-chrome-stable_current_amd64.deb; apt-get -fy install
```

Default configuration can be overriden on .env in particular
1. Protection of the server with an api key
2. Path of the chrome executable 

A docker image of the project can be built by running
```sh
docker build
```
in the project's folder

## Run the server
In the project folder, run
```sh
npm index.js
```
Server will be listening on port 8080 by default, port can be overriden in .env config

## API

The server exposes three endpoints:
1. content -> return the target url's html content
2. screenshot -> returns a full page screenshot of the target page
3. json -> returns the target url's content as json

You can extract content with custom proxies, headers and cookies
using the server's JSON API with the format below

```json
{
    "url":"xxx", // required
    "api_key":"xxx", // optional, if set in .env config
    "proxy": { // optional
        "host":"xxx",
        "port":"xxx",
        "user":"xxx",
        "password":"xxx" 
    },
    "headers": { // optional
        "Accept":"xxx",
        "Accept-Language":"xxx",
        "XXX":"xxx"
    },
    "cookies": [  // optional
        {
        "name":"xxx",
        "value":"xxx",
        "...":"xxx",
        "...": "xxx"
        },
        {
        "name":"xxx",
        "value":"xxx",
        "...":"xxx",
        "...": "xxx"
        }
    ],
}
```
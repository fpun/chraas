# CHRome As A Service

**Chraas:** an Express server running headless Chrome as a service.
1. Supports setting of **custom headers, cookies and proxies** through a simple JSON API.
2. Returns cookies set by the target with Set-Cookie headers.
3. Implements **stealth tactics** by the excellent [berstend/puppeteer-extra](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth) module to avoid bot detection.

## Usage

To be used as a gateway server for rendering websites that require javascript execution or are protected by a firewall that tests javascript execution (bot detection, browser fingerprinting etc.)

## Install

With [npm](https://npmjs.org/) installed, run

```sh
$ npm install
$ apt-get update
$ apt-get install -y gconf-service libasound2 libatk1.0-0 libcairo2 libcups2 libfontconfig1 libgdk-pixbuf2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libxss1 fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
$ wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
$ dpkg -i google-chrome-stable_current_amd64.deb; apt-get -fy install
```
Make a copy of .env.template and rename it .env
Default configuration can be overriden on the .env config file, in particular to **set an api key to protect the server in production**.

A docker image can be built by running
```sh
docker build
```

## Run the server
In the project folder, run
```sh
node index.js
```
The server will be listening on **port 8080** by default and the port can be overriden in the .env config file.

## API

The server exposes three endpoints:
1. **content** -> returns the target url's html content
2. **screenshot** -> returns a full page screenshot of the target url
3. **json** -> returns the target url's content as json

Set custom proxies, headers and cookies sending a json payload as below.
**url is the only required input**, along with api_key if set in .env config file

```js
{
    "url":"https://www.httpbin.org/headers",
    "api_key":"",
    "proxy": {
        "host":"example_host",
        "port":"8080",
        "user":"example_user",
        "password":"example_password" 
    },
    "headers": {
        "Accept":"text/html,application/xhtml+xml,application/xml",
        "Accept-Language":"en-US,en;q=0.9",
        "My-Custom-Header":"example_value"
    },
    "cookies": [
        {
        "name":"example_first_cookie_name",
        "value":"example_first_cookie_value"
        },
        {
        "name":"example_second_cookie_name",
        "value":"example_second_cookie_value"
        }
    ],
}
```

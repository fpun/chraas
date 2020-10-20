
// Load config
require('custom-env').env(); 

// Load Puppeteer with stealth setup to hide automation
const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const stealth = StealthPlugin();
stealth.enabledEvasions.delete('iframe.contentWindow');
puppeteer.use(stealth);


//// Helper functions ////

// Format header for use with puppeteer
function formatHeaders(headers) {
  const result = [];
  for (const name in headers) {
    if (!Object.is(headers[name], undefined))
      result.push({name, value: headers[name] + ''});
  }
  return result;
};

// Take puppeteer page cookies and attach them to express response
function attachCookies(cookies, res) {
  updated_response = res;
  for (const cookie of cookies) {
    let cookie_element = [cookie['name'], cookie['value']];
    const ignoreItems = ['name', 'value', 'expires'];
    let options = {};
    for (const key in cookie) {
      if (ignoreItems.indexOf(key) === -1) {
        options[key] = cookie[key]
      }
    }
    cookie_element.push(options)
    updated_response.cookie(...cookie_element);    
  }
  return updated_response;
};

// Enhance networkidle functionality
function waitForNetworkIdle(page, timeout, maxInflightRequests = 0) {
  page.on('request', onRequestStarted);
  page.on('requestfinished', onRequestFinished);
  page.on('requestfailed', onRequestFinished);

  let inflight = 0;
  let fulfill;
  let promise = new Promise(x => fulfill = x);
  let timeoutId = setTimeout(onTimeoutDone, timeout);
  return promise;

  function onTimeoutDone() {
    page.removeListener('request', onRequestStarted);
    page.removeListener('requestfinished', onRequestFinished);
    page.removeListener('requestfailed', onRequestFinished);
    fulfill();
  }

  function onRequestStarted() {
    ++inflight;
    if (inflight > maxInflightRequests)
      clearTimeout(timeoutId);
  }
  
  function onRequestFinished() {
    if (inflight === 0)
      return;
    --inflight;
    if (inflight === maxInflightRequests)
      timeoutId = setTimeout(onTimeoutDone, timeout);
  }
}

////

// Create express server
const app = express();
app.use(express.json())
app.all('*', async (req, res, next) => {

  // Parse JSON payload
  const api_key = req.body.api_key
  const url = req.body.url;
  const proxy = req.body.proxy;
  var headers = req.body.headers || {};
  var cookies = req.body.cookies || [];

  if (process.env.APP_API_KEY != '' && api_key != process.env.APP_API_KEY) {
    return res.status(401).send(
      'Please authenticate.');
  }
  else if (!url) {
    return res.status(400).send(
      'Please provide a URL.');
  }
  else if (proxy && (!proxy.host || !proxy.port)) {
    return res.status(400).send(
      'Proxy provided without host or port.');
  }

  // Convert header keys to lower case
  headers = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  
  headers['user-agent'] = headers['user-agent'] || process.env.APP_DEFAULT_USER_AGENT
  headers['accept-language'] = headers['accept-language'] || process.env.APP_DEFAULT_ACCEPT_LANGUAGE

  // Start Chrome in a way that hides automation
  const ignoreDefaultArgs = ['--enable-automation'];
  const args = [
    '--user-agent=' + headers['user-agent'],
    '--lang=' + headers['accept-language'],
    '--disable-gpu',
    '--no-sandbox',
    '--start-maximized',
    '--disable-infobars',
    '--disable-web-security',
    '--disable-dev-shm-usage',
    '--window-size=1920,1024',
    '--font-render-hinting=none',
    '--silent-debugger-extension-api',
    '--allow-running-insecure-content',
    '--disable-strict-mixed-content-checking',
    '--disable-features=IsolateOrigins,site-per-process',
    '--flag-switches-begin --disable-site-isolation-trials --flag-switches-end'
  ];

  if (proxy) {
    args.push('--proxy-server=' + proxy.host + ':' + proxy.port)
  }

  console.log('Launching puppeteer...');
  
  res.locals.browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.APP_CHROME_PATH,
      defaultViewport: {
        width: 1920,
        height: 1024,
      },
      args: args,
      ignoreDefaultArgs: ignoreDefaultArgs,
  });


  // Open new page
  try {
    res.locals.page = await res.locals.browser.newPage();
    if (cookies) {
      console.log('Setting cookies...');

      // Add required fields to cookies if not net, then set cookies
      updated_cookies = []
      const url_obj = new URL(url)
      for (cookie of cookies) {
        cookie['url'] = cookie['url'] || url;
        cookie['domain'] = cookie['domain'] || url_obj.hostname;
        cookie['path'] = cookie['path'] || '/';
        cookie['expires'] = cookie['expires'] || Date.now() / 1000 + 120;
        await res.locals.page.setCookie(cookie)
      }
    }
    // Create CDP (chrome dev protocol) session to intercept requests and set headers
    // Some headers can't be overriden with the standard setExtraHTTPHeaders approach (e.g. Accept)
    const cdpSession = await res.locals.page.target().createCDPSession()
    
    // Enable interception of request
    await cdpSession.send("Fetch.enable", {
      handleAuthRequests: true,
      patterns: [{requestStage: "Request"}]
    });
    
    // Intercept requests requiring auth (proxies) and send back authentication
    if (proxy) {
      cdpSession.on('Fetch.authRequired', async ({ requestId, request}) => {
        console.log('Proxy authentication required...');
        if (!proxy.user || !proxy.password) {
          console.log('No proxy credentials provided, exiting...');
          res.status(500).send('No proxy credentials provided.');
        }
        else {
          console.log('Authenticating proxy...');
          await cdpSession.send('Fetch.continueWithAuth', {      
            requestId: requestId,
            authChallengeResponse: {
              response: 'ProvideCredentials',
              username: proxy.user,
              password: proxy.password,
            }
          });
        }
      });
    }
    
    // Intercept requests and set headers
    cdpSession.on('Fetch.requestPaused', async ({ requestId, request}) => {      
      if (request.url = url) {
        console.log('Updating headers... ');
        var updated_headers = {...request.headers, ...headers};
      } 
      else {
        var updated_headers = request.headers;
      }      
      await cdpSession.send('Fetch.continueRequest', {
        requestId: requestId,
        headers: formatHeaders(updated_headers)
      });
    });
    
    // Navigate to page and wait for network to be idle for 1s
    console.log('Going to page...');
    await Promise.all([
      res.locals.page.goto(url),
      waitForNetworkIdle(res.locals.page, process.env.APP_NETWORKIDLE_TIME, process.env.APP_NETWORKIDLE_PROCESSES),
    ]);
    next();
  } catch(e) {
    console.error(e);
    res.status(500).send(e.toString());
    await res.locals.browser.close();
    console.log('Closed browser...')
  }
});

// Take a screenshot and store it in the project folder under screenshot.png
app.post('/screenshot', async function screenshotHandler(req, res) {  
  try {
    page = res.locals.page
    const buffer = await res.locals.page.screenshot({ path: 'screenshot.png', fullPage: false });
    console.log('Adding cookies to response...')
    const cookies = await page.cookies();
    res = attachCookies(cookies, res);
    res.type('image/png').send(buffer);    
  } catch (e) {
    console.error(e);
    res.status(500).send(e.toString());
  } finally {
    await res.locals.browser.close();
    console.log('Closed browser...')
  }
});

// Return HTML content
app.post('/content', async function contentHandler(req, res) {  
  try {
    page = res.locals.page
    content = await res.locals.page.content();
    console.log('Adding cookies to response...')
    const cookies = await page.cookies();
    res = attachCookies(cookies, res);
    res.send(content);
  } catch (e) { 
    console.error(e);   
    res.status(500).send(e.toString());
  } finally {
    await res.locals.browser.close();
    console.log('Closed browser...')
  }
});

// Return JSON content
app.post('/json', async function jsonHandler(req, res) {  
  try {
    page = res.locals.page
    content = await page.evaluate(() =>  {
      return JSON.parse(document.querySelector("body").innerText); 
    });
    console.log('Adding cookies to response...')
    const cookies = await page.cookies();
    res = attachCookies(cookies, res);
    res.json(content);
  } catch (e) {
    console.error(e);
    res.status(500).send(e.toString());
  } finally {
    await res.locals.browser.close();
    console.log('Closed browser...')
  }
});

app.listen(process.env.APP_PORT, () => {
  console.log(`Listening at http://localhost:${process.env.APP_PORT}`)
});
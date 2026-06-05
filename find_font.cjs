const https = require('https');
const fs = require('fs');

const options = {
  hostname: 'api.github.com',
  path: '/search/code?q=BankGothic.ttf+extension:ttf',
  headers: {
    'User-Agent': 'Node.js Script'
  }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.items && result.items.length > 0) {
        const item = result.items[0];
        console.log(`Found: ${item.html_url}`);
        // To get the raw URL, change github.com to raw.githubusercontent.com and remove /blob
        const rawUrl = item.html_url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
        console.log(`Raw URL: ${rawUrl}`);
      } else {
        console.log('No items found or rate limited.');
        console.log(data);
      }
    } catch (e) {
      console.log('Error parsing JSON:', e);
      console.log(data);
    }
  });
}).on('error', console.error);

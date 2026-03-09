const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();

    page.on('console', msg => {
        console.log(msg.text());
    });

    await page.goto('file://' + path.resolve('inspect_db_schema.html'), { waitUntil: 'networkidle0' });
    await browser.close();
})();

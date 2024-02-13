// read the Swiggy Bangalore city page and scrape restaurant data here ive useed puppeteer to scrape the data and mongodb to store the data in mongodb

const puppeteer = require('puppeteer');
const MongoDBHelper = require('./mongoDBHelper');

require('dotenv').config();


(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    // Go to the Swiggy Bangalore city page
    await page.goto('https://www.swiggy.com/city/bangalore');

    // Wait for the content to load
    await page.waitForSelector('.sc-gLLvby');

    // Extract restaurant URLs
    const restaurantURLs = await page.evaluate(() => {
        const urls = [];
        const restaurantLinks = document.querySelectorAll('.RestaurantList__RestaurantAnchor-sc-1d3nl43-3.kcEtBq');

        restaurantLinks.forEach(link => {
            urls.push(link.href);
        });
        return urls;
    });

    // Close the browser as we've gathered the URLs
    await browser.close();

    // Connect to MongoDB
    const mongodbHelper = new MongoDBHelper(process.env.MONGODB_URL,'swiggy', 'restaurants');
    await mongodbHelper.connect();

    // Limit to 2 restaurants for testing purposes
    for (let i = 0; i < 2 && i < restaurantURLs.length; i++) {
        const restaurantData = await scrapeRestaurantData(restaurantURLs[i]);

        // Insert restaurant data into MongoDB
        await mongodbHelper.insertOne(restaurantData);
    }

    // Close the MongoDB connection
    await mongodbHelper.close();
})();

async function scrapeRestaurantData(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);

    const restaurantName = await page.$eval('.RestaurantNameAddress_name__2IaTv', element => element.textContent.trim());
    const cuisine = await page.$eval('.RestaurantNameAddress_cuisines__mBHr2', element => element.textContent.trim());

    const items = await page.evaluate(() => {
        const itemList = [];
        const itemContainers = document.querySelectorAll('.styles_container__-kShr');

        itemContainers.forEach(container => {
            const nameElement = container.querySelector('.styles_itemNameText__3ZmZZ');
            const priceElement = container.querySelector('.styles_price__2xrhD');
            const descriptionElement = container.querySelector('.styles_itemDesc__3vhM0');
            const imageElement = container.querySelector('.styles_itemImage__3CsDL > img');

            const name = nameElement ? nameElement.textContent.trim() : '';
            const price = priceElement ? priceElement.textContent.trim() : '';
            const description = descriptionElement ? descriptionElement.textContent.trim() : '';
            const imageUrl = imageElement ? imageElement.getAttribute('src') : '';

            itemList.push({
                name,
                price,
                description,
                imageUrl
            });
        });

        return itemList;
    });

    await browser.close();

    return {
        restaurantName,
        cuisine,
        items
    };
}

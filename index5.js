// Import required packages
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { dbConnect, dbClose } = require('./mongoDBHelper');
const { magicpinUrls } = require('./dataSets/magicPinUrl');
const { RestaurantNames } = require('./dataSets/restrurantNames');

// Entry point of the script
const executeMainLogic = async () => {
    try {
        // Connect to MongoDB
        dbConnect();

        // Fetch common restaurants data
        const commonRestaurants = await fetchCommonRestaurants(RestaurantNames);
        console.log(commonRestaurants);

        // Close MongoDB connection
        dbClose();
    } catch (error) {
        console.error('Error executing main logic:', error);
    }
};

// Execute the main logic
executeMainLogic();

// Function to fetch data for common restaurant
    async function fetchCommonRestaurants(restaurantNames) {
    const commonRestaurants = [];

    try {
        // User agent string for browser
        const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36';

        // Launch Puppeteer browser instance
        const browser = await puppeteer.launch({ headless: true, defaultViewport: null });
        const page = await browser.newPage();

        // Iterate over restaurant names
        for (const restaurantName of restaurantNames) {
            try {
                // Fetch URLs for Swiggy, Zomato, and MagicPin
                const swiggyURL = await getSwiggyURL(page, restaurantName, ua);
                const zomatoURL = await getZomatoURL(page, restaurantName, ua);

                // Scrape data from each URL
                const swiggyData = await scrapeSwiggyRestaurantData(page, swiggyURL, ua);
                const zomatoData = await scrapeZomatoRestaurantData(page, zomatoURL, ua);
                const magicPinData = await fetchDataFromMagicPin(magicpinUrls, browser, ua);

                // Push collected data into commonRestaurants array
                commonRestaurants.push({
                    restaurantName: restaurantName,
                    swiggyData: swiggyData,
                    zomatoData: zomatoData,
                    magicPinData: magicPinData,
                });
            } catch (error) {
                console.error(`Error processing ${restaurantName}:`, error);
            }
        }

        // Close the browser instance
        await browser.close();

        return commonRestaurants;
    } catch (error) {
        console.error('Error fetching common restaurants:', error);
        return null;
    }
}

// Function to fetch data from MagicPin
async function fetchDataFromMagicPin(urls, browser, ua) {
    const restaurantData = [];

    try {
        // Iterate over MagicPin URLs
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            // Scrap menu items from MagicPin
            const data = await scrapMenuItemsFromMagicpin(url, browser, ua);
            restaurantData.push(data);
        }
    } catch (error) {
        console.error('Error fetching data from Magicpin:', error);
    }

    return restaurantData;
}

async function getZomatoURL(page, restaurantName) {
    try {
        // Navigate to Zomato's website
        page.setUserAgent(ua);
        await page.goto('https://www.zomato.com/bangalore/delivery-in-shanti-nagar');

        // Wait for the search input field to appear
        await page.waitForSelector('input[class="sc-fxgLge jUPfKP"][placeholder="Search for restaurant, cuisine or a dish"]', { timeout: 10000 });

        // Clear the search input field and type the restaurant name
        await page.click('.sc-fxgLge.jUPfKP');
        await page.$eval('input[class="sc-fxgLge jUPfKP"][placeholder="Search for restaurant, cuisine or a dish"]', (inputField) => inputField.value = '');
        await delay(2000); // 2 seconds delay
        await typeWithSpeed(page, 'input[class="sc-fxgLge jUPfKP"][placeholder="Search for restaurant, cuisine or a dish"]', restaurantName, 100); // Adjust delay as needed

        await page.keyboard.press('Enter');

        // Wait for the search results to load
        // await page.waitForSelector('.sc-cAJUJo.gPwkty', { timeout: 10000 });
        await delay(2000); // 5 seconds delay

        // Click on the first search result
        await page.click('.sc-1kx5g6g-3.dkwpEa');

        // Extract the URL of the first search result
        const restaurantURL = page.url();
        return restaurantURL;
    } catch (error) {
        console.error('Error getting Zomato URL for', restaurantName, ':', error);
        return null;
    }
}

async function scrapeSwiggyRestaurantData(page, url, ua) {
    try {
        page.setUserAgent(ua);
        await page.goto(url);
        await page.waitForSelector('p.RestaurantNameAddress_name__2IaTv');

        const htmlContent = await page.content();
        const $ = cheerio.load(htmlContent);

        // Extract restaurant data
        const restaurantData = {
            name: $('p.RestaurantNameAddress_name__2IaTv').text().trim(),
            cuisine: $('p.RestaurantNameAddress_cuisines__mBHr2').text().trim(),
            offers: [],
            menu: []
        };

        // Extract offers
        $('div.RestaurantOffer_infoWrapper__2trmg').each((index, element) => {
            const offerAmount = $(element).find('p.RestaurantOffer_header__3FBtQ').text().trim();
            const offerCode = $(element).find('div.RestaurantOffer_offerCodeWrapper__2Cr4F').text().trim();
            restaurantData.offers.push({ discount: offerAmount, code: offerCode });
        });

        // Extract menu items
        $('div.styles_container__-kShr').each((index, element) => {
            const nameElement = $(element).find('h3.styles_itemNameText__3ZmZZ');
            const priceElement = $(element).find('span.styles_price__2xrhD');
            const descriptionElement = $(element).find('div.styles_itemDesc__3vhM0');
            const imageElement = $(element).find('img.styles_itemImage__3CsDL');

            const name = nameElement.text().trim();
            const price = priceElement.text().trim();
            const description = descriptionElement.text().trim();
            const imageUrl = imageElement.attr('src');

            restaurantData.menu.push({ name, price, description, imageUrl });
        });

        return restaurantData;
    } catch (error) {
        console.error('Error scraping Swiggy restaurant data:', error);
        return { error: 'Error scraping Swiggy restaurant data' };
    }
}
// Function to scrape Zomato restaurant data
async function scrapeZomatoRestaurantData(page, url, ua) {
    try {
        // Set user agent for the page
        page.setUserAgent(ua);
        // Navigate to the provided URL
        await page.goto(url);
        // Wait for the selector indicating that the page has loaded
        await page.waitForSelector('h1.sc-iSDuPN');

        // Get the HTML content of the page
        const htmlContent = await page.content();
        const $ = cheerio.load(htmlContent);

        // Initialize an object to store restaurant data
        const restaurantData = {
            name: $('h1.sc-iSDuPN').text().trim(),
            offers: [],
            menu: []
        };

        // Extract menu items
        $('div.sc-1s0saks-13.kQHKsO').each((index, element) => {
            const itemName = $(element).find('h4.sc-1s0saks-15.iSmBPS').text().trim();
            const itemPrice = $(element).find('span.sc-17hyc2s-1.cCiQWA').text().trim(); // This gives ₹273
            restaurantData.menu.push({ name: itemName, price: itemPrice })
        });

        // Extract offers
        $('div.sc-1a03l6b-2.gerWzu').each((index, element) => {
            const offerAmount = $(element).find('div.sc-1a03l6b-0.lkqupg').text().trim();
            const offerCode = $(element).find('div.sc-1a03l6b-1.kvnZBD').text().trim();
            restaurantData.offers.push({ discount: offerAmount, code: offerCode });
        });

        // Return the extracted restaurant data
        return restaurantData;
    } catch (error) {
        console.error('Error scraping Zomato restaurant data:', error);
        return { error: 'Error scraping Zomato restaurant data' };
    }
}

// Function to scrape menu items from Magicpin
async function scrapMenuItemsFromMagicpin(url, browser, ua) {
    try {
        // Create a new page instance
        const page = await browser.newPage();
        // Set user agent for the page
        await page.setUserAgent(ua);
        // Navigate to the provided URL
        await page.goto(url, { waitUntil: 'domcontentloaded' }); // Wait for DOM content to be loaded

        // Get the HTML content of the page
        const htmlContent = await page.content();
        const $ = cheerio.load(htmlContent);

        // Initialize an object to store restaurant data
        const restaurantData = {
            name: $('h1.v2').text().trim(),
            offers: [],
            menu: []
        };

        // Extract offers
        $('.save-highlight.hide-mb span').each((index, element) => {
            const offerText = $(element).text().trim();
            restaurantData.offers.push(offerText);
        });

        // Extract menu items
        $('article.itemInfo').each((index, element) => {
            const itemName = $(element).find('.itemName a').text().trim();
            const itemPriceText = $(element).find('.itemPrice').text().trim();
            const itemPrice = itemPriceText.replace('₹', ''); // Removes the '₹' sign
            restaurantData.menu.push({ name: itemName, price: itemPrice });
        });

        // Close the page instance
        await page.close();

        // Return the extracted restaurant data
        return restaurantData;
    } catch (error) {
        console.error('Error scraping Magicpin restaurant data:', error);
        return { error: 'Error scraping Magicpin restaurant data' };
    }
}

// Function to introduce delay
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to type text with a specified speed
async function typeWithSpeed(page, selector, text, speed) {
    const inputField = await page.$(selector);
    for (const char of text) {
        await inputField.type(char, { delay: speed });
    }
}

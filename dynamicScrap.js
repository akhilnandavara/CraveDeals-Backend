const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
require('dotenv').config();

const swiggyURL = 'https://www.swiggy.com/city/bangalore/arakere-restaurants';
const zomatoUrl = 'https://www.zomato.com/bangalore/delivery-in-bannerghatta-road?delivery_subzone=17605&place_name=Arakere+Gate%2C++Bengaluru%2C++Karnataka';
// MongoDB connection parameters
const url = process.env.MONGODB_URL;
const dbName = 'restaurant_Data';
const collectionName = 'restaurant';
const mongoDBHelper=require('./mongoDBHelper');

(async () => {
    
    // Instantiate the MongoDB helper
    const db = mongoDBHelper(url, dbName, collectionName);
    await db.connect()


    const swiggyData = await fetchDataFromSwiggy();
    const zomatoData = await fetchDataFromZomato();

    const commonRestaurants = await fetchCommonRestaurantsFromSwiggyAndZomato(swiggyData, zomatoData);
    console.log('Common Restaurants:', commonRestaurants);


    // Combine data for common restaurants and store in MongoDB

    await combineAndStoreData(commonRestaurants, swiggyData, zomatoData,db);

    // Close the MongoDB connection
    await db.close();

})();


async function fetchDataFromZomato() {
    try {
        const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36';
        const browser = await puppeteer.launch({ headless: true })
        const page = await browser.newPage();
        page.setUserAgent(ua);
        // page.setDefaultNavigationTimeout(60000); // Set default navigation timeout to 60 seconds

        // Go to the Zomato page for Bangalore city
        await page.goto(zomatoUrl);

        // Wait for the content to load
        // await page.waitForSelector('div.sc-7kepeu-0.sc-eomEcv.efBcpU');

        // Get the HTML content of the page
        const htmlContent = await page.content();

        // Load the HTML content into Cheerio for parsing
        const $ = cheerio.load(htmlContent);

        const restaurantURLs = ['https://www.zomato.com/bangalore/andhra-gunpowder-btm-bangalore/order', 'https://www.zomato.com/bangalore/kfc-1-bannerghatta-road/order'];
        // Extract restaurant URLs
        // $('a.sc-ePDpFu.gjRRBQ').each((index, element) => {
        //     if (index < 40) { // Extract the first 10 links
        //         restaurantURLs.push(`https://www.zomato.com/` + $(element).attr('href'));
        //     }
        // });

        // Close the browser as we've gathered the URLs
        await browser.close();

        // Initialize an array to store restaurant data
        const restaurantData = [];

        // Loop through each restaurant URL and scrape data
        for (const url of restaurantURLs) {
            const data = await scrapeZomatoRestaurantData(url);
            restaurantData.push(data);
        }

        return restaurantData;
    } catch (error) {
        console.error('Error fetching data from Zomato:', error);
        return [];
    }
}


async function scrapeZomatoRestaurantData(url) {
    try {
        const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36';
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        page.setUserAgent(ua);
        await page.goto(url);
        await page.waitForSelector('h1.sc-iSDuPN');


        const htmlContent = await page.content();
        const $ = cheerio.load(htmlContent);

        const restaurantData = {};

        // Extract restaurant name
        restaurantData.name = $('h1.sc-iSDuPN').text().trim();

        // Extract offers
        restaurantData.offers = [];
        $('div.sc-1a03l6b-2.gerWzu').each((index, element) => {
            const offerAmount = $(element).find('div.sc-1a03l6b-0.lkqupg').text().trim();
            const offerCode = $(element).find('div.sc-1a03l6b-1.kvnZBD').text().trim();
            restaurantData.offers.push({ discount: offerAmount, code: offerCode });
        });

        // Extract menu items
        restaurantData.menu = [];
        $('div.sc-1s0saks-13.kQHKsO').each((index, element) => {
            const itemName = $(element).find('h4.sc-1s0saks-15.iSmBPS').text().trim();
            const itemPrice = $(element).find('span.sc-17hyc2s-1.cCiQWA').text().trim();
            restaurantData.menu.push({ name: itemName, price: itemPrice });
        });

        await browser.close();

        return restaurantData;
    } catch (error) {
        console.error('Error scraping restaurant data:', error);
        return { error: 'Error scraping restaurant data' };
    }
}


async function fetchCommonRestaurantsFromSwiggyAndZomato(swiggyData, zomatoData) {
    const commonRestaurants = [];

    // Create a map to store lowercase Swiggy restaurant names for faster lookup
    const swiggyRestaurantMap = new Map();
    swiggyData.forEach(swiggyRestaurant => {
        swiggyRestaurantMap.set(swiggyRestaurant.name.toLowerCase(), swiggyRestaurant);
    });

    // Iterate over Zomato data and check for common restaurants
    zomatoData.forEach(zomatoRestaurant => {
        const zomatoNameLower = zomatoRestaurant.name.toLowerCase();
        // Check if the restaurant name (in lowercase) exists in Swiggy data
        if (swiggyRestaurantMap.has(zomatoNameLower)) {
            // Restaurant found in both Swiggy and Zomato
            commonRestaurants.push({
                restaurantName: zomatoNameLower, // Keep the original case from Zomato
                zomatoData: zomatoRestaurant,
                swiggyData: swiggyRestaurantMap.get(zomatoNameLower) // Get the Swiggy data from the lowercase name
            });
        }
    });
    return commonRestaurants;
}


async function fetchDataFromSwiggy() {

    try {
        const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36';
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        page.setUserAgent(ua);

        await page.goto(swiggyURL);
        // let restaurantURLs = await extractRestaurantURLs(page);
        const restaurantURLs = ['https://www.swiggy.com/restaurants/kfc-brigade-road-ashok-nagar-bangalore-588619', 'https://www.swiggy.com/restaurants/andhra-gunpowder-shivananda-circle-seshadripuram-bangalore-502957'];

        // Keep track of the number of times we have clicked "Show More"
        let showMoreClicks = 0;

        // Click "Show More" until there are no more to load or until we have 20 URLs
        // while (await isShowMoreVisible(page) && restaurantURLs.length < 40) {
        //     await clickShowMore(page);
        //     showMoreClicks++;

        //     const additionalURLs = await extractRestaurantURLs(page);
        //     restaurantURLs = restaurantURLs.concat(additionalURLs);
        // }


        // Close the browser as we've gathered the URLs
        await browser.close()

        // Limit to 20 restaurants for testing purposes
        // restaurantURLs = restaurantURLs.slice(0, 40);

        const restaurantData = [];
        for (const url of restaurantURLs) {
            const data = await scrapeSwiggyRestaurantData(url);
            restaurantData.push(data);
        }

        return restaurantData;
    } catch (error) {
        console.error('Error fetching data from Swiggy:', error);
        return [];
    }
}

// Function to extract restaurant URLs from the grid
async function extractRestaurantURLs(page) {
    const restaurantURLs = [];
    try {
        // Wait for the grid to load
        await page.waitForSelector('.sc-gLLvby.jXGZuP');

        // Extract restaurant URLs
        const urls = await page.evaluate(() => {
            const urls = [];
            const restaurantLinks = document.querySelectorAll('.sc-gLLvby.jXGZuP a');
            restaurantLinks.forEach(link => {
                urls.push(link.href);
            });
            return urls;
        });

        restaurantURLs.push(...urls);
    } catch (error) {
        console.error('Error extracting restaurant URLs:', error);
    }
    return restaurantURLs;
}

// Function to check if the "Show More" button is visible
async function isShowMoreVisible(page) {
    try {
        await page.waitForSelector('.RestaurantList__ShowMoreContainer-sc-1d3nl43-0', { visible: true });
        return true;
    } catch (error) {
        return false;
    }
}

// Function to click on the "Show More" button
async function clickShowMore(page) {
    try {
        await page.click('.InfoCard__Center-sc-16vtyhn-1.fCTraS');
    } catch (error) {
        console.error('Error clicking on "Show More":', error);
    }
}

async function scrapeSwiggyRestaurantData(url) {
    try {
        const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36';
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        page.setUserAgent(ua);
        await page.goto(url);
        await page.waitForSelector('p.RestaurantNameAddress_name__2IaTv');

        const htmlContent = await page.content();
        const $ = cheerio.load(htmlContent);

        const restaurantData = {};

        restaurantData.name = $('p.RestaurantNameAddress_name__2IaTv').text().trim();
        restaurantData.cuisine = $('p.RestaurantNameAddress_cuisines__mBHr2').text().trim();

        // Extract offers
        restaurantData.offers = [];
        $('div.RestaurantOffer_infoWrapper__2trmg').each((index, element) => {
            const offerAmount = $(element).find('p.RestaurantOffer_header__3FBtQ').text().trim();
            const offerCode = $(element).find('div.RestaurantOffer_offerCodeWrapper__2Cr4F').text().trim();
            restaurantData.offers.push({ discount: offerAmount, code: offerCode });
        });

        restaurantData.menu = [];
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
        await browser.close();


        return restaurantData;
    } catch (error) {
        console.error('Error scraping Swiggy restaurant data:', error);
        return { error: 'Error scraping Swiggy restaurant data' };
    }
}





async function combineAndStoreData(commonRestaurants, swiggyData, zomatoData, db) {
    const combinedData = [];
    commonRestaurants.forEach(restaurant => {
        const swiggyRestaurant = swiggyData.find(items => items.name.toLowerCase() === restaurant.restaurantName);
        const zomatoRestaurant = zomatoData.find(items => items.name.toLowerCase() === restaurant.restaurantName);

        if (swiggyRestaurant && zomatoRestaurant) {
            const combinedRestaurant = {
                name: swiggyRestaurant.name,
                cuisine: swiggyRestaurant.cuisine,
                zomatoOffers: zomatoRestaurant.offers,
                swiggyOffers: swiggyRestaurant.offers,
                menu: []
            };
            swiggyRestaurant.menu.forEach(swiggyItem => {
                const zomatoItem = zomatoRestaurant.menu.find(item => item.name === swiggyItem.name);
                if (zomatoItem) {
                    combinedRestaurant.menu.push({
                        name: swiggyItem.name,
                        swiggyPrice: swiggyItem.price,
                        zomatoPrice: zomatoItem.price,
                    });
                }
               
            });
            combinedData.push(combinedRestaurant);
        }
    });
    await db.insertMany( combinedData);
    
}

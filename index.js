// fetchs  swiggy and  zomato restrurant data for predefined urls and stores/updates  it in MongoDB 

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const Restaurant = require('./modals/Restaurant');
const { dbConnect } = require('./mongoDBHelper');
require('dotenv').config();

const swiggyURLs = [
    'https://www.swiggy.com/restaurants/kfc-4th-phase-jp-nagar-bangalore-17312',
    'https://www.swiggy.com/restaurants/truffles-1st-phase-jp-nagar-bangalore-64131',
    'https://www.swiggy.com/restaurants/meghana-foods-bannergatta-main-road-arekere-bangalore-167101'
];

const zomatoURLs = [
    'https://www.zomato.com/bangalore/truffles-1-jp-nagar-bangalore/order',
    'https://www.zomato.com/bangalore/kfc-1-bannerghatta-road/order',
    'https://www.zomato.com/bangalore/meghana-foods-bannerghatta-road-bangalore/order'
];

(async () => {
    dbConnect()

    const swiggyData = await fetchDataFromSwiggy(swiggyURLs);
    const zomatoData = await fetchDataFromZomato(zomatoURLs);

    const commonRestaurants = await fetchCommonRestaurantsFromSwiggyAndZomato(swiggyData, zomatoData);

    // Combine data for common restaurants and store in MongoDB
    await combineAndStoreData(commonRestaurants, swiggyData, zomatoData);

})();

async function fetchDataFromSwiggy(urls) {
    const restaurantData = [];

    try {
        const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36';
        const browser = await puppeteer.launch({ headless: true });

        for (const url of urls) {
            const data = await scrapeSwiggyRestaurantData(url, browser, ua);
            restaurantData.push(data);
        }

        // Close the browser as we've gathered the URLs
        await browser.close();
    } catch (error) {
        console.error('Error fetching data from Swiggy:', error);
    }

    return restaurantData;
}

async function fetchDataFromZomato(urls) {
    const restaurantData = [];

    try {
        const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36';
        const browser = await puppeteer.launch({ headless: true });

        for (const url of urls) {
            const data = await scrapeZomatoRestaurantData(url, browser, ua);
            restaurantData.push(data);
        }

        // Close the browser as we've gathered the URLs
        await browser.close();
    } catch (error) {
        console.error('Error fetching data from Zomato:', error);
    }

    return restaurantData;
}

async function scrapeSwiggyRestaurantData(url, browser, ua) {
    try {
        const page = await browser.newPage();
        page.setUserAgent(ua);
        await page.goto(url);
        await page.waitForSelector('p.RestaurantNameAddress_name__2IaTv');

        const htmlContent = await page.content();
        const $ = cheerio.load(htmlContent);

        const restaurantData = {
            name: $('p.RestaurantNameAddress_name__2IaTv').text().trim(),
            cuisine: $('p.RestaurantNameAddress_cuisines__mBHr2').text().trim(),
            offers: [],
            menu: []
        };

        $('div.RestaurantOffer_infoWrapper__2trmg').each((index, element) => {
            const offerAmount = $(element).find('p.RestaurantOffer_header__3FBtQ').text().trim();
            const offerCode = $(element).find('div.RestaurantOffer_offerCodeWrapper__2Cr4F').text().trim();
            restaurantData.offers.push({ discount: offerAmount, code: offerCode });
        });

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

        await page.close();
        return restaurantData;
    } catch (error) {
        console.error('Error scraping Swiggy restaurant data:', error);
        return { error: 'Error scraping Swiggy restaurant data' };
    }
}

async function scrapeZomatoRestaurantData(url, browser, ua) {
    try {
        const page = await browser.newPage();
        page.setUserAgent(ua);
        await page.goto(url);
        await page.waitForSelector('h1.sc-iSDuPN');

        const htmlContent = await page.content();
        const $ = cheerio.load(htmlContent);

        const restaurantData = {
            name: $('h1.sc-iSDuPN').text().trim(),
            offers: [],
            menu: []
        };

        $('div.sc-1a03l6b-2.gerWzu').each((index, element) => {
            const offerAmount = $(element).find('div.sc-1a03l6b-0.lkqupg').text().trim();
            const offerCode = $(element).find('div.sc-1a03l6b-1.kvnZBD').text().trim();
            restaurantData.offers.push({ discount: offerAmount, code: offerCode });
        });

        $('div.sc-1s0saks-13.kQHKsO').each((index, element) => {
            const itemName = $(element).find('h4.sc-1s0saks-15.iSmBPS').text().trim();
            const itemPrice = $(element).find('span.sc-17hyc2s-1.cCiQWA').text().trim();
            restaurantData.menu.push({ name: itemName, price: itemPrice });
        });

        await page.close();
        return restaurantData;
    } catch (error) {
        console.error('Error scraping Zomato restaurant data:', error);
        return { error: 'Error scraping Zomato restaurant data' };
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

async function combineAndStoreData(commonRestaurants, swiggyData, zomatoData) {
    const combinedData = [];

    for (const restaurant of commonRestaurants) {
        const swiggyRestaurant = swiggyData.find(items => items.name.toLowerCase() === restaurant.restaurantName);
        const zomatoRestaurant = zomatoData.find(items => items.name.toLowerCase() === restaurant.restaurantName);

        if (swiggyRestaurant && zomatoRestaurant) {
            const existingRestaurant = await Restaurant.findOne({ name: swiggyRestaurant.name });

            if (existingRestaurant) {
                // Check for changes in the menu
                const updatedMenu = [];

                swiggyRestaurant.menu.forEach(swiggyItem => {
                    const zomatoItem = zomatoRestaurant.menu.find(item => item.name.toLowerCase() === swiggyItem.name.toLowerCase());
                    if (zomatoItem) {
                        updatedMenu.push({
                            name: swiggyItem.name,
                            swiggyPrice: swiggyItem.price,
                            zomatoPrice: zomatoItem.price,
                        });
                    }
                });

                // Update the menu if there are changes
                if (updatedMenu.length > 0) {
                    existingRestaurant.menu = updatedMenu;
                    await existingRestaurant.save();
                    console.log(`Updated menu for restaurant: ${existingRestaurant.name}`);
                }
            } else {
                // Create new document if restaurant doesn't exist
                const combinedRestaurant = new Restaurant({
                    name: swiggyRestaurant.name,
                    cuisine: swiggyRestaurant.cuisine,
                    zomatoOffers: zomatoRestaurant.offers,
                    swiggyOffers: swiggyRestaurant.offers,
                    menu: []
                });

                // Add menu items to the combined restaurant
                swiggyRestaurant.menu.forEach(swiggyItem => {
                    const zomatoItem = zomatoRestaurant.menu.find(item => item.name.toLowerCase() === swiggyItem.name.toLowerCase());
                    if (zomatoItem) {
                        combinedRestaurant.menu.push({
                            name: swiggyItem.name,
                            swiggyPrice: swiggyItem.price,
                            zomatoPrice: zomatoItem.price,
                        });
                    }
                });

                // Save the new restaurant document to the database
                await combinedRestaurant.save();
                console.log(`New restaurant added: ${combinedRestaurant.name}`);
            }
        }
    }
}



// This code fetches restaurant data from Swiggy, Zomato, and Magicpin for predefined URLs and stores or updates it in MongoDB.
// The code is designed to run at 8 AM every day.

// Required dependencies
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const Restaurant = require('./modals/Restaurant'); // Assuming this imports the Restaurant model
const { dbConnect, dbClose } = require('./mongoDBHelper'); // Assuming this file contains MongoDB connection helpers
const { magicpinUrls } = require('./dataSets/magicPinUrl');
const { swiggyUrls } = require('./dataSets/swiggyUrl');
const { zomatoUrls } = require('./dataSets/zomatoUrl');
require('dotenv').config();

// Required node-cron and moment-timezone for scheduling tasks
const cron = require('node-cron');
const moment = require('moment-timezone');

// Main logic to execute
(async () => {
    try {
        dbConnect(); // Connect to MongoDB

        // Fetch data from Swiggy, Zomato, and Magicpin
        const [swiggyData, zomatoData, magicPinData] = await Promise.all([
            fetchDataFromSwiggy(swiggyUrls),
            fetchDataFromZomato(zomatoUrls),
            fetchDataFromMagicPin(magicpinUrls)
        ]);

        // Find common restaurants among Swiggy, Zomato, and Magicpin data
        const commonRestaurants = await fetchCommonRestaurants(swiggyData, zomatoData, magicPinData);
        console.log(commonRestaurants);

        // Combine and store the data in MongoDB
        await combineAndStoreData(commonRestaurants, swiggyData, zomatoData, magicPinData);

        dbClose(); // Close MongoDB connection
    } catch (error) {
        console.error('Error executing main logic:', error);
    }
})();

// Schedule the task to run at 8 AM Indian time
cron.schedule('0 8 * * *', async () => {
    console.log(`Running scheduled task at ${moment.tz('Asia/Kolkata').format()}`);
    await executeMainLogic();
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});

// Function to fetch data from Swiggy based on provided URLs
async function fetchDataFromSwiggy(urls) {
    const restaurantData = []; // Initialize an array to store fetched restaurant data

    try {
        // Define user agent for browser
        const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36';
        // Launch a headless browser instance with Puppeteer
        const browser = await puppeteer.launch({ headless: true });

        // Iterate over each URL in the provided array
        for (const url of urls) {
            // Scrape restaurant data from Swiggy for the current URL
            const data = await scrapeSwiggyRestaurantData(url, browser, ua);
            // Push the scraped data into the restaurantData array
            restaurantData.push(data);
        }

        // Close the browser after fetching data from all URLs
        await browser.close();
    } catch (error) {
        // Handle errors that may occur during data fetching
        console.error('Error fetching data from Swiggy:', error);
    }

    // Return the fetched restaurant data array
    return restaurantData;
}

// Function to fetch data from Zomato based on provided URLs
async function fetchDataFromZomato(urls) {
    const restaurantData = []; // Initialize an array to store fetched restaurant data

    try {
        // Define user agent for browser
        const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36';
        // Launch a headless browser instance with Puppeteer
        const browser = await puppeteer.launch({ headless: true });

        // Iterate over each URL in the provided array
        for (const url of urls) {
            // Scrape restaurant data from Zomato for the current URL
            const data = await scrapeZomatoRestaurantData(url, browser, ua);
            // Push the scraped data into the restaurantData array
            restaurantData.push(data);
        }

        // Close the browser after fetching data from all URLs
        await browser.close();
    } catch (error) {
        // Handle errors that may occur during data fetching
        console.error('Error fetching data from Zomato:', error);
    }

    // Return the fetched restaurant data array
    return restaurantData;
}

// Function to fetch data from Magicpin based on provided URLs
async function fetchDataFromMagicPin(urls) {
    const restaurantData = []; // Initialize an array to store fetched restaurant data

    try {
        // Launch a headless browser instance with Puppeteer
        const browser = await puppeteer.launch({ headless: true });

        // Iterate over each URL in the provided array
        for (const url of urls) {
            // Scrape menu items data from Magicpin for the current URL
            const data = await scrapMenuItemsFromMagicpin(url, browser);
            // Push the scraped data into the restaurantData array
            restaurantData.push(data);
        }

        // Close the browser after fetching data from all URLs
        await browser.close();
    } catch (error) {
        // Handle errors that may occur during data fetching
        console.error('Error fetching data from Magicpin:', error);
    }

    // Return the fetched restaurant data array
    return restaurantData;
}


// Function to scrape menu items from Magicpin
async function scrapMenuItemsFromMagicpin(url, browser) {
    try {
        // Open a new page with the provided browser instance
        const page = await browser.newPage();
        // Navigate to the provided URL
        await page.goto(url);

        // Wait for a certain amount of time to ensure dynamic content is loaded
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Get the entire HTML content of the page
        const htmlContent = await page.content();
        
        // Load the HTML content into Cheerio for parsing
        const $ = cheerio.load(htmlContent);

        // Initialize an object to store restaurant data
        const restaurantData = {
            name: $('h1.v2').text().trim(), // Extract the restaurant name
            offers: [], // Initialize an empty array to store offers
            menu: [] // Initialize an empty array to store menu items
        };

        // Retrieve the text content of the <span> element inside the selected element and trim it
        const offerText = $('.save-highlight.hide-mb span').text().trim();

        // Push the retrieved text content into the offers array
        restaurantData.offers.push(offerText);

        // Extract menu items
        $('article.itemInfo').map((index, element) => {
            const itemName = $(element).find('.itemName a').text().trim(); // Extract item name
            const itemPriceText = $(element).find('.itemPrice').text().trim(); // Extract item price (e.g., ₹273)
            const itemPrice = itemPriceText.replace('₹', ''); // Removes the '₹' sign

            // Push the menu item into the menu array
            restaurantData.menu.push({ name: itemName ? itemName : '', price: itemPrice ? itemPrice : '' });
        }).get();

        // Close the page after scraping
        await page.close();

        // Return the scraped restaurant data
        return restaurantData;
    } catch (error) {
        console.error('Error scraping magicpin restaurant data:', error);
        // If an error occurs during scraping, return an error object
        return { error: 'Error scraping magicpin restaurant data' };
    }
}

// Function to scrape restaurant data from Swiggy
async function scrapeSwiggyRestaurantData(url, browser, ua) {
    try {
        // Open a new page with the provided browser instance
        const page = await browser.newPage();
        // Set the user agent
        page.setUserAgent(ua);
        // Navigate to the provided URL
        await page.goto(url);
        // Wait for the selector to load
        await page.waitForSelector('p.RestaurantNameAddress_name__2IaTv');

        // Get the HTML content of the page
        const htmlContent = await page.content();
        // Load the HTML content into Cheerio for parsing
        const $ = cheerio.load(htmlContent);

        // Initialize an object to store restaurant data
        const restaurantData = {
            name: $('p.RestaurantNameAddress_name__2IaTv').text().trim(), // Extract the restaurant name
            cuisine: $('p.RestaurantNameAddress_cuisines__mBHr2').text().trim(), // Extract the cuisine
            offers: [], // Initialize an empty array to store offers
            menu: [] // Initialize an empty array to store menu items
        };

        // Extract offers
        $('div.RestaurantOffer_infoWrapper__2trmg').each((index, element) => {
            const offerAmount = $(element).find('p.RestaurantOffer_header__3FBtQ').text().trim(); // Extract offer amount
            const offerCode = $(element).find('div.RestaurantOffer_offerCodeWrapper__2Cr4F').text().trim(); // Extract offer code
            // Push the offer data into the offers array
            restaurantData.offers.push({ discount: offerAmount, code: offerCode });
        });

        // Extract menu items
        $('div.styles_container__-kShr').each((index, element) => {
            const nameElement = $(element).find('h3.styles_itemNameText__3ZmZZ');
            const priceElement = $(element).find('span.styles_price__2xrhD');
            const descriptionElement = $(element).find('div.styles_itemDesc__3vhM0');
            const imageElement = $(element).find('img.styles_itemImage__3CsDL');

            const name = nameElement.text().trim(); // Extract item name
            const price = priceElement.text().trim(); // Extract item price
            const description = descriptionElement.text().trim(); // Extract item description
            const imageUrl = imageElement.attr('src'); // Extract item image URL

            // Push the menu item into the menu array
            restaurantData.menu.push({ name, price, description, imageUrl });
        });

        // Close the page after scraping
        await page.close();
        // Return the scraped restaurant data
        return restaurantData;
    } catch (error) {
        console.error('Error scraping Swiggy restaurant data:', error);
        // If an error occurs during scraping, return an error object
        return { error: 'Error scraping Swiggy restaurant data' };
    }
}


// Function to scrape restaurant data from Zomato
async function scrapeZomatoRestaurantData(url, browser, ua) {
    try {
        // Open a new page with the provided browser instance
        const page = await browser.newPage();
        // Set the user agent
        page.setUserAgent(ua);
        // Navigate to the provided URL
        await page.goto(url);
        // Wait for the selector to load
        await page.waitForSelector('h1.sc-iSDuPN');

        // Get the HTML content of the page
        const htmlContent = await page.content();
        // Load the HTML content into Cheerio for parsing
        const $ = cheerio.load(htmlContent);

        // Initialize an object to store restaurant data
        const restaurantData = {
            name: $('h1.sc-iSDuPN').text().trim(), // Extract restaurant name
            offers: [], // Initialize an empty array to store offers
            menu: [] // Initialize an empty array to store menu items
        };

        // Extract menu items
        $('div.sc-1s0saks-13.kQHKsO').each((index, element) => {
            const itemName = $(element).find('h4.sc-1s0saks-15.iSmBPS').text().trim(); // Extract item name
            const itemPrice = $(element).find('span.sc-17hyc2s-1.cCiQWA').text().trim(); // Extract item price
            restaurantData.menu.push({ name: itemName, price: itemPrice }); // Push item data into the menu array
        });

        // Extract offers
        $('div.sc-1a03l6b-2.gerWzu').each((index, element) => {
            const offerAmount = $(element).find('div.sc-1a03l6b-0.lkqupg').text().trim(); // Extract offer amount
            const offerCode = $(element).find('div.sc-1a03l6b-1.kvnZBD').text().trim(); // Extract offer code
            restaurantData.offers.push({ discount: offerAmount, code: offerCode }); // Push offer data into the offers array
        });

        // Close the page after scraping
        await page.close();
        
        // Return the scraped restaurant data
        return restaurantData;
    } catch (error) {
        console.error('Error scraping Zomato restaurant data:', error);
        // If an error occurs during scraping, return an error object
        return { error: 'Error scraping Zomato restaurant data' };
    }
}


// Function to find common restaurants among Swiggy, Zomato, and Magicpin data
async function fetchCommonRestaurants(swiggyData, zomatoData, magicPinData) {
    // Initialize an array to store common restaurants
    const commonRestaurants = [];

    // Create maps to store lowercase restaurant names for faster lookup
    const swiggyRestaurantMap = new Map();
    const magicPinRestaurantMap = new Map();

    // Populate Swiggy restaurant map
    swiggyData.forEach(swiggyRestaurant => {
        swiggyRestaurantMap.set(swiggyRestaurant.name.toLowerCase(), swiggyRestaurant);
    });

    // Populate MagicPin restaurant map
    magicPinData.forEach(magicPinRestaurant => {
        magicPinRestaurantMap.set(magicPinRestaurant.name.toLowerCase(), magicPinRestaurant);
    });

    // Iterate over Zomato data and check for common restaurants
    zomatoData.forEach(zomatoRestaurant => {
        const zomatoNameLower = zomatoRestaurant.name.toLowerCase();

        // Check if the restaurant name (in lowercase) exists in Swiggy data and MagicPin data
        if (swiggyRestaurantMap.has(zomatoNameLower) && magicPinRestaurantMap.has(zomatoNameLower)) {
            // Restaurant found in Swiggy, Zomato, and MagicPin
            commonRestaurants.push({
                restaurantName: zomatoRestaurant.name, // Keep the original case from Zomato
                zomatoData: zomatoRestaurant,
                swiggyData: swiggyRestaurantMap.get(zomatoNameLower), // Get the Swiggy data from the lowercase name
                magicPinData: magicPinRestaurantMap.get(zomatoNameLower) // Get the MagicPin data from the lowercase name
            });
        }
    });

    return commonRestaurants;
}

// Function to combine and store data in MongoDB
async function combineAndStoreData(commonRestaurants, swiggyData, zomatoData, magicPinData) {
    // Initialize an array to store combined data
    const combinedData = [];

    // Check if commonRestaurants is an array
    if (!Array.isArray(commonRestaurants)) {
        console.error('commonRestaurants is not an array');
        return;
    }

    // Iterate through common restaurants
    for (const restaurant of commonRestaurants) {
        // Find corresponding restaurant data from Swiggy, Zomato, and MagicPin datasets
        const swiggyRestaurant = swiggyData.find(item => item.name.toLowerCase() === restaurant.restaurantName.toLowerCase());
        const zomatoRestaurant = zomatoData.find(item => item.name.toLowerCase() === restaurant.restaurantName.toLowerCase());
        const magicPinRestaurant = magicPinData.find(item => item.name.toLowerCase() === restaurant.restaurantName.toLowerCase());

        // If data is available for all platforms
        if (swiggyRestaurant && zomatoRestaurant && magicPinRestaurant) {
            // Check if the restaurant already exists in the database
            let existingRestaurant = await Restaurant.findOne({ name: swiggyRestaurant.name });

            // If the restaurant does not exist, check Zomato and MagicPin
            if (!existingRestaurant) {
                existingRestaurant = await Restaurant.findOne({ name: zomatoRestaurant.name });
            }

            if (!existingRestaurant) {
                existingRestaurant = await Restaurant.findOne({ name: magicPinRestaurant.name });
            }

            if (existingRestaurant) {
                // Update menu and offers if needed
                const updatedMenu = [];
                const updatedOffers = [];

                // Update menu based on data from all platforms
                swiggyRestaurant.menu.forEach(swiggyItem => {
                    const zomatoItem = zomatoRestaurant.menu.find(item => item.name.toLowerCase() === swiggyItem.name.toLowerCase());
                    const magicPinItem = magicPinRestaurant.menu.find(item => item.name.toLowerCase() === swiggyItem.name.toLowerCase());
                    if (zomatoItem && magicPinItem) {
                        updatedMenu.push({
                            name: swiggyItem.name,
                            description: swiggyItem.description,
                            image: swiggyItem.imageUrl,
                            swiggyPrice: swiggyItem.price,
                            zomatoPrice: zomatoItem.price,
                            magicPinPrice: magicPinItem.price,
                        });
                    }
                });

                // Update offers if available
                if (swiggyRestaurant.offers && zomatoRestaurant.offers && magicPinRestaurant.offers) {
                    updatedOffers.push({
                        swiggyOffers: swiggyRestaurant.offers,
                        zomatoOffers: zomatoRestaurant.offers,
                        magicPinOffers: magicPinRestaurant.offers,
                    });
                }

                // Update the menu and offers if there are changes
                if (updatedMenu.length > 0 || updatedOffers.length > 0) {
                    existingRestaurant.menu = updatedMenu;
                    existingRestaurant.swiggyOffers = swiggyRestaurant.offers;
                    existingRestaurant.zomatoOffers = zomatoRestaurant.offers;
                    existingRestaurant.magicPinOffers = magicPinRestaurant.offers;
                    await existingRestaurant.save();
                    console.log(`Updated restaurant: ${existingRestaurant.name}`);
                }
            } else {
                // If no existing restaurant found, create a new one
                const combinedRestaurant = new Restaurant({
                    name: swiggyRestaurant.name,
                    cuisine: swiggyRestaurant.cuisine,
                    zomatoOffers: zomatoRestaurant.offers,
                    swiggyOffers: swiggyRestaurant.offers,
                    magicPinOffers: magicPinRestaurant.offers,
                    menu: []
                });

                // Add menu items to the combined restaurant
                swiggyRestaurant.menu.forEach(swiggyItem => {
                    const zomatoItem = zomatoRestaurant.menu.find(item => item.name.toLowerCase() === swiggyItem.name.toLowerCase());
                    const magicPinItem = magicPinRestaurant.menu.find(item => item.name.toLowerCase() === swiggyItem.name.toLowerCase());
                    if (zomatoItem && magicPinItem) {
                        combinedRestaurant.menu.push({
                            name: swiggyItem.name,
                            description: swiggyItem?.description,
                            image: swiggyItem?.imageUrl,
                            swiggyPrice: swiggyItem.price,
                            zomatoPrice: zomatoItem.price,
                            magicPinPrice: magicPinItem.price,
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



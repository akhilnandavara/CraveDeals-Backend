// fetchs  swiggy and  zomato restrurant data for predefined urls and stores/updates  it in MongoDB 

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const Restaurant = require('./modals/Restaurant');
const { dbConnect, dbClose } = require('./mongoDBHelper');
const { magicpinUrls } = require('./dataSets/magicPinUrl');
const { swiggyUrls } = require('./dataSets/swiggyUrl');
const { zomatoUrls } = require('./dataSets/zomatoUrl');
require('dotenv').config();


const cron = require('node-cron');
const moment = require('moment-timezone');

const executeMainLogic = async () => {
    try {
        dbConnect();

        const [swiggyData, zomatoData, magicPinData] = await Promise.all([
            fetchDataFromSwiggy(swiggyUrls),
            fetchDataFromZomato(zomatoUrls),
            fetchDataFromMagicPin(magicpinUrls)
        ]);

        const commonRestaurants =await  fetchCommonRestaurants(swiggyData, zomatoData, magicPinData);
        console.log(commonRestaurants)
        await combineAndStoreData(commonRestaurants, swiggyData, zomatoData, magicPinData);

        dbClose();
    } catch (error) {
        console.error('Error executing main logic:', error);
    }
};

// // Schedule the task to run at 8 AM Indian time
// cron.schedule('0 8 * * *', async () =>   {
//     console.log(`Running scheduled task at ${moment.tz('Asia/Kolkata').format()}`);
//     await executeMainLogic();
// }, {
//     scheduled: true,
//     timezone: "Asia/Kolkata"
// });
executeMainLogic()

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

async function fetchDataFromMagicPin(urls) {
    const restaurantData = [];

    try {
        const browser = await puppeteer.launch({ headless: true });

        for (const url of urls) {
            const data = await scrapMenuItemsFromMagicpin(url, browser);
            restaurantData.push(data);
        }

        // Close the browser as we've gathered the URLs
        await browser.close();
    } catch (error) {
        console.error('Error fetching data from Magicpin:', error);
    }

    return restaurantData;
}

async function scrapMenuItemsFromMagicpin(url, browser) {
    try {
        const page = await browser.newPage();
        await page.goto(url);

        // Wait for a certain amount of time to ensure dynamic content is loaded
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        // Get the entire HTML content of the page
        const htmlContent = await page.content();
        
        // Load the HTML content into Cheerio for parsing
        const $ = cheerio.load(htmlContent);


        const restaurantData = {
            name: $('h1.v2').text().trim(),
            offers: [],
            menu: []
        };
        // Retrieve the text content of the <span> element inside the selected element and trim it
        const offerText = $('.save-highlight.hide-mb span').text().trim();

        // Push the retrieved text content into the offers array
        restaurantData.offers.push(offerText);

        //extracting menu items
        $('article.itemInfo').map((index, element) => {
            const itemName = $(element).find('.itemName a').text().trim();
            const itemPriceText = $(element).find('.itemPrice').text().trim(); // This gives ₹273
            const itemPrice = itemPriceText.replace('₹', ''); // Removes the '₹' sign


            restaurantData.menu.push({ name: itemName ? itemName : '', price: itemPrice ? itemPrice : '' })
        }).get();


        await page.close();

        return restaurantData;
    } catch (error) {
        console.error('Error scraping magicpin restaurant data:', error);
        return { error: 'Error scraping magicpin restaurant data' };
    }
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



        $('div.sc-1s0saks-13.kQHKsO').each((index, element) => {
            const itemName = $(element).find('h4.sc-1s0saks-15.iSmBPS').text().trim();
            const itemPrice = $(element).find('span.sc-17hyc2s-1.cCiQWA').text().trim(); // This gives ₹273
            restaurantData.menu.push({ name: itemName, price: itemPrice })
        });

        $('div.sc-1a03l6b-2.gerWzu').each((index, element) => {
            const offerAmount = $(element).find('div.sc-1a03l6b-0.lkqupg').text().trim();
            const offerCode = $(element).find('div.sc-1a03l6b-1.kvnZBD').text().trim();
            restaurantData.offers.push({ discount: offerAmount, code: offerCode });
        });

        await page.close();
        return restaurantData;
    } catch (error) {
        console.error('Error scraping Zomato restaurant data:', error);
        return { error: 'Error scraping Zomato restaurant data' };
    }
}

async function fetchCommonRestaurants(swiggyData, zomatoData, magicPinData) {
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


async function combineAndStoreData(commonRestaurants, swiggyData, zomatoData, magicPinData) {
    const combinedData = [];
    if (!Array.isArray(commonRestaurants)) {
        console.error('commonRestaurants is not an array');
        return;
    }
    for (const restaurant of commonRestaurants) {
        const swiggyRestaurant = swiggyData.find(item => item.name.toLowerCase() === restaurant.restaurantName.toLowerCase());
        const zomatoRestaurant = zomatoData.find(item => item.name.toLowerCase() === restaurant.restaurantName.toLowerCase());
        const magicPinRestaurant = magicPinData.find(item => item.name.toLowerCase() === restaurant.restaurantName.toLowerCase());

        if (swiggyRestaurant && zomatoRestaurant && magicPinRestaurant) {
            let existingRestaurant = await Restaurant.findOne({ name: swiggyRestaurant.name });

            if (!existingRestaurant) {
                existingRestaurant = await Restaurant.findOne({ name: zomatoRestaurant.name });
            }

            if (!existingRestaurant) {
                existingRestaurant = await Restaurant.findOne({ name: magicPinRestaurant.name });
            }

            if (existingRestaurant) {
                // Existing restaurant found, update menu and offers if needed
                const updatedMenu = [];
                const updatedOffers = [];

                // Update menu
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

                // Update offers
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
                // No existing restaurant found, create a new one
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



// Import required packages
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
require('dotenv').config();
const { dbConnect, dbClose } = require('./mongoDBHelper');
const { magicpinUrls } = require('./dataSets/magicPinUrl');
const { RestaurantNames } = require('./dataSets/restaurantNames');
const Restaurant = require('./modals/Restaurant');
const fuzzball = require('fuzzball');

// Entry point of the script
exports.fetchRestaurantUpdatedData = async () => {
    try {
        // Fetch common restaurants data
        await fetchCommonRestaurants(RestaurantNames);
    } catch (error) {
        console.error('Error executing main logic:', error);
    }
};

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
            let retryCount = 0;
            const maxRetries = 4;
            try {
                // Fetch URLs for Swiggy, Zomato
                const swiggyURL = await getSwiggyURL(page, restaurantName, ua);
                const zomatoURL = await getZomatoURL(page, restaurantName, ua);
                const googleURL = await getGoogleURL(page, restaurantName, ua);

                // Scrape swiggy data from each URL
                let swiggyData = await scrapeSwiggyRestaurantData(page, swiggyURL, ua);
                while (swiggyData.menu.length === 0 && retryCount < maxRetries) {
                    console.log(`Retrying fetching Swiggy data for ${restaurantName}, attempt ${retryCount + 1}`);
                    swiggyData = await scrapeSwiggyRestaurantData(page, swiggyURL, ua);
                    retryCount++;
                }
                retryCount = 0;

                let zomatoData = await scrapeZomatoRestaurantData(page, zomatoURL, ua);
                //scrapping zomato data
                while (zomatoData.menu.length === 0 && retryCount < maxRetries) {
                    console.log(`Retrying fetching Zomato data for ${restaurantName}, attempt ${retryCount + 1}`);
                    zomatoData = await scrapeZomatoRestaurantData(page, zomatoURL, ua);
                    retryCount++;
                }
                retryCount = 0;

                //scrape google data
                let googleData = await scrapeGoogleRestaurantData(page, googleURL, ua);
                while (googleData.reviews.length === 0 && retryCount < maxRetries) {
                    console.log(`Retrying fetching Google data for ${restaurantName}, attempt ${retryCount + 1}`);
                    googleData = await scrapeGoogleRestaurantData(page, googleURL, ua);
                    retryCount++;
                }
                retryCount = 0;


                // Find the MagicPin URL for the current restaurant
                const magicPinURL = magicpinUrls.find(url => url.includes(restaurantName.replace(/\s/g, '-').trim()));

                if (magicPinURL) {
                    // Fetch data from MagicPin
                    let magicPinData = await scrapMenuItemsFromMagicpin(magicPinURL, browser, ua);
                    // console.log(magicPinData)
                    while (magicPinData.menu.length === 0 && retryCount < maxRetries) {
                        console.log(`Retrying fetching MagicPin data for ${restaurantName}, attempt ${retryCount + 1}`);
                        magicPinData = await scrapMenuItemsFromMagicpin(magicPinURL, browser, ua);
                        retryCount++;
                    }

                    retryCount = 0;
                    // Combined menu array to hold menu items with prices from different sources
                    // Define the final combined menu array
                    const combinedMenu = [];

                    // Iterate through each section heading in the swiggyData.menu
                    for (const sectionHeading in swiggyData.menu) {
                        if (Object.hasOwnProperty.call(swiggyData.menu, sectionHeading)) {
                            const menuItemsInSection = swiggyData.menu[sectionHeading];

                            // Iterate through each menu item in the current section
                            const combinedMenuItemsInSection = menuItemsInSection.map(swiggyItem => {
                                // Find the corresponding item in Zomato data
                                const zomatoItem = zomatoData.menu?.find(item => item.name.toLowerCase() === swiggyItem.name.toLowerCase());

                                // Find the corresponding item in MagicPin data
                                const magicPinItem = magicPinData.menu?.find(item => item.name.toLowerCase() === swiggyItem.name.toLowerCase());

                                // Create a combined menu item object
                                const combinedMenuItem = {
                                    name: swiggyItem.name,
                                    description: swiggyItem.description,
                                    image: swiggyItem.image,
                                    swiggyPrice: swiggyItem.price,
                                    zomatoPrice: zomatoItem ? zomatoItem.price : 'Not available',
                                    magicPinPrice: magicPinItem ? magicPinItem.price : 'Not available'
                                };

                                return combinedMenuItem;
                            });

                            // Add the combined menu items of the current section to the final combined menu array
                            combinedMenu.push({ sectionHeading, menuItems: combinedMenuItemsInSection });

                        }
                    }


                    // Push collected data into commonRestaurants array
                    commonRestaurants.push({
                        restaurantName: restaurantName,
                        cuisine: swiggyData.cuisine,
                        images: zomatoData.imageUrls,
                        googleData: googleData,
                        swiggyOffers: swiggyData.offers,
                        zomatoOffers: zomatoData.offers,
                        magicPinOffers: magicPinData.offers,
                        menu: combinedMenu // Assuming combinedMenu is an array containing menu items with prices from all sources
                    });


                    // console.log("commonRestaurants", commonRestaurants)
                    // Store or update restaurant data in MongoDB
                    await storeOrUpdateRestaurants(commonRestaurants);
                } else {
                    console.error(`MagicPin URL not found for ${restaurantName}`);
                }

            } catch (error) {
                console.error(`Error processing ${restaurantName}:`, error);
            }
        }
        // Close the browser instance
        await browser.close();
        return commonRestaurants; // Return the common restaurants array
    } catch (error) {
        console.error('Error fetching common restaurants:', error);
        return null;
    }

}

async function storeOrUpdateRestaurants(commonRestaurants) {
    try {
        for (const restaurantData of commonRestaurants) {
            // Check if the restaurant already exists in the database
            let existingRestaurant = await Restaurant.findOne({ name: restaurantData.restaurantName });

            if (!existingRestaurant) {
                const newRestaurant = new Restaurant({
                    name: restaurantData.restaurantName,
                    cuisine: restaurantData.cuisine,
                    images: restaurantData.images,
                    googleData: restaurantData.googleData,
                    swiggyOffers: restaurantData.swiggyOffers,
                    zomatoOffers: restaurantData.zomatoOffers,
                    magicPinOffers: restaurantData.magicPinOffers,
                    menu: restaurantData.menu.map(section => ({
                        sectionHeading: section.sectionHeading,
                        menuItems: section.menuItems.map(item => ({
                            name: item.name,
                            description: item.description,
                            image: item.image,
                            swiggyPrice: item.swiggyPrice,
                            zomatoPrice: item.zomatoPrice,
                            magicPinPrice: item.magicPinPrice
                        }))
                    }))
                });

                await newRestaurant.save();
                console.log(`New restaurant added: ${restaurantData.restaurantName}`);
            } else {
                if (existingRestaurant.updatedAt.toDateString() === new Date().toDateString()) {
                    console.log(`Restaurant data for ${restaurantData.name} is already up to date.`);
                } else {
                    existingRestaurant.cuisine = restaurantData.cuisine;
                    existingRestaurant.googleData = restaurantData.googleData;
                    existingRestaurant.swiggyOffers = restaurantData.swiggyOffers;
                    existingRestaurant.images = restaurantData.images;
                    existingRestaurant.zomatoOffers = restaurantData.zomatoOffers;
                    existingRestaurant.magicPinOffers = restaurantData.magicPinOffers;

                    // Update menu only if the latest menu array is not empty
                    if (restaurantData.menu.length > 0) {
                        existingRestaurant.menu = restaurantData.menu.map(section => ({
                            sectionHeading: section.sectionHeading,
                            menuItems: section.menuItems.map(item => ({
                                name: item.name,
                                description: item.description,
                                image: item.image,
                                swiggyPrice: item.swiggyPrice,
                                zomatoPrice: item.zomatoPrice,
                                magicPinPrice: item.magicPinPrice
                            }))
                        }));
                    }

                    await existingRestaurant.save();
                    console.log(`Restaurant data updated for: ${restaurantData.restaurantName}`);
                }
            }
        }
    } catch (error) {
        console.error('Error storing or updating restaurant data:', error);
    }
}


async function getZomatoURL(page, restaurantName, ua) {
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

// Function to get Swiggy URL for a restaurant
async function getSwiggyURL(page, restaurantName) {
    try {
        // Navigate to Swiggy's website
        await page.goto('https://www.swiggy.com/search');

        // Wait for the search input field to appear
        await page.waitForSelector('input[class="_2FkHZ"]', { timeout: 10000 });

        // Clear the search input field and type the restaurant name
        await page.$eval('input[class="_2FkHZ"]', inputField => inputField.value = '');
        await page.type('input[class="_2FkHZ"]', restaurantName);

        // Press Enter to search
        await page.keyboard.press('Enter');

        // Wait for the search results to load
        await page.waitForSelector('.styles_restaurantListItem__1lOsF');

        // Extract the URL of the first search result
        const restaurantURL = await page.evaluate(() => {
            const firstResult = document.querySelector('.styles_restaurantListItem__1lOsF > a');
            return firstResult ? firstResult.href : null;
        });

        return restaurantURL;
    } catch (error) {
        console.error('Error getting Swiggy URL for', restaurantName, ':', error);
        return null;
    }
}

async function getGoogleURL(page, restaurantName) {
    try {
        // Navigate to Swiggy's website
        await page.goto('https://www.google.co.in/maps/@12.962000,77.597038,15z?entry=ttu');

        // Wait for the search input field to appear
        await page.waitForSelector('input[class="searchboxinput xiQnY"]', { timeout: 10000 });

        // Clear the search input field and type the restaurant name
        await page.$eval('input[class="searchboxinput xiQnY"]', inputField => inputField.value = '');
        await page.type('input[class="searchboxinput xiQnY"]', restaurantName);

        // Press Enter to search
        await page.keyboard.press('Enter');

        // Wait for the search results to load
        await page.waitForSelector('.Nv2PK.tH5CWc.THOPZb > a , .Nv2PK.THOPZb.CpccDe  > a', { timeout: 10000 });


        // Extract the names of all search results
        const restaurantNamesInSearch = await page.evaluate(() => {
            const restaurantNameElements = document.querySelectorAll('.qBF1Pd.fontHeadlineSmall');
            return Array.from(restaurantNameElements).map(element => element.textContent.trim());
        });

        // Find the closest matching restaurant name
        const closestMatch = fuzzball.extract(restaurantName, restaurantNamesInSearch, { scorer: fuzzball.token_set_ratio });

        if (closestMatch) {
            const closestRestaurantName = closestMatch[0][1]; // Get the closest matching restaurant name
            console.log('Closest matching restaurant name:', closestRestaurantName);
            // Extract the URL of the first search result
            const restaurantURL = await page.evaluate(() => {
                const firstResult = document.querySelector('.Nv2PK.tH5CWc.THOPZb > a , .Nv2PK.THOPZb.CpccDe  > a');
                return firstResult ? firstResult.href : null;
            });

            return restaurantURL;
        } else {
            console.error('No matching restaurant found.');
            return null;
        }
    } catch (error) {
        console.error('Error getting Swiggy URL for', restaurantName, ':', error);
        return null;
    }
}

async function scrapeSwiggyRestaurantData(page, url, ua) {
    try {
        page.setUserAgent(ua);
        await page.goto(url);
        await page.waitForSelector('.RestaurantNameAddress_name__2IaTv', { timeout: 10000 });

        const htmlContent = await page.content();
        const $ = cheerio.load(htmlContent);

        // Extract restaurant data
        const swiggyData = {
            name: '',
            cuisine: $('p.RestaurantNameAddress_cuisines__mBHr2').text().trim().split(',').map(item => item.trim()),
            offers: [],
            menu: {}
        };

        // Extract offers
        $('div.RestaurantOffer_infoWrapper__2trmg').each((index, element) => {
            const offerAmount = $(element).find('p.RestaurantOffer_header__3FBtQ').text().trim();
            const offerCode = $(element).find('div.RestaurantOffer_offerCodeWrapper__2Cr4F').text().trim();
            swiggyData.offers.push({ discount: offerAmount, code: offerCode });
        });


        // Extract restaurant name
        swiggyData.name = $('p.RestaurantNameAddress_name__2IaTv').text().trim();

        // Initialize an object to store menu items by section
        const menuBySection = {};

        // Extract main section headings and associated menu items
        $('.main_container__3QMrw').each((index, container) => {
            const mainSectionHeadingButton = $(container).find('.styles_header__2bQR-');
            const mainSectionItems = $(container).find('.styles_container__-kShr');

            // Extract main section heading from the button
            const mainSectionHeading = mainSectionHeadingButton.text().split('(')[0].trim();

            // Extract menu items under the main section
            const menuItemsInSection = [];
            mainSectionItems.each((index, item) => {
                const name = $(item).find('.styles_itemNameText__3ZmZZ').text().trim();
                const price = $(item).find('.styles_price__2xrhD').text().trim();
                const description = $(item).find('.styles_itemDesc__3vhM0').text().trim();
                const imageUrl = $(item).find('img.styles_itemImage__3CsDL').attr('src');

                menuItemsInSection.push({ name, price, description, image: imageUrl });
            });

            // Store the menu items under the corresponding main section heading
            menuBySection[mainSectionHeading] = menuItemsInSection;
        });

        // Update the menu object with the menu items by section
        swiggyData.menu = menuBySection;

        return swiggyData;
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
            imageUrls: [],
            offers: [],
            menu: []
        };

        // Extract images
        $('img.sc-s1isp7-5.eQUAyn').each((index, element) => {
            // Find image elements and extract src attribute
            const imageUrl = $(element).attr('src');
            if (imageUrl) {
                // Push the extracted image URL to the array
                restaurantData.imageUrls.push(imageUrl);
            }
        });

        // Extract menu items
        $('div.sc-1s0saks-13.kQHKsO').each((index, element) => {
            const itemName = $(element).find('h4.sc-1s0saks-15.iSmBPS').text().trim();
            const itemPriceText = $(element).find('span.sc-17hyc2s-1.cCiQWA').text().trim(); // This gives ₹273
            const itemPrice = itemPriceText.replace('₹', ''); // Removes the '₹' sign
            restaurantData.menu.push({ name: itemName, price: itemPrice });
        });

        // Extract offers
        $('div.sc-1a03l6b-2.gerWzu').each((index, element) => {
            const offerAmount = $(element).find('div.sc-1a03l6b-0.lkqupg').text().trim();
            const offerCode = $(element).find('div.sc-1a03l6b-1.kvnZBD').text().trim();
            restaurantData.offers.push({ discount: offerAmount, code: offerCode });
        });
        // console.log("restaurantData:", restaurantData)
        // Return the extracted restaurant data
        return restaurantData;
    } catch (error) {
        console.error('Error scraping Zomato restaurant data:', error);
        return { error: 'Error scraping Zomato restaurant data' };
    }
}

async function scrapMenuItemsFromMagicpin(url, browser, ua) {
    try {
        // Create a new page instance
        const page = await browser.newPage();

        // Set user agent for the page
        await page.setUserAgent(ua);
        // Navigate to the provided URL
        await page.goto(url, { waitUntil: 'domcontentloaded' }); // Wait for DOM content to be loaded
        await new Promise(resolve => setTimeout(resolve, 10000));

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

        $('article.itemInfo').each((index, element) => {
            const itemName = $(element).find('.itemName > a').text().trim();
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

async function scrapeGoogleRestaurantData(page, url, ua) {
    try {
        page.setUserAgent(ua);
        await page.goto(url);
        await page.waitForSelector('h1.DUwDvf.lfPIob');

        const htmlContent = await page.content();
        const $ = cheerio.load(htmlContent);

        // Extract restaurant data
        const restaurantData = {
            name: $('h1.DUwDvf.lfPIob').text().trim(),
            ratings: [],
            reviews: [],
        }

        // Extract ratings
        const rating = $('.F7nice > span > span[aria-hidden="true"]').text().trim();

        // Extract the number of reviews
        const reviewsText = $('.F7nice > span > span > span[aria-label]').text().trim();

        // Extract the number of reviews from the reviewsText
        const reviewsCount = reviewsText.replace(/[^\d]/g, '');
        const formattedReviews = Number(reviewsCount).toLocaleString();
        restaurantData.ratings.push({ rating: rating, review: formattedReviews });


        // Extract Reviews
        $('.jftiEf.fontBodyMedium').each((index, element) => {
            const profileImg = $(element).find('img.NBa7we').attr('src');
            const name = $(element).find('div.d4r55').text().trim();
            const intro = $(element).find('div.RfnDt').text().trim();
            const star = $(element).find('div.kvMYJc').attr('aria-label');
            const postedTime = $(element).find('span.rsqaWe').text().trim();
            const reviewDesc = $(element).find('span.wiI7pd').text().trim();
            restaurantData.reviews.push({ profileImg: profileImg, name: name, intro: intro, star: star, postedTime: postedTime, reviewDesc: reviewDesc });
        });

        return restaurantData;
    } catch (error) {
        console.error('Error scraping Swiggy restaurant data:', error);
        return { error: 'Error scraping Swiggy restaurant data' };
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

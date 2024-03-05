// Import required packages
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
require('dotenv').config();
const { magicpinUrls } = require('./dataSets/magicPinUrl');
const { RestaurantNames } = require('./dataSets/restaurantNames');

const fuzzball = require('fuzzball');

// Entry point of the script
exports.scrapRestaurantdata = async () => {
    try {
        // Fetch common restaurants data
        console.log('Fetching common restaurants data...')
        await fetchCommonRestaurants(RestaurantNames);
        console.log('after fetching common restaurants data...')
    } catch (error) {
        console.error('Error executing main logic:', error)
    }
};

// Function to fetch data for common restaurant
async function fetchCommonRestaurants(restaurantNames) {
    const commonRestaurants = [];
    try {
        // User agent string for browser
        const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36';

        // Launch Puppeteer browser instance
        const browser = await puppeteer.launch({
              defaultViewport: {
                width: 1700,
                height: 800,
              },
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        console.log('after launching browser')
        const page = await browser.newPage();

        // Iterate over restaurant names
        for (const restaurantName of restaurantNames) {
            let retryCount = 0;
            const maxRetries = 4;
            try {
                let swiggyURL = '';
                let zomatoURL = '';
                let googleURL = '';

                while (!swiggyURL && retryCount < maxRetries) {
                    console.log('before getting urls...')
                    swiggyURL = await getSwiggyURL(page, restaurantName, ua);
                    retryCount++;
                }
                retryCount = 0;

                while (!zomatoURL && retryCount < maxRetries) {
                    zomatoURL = await getZomatoURL(page, restaurantName, ua);
                    retryCount++;
                }
                retryCount = 0;

                while (!googleURL && retryCount < maxRetries) {
                    googleURL = await getGoogleURL(page, restaurantName, ua);
                    retryCount++;
                }
                retryCount = 0;
                console.log('after getting urls...')
                console.log("swiggyUrl",swiggyURL, zomatoURL, googleURL)

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



// Function to get Swiggy URL for a restaurant
async function getSwiggyURL(page, restaurantName) {
    try {
        // Navigate to Swiggy's website
        await page.goto('https://www.swiggy.com/search');
        console.log("after going to swiggy website...")
        // Wait for the search input field to appear
        // await page.waitForSelector('input[class="_2FkHZ"]', { timeout: 10000 });
        delay(3000); // 2 seconds delay
        console.log("after going to swiggy page load...")

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


async function getZomatoURL(page, restaurantName, ua) {
    try {
        // Navigate to Zomato's website
        page.setUserAgent(ua);
        await page.goto('https://www.zomato.com/bangalore/delivery-in-shanti-nagar');

        // Wait for the search input field to appear
        // await page.waitForSelector('input[class="sc-fxgLge jUPfKP"][placeholder="Search for restaurant, cuisine or a dish"]', { timeout: 10000 });
        delay(2000); // 2 seconds delay

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
            // console.log('Closest matching restaurant name:', closestRestaurantName);
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

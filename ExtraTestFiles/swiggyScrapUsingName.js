const  cheerio  = require("cheerio");
const { default: puppeteer } = require("puppeteer");
const { RestaurantNames } = require("../dataSets/restaurantNames");

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
                if (!swiggyURL) {
                    console.log("unable to find swiggy url for ", restaurantName)
                }
                // Scrape swiggy data from each URL
                let swiggyData = await scrapeSwiggyRestaurantData(page, swiggyURL, ua);
                while (swiggyData.menu.length === 0 && retryCount < maxRetries) {
                    console.log(`Retrying fetching Swiggy data for ${restaurantName}, attempt ${retryCount + 1}`);
                    swiggyData = await scrapeSwiggyRestaurantData(page, swiggyURL, ua);
                    retryCount++;
                }
                retryCount = 0;
             console.log("swiggyData", swiggyData)
                    // Push collected data into commonRestaurants array
                    commonRestaurants.push({
                        restaurantName: restaurantName,
                        cuisine: swiggyData.cuisine,
                        offers: swiggyData.offers,
                        menu: swiggyData.menu // Assuming combinedMenu is an array containing menu items with prices from all sources
                    });

                    // console.log("commonRestaurants", commonRestaurants)
                
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
            menu: {}
        };

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



(async () => {
    const commonRestaurants = await fetchCommonRestaurants(RestaurantNames);
    // console.log("commonRestaurants", commonRestaurants)
})();
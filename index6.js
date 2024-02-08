
// fetchs  swiggy and  zomato restrurant data for predefined urls and stores/updates  it in MongoDB 
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
// const RestaurantNames = ['McDonalds','Burger King', 'Dominoz', 'Pizza Hut', 'Subway', 'Faasos', 'FreshMenu', 'Behrouz Biryani', 'Biryani Blues', 'Biryani Zone']
const RestaurantNames = ['Meghana Foods', 'Burger King']
// const RestaurantNames = ['https://www.zomato.com/bangalore/c-k-mega-hot-food-btm/order', 'https://www.zomato.com/bangalore/mcdonalds-brigade-road/order']







const executeMainLogic = async () => {
    try {
        // const commonRestaurants = await fetchCommonRestaurants(RestaurantNames);
        // console.log(commonRestaurants)
        scrapeBangaloreRestaurants();

        // dbClose();
    } catch (error) {
        console.error('Error executing main logic:', error);
    }
};
executeMainLogic()




async function fetchCommonRestaurants(restaurantNames) {
    const commonRestaurants = [];

    try {
        ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36';

        const browser = await puppeteer.launch({
            headless: false, // Set to true for production
            args: [
                `--window-size=1920,1080`,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-infobars',
                '--disable-extensions',
            ],
        });
        const page = await browser.newPage();

        for (const restaurantName of restaurantNames) {
            try {
                // Search for the restaurant on Swiggy, Zomato, and MagicPin to get their URLs
                const MagicPinUrl = await getMagicPinUrl(page, restaurantName, ua);
                console.log(MagicPinUrl)

                // const swiggyData = await scrapeSwiggyRestaurantData(page, MagicPinUrl, ua);
            } catch (error) {
                console.error(`Error processing ${restaurantName}:`, error);
            }
        }

        await browser.close();
        return commonRestaurants;
    } catch (error) {
        console.error('Error fetching common restaurants:', error);
        return null;
    }
}


async function scrapeBangaloreRestaurants() {
    const browser = await puppeteer.launch({ headless: false }); // Launch browser
    const page = await browser.newPage(); // Open new page
    await page.setViewport({ width: 1366, height: 768 }); // Set viewport size

    try {
       
        // Visit the Magicpin Bangalore page
        await page.goto('https://magicpin.in/india/Bangalore/All/Restaurant/');

        // Wait for the restaurant data to load
        await page.waitForSelector('.store-result-container');

        // Get the HTML content of the page
        const htmlContent = await page.content();

        // Load HTML content into Cheerio
        const $ = cheerio.load(htmlContent);

        // Scrape restaurant URLs
        const restaurantURLs = [];
        $('div.store-result-container').each((index, element) => {
            const url = $(element).find('a').attr('href');
            restaurantURLs.push(url);
            if (restaurantURLs.length >= 100) return false; // Limit to 10 restaurants
        });
        console.log(restaurantURLs)
        // Scrape restaurant data from each URL
        // const restaurantData = [];
        // for (const url of restaurantURLs) {
        //     await page.goto(url); // Visit each restaurant page
        //     // const restaurantInfo = await scrapeRestaurantData(page); // Scrape restaurant data
        //     restaurantData.push(restaurantInfo);
        // }

        // Output the scraped data
        // console.log(restaurantData);

    } catch (error) {
        console.error('Error scraping Bangalore restaurants:', error);
    } finally {
        await browser.close(); // Close the browser
    }
}




async function getMagicPinUrl(page, restaurantName, ua) {
    try {

        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36");
        // Set the geolocation
        await page.setGeolocation({ latitude: 12.970560, longitude: 77.606750 });

        // Navigate to the website
        await page.goto('https://magicpin.in/india/Bangalore/home?locality=JP+Nagar');

        await page.waitForSelector('input[placeholder="Search for places, cuisines, and more..."]', { timeout: 10000 });
        await page.type('input[placeholder="Search for places, cuisines, and more..."]', restaurantName);

        // Press Enter to search
        await page.keyboard.press('Enter');
        await delay(2000)

        await page.waitForSelector('.result-card-container', { timeout: 10000 });
        // Extract the URL of the first search result
        await page.click('.mx-info > h3 >  a');

        const restaurantURL = page.url();


        return restaurantURL;
    } catch (error) {
        console.error('Error getting Magicpin URL for', restaurantName, ':', error);
        return null;
    }
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


async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function typeWithSpeed(page, selector, text, speed) {
    const inputField = await page.$(selector);
    for (const char of text) {
        await inputField.type(char, { delay: speed });
    }
}
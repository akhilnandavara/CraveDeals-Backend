//This code extracts the menu items and offers from the zomato website using puppeteer and cheerio
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');


// Fetch data from Magicpin

(async () => {
        const magicpinUrls = [
            'https://magicpin.in/Bangalore/Bannerghatta-Road/Restaurant/Meghana-Foods/store/50601c/delivery/',
            'https://magicpin.in/Bangalore/Jp-Nagar/Restaurant/Truffles/store/589094/delivery/',
        'https://magicpin.in/Bangalore/Royal-Meenakshi-Mall/Restaurant/Kfc/store/301802/delivery/'
        ] 
        const magicPinData = await fetchDataFromMagicPin(magicpinUrls);
        console.log(magicPinData);
        
    })();

async function fetchDataFromMagicPin(urls) {
    const restaurantData = [];

    try {
        const browser = await puppeteer.launch({ headless: true });

        for (const url of urls) {
            const data = await fetchMenuItemsFromMagicpin(url, browser);
            restaurantData.push(data);
        }

        // Close the browser as we've gathered the URLs
        await browser.close();
    } catch (error) {
        console.error('Error fetching data from Magicpin:', error);
    }

    return restaurantData;
}


async function fetchMenuItemsFromMagicpin(url, browser) {
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
            offers: $('.save-highlight.hide-mb span').text().trim(),
            menu: []
        };

        //extracting menu items
        $('article.itemInfo').map((index, element) => {
            const name = $(element).find('.itemName a').text().trim();
            const price = $(element).find('.itemPrice').text().trim();
            restaurantData.menu.push({ name, price })
        }).get();


        await page.close();

        return restaurantData;
    } catch (error) {
        console.error('Error scraping magicpin restaurant data:', error);
        return { error: 'Error scraping magicpin restaurant data' };
    }
}


//This code extracts the menu items and offers from the zomato website using puppeteer and cheerio
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

async function fetchMenuItemsFromZomato() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('https://www.zomato.com/bangalore/empire-restaurant-1-banashankari-bangalore/order');

    // Wait for a certain amount of time to ensure dynamic content is loaded
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get the entire HTML content of the page
    const htmlContent = await page.content();

    // Load the HTML content into Cheerio for parsing
    const $ = cheerio.load(htmlContent);

    // Extract restaurant name
    const restaurantName = $('h1.sc-iSDuPN').text().trim();

    // testing code to get the entire html content
    // try {
    //     const htmlContent = $('section.sc-eCXBzT.jGoFlS').html();
    //     console.log(htmlContent);
    // } catch (error) {
    //     console.error('Error retrieving HTML content:', error);
    // }
    
    
    // Extract offers by selecting elements with specific classes
    const offers = $('div.sc-1a03l6b-2.gerWzu').map((index, element) => {
        const offerAmount = $(element).find('div.sc-1a03l6b-0.lkqupg').text().trim();
        const offerCode = $(element).find('div.sc-1a03l6b-1.kvnZBD').text().trim();
        return { discount: offerAmount, code: offerCode };
    }).get();
    
//extracting menu items
    const menuItems = $('div.sc-1s0saks-13.kQHKsO').map((index, element) => {
        const itemName = $(element).find('h4.sc-1s0saks-15.iSmBPS').text().trim();
        const itemPrice = $(element).find('span.sc-17hyc2s-1.cCiQWA').text().trim();
        return { name: itemName, price: itemPrice };
    }).get();
    

    await browser.close();

    return { restaurantName, menuItems , offers};
}

// Usage
fetchMenuItemsFromZomato()
    .then(({ restaurantName, menuItems ,offers}) => {
        console.log('Restaurant Name:', restaurantName);
        console.log('Menu Items:', menuItems);
        console.log('offers:', offers);
    })
    .catch(error => console.error('Error fetching menu items from Zomato:', error));

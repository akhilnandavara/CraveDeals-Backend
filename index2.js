
// Altrenate code which runs  only get the restaurant name, cuisine and items from the Swiggy website using Puppeteer
const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto(
        'https://www.swiggy.com/restaurants/anupams-coast-ii-coast-church-street-bangalore-93802'
    );

    // Wait for the content to load
    await page.waitForSelector('.main_container__3QMrw');

    // Extract restaurant name and cuisine
    const restaurantName = await page.$eval('.RestaurantNameAddress_name__2IaTv', element => element.textContent.trim());
    const cuisine = await page.$eval('.RestaurantNameAddress_cuisines__mBHr2', element => element.textContent.trim());

    // Extract information about items
    const items = await page.evaluate(() => {
        const itemList = [];
        const itemContainers = document.querySelectorAll('.styles_container__-kShr');

        itemContainers.forEach(container => {
            const nameElement = container.querySelector('.styles_itemNameText__3ZmZZ');
            const priceElement = container.querySelector('.styles_price__2xrhD');
            const descriptionElement = container.querySelector('.styles_itemDesc__3vhM0');
            const imageElement = container.querySelector('.styles_itemImage__3CsDL > img');

            const name = nameElement ? nameElement.textContent.trim() : '';
            const price = priceElement ? priceElement.textContent.trim() : '';
            const description = descriptionElement ? descriptionElement.textContent.trim() : '';
            const imageUrl = imageElement ? imageElement.getAttribute('src') : '';

            itemList.push({
                name,
                price,
                description,
                imageUrl
            });
        });

        return itemList;
    });

    // Close the browser
    await browser.close();

    // Construct the final JSON object
    const data = {
        restaurantName,
        cuisine,
        items
    };

    console.log(data);
})();

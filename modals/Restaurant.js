const mongoose = require('mongoose');
// Define the menu item schema
const menuItemSchema = new mongoose.Schema({
    name: String,
    description: String,
    image: String,
    swiggyPrice: String,
    zomatoPrice: String,
    magicPinPrice: String
});

// Define the combined menu schema
const combinedMenuSchema = new mongoose.Schema({
    sectionHeading: String,
    menuItems: [menuItemSchema] // Embed the menuItemSchema as an array
});

const restaurantSchema = new mongoose.Schema({
    name: String,
    cuisine: [String],
    images: [String], // Assuming storing URLs to images
    googleData: {
        name: String,
        ratings: [], // Assuming storing ratings as numbers
        reviews: []
    },
    zomatoOffers: [{
        discount: String,
        code: String
    }], 
    swiggyOffers: [{
        discount: String,
        code: String
    }], 
    magicPinOffers: [],
    menu:[combinedMenuSchema],
    updatedAt: {
        type: Date,
        default: Date.now()
    }
});

module.exports = mongoose.model('Restaurant', restaurantSchema);




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
        cuisine:String,
        formattedOpeningHours:[],
        address:String,
        url:String,
        phone:String,
        latitude:String,
        longitude:String,
        ratings: [], // Assuming storing ratings as numbers
        reviews: [],
        restoOptions:[],
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

// Update the 'updatedAt' field before saving the document
restaurantSchema.pre('save', function(next) {
    this.updatedAt = new Date(); // Update 'updatedAt' to the current date and time
    next(); // Proceed to save the document
});
module.exports = mongoose.model('Restaurant', restaurantSchema);




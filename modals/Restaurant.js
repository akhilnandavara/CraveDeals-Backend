const mongoose = require('mongoose');

// Define the schema for the restaurant document
const restaurantSchema = new mongoose.Schema({
    name: String,
    cuisine:String,
    zomatoOffers: [],
    swiggyOffers: [],
    magicPinOffers: [],
    menu: [
        {
            name: String,
            description: String,
            image: String,
            swiggyPrice: String,
            zomatoPrice: String,
            magicPinPrice: String
        }
    ]
});


// Create the Mongoose model based on the schema
module.exports = mongoose.model('Restaurant', restaurantSchema);

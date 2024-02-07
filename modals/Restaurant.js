const mongoose = require('mongoose');

// Define the schema for the restaurant document
const restaurantSchema = new mongoose.Schema({
    name: String,
    cuisine:String,
    zomatoOffers: [],
    swiggyOffers: [],
    menu: [
        {
            name: String,
            swiggyPrice: String,
            zomatoPrice: String
        }
    ]
});


// Create the Mongoose model based on the schema
module.exports = mongoose.model('Restaurant', restaurantSchema);

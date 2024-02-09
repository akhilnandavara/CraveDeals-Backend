const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
    name: String,
    cuisine: String,
    zomatoOffers: [], // Explicitly define as an array of strings
    swiggyOffers: [], // Explicitly define as an array of strings
    magicPinOffers: [], // Explicitly define as an array of strings
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

module.exports = mongoose.model('Restaurant', restaurantSchema);

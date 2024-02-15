const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
    name: String,
    cuisine: [],
    images:[],
    googleData: {
        name: String,
        ratings: [],
        reviews: [],
    },
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
    ],
    updatedAt:
    {    type: Date,
        default: Date.now(),
        }
});

module.exports = mongoose.model('Restaurant', restaurantSchema);

const express =require('express');
const router = express.Router();


const {getRestaurantList,getRestaurantData, getRestaurantOverview, getRestaurantOffers, getRestaurantReviews, getRestaurantMenu}=require('../controllers/Restaurant')

// ************************************************
// 1. Add a new route for fetching restaurant data
// ************************************************
router.get('/getRestaurantList',getRestaurantList)
router.post('/getRestaurantData',getRestaurantData)

router.post('/getRestaurantOverview',getRestaurantOverview)
router.post('/getRestaurantMenu',getRestaurantMenu)
router.post('/getRestaurantReviews',getRestaurantReviews)
router.post('/getRestaurantOffers',getRestaurantOffers)

module.exports=router;
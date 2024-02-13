const express =require('express');
const router = express.Router();


const {getRestaurantList,getRestaurantData}=require('../controllers/Restaurant')

// ************************************************
// 1. Add a new route for fetching restaurant data
// ************************************************
router.get('/getRestaurantList',getRestaurantList)
router.get('/getRestaurantData',getRestaurantData)

module.exports=router;
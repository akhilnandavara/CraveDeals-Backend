const express=require('express')
const router=express.Router()

const {fetchCuisineData}=require('../controllers/Cuisine')

router.get('/fetchCuisineData',fetchCuisineData)

module.exports = router;
const express=require('express')
const router=express.Router()

const {fetchCuisineData}=require('../controllers/Cuisine')

router.post('/getCuisineData',fetchCuisineData)

module.exports = router;
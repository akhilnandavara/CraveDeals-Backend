const express=require('express')
const router=express.Router()

const {fetchCategoryData}=require('../controllers/Category')

router.post('/getCategoryData',fetchCategoryData)

module.exports = router;
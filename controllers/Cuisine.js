const Restaurant=require('../modals/Restaurant')

exports.fetchCuisineData=async(req,res)=> {
    try {
        const {cuisineName}=req.body;
        console.log(req.body)
        console.log("cuisine at BAcKEnd",cuisineName)
        if(!cuisineName){
            return res.status(400).json({success:false,message:"Missinge cuisine"})
        }
        const cuisineData=await Restaurant.find({cuisine:cuisineName}).select('name cuisine images').select({'googleData.ratings':1}).exec();

        return res.json({
            success:true,
            data:cuisineData,
            message:"Cuisine Fetched Successfully"
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Internal server error'
        })
    }
    
}

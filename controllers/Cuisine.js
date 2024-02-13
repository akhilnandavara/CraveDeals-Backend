const Restaurant=require('../modals/Restaurant')

exports.fetchCuisineData=async(req,res)=> {
    const {cuisine}=req.body;
    const cuisineData=await Restaurant.find({cuisine:cuisine}).select('name cuisine images').select({'googleData.ratings':1}).exec();
    return res.json({
        success:true,
        data:cuisineData
    })
}

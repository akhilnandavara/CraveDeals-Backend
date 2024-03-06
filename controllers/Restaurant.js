const Restaurant = require("../modals/Restaurant");

exports.getRestaurantList=async(req,res)=> {
   
    const restaurantList=await Restaurant.find({}).select('name cuisine images').select({'googleData.ratings':1}).exec();
    return res.json({
        success:true,
        data:restaurantList
    })
}

exports.getRestaurantData=async(req,res)=> {
    const {restaurantId}=req.body;
    const restaurantData = await Restaurant.findOne({_id: restaurantId})

    return res.json({
        success:true,
        data:restaurantData
    })
}


const Restaurant = require("../modals/Restaurant");

exports.getRestaurantList=async(req,res)=> {
    const restaurantList=await Restaurant.find({}).select('name cuisine images').select({'googleData.ratings':1}).exec();
    return res.json({
        success:true,
        data:restaurantList
    })
}

exports.getRestaurantData=async(req,res)=> {
    const id=req.body;
    const restaurantData=await Restaurant.find({_id:id}).exec();
    return res.json({
        success:true,
        data:restaurantData
    })
}

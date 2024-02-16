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
    const restaurantData=await Restaurant.findOne({_id:restaurantId}).select(" name cuisine images").select({'googleData.ratings':1}).exec();
    return res.json({
        success:true,
        data:restaurantData
    })
}

exports.getRestaurantOverview=async(req,res)=> {
    const {restrurantId}=req.body;
    const restaurantData=await Restaurant.findOne({_id:restrurantId}).select({'googleData':1}).exec();
    return res.json({
        success:true,
        data:restaurantData
    })
}

exports.getRestaurantMenu=async(req,res)=> {
    const {restrurantId}=req.body;
    const restaurantData = await Restaurant.findOne({ _id: restrurantId }).select({ "menu": 1 }).exec();

    return res.json({
        success:true,
        data:restaurantData
    })
}
exports.getRestaurantReviews=async(req,res)=> {
    const {restrurantId}=req.body;
    const restaurantData = await Restaurant.findOne({ _id: restrurantId }).select({'googleData.reviews':1}).exec();

    return res.json({
        success:true,
        data:restaurantData
    })
}
exports.getRestaurantOffers=async(req,res)=> {
    const {restrurantId}=req.body;
    const restaurantData = await Restaurant.findOne({ _id: restrurantId }).select("zomatoOffers swiggyOffers magicPinOffers").exec();

    return res.json({
        success:true,
        data:restaurantData
    })
}

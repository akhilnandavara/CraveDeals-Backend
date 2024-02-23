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
    const {restaurantId}=req.body;
    const restaurantData=await Restaurant.findOne({_id:restaurantId}).select("zomatoOffers swiggyOffers magicPinOffers").select({'googleData':1}).exec();
    return res.json({
        success:true,
        data:restaurantData
    })
}

exports.getRestaurantMenu=async(req,res)=> {
    const {restaurantId}=req.body;
    const restaurantData = await Restaurant.findOne({ _id: restaurantId }).select("name").select({ "menu": 1 }).exec();

    return res.json({
        success:true,
        data:restaurantData
    })
}
exports.getRestaurantReviews=async(req,res)=> {
    const {restaurantId}=req.body;
    const restaurantData = await Restaurant.findOne({ _id: restaurantId }).select('googleData.name').select({'googleData.reviews':1}).exec();

    return res.json({
        success:true,
        data:restaurantData
    })
}
exports.getRestaurantOffers=async(req,res)=> {
    const {restaurantId}=req.body;
    const restaurantData = await Restaurant.findOne({ _id: restaurantId }).select("zomatoOffers swiggyOffers magicPinOffers").exec();

    return res.json({
        success:true,
        data:restaurantData
    })
}

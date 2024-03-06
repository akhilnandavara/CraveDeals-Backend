const Restaurant=require('../modals/Restaurant')

exports.fetchCategoryData=async(req,res)=> {
    try {
        const {categoryName}=req.body;
        
        if(!categoryName){
            return res.status(400).json({success:false,message:"Missinge Category"})
        }
        const categoryData=await Restaurant.find({cuisine:categoryName}).select('name cuisine images').select({'googleData.ratings':1}).exec();

        return res.json({
            success:true,
            data:categoryData,
            message:"category Fetched Successfully"
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

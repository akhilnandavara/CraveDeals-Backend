const Restaurant = require('../modals/Restaurant');

exports.fetchCategoryData = async (req, res) => {
    try {
        const { searchTerm } = req.body;
       
        // Check if a search term is provided
        if (!searchTerm) {
            return res.status(400).json({ success: false, message: "Please provide a search term" });
        }

        // Construct query to search across multiple fields
        const query = {
            $or: [
                { cuisine: { $regex: searchTerm, $options: 'i' } }, // Search cuisine
                { name: { $regex: searchTerm, $options: 'i' } }, // Search restaurant name
                { 'menu': { $elemMatch: { 
                    $or: [
                        { 'menuSectionHeading': { $regex: searchTerm, $options: 'i' } }, // Search menu section heading
                        { 'menuItems.name': { $regex: searchTerm, $options: 'i' } } // Search menu item name
                    ]
                }}}
            ]
        };

        // Fetch data based on the constructed query
        const categoryData = await Restaurant.find(query)
            .select('name cuisine images')
            .select({ 'googleData.ratings': 1 })
            .exec();

        return res.json({
            success: true,
            data: categoryData,
            message: "Category fetched successfully"
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Internal server error'
        });
    }
};

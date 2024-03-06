# CraveDeals Backend

The backend component of CraveDeals is responsible for managing data retrieval, storage, and serving API requests to the frontend. Here's an overview of the backend architecture and technologies used:

## Overview

CraveDeals backend utilizes MongoDB for data storage, Puppeteer and Cheerio for web scraping, and Express.js for API routing. It provides RESTful endpoints for frontend consumption.

## Technologies Used

- **Node.js**: Backend server environment.
- **Express.js**: Web application framework for Node.js.
- **MongoDB and Mongoose**: NoSQL database and object modeling for Node.js.
- **Puppeteer and Cheerio**: Tools for web scraping.
- **CORS**: Cross-Origin Resource Sharing to manage frontend API calls.

## Installation and Setup

1. Clone the backend repository from GitHub: [CraveDeals Backend Repository](https://github.com/akhilnandavara/CraveDeals-Backend).
2. Navigate to the project directory and install dependencies using yarn:

    ```
    yarn install
    ```

3. Configure MongoDB connection settings in the application configuration file.
4. Run the backend server:

    ```
    node index.js or nodemon index.js
    ```

5. The backend server will start running and will be ready to serve API requests from the frontend.

## API Endpoints
-**POST /api/v1/category/getCategoryData**: Retrieves a list of restaurants for specific category by Name
- **GET /api/v1/restaurant/getRestaurantList**: Retrieves a list of all the  restaurants from the database.
- **POST /api/v1/restaurant/getRestaurantData**: Retrieves details of a specific restaurant by ID.

## Contributing

Contributions to CraveDeals are welcome! This project is primarily intended for educational purposes and not for commercial use. If you find any issues or have suggestions for improvements, please open an issue or submit a pull request on the GitHub repository.


## License

This backend component of CraveDeals is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to the developers of Swiggy, Zomato, and Magicpin for providing public APIs and data accessibility.
- Special thanks to the open-source community for valuable resources and inspiration.

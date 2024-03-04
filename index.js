const express=require('express')
const app=express()
const cors=require('cors');
const cron = require('node-cron'); // Required node-cron and moment-timezone for scheduling tasks
const moment = require('moment-timezone');

const categoryRoute=require('./routes/Category')
const restaurantRoute=require('./routes/Restaurant')

const { fetchRestaurantUpdatedData } = require('./fetchRestaurantUpdatedData');
const { dbConnect } = require('./mongoDBHelper');
require('dotenv').config();

const PORT=process.env.PORT||4000;

app.use(express.json());// json parser

app.use(cors({
    origin: "https://cravedeals.vercel.app",
    methods: ["GET", "POST", "PUT", "DELETE"] // Add additional methods as needed
}));

// origin: "http://localhost:3000",// used for locally testing

// connect to db
dbConnect()

// routes
app.use("/api/v1/category",categoryRoute)
app.use("/api/v1/restaurant",restaurantRoute)

// default route 
app.use('/',(req,res)=>{
    return res.json({
        success:true,
        message:"Server is up and running"
    })
})


// Schedule the task to run at 8 AM Indian time
cron.schedule('40 20 * * *', async () => {
    console.log(`Running scheduled task at ${moment.tz('Asia/Kolkata').format()}`);
    await fetchRestaurantUpdatedData()
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
})


// server  listen 
app.listen(PORT,()=>{
    console.log(`App is running at port  ${PORT} `)
})
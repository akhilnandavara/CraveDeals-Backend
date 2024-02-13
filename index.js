const express=require('express')
const app=express()
const cors=require('cors');
const cron = require('node-cron'); // Required node-cron and moment-timezone for scheduling tasks
const moment = require('moment-timezone');

const cuisineRoute=require('./routes/Cuisine')
const restaurantRoute=require('./routes/Restaurant')

const { fetchRestaurantUpdatedData } = require('./fetchRestaurantUpdatedData');
const { dbConnect } = require('./mongoDBHelper');
require('dotenv').config();

const PORT=process.env.PORT||4000;

app.use(express.json());// json parser
// cors
app.use(cors({
    origin:"http://localhost:3000",
    credentials:true,
}))


// Schedule the task to run at 8 AM Indian time
cron.schedule('58 18 * * *', async () => {
    console.log(`Running scheduled task at ${moment.tz('Asia/Kolkata').format()}`);
    await fetchRestaurantUpdatedData()
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
})

// connect to db
dbConnect();

// routes
app.use("/api/v1/cuisine",cuisineRoute)
app.use("/api/v1/restaurant",restaurantRoute)

// default route 
app.use('/',(req,res)=>{
    return res.json({
        success:true,
        message:"Server is up and running"
    })
})

// server  listen 
app.listen(PORT,()=>{
    console.log(`App is running at port  ${PORT} `)
})
const mongoose = require("mongoose");

exports.dbConnect = () => {
  mongoose
    .connect(process.env.MONGODB_URL,{
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    .then(() => {
      console.log("DB Connected Successfully");
    })
    .catch((error) => {
      console.log("DB connection failed");
      console.error(error);
      process.exit(1);
    });
};

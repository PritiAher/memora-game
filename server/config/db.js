const mongoose = require("mongoose");

//connect to the DB
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`Mongo connected`);
    }catch (error){
        console.error(`error occured : ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
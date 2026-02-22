import mongoose from "mongoose";

export const connectDB = async () => {
  await mongoose
    .connect(
      "mongodb+srv://yehezkielangg_db_user:jehovahtravel@cluster0.5dnd4zc.mongodb.net/JehovahTravel",
    )
    .then(() => {
      console.log("Connected to MongoDB");
    });
};

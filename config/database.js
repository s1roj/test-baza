const mongoose = require("mongoose");
const mongoUrl = "mongodb://localhost:27017/test-baza";

module.exports = async () => {
  await mongoose
    .connect(mongoUrl)
    .then(() => console.log("MongoDB ishladi"))
    .catch((error) => {
      console.log("Error on connecting database", error.massage);
    });
};

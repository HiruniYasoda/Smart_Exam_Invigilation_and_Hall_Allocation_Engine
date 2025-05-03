const express = require('express')
const routes = require('./routes/index')
const mongoose = require('mongoose')
const dotenv = require('dotenv')


dotenv.config()


const app = express();


mongoose.connect("mongodb+srv://jith:123@cluster0.aggypgu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('MongoDB connected');
    })
    .catch(err => {
        console.error('MongoDB connection failed:', err);
    });

app.use('/api', routes)


app.listen(3000, () => {
    console.log("App is running on port", 3000)
})
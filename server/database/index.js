// connection and functions
const User = require("./model/user.js");
const Ticket = require("./model/ticket.js");
const Region = require("./model/region.js");
const mongoose = require('mongoose');
const { REGIONS } = require('../constants/region.js');
const { initRegionCache } = require('../redis/redis.js')

const connect = async () => {

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/GMS', {
        serverSelectionTimeoutMS: Number(process.env.MONGODB_TIMEOUT_MS || 5000)
    });
    console.log('connected to MongoDB.');
    await initRegions(REGIONS);
    console.log('Database initialized successfully');
    await initRegionCache();

}

const createDocument = async (Model, details) => {
    try {
        const doc = new Model(details);
        await doc.save();
        return doc;
    } catch (err) {
        console.error(err);
    }
}

const initRegions = async (regions) => {
    await Promise.all(
        regions.map(region =>
            Region.updateOne({ name: region.name }, { $set: region }, { upsert: true })
        )
    );
}

module.exports = { connect, initRegions }

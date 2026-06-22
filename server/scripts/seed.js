require('dotenv').config();
const mongoose = require('mongoose');
const Region = require('../database/model/region');
const { REGIONS } = require('../constants/region');

const seed = async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/GMS');
    await Promise.all(
        REGIONS.map(region =>
            Region.updateOne({ name: region.name }, { $set: region }, { upsert: true })
        )
    );
    console.log(`Seeded ${REGIONS.length} regions.`);
    await mongoose.disconnect();
}

seed().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
});

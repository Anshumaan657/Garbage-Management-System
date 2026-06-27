require('dotenv').config();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const User = require('../database/model/user');
const Ticket = require('../database/model/ticket');
const Region = require('../database/model/region');
const { REGIONS } = require('../constants/region');

const PASSWORD = 'StrongPass123!';

const users = [
    {
        username: 'demo_customer',
        email: 'customer.demo@example.com',
        phone: '9876543210',
        role: 'customer'
    },
    {
        username: 'demo_admin',
        email: 'admin.demo@example.com',
        phone: '9876543211',
        role: 'admin',
        region: 'region1',
        slot: 'morning'
    },
    {
        username: 'demo_worker',
        email: 'worker.demo@example.com',
        phone: '9876543212',
        role: 'worker',
        region: 'region1',
        slot: 'morning'
    }
];

const tickets = [
    {
        slot: 'morning',
        status: 'pending',
        location: { type: 'Point', coordinates: [75.77781182767711, 26.956567333262228] },
        note: [{ author: 'demo_customer', message: 'Pickup requested near the main gate.' }]
    },
    {
        slot: 'morning',
        status: 'assigned',
        location: { type: 'Point', coordinates: [75.772390399052, 26.967175774333015] },
        note: [
            { author: 'demo_customer', message: 'Bins are full after the weekend.' },
            { author: 'demo_admin', message: 'Assigned to demo_worker' }
        ]
    },
    {
        slot: 'afternoon',
        status: 'pending',
        location: { type: 'Point', coordinates: [75.78543883994007, 26.967577088741734] },
        note: [{ author: 'demo_customer', message: 'Second pickup point for afternoon demo.' }]
    }
];

const seedRegions = async () => {
    await Promise.all(
        REGIONS.map(region =>
            Region.updateOne({ name: region.name }, { $set: region }, { upsert: true })
        )
    );
}

const upsertUsers = async () => {
    const password = await bcrypt.hash(PASSWORD, 10);
    const region1 = await Region.findOne({ name: 'region1' });

    for (const user of users) {
        const payload = { ...user, password };
        if (payload.region) payload.region = region1._id;
        await User.updateOne({ username: user.username }, { $set: payload }, { upsert: true });
    }

    return User.findOne({ username: 'demo_customer' });
}

const seedTickets = async (customer) => {
    const worker = await User.findOne({ username: 'demo_worker' });
    await Ticket.deleteMany({ ownerId: customer._id });
    await Ticket.insertMany(tickets.map((ticket, index) => ({
        ...ticket,
        ownerId: customer._id,
        assignedTo: index === 1 ? worker._id : null
    })));
}

const seed = async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/GMS', {
        serverSelectionTimeoutMS: Number(process.env.MONGODB_TIMEOUT_MS || 5000)
    });

    await seedRegions();
    const customer = await upsertUsers();
    await seedTickets(customer);

    console.log('Demo data seeded.');
    console.log(`Customer: demo_customer / ${PASSWORD}`);
    console.log(`Admin: demo_admin / ${PASSWORD}`);
    console.log(`Worker: demo_worker / ${PASSWORD}`);
    await mongoose.disconnect();
}

seed().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
});

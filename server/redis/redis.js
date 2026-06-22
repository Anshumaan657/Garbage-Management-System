const Redis = require("redis");
const Region = require("../database/model/region");
const redisClient = Redis.createClient({
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    socket: {
        reconnectStrategy: false
    }
});
const memoryCache = new Map();
let redisReady = false;

redisClient.on("error", (err) => console.error("Redis Error:", err));

(async () => {
    try {
        await redisClient.connect();
        redisReady = true;
        console.log("Connected to Redis.");
    } catch (error) {
        redisReady = false;
        console.warn("Redis unavailable. Using in-memory cache for this process.");
    }
})();

const readMemory = (key) => {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
        memoryCache.delete(key);
        return null;
    }
    return entry.value;
}

const writeMemory = (key, value, exp = null) => {
    memoryCache.set(key, {
        value,
        expiresAt: exp ? Date.now() + exp * 1000 : null
    });
}

const getOrSetCache = async (key, cb, exp = null) => {
    try {

        const data = redisReady ? await redisClient.get(key) : readMemory(key);

        if (data != null) return typeof data === 'string' ? JSON.parse(data) : data;

        const freshData = await cb();

        await setCache(key, freshData, exp);

        return freshData;

    } catch (err) {

        console.error("Redis error: ", err);
        throw new Error(`Redis err: ${err}`);

    }
}

const setCache = async (key, data, exp = null) => {
    try {

        if (!redisReady) {
            writeMemory(key, data, exp);
        } else if (exp !== null) {
            await redisClient.setEx(key, exp, JSON.stringify(data));
        } else {
            await redisClient.set(key, JSON.stringify(data));
        }

    } catch (err) {

        console.error("Redis error: ", err);
        throw new Error(`Redis err: ${err}`);

    }
}

const getCache = async (key) => {
    try {

        const data = redisReady ? await redisClient.get(key) : readMemory(key);
        if (data != null) {
            return typeof data === 'string' ? JSON.parse(data) : data;
        } else {
            return undefined
        }

    } catch (err) {

        console.error("Redis error: ", err);
        throw new Error(`Redis err: ${err}`);

    }
}

// updates: {
//     key1: newValue,
//     key2: newValue
// }

// updates:{
//     note:{
//         author: 'username',
//         message: 'message from author',
//     }
// }

const updateCache = async (key, updates, exp = null) => {
    try {

        let data = await getCache(key);

        if (data) {
            if (updates.note) {
                data.note ??= [];
                data.note.push(updates.note);
            } else {
                for (const [field, value] of Object.entries(updates)) {
                    data[field] = value;
                }
            }
        } else {
            data = { ...updates };
        }

        await setCache(key, data, exp);

        return data;

    } catch (err) {

        console.error("Redis error: ", err);
        throw new Error(`Redis err: ${err}`);

    }
}

const deleteCache = async (key) => {
    if (redisReady) await redisClient.del(key);
    memoryCache.delete(key);
}

// init region cache
const initRegionCache = async () => {

    try {
        const regions = await Region.find({})/*.select('_id name')*/;

        if (regions.length > 0) {
            await Promise.all(
                regions.map(region =>
                    Promise.all([
                        setCache(`region:${region.name}`, region.toObject()),
                        setCache(`region:${region._id}`, region.toObject())
                    ])
                )
            );

            console.log(`Successfully cached ${regions.length} regions`);
        } else {
            console.log(`No regions available`);
        }

    } catch (error) {
        console.error('Error initializing region cache:', error);
        throw new Error(`Redis err: ${error}`);
    }

};

module.exports = { getOrSetCache, setCache, getCache, updateCache, deleteCache, initRegionCache }

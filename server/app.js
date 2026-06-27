require('dotenv').config();
const express = require('express');
const app = express();
const path = require("path");
const router = require('./routes');
const ExpressError = require('./error');
const cookieParser = require('cookie-parser');
const { verifyRole, verifyUser } = require('./middleware');
const database = require('./database');

const PORT = process.env.PORT || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));

app.use((req, res, next) => {
    if (CLIENT_ORIGIN) {
        res.header('Access-Control-Allow-Origin', CLIENT_ORIGIN);
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Vary', 'Origin');
    }
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

app.use(express.static(path.join(__dirname, '..', 'client')));

app.get('/api/v1/health', (req, res) => {
    res.status(200).send({
        status: 'ok',
        service: 'Garbage Management System',
        environment: process.env.NODE_ENV || 'development',
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

app.use('/api/v1/auth', router.auth);
app.use('/api/v1/regions', router.region);
app.use('/api/v1/admin', verifyUser, verifyRole('admin'), router.admin);
app.use('/api/v1/customer', verifyUser, verifyRole('customer'), router.customer);
app.use('/api/v1/worker', verifyUser, verifyRole('worker'), router.worker);

app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return next(new ExpressError(404, 'API route not found'));
    }
    return res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

app.use((error, req, res, next) => {
    if (error instanceof ExpressError) {
        console.error(`status: ${error.status}, message: ${error.message}`);
        return res.status(error.status || 500).send({ message: error.message });
    }
    console.error(error);
    return res.status(500).send('server error');
})

database.connect()
    .then(() => {
        app.listen(PORT, () => { console.log(`http listening at ${PORT}`) });
    })
    .catch(err => {
        console.error('Failed to initialize backend:', err);
        process.exit(1);
    });

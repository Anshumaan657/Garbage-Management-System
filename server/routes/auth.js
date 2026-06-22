const express = require('express')
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../database/model/user');
const joi = require('../utils/joi.js');
const ExpressError = require('../error.js');
const redis = require('../redis/redis.js');

const cookieOptions = (maxAge) => ({
    signed: true,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge
});

const userPayload = (user) => ({
    _id: user._id.toString(),
    username: user.username,
    role: user.role
});

const issueTokens = (res, user) => {
    const payload = userPayload(user);
    const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

    res.cookie('token', accessToken, cookieOptions(15 * 60 * 1000));
    res.cookie('refreshToken', refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));
};

router.route('/signup')
    .post(async (req, res, next) => {
        try {

            const { error } = joi.signUpSchema.validate(req.body);
            if (error) {
                throw new ExpressError(400, `Inappropriate request body: ${error.details[0].message}`);
            }

            req.body.password = await bcrypt.hash(req.body.password, 10);

            //
            if(req.body.region){
                const region = await redis.getCache(`region:${req.body.region}`);
                if (!region) throw new ExpressError(400, 'Invalid region');
                req.body.region = typeof region._id === 'string'
                    ? new mongoose.Types.ObjectId(region._id)
                    : region._id;
            }
            //

            let details = req.body;

            let newUser = new User(details);  // storing mongoose object in DB
            await newUser.save();

            issueTokens(res, newUser);

            return res.status(201).send({ message: 'successfully registered', user: userPayload(newUser) });

        } catch (error) {
            if(error.code === 11000){
                return next(new ExpressError(409, 'Username or email already in use'));
            }

            if (!(error instanceof ExpressError)) {
                const err = new ExpressError(500, `${error}`);
                return next(err);
            }

            return next(error);
        }
    })

router.route('/login')
    .post(async (req, res, next) => {
        try {

            const { error } = joi.loginSchema.validate(req.body);
            if (error) throw new ExpressError(400, 'Inappropriate request body');

            let user = await User.findOne({ username: req.body.username });

            if (!user) throw new ExpressError(401, 'wrong username')

            if (await bcrypt.compare(req.body.password, user.password)) {

                issueTokens(res, user);

                return res.status(200).send({ message: 'successfully logged in', user: userPayload(user) });

            } else {
                throw new ExpressError(401, `wrong password`);
            }

        } catch (error) {
            console.error(error);

            if (!(error instanceof ExpressError)) {
                const err = new ExpressError(500, `${error}`);
                return next(err);
            }

            return next(error);
        }
    })

router.route('/generate-token')
    .post((req, res, next) => {
        try {

            const refreshToken = req.signedCookies.refreshToken;
            if (!refreshToken) { throw new ExpressError(403, 'Forbidden') }

            const user = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
            const accessToken = jwt.sign({ _id: user._id, username: user.username, role: user.role }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });

            res.cookie('token', accessToken, cookieOptions(15 * 60 * 1000));

            return res.status(200).send({ message: 'token refreshed' });

        } catch (error) {
            if (!(error instanceof ExpressError)) return next(new ExpressError(403, 'Forbidden: unauthorized refresh token'));

            return next(error);
        }
    })

router.route('/logout')
    .post((req, res) => {
        res.clearCookie('token');
        res.clearCookie('refreshToken');
        return res.status(200).send({ message: 'logged out' });
    })

router.route('/me')
    .get(async (req, res, next) => {
        try {
            const token = req.signedCookies.token;
            if (!token) throw new ExpressError(401, 'Unauthorized');
            const user = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
            return res.status(200).send({ user });
        } catch (error) {
            return next(new ExpressError(401, 'Unauthorized'));
        }
    })

module.exports = router;

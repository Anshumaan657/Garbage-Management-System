const express = require('express');
const router = express.Router();
const axios = require('axios');
const joi = require('../utils/joi');
const User = require('../database/model/user.js');
const Ticket = require('../database/model/ticket.js');
const ExpressError = require('../error');
const redis = require('../redis/redis.js');
const { DEFAULT_EXPIRATION } = require('../constants').redis;
const SLOT = require('../constants').slot;

const ticketListSchema = joi.Joi.object({
    status: joi.Joi.string().valid('active', 'closed').default('active'),
    slot: joi.Joi.string().valid('morning', 'afternoon', 'evening')
});

const serializeTicket = (ticket) => {
    const raw = ticket.toJSON ? ticket.toJSON() : ticket;
    const created = raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString();
    return {
        ...raw,
        dateOfCreation: created.slice(0, 10),
        timeOfCreation: created.slice(11, 16)
    };
}

const getAdminRegion = async (user) => {
    const region = await redis.getCache(`region:${user.region}`);
    if (!region) throw new ExpressError(400, 'Admin region is not configured');
    return region;
}

const getAdminTicket = async (ticketId, user) => {
    const region = await getAdminRegion(user);
    const ticket = await Ticket.findOne({
        _id: ticketId,
        location: {
            $geoWithin: {
                $geometry: {
                    type: 'Polygon',
                    coordinates: region.area.coordinates
                }
            }
        }
    });
    if (!ticket) throw new ExpressError(404, 'Ticket not found in your region');
    return ticket;
}

router.route("/")
    .get(async (req, res, next) => {

        try {

            const region = await getAdminRegion(req.user);
            return res.status(200).send({ ...req.user, region: region.name });

        } catch (error) {

            console.error(error);

            if (!(error instanceof ExpressError)) {
                const err = new ExpressError(500, `${error}`);
                return next(err);
            }

            return next(error);
        }

    })
    .patch(async (req, res, next) => {

        try {

            const user = req.user;
            let { error } = joi.updateAdminSchema.validate(req.body);
            if (error) { throw new ExpressError(400, 'Inappropriate request body') };

            const updates = { ...req.body.updates };
            if (updates.region) {
                const region = await redis.getCache(`region:${updates.region}`);
                if (!region) throw new ExpressError(400, 'Invalid region');
                updates.region = region._id;
            }

            const updated = await User.findByIdAndUpdate(user._id, updates, { new: true }).select('-password').lean();
            await redis.setCache(`${user.role}:${user._id}`, updated, DEFAULT_EXPIRATION);

            res.status(200).send(updated);

        } catch (error) {

            console.error(error);

            if (!(error instanceof ExpressError)) {
                const err = new ExpressError(500, `${error}`);
                return next(err);
            }

            return next(error);
        }

    })

router.route("/ticket")
    .get(async (req, res, next) => { /* fetch all tickets for admin based on their slot if and only if the current time falls within their slot timing. Also give the shortest path to traverse. Try limiting number of requests(rate limiting) for an IP to prevent inconsistency */

        try {

            const user = req.user;
            const { error, value: filters } = ticketListSchema.validate(req.query);
            if (error) throw new ExpressError(400, 'Invalid ticket filters');

            const selectedSlot = filters.slot || user.slot;
            if (selectedSlot !== user.slot) {
                throw new ExpressError(403, 'Forbidden, admins can only view their assigned slot');
            }

            const currTime = new Intl.DateTimeFormat('en-GB', {
                timeZone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).format(new Date());

            const { start, end } = SLOT[selectedSlot];
            if (!(start <= currTime && end >= currTime)) {
                throw new ExpressError(403, 'Forbidden, try again in your time slot');
            }

            const region = await getAdminRegion(user);


            let tickets = await Ticket.find({
                slot: selectedSlot,
                status: filters.status,
                location: {
                    $geoWithin: {
                        $geometry: {
                            type: 'Polygon',
                            coordinates: region.area.coordinates
                        }
                    }
                }
            }).select('-note').sort({ createdAt: -1 });

            const coords = tickets.map(ticket => ticket.location.coordinates);

            const shortestPath = await getShortestPath(coords).catch(() => false);


            const response = shortestPath ? {tickets, shortestPath} : {tickets};

            return res.status(200).send(response);

        } catch (error) {

            console.error(error);

            if (!(error instanceof ExpressError)) {
                const err = new ExpressError(500, `${error}`);
                return next(err);
            }

            return next(error);

        }

    })

router.route("/ticket/:id")
    .get(async (req, res, next) => {

        try {

            let ticketId = req.params.id;

            let ticket = serializeTicket(await getAdminTicket(ticketId, req.user));

            return res.status(200).send(ticket);

        } catch (error) {

            console.error(error);

            if (!(error instanceof ExpressError)) {
                const err = new ExpressError(500, `${error}`);
                return next(err);
            }

            return next(error);

        }

    })
    .patch(async (req, res, next) => {

        try {

            const user = req.user;
            let ticketId = req.params.id;

            let { error } = joi.Joi.object({ note: joi.Joi.string().required() }).validate(req.body);
            if (error) { throw new ExpressError(400, 'Inappropriate request body') };

            const updates = {
                note: {
                    author: `${user.username}`,
                    message: req.body.note,
                }
            }

            let ticket = await getAdminTicket(ticketId, user);
            ticket.note ??= [];
            ticket.note.push(updates.note);
            await ticket.save();
            await redis.setCache(`ticket:${ticketId}`, serializeTicket(ticket), DEFAULT_EXPIRATION);

            return res.status(200).send(serializeTicket(ticket));

        } catch (error) {

            console.error(error);

            if (!(error instanceof ExpressError)) {
                const err = new ExpressError(500, `${error}`);
                return next(err);
            }

            return next(error);

        }

    })
    .put(async (req, res, next) => {
        try {

            const user = req.user;
            let ticketId = req.params.id;

            const updates = {
                status: 'closed'
            }

            const ticket = await getAdminTicket(ticketId, user);

            await Ticket.findByIdAndUpdate(ticket._id, updates);
            await redis.deleteCache(`ticket:${ticketId}`);
            const region = await getAdminRegion(user);
            await redis.deleteCache(`ticket:${user.slot}:${region.name}`);

            return res.status(200).send({ message: 'ticket closed' });

        } catch (error) {

            console.error(error);

            if (!(error instanceof ExpressError)) {
                const err = new ExpressError(500, `${error}`);
                return next(err);
            }

            return next(error);

        }
    })

module.exports = router;

async function getShortestPath(coords) {
    if (!Array.isArray(coords) || coords.length < 2) {
        // throw new Error('At least 2 coordinates are required for routing.');/
        return false;
    }

    for (const c of coords) {
        if (!Array.isArray(c) || c.length !== 2 || isNaN(c[0]) || isNaN(c[1])) {
            throw new Error('Invalid coordinate format. Each point must be [lon, lat] with numeric values.');
        }
    }

    const coordStr = coords.map(c => `${c[0]},${c[1]}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;

    try {
        const res = await axios.get(url);
        const route = res.data.routes[0];
        return {
            distance: route.distance,
            duration: route.duration,
            geometry: route.geometry
        };
    } catch (err) {
        console.error('Axios: Error fetching route:', err.response?.status, err.response?.data || err.message);
        throw new Error('Axios error');
    }
}

// async function getShortestPath(coords) {
//     const coordStr = coords.map(c => `${c[0]},${c[1]}`).join(';');
//     const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;

//     try {
//         const res = await axios.get(url);
//         const route = res.data.routes[0];
//         return {
//             distance: route.distance, // in meters
//             duration: route.duration, // in seconds
//             geometry: route.geometry  // GeoJSON LineString
//         };
//     } catch (err) {
//         console.error('Axios: Error fetching route:', err.message);
//         throw new Error('Axios error');
//     }
// }

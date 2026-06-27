const express = require('express');
const router = express.Router();
const joi = require('../utils/joi');
const User = require('../database/model/user');
const Ticket = require('../database/model/ticket');
const ExpressError = require('../error');
const redis = require('../redis/redis');
const { DEFAULT_EXPIRATION } = require('../constants').redis;

const statusSchema = joi.Joi.object({
    status: joi.Joi.string().valid('in_progress', 'collected').required(),
    note: joi.Joi.string().allow('', null)
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

const getWorkerTicket = async (ticketId, workerId) => {
    const ticket = await Ticket.findOne({ _id: ticketId, assignedTo: workerId });
    if (!ticket) throw new ExpressError(404, 'Assigned ticket not found');
    return ticket;
}

router.route('/')
    .get((req, res) => {
        return res.status(200).send({ ...req.user });
    })
    .patch(async (req, res, next) => {
        try {
            const { error } = joi.updateWorkerSchema.validate(req.body);
            if (error) throw new ExpressError(400, 'Inappropriate request body');

            const updates = { ...req.body.updates };
            if (updates.region) {
                const region = await redis.getCache(`region:${updates.region}`);
                if (!region) throw new ExpressError(400, 'Invalid region');
                updates.region = region._id;
            }

            const updated = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password').lean();
            await redis.setCache(`${req.user.role}:${req.user._id}`, updated, DEFAULT_EXPIRATION);

            return res.status(200).send(updated);
        } catch (error) {
            return next(error instanceof ExpressError ? error : new ExpressError(500, `${error}`));
        }
    })

router.route('/ticket')
    .get(async (req, res, next) => {
        try {
            const status = req.query.status;
            const valid = ['assigned', 'in_progress', 'collected', 'closed'];
            if (status && !valid.includes(status)) throw new ExpressError(400, 'Invalid ticket status');

            const query = { assignedTo: req.user._id };
            if (status) query.status = status;

            const tickets = await Ticket.find(query).select('-note').sort({ updatedAt: -1 });
            return res.status(200).send(tickets);
        } catch (error) {
            return next(error instanceof ExpressError ? error : new ExpressError(500, `${error}`));
        }
    })

router.route('/ticket/:id')
    .get(async (req, res, next) => {
        try {
            const ticket = await getWorkerTicket(req.params.id, req.user._id);
            return res.status(200).send(serializeTicket(ticket));
        } catch (error) {
            return next(error instanceof ExpressError ? error : new ExpressError(500, `${error}`));
        }
    })
    .patch(async (req, res, next) => {
        try {
            const { error, value } = statusSchema.validate(req.body);
            if (error) throw new ExpressError(400, 'Invalid status update');

            const ticket = await getWorkerTicket(req.params.id, req.user._id);
            const allowed = {
                assigned: ['in_progress'],
                in_progress: ['collected'],
                collected: [],
                closed: []
            };

            if (!allowed[ticket.status]?.includes(value.status)) {
                throw new ExpressError(400, `Cannot move ticket from ${ticket.status} to ${value.status}`);
            }

            ticket.status = value.status;
            ticket.note ??= [];
            ticket.note.push({
                author: req.user.username,
                message: value.note || `Status changed to ${value.status.replace('_', ' ')}`
            });
            await ticket.save();
            await redis.setCache(`ticket:${ticket._id}`, serializeTicket(ticket), DEFAULT_EXPIRATION);

            return res.status(200).send(serializeTicket(ticket));
        } catch (error) {
            return next(error instanceof ExpressError ? error : new ExpressError(500, `${error}`));
        }
    })

module.exports = router;

const express = require('express');
const router = express.Router();
const joi = require('../utils/joi');
const User = require('../database/model/user.js');
const Ticket = require('../database/model/ticket.js');
const ExpressError = require('../error');
const redis = require('../redis/redis.js');
const constants = require('../constants');
const { DEFAULT_EXPIRATION } = constants.redis;
const { PARENT_REGION } = constants.region;
const { isPointInPolygon } = require('../utils/miscellaneous.js');

const ticketListSchema = joi.Joi.object({
    status: joi.Joi.string().valid('active', 'closed'),
    slot: joi.Joi.string().valid('morning', 'afternoon', 'evening')
});

const getCustomerTicket = async (ticketId, userId) => {
    const ticket = await Ticket.findOne({ _id: ticketId, ownerId: userId });
    if (!ticket) throw new ExpressError(404, 'Ticket not found');
    return ticket;
}

const serializeTicket = (ticket) => {
    const raw = ticket.toJSON ? ticket.toJSON() : ticket;
    const created = raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString();
    return {
        ...raw,
        dateOfCreation: created.slice(0, 10),
        timeOfCreation: created.slice(11, 16)
    };
}


router.route("/")
    .get((req, res, next) => {
        try {

            return res.status(200).send({ ...req.user });

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
            let { error } = joi.updateCustomerSchema.validate(req.body);
            if (error) { throw new ExpressError(400, 'Inappropriate request body') };

            let data = await redis.updateCache(`${user.role}:${user._id}`, req.body.updates, DEFAULT_EXPIRATION);

            await User.findByIdAndUpdate(user._id, req.body.updates); // later add a queue for storing in database, implement write-behind caching

            res.status(200).send(data);

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
    .get(async (req, res, next) => {

        try {

            const user = req.user;
            const { error, value: filters } = ticketListSchema.validate(req.query);
            if (error) throw new ExpressError(400, 'Invalid ticket filters');

            const query = { ownerId: user._id };
            if (filters.status) query.status = filters.status;
            if (filters.slot) query.slot = filters.slot;

            const tickets = await Ticket.find(query).select('-ownerId -note').sort({ createdAt: -1 });

            res.status(200).send(tickets);

        } catch (error) {

            console.error(error);

            if (!(error instanceof ExpressError)) {
                const err = new ExpressError(500, `${error}`);
                return next(err);
            }

            return next(error);

        }
    })
    .post(async (req, res, next) => {

        try {

            const user = req.user;
            let { error } = joi.ticketSchema.validate(req.body);
            if (error) { 
                console.error(error);
                throw new ExpressError(400, 'Invalid request body') 
            };

            if (!(isPointInPolygon(req.body.location.coordinates, PARENT_REGION ))) {
                throw new ExpressError(400, 'choose a location within the designated working area');
            }

            let tempTickets = await redis.getCache(`${user.role}:${user._id}:tickets`);
            let duplicate = false;
            
            if(tempTickets != null){
                duplicate = tempTickets.some((ticket)=> {
                    const coords = ticket.location.coordinates;
                    return coords[0] === req.body.location.coordinates[0] && coords[1] === req.body.location.coordinates[1] && ticket.status !== 'closed';
                });
            } else {
                let tickets = await Ticket.find({ ownerId: user._id, status: 'active' }).select('location status');
                if(tickets){
                    tickets.forEach((ticket)=>{
                        if((ticket.location.coordinates[0] == req.body.location.coordinates[0])){
                            if((ticket.location.coordinates[1] == req.body.location.coordinates[1]))
                            duplicate = true;
                        }
                    })
                }
            }

            if(duplicate){
                throw new ExpressError(409, 'duplicate entry');
            }

            if (req.body.note && (typeof req.body.note == 'string')) {
                let message = req.body.note;
                req.body.note = [{ author: `${user.username}`, message }]
            }

            let ticket = new Ticket({ ...req.body, ownerId: user._id, status: 'active' });
            await ticket.save();
            const response = serializeTicket(ticket);
            await redis.setCache(`ticket:${ticket._id}`, response, DEFAULT_EXPIRATION);
            await redis.deleteCache(`${user.role}:${user._id}:tickets`);

            return res.status(201).send(response);

        } catch (error) {

            if (!(error instanceof ExpressError)  && !(error.status)) {
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

            let ticket = await redis.getOrSetCache(`ticket:${ticketId}`, async () => {
                const ticket = await getCustomerTicket(ticketId, req.user._id);
                return serializeTicket(ticket);
            })

            if (ticket.ownerId && ticket.ownerId.toString() !== req.user._id.toString()) throw new ExpressError(403, 'Forbidden');

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

            let ticket = await getCustomerTicket(ticketId, user._id);
            ticket.note ??= [];
            ticket.note.push(updates.note);
            await ticket.save();
            await redis.setCache(`ticket:${ticketId}`, serializeTicket(ticket), DEFAULT_EXPIRATION);
            await redis.deleteCache(`${user.role}:${user._id}:tickets`);

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
    .delete(async (req, res, next) => {

        try {

            let ticketId = req.params.id;

            const ticket = await getCustomerTicket(ticketId, req.user._id);
            await redis.deleteCache(`ticket:${ticketId}`);
            await redis.deleteCache(`${req.user.role}:${req.user._id}:tickets`);

            await Ticket.findByIdAndDelete(ticket._id);

            res.status(200).send({ message: 'deleted successfully' });

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

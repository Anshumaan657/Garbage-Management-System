const Joi = require('joi');
const { VALID, REGEX } = require('../constants').joi

const signUpSchema = Joi.object({
    username: Joi.string().pattern(REGEX.disallowHtml).min(3).max(32).required(),
    email: Joi.string().pattern(REGEX.email).required(),
    password: Joi.string().pattern(REGEX.password).required(),
    phone: Joi.string().pattern(REGEX.phone).required(),
    role: Joi.string().valid(...VALID.roles).required(),
    slot: Joi.alternatives().conditional('role', {
        is: Joi.valid('admin', 'worker'),
        then: Joi.string().valid(...VALID.slots).required(),
        otherwise: Joi.any().strip()
    }),
    region: Joi.alternatives().conditional('role', {
        is: Joi.valid('admin', 'worker'),
        then: Joi.string().valid(...VALID.regions).required(),
        otherwise: Joi.any().strip()
    })
});

const loginSchema = Joi.object({
    username: Joi.string().pattern(REGEX.disallowHtml).required(),
    password: Joi.string().pattern(REGEX.disallowHtml).required(),
})

// const updateCustomerSchema = Joi.object({
//     updates: Joi.array().items(
//         Joi.object({
//             key: Joi.string().valid('email', 'phone',),
//             value: Joi.alternatives().conditional('key', [
//                 {
//                     is: 'email',
//                     then: Joi.string()
//                         .pattern(REGEX.email)
//                         .message('Invalid email (e.g., user@example.com)'),
//                 },
//                 {
//                     is: 'phone',
//                     then: Joi.string()
//                         .pattern(/^(\+91|0)?[6-9]\d{9}$/) // Indian phone regex
//                         .message('Must be a valid Indian phone (10 digits, starts with 6-9)'),
//                 },
//                 {
//                     otherwise: Joi.string(),
//                 },
//             ]),
//         })
//     ),
// });

const updateCustomerSchema = Joi.object({
    updates: Joi.object({
        email: Joi.string().pattern(REGEX.email),
        phone: Joi.string().pattern(REGEX.phone),
    }).min(1).required()
})

const updateAdminSchema = Joi.object({
    updates: Joi.object({
        email: Joi.string().pattern(REGEX.email),
        phone: Joi.string().pattern(REGEX.phone),
        region: Joi.string().valid(...VALID.regions),
        slot: Joi.string().valid(...VALID.slots),
    }).min(1).required()
})

const updateWorkerSchema = Joi.object({
    updates: Joi.object({
        email: Joi.string().pattern(REGEX.email),
        phone: Joi.string().pattern(REGEX.phone),
        region: Joi.string().valid(...VALID.regions),
        slot: Joi.string().valid(...VALID.slots),
    }).min(1).required()
})

const ticketSchema = Joi.object({

    location: Joi.object({
        type: Joi.string().valid('Point').default('Point'),
        coordinates: Joi.array().items(Joi.number()).length(2).required(),
    }).required(),

    slot: Joi.string().valid(...VALID.slots).required(),

    note: Joi.string()
        .allow('', null)
        .optional()
        .custom((value, helpers) => {
            return (value === '' || value === null) ? undefined : value;
        }),

}).options({ stripUnknown: true });

module.exports = { signUpSchema, loginSchema, updateCustomerSchema, updateAdminSchema, updateWorkerSchema, ticketSchema, Joi }

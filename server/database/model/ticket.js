const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
    },
    location: {
        type: {
            type: String,
            enum: { values: ['Point'], message: "only Point coordinate is supported for ticket location" },
            default: 'Point',
        },
        coordinates: {
            type: [Number],
            required: [true, 'coordinates are required'],
        }
    },
    slot: {
        type: String,
        enum: { values: ['morning', 'afternoon', 'evening'], message: "{VALUE} is not supported. Supported: ['morning', 'afternoon', 'evening']" },
        required: [true, 'slot is required'],
    },
    note: [
        {
            author: { type: String, required: [true, 'note author required'] },
            message: { type: String, required: [true, 'note message required'] },
        }
    ],
    status: {
        type: String,
        enum: { values: ['pending', 'assigned', 'in_progress', 'collected', 'closed'], message: "{VALUE} is not supported" },
        default: 'pending',
    }

}, { timestamps: true }); // use doc.createdAt on the service layer

ticketSchema.index({ location: '2dsphere' });
ticketSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model("ticket", ticketSchema);

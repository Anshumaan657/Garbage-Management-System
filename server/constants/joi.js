const VALID = {
    regions: ['region1', 'region2', 'region3', 'region4'],
    roles: ['admin', 'customer', 'worker'],
    slots: ['morning', 'afternoon', 'evening'],
    statuses: ['pending', 'assigned', 'in_progress', 'collected', 'closed'],
    updateKey: ['username', 'email', 'phone', 'region', 'slot'],
}

const REGEX = {
    // email: /^[\w.-]+@[a-zA-Z\d.-]+\.[a-zA-Z]{2,}$/,
    email: /^(?=[^<>]*$)[\w.-]+@[a-zA-Z\d.-]+\.[a-zA-Z]{2,}$/,
    password: /^(?=[^<>]*$)(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,}$/, // Password must be at least 12 characters long, contain no < or > symbols, and include at least one uppercase letter, one lowercase letter, one number, and one special character
    disallowHtml: /^[^<>]*$/,
    phone: /^(?:(?:\+91|0)?[ -]?)?[6-9]\d{9}$/,
}

module.exports = {
    VALID,
    REGEX,
}

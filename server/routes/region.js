const express = require('express');
const router = express.Router();
const { PARENT_REGION, REGIONS } = require('../constants/region');

router.route('/')
    .get((req, res) => {
        res.status(200).send({
            parent: PARENT_REGION,
            regions: REGIONS
        });
    });

module.exports = router;

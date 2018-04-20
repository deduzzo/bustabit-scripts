var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var Bust = require('../models/Busts.js');

/* GET ALL PRODUCTS */
router.get('/', function(req, res, next) {
    Bust.find(function (err, products) {
        if (err) return next(err);
        res.json(products);
    });
});

/!* GET SINGLE PRODUCT BY ID *!/
router.get('/get/:id', function(req, res, next) {
    Bust.findById(req.params.id, function (err, post) {
        if (err) return next(err);
        res.json(post);
    });
});

router.get('/add', function(req, res, next) {
    console.log(req.query.data);
    Bust.create(JSON.parse(req.query.data), function (err, post) {
        if (err) return next(err);
        res.json(post);
    });
});

/* SAVE PRODUCT */
router.post('/', function(req, res, next) {
    Bust.create(req.body, function (err, post) {
        if (err) return next(err);
        res.json(post);
    });
});

/* UPDATE PRODUCT */
router.put('/:id', function(req, res, next) {
    Bust.findByIdAndUpdate(req.params.id, req.body, function (err, post) {
        if (err) return next(err);
        res.json(post);
    });
});

/* DELETE PRODUCT */
router.delete('/:id', function(req, res, next) {
    Bust.findByIdAndRemove(req.params.id, req.body, function (err, post) {
        if (err) return next(err);
        res.json(post);
    });
});

module.exports = router;
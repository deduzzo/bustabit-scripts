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
    var d;
    try {
        d= JSON.parse(req.query.data);
    }
    catch(e)
    {
        return next(e);
    }
    console.log('id:' + d.id);
    Bust.create(JSON.parse(req.query.data), function (err, post) {
        if (err)
            return res.json({status: 'error', msg: {code: err.code, msg: err.errmsg} });
        console.log('OK '+ d.id + ' ' + d.date);
        res.json({status: 'ok', msg: 'succ. add id'+ d.id});
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
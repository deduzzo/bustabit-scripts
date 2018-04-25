var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var Bust = require('../models/Busts.js');
require('../controllers/stats.js')()


router.get('/', function(req, res, next) {
    Bust.find(function (err, products) {
        if (err) return next(err);
        res.json(products);
    });
});

router.get('/get/:id', function(req, res, next) {
    Bust.findById(req.params.id, function (err, post) {
        if (err) return next(err);
        res.json(post);
    });
});

router.get('/add', function(req, res, next) {
    var d;
    try{
        d= JSON.parse(req.query.data);
    }
    catch(e)
    {
        return next(e);
    }
    console.log('id:' + d.id);

    Bust.create(JSON.parse(req.query.data), function (err, post) {
        if (err)
        {
            return res.json({status: 'error', msg: {code: err.code, msg: err.errmsg} });
        }
        console.log('OK '+ d.id + ' ' + d.date);
        res.json({status: 'ok', msg: 'succ. add id'+ d.id});
    });


});

/!* GET SINGLE PRODUCT BY ID *!/
router.get('/last/:bust', function(req, res, next) {
    var query = {bust: { $gt: req.params.bust}};
    Bust.find(query).sort({ date: -1 }).limit(1).select({ id: 1, date: 1,bust:1}).
    exec(function (err, post) {
        if (err) return next(err);
        res.json(post);
    });
});

router.get('/fromLastBust/:bust', async function(req, res, next) {
    try
    {
        var last =  await Bust.find().sort({ date: -1 }).limit(1).select({ id: 1}).exec();
        var lastBust = await Bust.find({bust: { $gt: req.params.bust}}).sort({ date: -1 }).limit(1).select({ id: 1, date: 1,bust:1}).exec();
        console.log("last: " +last);
        console.log('lastBust:' + lastBust);
        res.json({times: (last[0].id - lastBust[0].id) , lastBust: lastBust[0].id , last: last[0].id, date: lastBust[0].date, error: false});
    }
    catch (e)
    {
        res.json({error:true});
    }
});

/!* GET SINGLE PRODUCT BY ID *!/
router.get('/stats', function(req, res, next) {
    Bust.find(function (err, data) {
        if (err) return next(err);
        var dataEdit = data.sort((p1, p2)=>
        {
            if(p1.id > p2.id)
                return 1
            else return -1
        });
        var results =bestBets(100,2000,100, 1,dataEdit,false).sort((p1, p2)=>
        {
            if(p1.balance < p2.balance)
                return 1
            else return -1
        });
        res.json({flags: checkDataIntegrity(dataEdit), results: results});
    });
});


module.exports = router;

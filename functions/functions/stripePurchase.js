const functions = require('firebase-functions');
const stripe = require('stripe')(functions.config().stripe.token);


exports.handler = (req, res) => {

    console.log(req);
    console.log(req.body);
    const token = request.body.token;

    const charge = stripe.charges.create({
        amount: req.body.value,
        currency: 'cad',
        description: `Power Up for ${req.body.value}`,
        source: token,
    }, function (err, charge) {
        console.log(err);
        console.log('This is the charge: ' + charge);
        req.send(error).status(500);
    }).then(function (charge) {
        req.status(200);
    })
};
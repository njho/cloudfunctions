const gcs = require('@google-cloud/storage')();
const spawn = require('child-process-promise').spawn;
const path = require('path');
const os = require('os');
const fs = require('fs');
const admin = require('firebase-admin');


exports.handler = (req, res) => {

    console.log('Check if request is authorized with Firebase ID token');
    // See documentation on defining a message payload.

    console.log(req);
    console.log(res);


    if ((!req.headers.authorization || !req.headers.authorization.startsWith('Bearer '))) {
        console.error('No Firebase ID token was passed as a Bearer token in the Authorization header.',
            'Make sure you authorize your request by providing the following HTTP header:',
            'Authorization: Bearer <Firebase ID Token>',
            'or by passing a "__session" cookie.');
        res.status(403).send('Unauthorized');
        return;
    }
    ;

    let idToken;
    let fcmToken;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        console.log('Found "Authorization" header');
        // Read the ID Token from the Authorization header.
        idToken = req.headers.authorization.split('Bearer ')[1];
        fcmToken = req.body;

        console.log('Found fcmToken');
        console.log(req.body);
        console.log(fcmToken);
    } else {
        console.log('Found "__session" cookie');
        // Read the ID Token from cookie.
        idToken = req.cookies.__session;
    }
    admin.auth().verifyIdToken(idToken).then((decodedIdToken) => {
        console.log('ID Token correctly decoded', decodedIdToken);
        req.user = decodedIdToken;

        var message = {
            data: {
                type: 'CURRENT_LOCATION'
            },
            token: fcmToken

        };

        // =============== SEND MESSAGE TO DEVICE =============>
        admin.messaging().send(message)
            .then((response) => {
                // Response is a message ID string.
                console.log('Successfully sent message:', response);
                res.status(200).send('What will be sent');
            })
            .catch((error) => {
                console.log('Error sending message:', error);
                res.status(500).send();

            });
    }).catch((error) => {
        console.error('Error while verifying Firebase ID token:', error);
        res.status(403).send('Unauthorized');
    });
}
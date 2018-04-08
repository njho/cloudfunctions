const functions = require('firebase-functions');

//These are required for ImageMagick Manipulation
const generateThumbnail = require('./functions/generateThumbnail');
const path = require('path');
const os = require('os');
const fs = require('fs');

// import setupGraphQLServer from "./graphql/server"

const express = require('express');
const graphqlHTTP = require('express-graphql');
const {buildSchema} = require('graphql');
const bodyParser = require('body-parser');

const app = express();


const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

/* CF for Firebase with graphql-server-express */
// const graphQLServer = setupGraphQLServer()

var apiKey = functions.config().tokbox.api_key;
var secret = functions.config().tokbox.tokbox_secret

var OpenTok = require('opentok');
var opentok = new OpenTok(apiKey, secret);

var generateToken = (session_id) => {
    this.session_id = session_id;

    return new Promise((resolve, reject) => {
        let token = opentok.generateToken(session_id);
        if (token !== null) {
            resolve(token)
        } else {
            return ('There was an Error');
        }
    })
};

const schema = buildSchema(
    `
        type PublisherInfo {
            token: String
            session_id: String
        }
        
        type coordinate {
            latitude: Float!
            longitude: Float!
            }

      type Query {
        requestToken(session_id: String!, user_id: String!,journey_id: String!, name: String! ): String
        createSession(journey_id: String!, journey_name: String!, user_id: String!, user_name: String!, journey_description: String!): PublisherInfo
      } 
      `);


const root = {
    requestToken: function (args) {
        console.log('request token');
        console.log(args.session_id);
        console.log(args.user_id);

        // Generate token associated with session_id
        // let token = opentok.generateToken(args.session_id);

        let token = generateToken(args.session_id).then((token) => {
                console.log('this is the token');
                console.log(token);

                //Pushes user as active member within the session (session_id)
                admin.database().ref('/streaming_members/' + args.session_id).set({
                    user_id: args.user_id,
                    name: args.name
                }).then(snapshot => {
                    console.log('Data should be written');
                    console.log(token)
                }, function (error) {
                    console.log('there was an error');
                });
                console.log('this is the token return inside promise' + token)
                return token;
            }
        ).catch(function (error) {
            console.log('ugh an error');
            console.log(error);
        })
        console.log('this is the token again' + token)
        return token;
    },
    createSession: function (args) {

        var fetchStuff = () => {
            return new Promise((resolve, reject) => {
                    console.log('I am in the promise');
                    var session_id, token;
                    opentok.createSession({mediaMode: 'routed'}, (err, session) => {
                        if (err) {
                        } else {
                            // // generate token
                            session_id = session.sessionId;
                            token = opentok.generateToken(session.sessionId);

                            console.log(session.sessionId);
                            console.log('creating token' + token);

                            admin.database().ref('/streaming_journeys/' + args.journey_id).set({

                                "session_id": session.sessionId,
                                "user_id": args.user_id,
                                "user_name": args.user_name,
                                "journey_description": args.journey_description,

                            }).then(snapshot => {
                                console.log('going to return');
                                console.log(token);
                                resolve({token: token, session_id: session_id})


                            }, function (error) {
                                console.log('there was an error');

                            });
                        }
                    });
                }
            )
        }
        return fetchStuff();
    }


};


//Taken from KittyKendoHN -> Investigate more
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

// app.use(function (req, res, next) {
//     console.log(req.body) // populated!
//     next()
// })

app.use('/graphql', graphqlHTTP({
    schema: schema,
    rootValue: root,
    graphiql: true,
}));


app.post('/locationUpdate', function (req, res) {

    console.log('A Location Update has been triggered');
    let eventData = req.body.location;
    console.log(eventData);

    let timestamp = -Date.parse(eventData.timestamp);
    console.log("Negative timestamp for Firebase lookup: " + timestamp);

    admin.database().ref('/live_journeys/' + req.body.location.extras.journey_id).child(req.body.location.uuid).set({
        coordinates: {
            latitude: eventData.coords.latitude,
            longitude: eventData.coords.longitude
        },
        altitude: eventData.coords.altitude,
        timestamp: timestamp,
        imageUploaded: false
    }).then(snapshot => {
        res.status(200).json(eventData.uuid)
    }, function (error) {
        res.status(500).send('this is not okay');
    });

});


exports.graphql = functions.https.onRequest(app);

//===================================START_GENERATE_THUMBNAIL======================================>

// [START generateThumbnail]
/**
 * When an image is uploaded in the Storage bucket We generate a thumbnail automatically using
 * ImageMagick.
 */
// [START generateThumbnailTrigger]
exports.generateThumbnail = functions.storage.object().onChange(generateThumbnail.handler);
// [END generateThumbnail]

//===================================END_GENERATE_THUMBNAIL======================================>


// // Generate an OpenTok Token based on a session_id
// // Realtime Database under the path /messages/:pushId/original
// exports.requestSessionToken = functions.https.onRequest((req, res) => {
//
//     const session_id = req.query.session_id;
//     const user_id = req.query.user_id;
//
//     // Generate token associated with session_id
//     var token = opentok.generateToken(session_id);
//     res.setHeader('Content-Type', 'application/json');
//
//     //Pushes user as active member within the session (session_id)
//     admin.database().ref('/sessions/' + session_id).push({user_id: user_id, token: token}).then(snapshot => {
//         // Redirect with 303 SEE OTHER to the URL of the pushed object in the Firebase console.
//         res.send({
//             apiKey: apiKey,
//             sessionId: session_id,
//             token: token
//         });
//     }, function (error) {
//         console.log('there was an error');
//         res.send({
//             error: error
//         })
//
//     });
// });


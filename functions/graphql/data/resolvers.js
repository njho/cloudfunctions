const resolveFunctions = {
    requestToken: function (args) {
        console.log('request token');
        console.log(args.session_id);
        console.log(args.user_id);

        // Generate token associated with session_id
        // let token = opentok.generateToken(args.session_id);
        var token;

        generateToken(args.session_id).then((token) => {
                console.log('this is the token');
                console.log(token);
                token = token;
                //Pushes user as active member within the session (session_id)
                admin.database().ref('/streaming_members/' + args.session_id).set({
                    user_id: args.user_id,
                    name: args.name
                }).then(snapshot => {
                    console.log('Data should be written');
                }, function (error) {
                    console.log('there was an error');
                });
            }
        ).catch(function (error) {
            console.log('ugh an error');
            console.log(error);
        })

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

                            admin.database().ref('/streaming_journeys/' + session.sessionId).set({
                                [args.journey_id]: {
                                    "session_id": session.sessionId,
                                    "user_id": args.user_id,
                                    "user_name": args.user_name,
                                    "journey_description": args.journey_description,
                                }
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
            )}
        return fetchStuff();
    },
    Query: {
        posts() {
            return posts
        },
        author(_, { id }) {
            return authors.find(author => author.id === id)
        }
    },
    Mutation: {
        upvotePost(_, { postId }) {
            const post = posts.find(post => post.id === postId)
            if (!post) {
                throw new Error(`Couldn't find post with id ${postId}`)
            }
            post.votes += 1
            // pubsub.publish('postUpvoted', post);
            return post
        }
    },
    Author: {
        posts(author) {
            return posts.filter(post => post.authorId === author.id)
        }
    },
    Post: {
        author(post) {
            return authors.find(author => author.id === post.authorId)
        }
    }
}

export default resolveFunctions
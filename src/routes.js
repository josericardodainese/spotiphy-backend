const routes = require('express').Router();
const SpotifyWebApi = require('spotify-web-api-node');
const querystring = require('querystring');
const stateKey = 'spotify_auth_state';
const request = require('request');
const axios = require('axios');
const { response } = require('express');
const e = require('express');



var generateRandomString = function (length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

var configuration = {
    clientId: '4647c27e51d54410b922f969fb042217',
    clientSecret: '1de47a4e505a4760bd1576353d927525',
    redirectUri: 'http://localhost:3000/callback',
    urlAuthorize: 'https://accounts.spotify.com/authorize?',
    scope: 'user-read-private user-read-email user-read-currently-playing user-read-currently-playing user-read-playback-state app-remote-control user-modify-playback-state',
    url_token: 'https://accounts.spotify.com/api/token'
}

var spotifyApi = new SpotifyWebApi({
    clientId: configuration.clientId,
    clientSecret: configuration.clientSecrets
});

// Get an access token and 'save' it using a setter
routes.get('/login', (req, res) => {
    var state = generateRandomString(16);
    res.cookie(stateKey, state);

    res.redirect(configuration.urlAuthorize +
        querystring.stringify({
            response_type: 'code',
            client_id: configuration.clientId,
            scope: configuration.scope,
            redirect_uri: configuration.redirectUri,
            state: state
        }));
})

routes.get('/callback', (req, res) => {

    var code = req.query.code || null;
    var state = req.query.state || null;
    var storedState = req.headers.cookie ? req.headers.cookie.split('=')[1] : null;


    if (state === null || state !== storedState) {
        res.send({
            "code": code,
            "state": state,
            "storedState": storedState
        });
    } else {
        res.clearCookie(stateKey);

        var authOptions = {
            url: configuration.url_token,
            form: {
                code: code,
                redirect_uri: configuration.redirectUri,
                grant_type: 'authorization_code'
            },
            headers: {
                'Authorization': 'Basic ' + (new Buffer(configuration.clientId + ':' + configuration.clientSecret).toString('base64')),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            json: true
        };

        request.post(authOptions, function (error, response, body) {

            if (!error && response.statusCode === 200) {

                var access_token = body.access_token,
                    refresh_token = body.refresh_token;

                spotifyApi.setAccessToken(access_token);
                spotifyApi.setRefreshToken(refresh_token);

                res.redirect('/me');

            } else {
                res.redirect('/#' +
                    querystring.stringify({
                        error: 'invalid_token'
                    }));
            }
        });
    }
});

routes.get('/refresh_token', (req, res) => {

    var refresh_token = req.query.refresh_token;
    var authOptions = {
        url: configuration.url_token,
        headers: { 'Authorization': 'Basic ' + (new Buffer(configuration.clientId + ':' + configuration.clientSecret).toString('base64')) },
        form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        },
        json: true
    };

    request.post(authOptions, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            var access_token = body.access_token;
            spotifyApi.setRefreshToken(access_token);
        }
    });
});

routes.get('/getArtist/:id', (req, res) => {
    spotifyApi.getArtist(req.params.id).then(
        function (data) {
            res.send(data.body)
        },
        function (err) {
            console.error(err);
        }
    );
})

routes.get('/me', (req, res) => {
    spotifyApi.getMe(req.params.id).then(
        function (data) {
            res.send(data.body);
        },
        function (err) {
            res.send({ "ERROR": err });
        }
    );
})

routes.get('/next', (req, res) => {
    spotifyApi.skipToNext().then(
        function (data) {
            res.send(data.body);
        },
        function (err) {
            if (err.statusCode === 401 && err.name === 'WebapiError' && err.message === 'Unauthorized') {
                res.redirect('/refresh_token#next=' + req.url);
            } else {
                res.send({ "ERROR": err });
            }
        }
    );
})

routes.get('/current_playing_track', (req, res) => {

    spotifyApi.getMyCurrentPlayingTrack().then((data) => {
        res.send(data.item);
    }, (err) => {
        if (err.statusCode === 401 && err.name === 'WebapiError' && err.message === 'Unauthorized') {
            res.redirect('/logins');
        } else {
            res.send({ "ERROR": err });
        } s
    });

});

routes.get('/test', (req, res) => {

    spotifyApi.getMyCurrentPlayingTrack().then((data) => {
        res.send(data);
    }, (err) => {
        if (err.statusCode === 401 && err.name === 'WebapiError' && err.message === 'Unauthorized') {
            res.redirect('/login');
        } else {
            res.send({ "ERROR": err });
        } s
    });

});

routes.get('/get_device_id', (req, res) => {

    spotifyApi.getMyDevices().then((data) => {
        res.send(data.body.devices);
    }, (err) => {
        if (err.statusCode === 401 && err.name === 'WebapiError' && err.message === 'Unauthorized') {
            res.redirect('/refresh-token');
        } else if (err.statusCode === 400 && err.name === 'WebapiError' && err.message === 'Bad Request') {
            res.redirect('/refresh-token');
        } else {
            res.send({ "ERROR": err });
        }
    });
})


routes.get('/current_playing', (req, res) => {
    spotifyApi.getMyCurrentPlaybackState({})
        .then(function (data) {
            // Output items
            res.send(data.body);
        }, function (err) {
            if (err.statusCode === 401 && err.name === 'WebapiError' && err.message === 'Unauthorized') {
                res.redirect('/login');
            } else {
                res.send({ "ERROR": err });
            }
        });

});

routes.get('/current_playing/lyric', (req, res) => {
    spotifyApi.getMyCurrentPlaybackState({})
        .then(async function (data) {
            // Output items

            const artist = data.body.item.artists[0].name
            const song = data.body.item.name

            getLyric(artist, song).then(lyric => {
                console.log(lyric);
                if (lyric.status === 200) {
                    data.lyric = lyric.data.lyrics;
                    res.send(`<pre>${data.lyric}</pre>`);
                }
            }).catch(e => {
                res.send(`<pre>Letra Não Encontrada</pre>`);
            });


        }, function (err) {
            if (err.statusCode === 401 && err.name === 'WebapiError' && err.message === 'Unauthorized') {
                res.redirect('/login');
            } else {
                res.send({ "ERROR": err });
            }
        });

});

async function getLyric(artist, song) {
    return await axios.get(`https://api.lyrics.ovh/v1/${artist}/${song}`);
}

routes.get('/refresh-token', (req, res) => {
    spotifyApi.refreshAccessToken().then(
        function (data) {
            spotifyApi.setAccessToken(data.body['access_token']);
        },
        function (err) {
            if (err.statusCode === 400 && err.name === 'WebapiError' && err.message === 'Bad Request') {
                res.redirect('/login');
            } else {
                res.send({ "ERROR": err });
            }
        }
    );
});

module.exports = routes;
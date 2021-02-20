import { Router, Request, Response } from 'express';
import SpotifyWebApi from 'spotify-web-api-node';
import querystring from 'querystring';
import request from 'request';

const getLyrics = require('genius-lyrics-api/lib/getLyrics');

import { authConfig } from './config/AuthConfig';
import { ErrorModel } from './models/errors/ErrorModel';
import { StringUtils } from './utils/StringUtils';


const stateKey = 'spotify_auth_state';
const stringUtils = new StringUtils();

const spotifyApi = new SpotifyWebApi({
    clientId: authConfig.spotifyClientId,
    clientSecret: authConfig.spotifyClientSecret
});

const handleError = (req: Request, res: Response, err: ErrorModel) => {
    if (err.statusCode === 401 && err.name === 'WebapiError' && err.message === 'Unauthorized') {
        res.redirect(`/login/${req.path.slice(1, req.path.length)}`);
    } else {
        res.send({ "ERROR": err });
    }
}

const routes = Router();

// Get an access token and 'save' it using a setter
routes.get('/login', (_req: Request, res: Response) => {
    const state = stringUtils.generateRandomString(16);
    
    res.cookie(stateKey, state);

    res.redirect(authConfig.spotifyUrlAuthorize +
        querystring.stringify({
            response_type: 'code',
            client_id: authConfig.spotifyClientId,
            scope: authConfig.spotifyScope,
            redirect_uri: authConfig.spotifyRedirectUri,
            state: state
        }));
})

routes.get('/login/*', (req, res) => {

    const state = req.params[0]

    res.cookie(stateKey, state);

    res.redirect(authConfig.spotifyUrlAuthorize +
        querystring.stringify({
            response_type: 'code',
            client_id: authConfig.spotifyClientId,
            scope: authConfig.spotifyScope,
            redirect_uri: authConfig.spotifyRedirectUri,
            state: state
        }));
})

routes.get('/callback', (req, res) => {

    var code = req.query.code || null;
    var state = req.query.state || null;

    var storedState = req.cookies['spotify_auth_state'] ? req.cookies['spotify_auth_state'] : null;

    if (state === null || state !== storedState) {
        res.send({
            "code": code,
            "state": state,
            "storedState": storedState
        });
    } else {

        res.clearCookie(stateKey);

        const authOptions = {
            url: authConfig.spotifyUrltoken || "",
            form: {
                code: code,
                redirect_uri: authConfig.spotifyRedirectUri,
                grant_type: 'authorization_code'
            },
            headers: {
                'Authorization': 'Basic ' + (new Buffer(authConfig.spotifyClientId + ':' + authConfig.spotifyClientSecret).toString('base64')),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            json: true
        };

        request.post(authOptions, (error, response, body) => {

            if (!error && response.statusCode === 200) {

                const access_token = body.access_token;
                const refresh_token = body.refresh_token;

                spotifyApi.setAccessToken(access_token);
                spotifyApi.setRefreshToken(refresh_token);

                if (storedState.length == 16) {
                    res.redirect(`/me`);
                } else {
                    res.redirect(`/${storedState}`);
                }

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
        url: authConfig.spotifyUrltoken || "",
        headers: { 'Authorization': 'Basic ' + (new Buffer(authConfig.spotifyClientId + ':' + authConfig.spotifyClientSecret).toString('base64')) },
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
            handleError(req, res, err)
        }
    );
})

routes.get('/me', (req, res) => {
    spotifyApi.getMe().then(
        function (data) {
            res.send(data.body);
        },
        function (err) {
            handleError(req, res, err)
        }
    );
})

routes.get('/next', (req, res) => {
    spotifyApi.skipToNext().then(
        function (data) {
            res.send(data.body);
        },
        function (err) {
            handleError(req, res, err)
        }
    );
})

routes.get('/current_playing_track', (req, res) => {

    spotifyApi.getMyCurrentPlayingTrack().then((data) => {
        res.send(data.body.item);
    }, (err) => {
        handleError(req, res, err)
    });

});

routes.get('/test', (req, res) => {

    spotifyApi.getMyCurrentPlayingTrack().then((data) => {
        res.send(data);
    }, (err) => {
        handleError(req, res, err)
    });

});

routes.get('/get_device_id', (req, res) => {

    spotifyApi.getMyDevices().then((data) => {
        res.send(data.body.devices);
    }, (err) => {
        handleError(req, res, err)
    });
})


routes.get('/current_playing', (req, res) => {
    spotifyApi.getMyCurrentPlayingTrack({})
        .then(async function (data) {
            // Output items
            const trackId = data.body.item?.id;
            // res.send(trackId);
            const trackDetails = await getTrackDetails(trackId)
            res.send(trackDetails);
        }, function (err) {
            handleError(req, res, err)
        });

});

routes.get('/current_playing/lyric', (req, res) => {
    spotifyApi.getMyCurrentPlaybackState({})
        .then(async function (data) {

            if (data.statusCode == 204) {
                res.send("Nada Sendo Reproduzido")
            } else {
                const artist = data.body.item?.artists[0].name
                const song = data.body.item?.name

                const options = {
                    apiKey: authConfig.geniusToken,
                    title: song,
                    artist: artist,
                    optimizeQuery: true
                };



                getLyric(artist, song).then(lyric => {
                    if (lyric.length > 0) {
                        res.send(`<pre>${lyric}</pre>`);
                    }
                }).catch(e => {
                    res.send(`<pre>Letra Não Encontrada</pre>`);
                });
            }
        }, function (err) {
            handleError(req, res, err)
        });

});

async function getLyric(artist: string | undefined, song: string | undefined) {


    const options = {
        apiKey: authConfig.geniusToken,
        title: song,
        artist: artist,
        optimizeQuery: false
    };

    return await getLyrics(options);
}

async function getTrackDetails(trackId: string) {
    return await spotifyApi.getTrack(trackId);
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

export default routes;
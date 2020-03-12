const routes = require('express').Router();
var Spotify = require('spotify-web-api-js');
var SpotifyWebApi = require('spotify-web-api-node');

var credentials = {
    clientId: '4647c27e51d54410b922f969fb042217',
    clientSecret: '1de47a4e505a4760bd1576353d927525',
    redirectUri: 'http://localhost:3000/callback'
}

var spotifyApi = new SpotifyWebApi({
    clientId: '4647c27e51d54410b922f969fb042217',
    clientSecret: '1de47a4e505a4760bd1576353d927525'
});

// Get an access token and 'save' it using a setter
routes.get('/login', (req, res) => {
    spotifyApi.clientCredentialsGrant().then(
        function (data) {
            res.send('The access token is ' + data.body['access_token'])
            spotifyApi.setAccessToken(data.body['access_token']);
        },
        function (err) {
            console.log('Something went wrong!', err);
        }
    );  
})

routes.get('/getArtist/:id', (req, res) => {
    spotifyApi.getArtistAlbums(req.params.id).then(
        function (data) {
            res.send( data.body)
            console.log('Artist albums', data.body);
        },
        function (err) {
            console.error(err);
        }
    );
})

routes.get('/me', (req, res) => {
    spotifyApi.getMe(req.params.id).then(
        function (data) {
            res.send( data.body)
        },
        function (err) {
            console.error(err);
        }
    );
})

module.exports = routes;
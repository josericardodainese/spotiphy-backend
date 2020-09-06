const express = require('express')
const app = express()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const routes = require('./routes');

//  Connect all our routes to our application
app.use(cors());
app.use(cookieParser());

app.use('/', routes);

// Turn on that server!
app.listen(3000, () => {
  console.log('App listening on port 3000');
});
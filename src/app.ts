import express from 'express';
const app = express()
import cors from 'cors';
import cookieParser from 'cookie-parser';
import routes from './routes';
require("dotenv").config({
  path: process.env.NODE_ENV === "development" ? ".env.dev" : ".env",
});

//  Connect all our routes to our application
app.use(cors());
app.use(cookieParser());

app.use('/', routes);

// Turn on that server!
app.listen(3001, () => {
  console.log('App listening on port 3001');
});
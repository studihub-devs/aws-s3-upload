import bodyParser from 'body-parser';
import express from 'express';
import dotenv from 'dotenv';
import { uploadRouter } from './routers/upload-file.router';

dotenv.config();

const app = express();

app.use(bodyParser.json());

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});    

app.get('/', (req, res, next) => {   
    res.send('Hello World!')
});

app.use(uploadRouter)

app.listen(5000, '0.0.0.0', () => {
    console.log(`🚀 Server ready at http://0.0.0.0:5000`);
});

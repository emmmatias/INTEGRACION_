import express from "express";
import cors from "cors";
import morgan from "morgan";
import passport from "passport";
// @ts-ignore
import dotenv from "dotenv";
import path from "path";
//import bodyParser from 'body-parser';
import https from 'https';
import fs from 'fs';

const options = {
  key: fs.readFileSync(path.join(__dirname, 'localhost.key')),
  cert: fs.readFileSync(path.join(__dirname, 'localhost.crt'))
};

dotenv.config({
  path: path.resolve(".env"),
});
const pug = require('pug')
import { AppRoutes } from "@config";
import {
  beforeCheckClientMiddleware,
  errorHandlingMiddleware,
} from "@middlewares";
import "./utils/passaport-strategy";

const port = process.env.PORT || 7200;
const app = express();


app.use(express.json());
app.set('view engine', pug)
app.set('views', path.join(__dirname, '../vistas'))
app.use(
  morgan(":method :url :status :res[content-length] - :response-time ms")
);
app.use(cors());
app.use(beforeCheckClientMiddleware);
app.use(AppRoutes);
app.use(errorHandlingMiddleware);


app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

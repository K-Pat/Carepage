const { Client } = require('pg');
var express = require('express');
var http = require('http');
var path = require("path");
var bodyParser = require('body-parser');
var helmet = require('helmet');
var rateLimit = require("express-rate-limit");

const bcrypt = require('bcrypt');
const saltRounds = 10;

var app = express();
var server = http.createServer(app);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

const connectionString = process.env.DATABASE_URL; // No need to assign, Heroku automatically sets this
/*
const client = new Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});
*/

//WORKING CLIENT ABOVE WITHOUT CONDITIONAL HEROKU MODIFICATIONS


const client = new Client({
  connectionString: connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
client.connect();

app.use(bodyParser.urlencoded({extended: false}));
app.use(express.static(path.join(__dirname,'./public')));
app.use(helmet());
app.use(limiter);

client.query('CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY, username TEXT, email TEXT UNIQUE, password TEXT)', (err, res) => {
    if(err) throw err;
});

app.get('/',(req,res) => {
  res.sendFile(path.join(__dirname,'./public/index.html'));
});

app.post('/register', async (req, res) => {
  try{
      let username = req.body.username;
      let email = req.body.email;
      let password = req.body.password;

      client.query("SELECT * FROM users WHERE email = $1", [email], async function(err, result) {
        if(err) {
          console.log(err);
          res.send("Internal server error");
          return;
        }
        if(result.rows.length > 0) {
          res.send("<div align ='center'><h2>Email already used</h2></div><br><br><div align='center'><a href='./registration.html'>Register again</a></div>");
          return;
        }

        let hashPassword = await bcrypt.hash(password, saltRounds);
        client.query('INSERT INTO users (username, email, password) VALUES ($1, $2, $3)', [username, email, hashPassword], function(err, result) {
          if(err) {
            console.log(err);
            res.send("Internal server error");
            return;
          }
          console.log('User registered: ', username, email);

          res.send("<div align ='center'><h2>Registration successful</h2></div><br><br><div align='center'><a href='./login.html'>login</a></div><br><br><div align='center'><a href='./registration.html'>Register another user</a></div>");
        });
      });
  } catch{
      res.send("Internal server error");
  }
});

app.post('/login', async (req, res) => {
  try {
    client.query('SELECT * FROM users WHERE email = $1', [req.body.email], async (err, result) => {
      if (err) {
        return res.send("Internal server error");
      }
      if (!result.rows.length) {
        return res.send("<div align ='center'><h2>Invalid email or password</h2></div><br><br><div align ='center'><a href='./login.html'>login again</a></div>");
      }

      const passwordMatch = await bcrypt.compare(req.body.password, result.rows[0].password);
      if (passwordMatch) {
        let usrname = result.rows[0].username;
        res.send(`<div align ='center'><h2>login successful</h2></div><br><br><br><div align ='center'><h3>Hello ${usrname}</h3></div><br><br><div align='center'><a href='./login.html'>logout</a></div>`);
      } else {
        res.send("<div align ='center'><h2>Invalid email or password</h2></div><br><br><div align ='center'><a href='./login.html'>login again</a></div>");
      }
    });
  } catch {
    res.send("Internal server error");
  }
});

// Remaining code with all db.* replaced with client.query or similar
// Please note that carepage table has not been defined

var port = process.env.PORT || 3000;

server.listen(port, function(){
  console.log("server is listening on port: " + port);
});
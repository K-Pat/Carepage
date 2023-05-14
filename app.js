var sqlite3 = require('sqlite3').verbose();
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

var db = new sqlite3.Database('./database/carepage.db');

app.use(bodyParser.urlencoded({extended: false}));
app.use(express.static(path.join(__dirname,'./public')));
app.use(helmet());
app.use(limiter);

db.run('CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, email TEXT UNIQUE, password TEXT)');

app.get('/',(req,res) => {
  res.sendFile(path.join(__dirname,'./public/index.html'));
});

app.post('/register', async (req, res) => {
  try{
      let username = req.body.username;
      let email = req.body.email;
      let password = req.body.password;

      db.get("SELECT * FROM users WHERE email = ?", email, async function(err, row) {
        if(err) {
          console.log(err);
          res.send("Internal server error");
          return;
        }
        if(row) {
          res.send("<div align ='center'><h2>Email already used</h2></div><br><br><div align='center'><a href='./registration.html'>Register again</a></div>");
          return;
        }

        let hashPassword = await bcrypt.hash(password, saltRounds);
        db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashPassword], function(err) {
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
    db.get('SELECT * FROM users WHERE email = ?', req.body.email, async (err, row) => {
      if (err) {
        return res.send("Internal server error");
      }
      if (!row) {
        return res.send("<div align ='center'><h2>Invalid email or password</h2></div><br><br><div align ='center'><a href='./login.html'>login again</a></div>");
      }

      const passwordMatch = await bcrypt.compare(req.body.password, row.password);
      if (passwordMatch) {
        let usrname = row.username;
        res.send(`<div align ='center'><h2>login successful</h2></div><br><br><br><div align ='center'><h3>Hello ${usrname}</h3></div><br><br><div align='center'><a href='./login.html'>logout</a></div>`);
      } else {
        res.send("<div align ='center'><h2>Invalid email or password</h2></div><br><br><div align ='center'><a href='./login.html'>login again</a></div>");
      }
    });
  } catch {
    res.send("Internal server error");
  }
});



// Add
app.post('/add', function(req,res){
  db.serialize(()=>{
    db.run('INSERT INTO carepage(name, address, city, state, zip, mobile, email, nation, fnation, mnation) VALUES(?,?,?,?,?,?,?,?,?,?)', [req.body.member1, req.body.address1, req.body.city1, req.body.state1, req.body.zip1, req.body.mobile1, req.body.email1, req.body.fnation1, req.body.mnation1], function(err) {
      if (err) {
        return console.log(err.message);
      }
      res.send("Data for " + req.body.member1+" has been added");
    });
  });
});

app.post('/add2', function(req,res){
    db.serialize(()=>{
      db.run('INSERT INTO carepage(name, address, city, state, zip, mobile, email, nation, fnation, mnation) VALUES(?,?,?,?,?,?,?,?,?,?)', [req.body.member2, req.body.address2, req.body.city2, req.body.state2, req.body.zip2, req.body.mobile2, req.body.email2, req.body.fnation2, req.body.mnation2], function(err) {
        if (err) {
          return console.log(err.message);
        }
        res.send("Data for " +req.body.member2+ " has been added");
      });
    });
  });

// View
app.post('/view', function(req,res){
  db.serialize(()=>{
    db.each('SELECT name NAME FROM carepage WHERE name =?', [req.body.member1], function(err,row){     //db.each() is only one which is funtioning while reading data from the DB
      if(err){
        res.send("Error encountered while displaying");
        return console.error(err.message);
      }
      res.send(` Name: ${row.member1}`);
      console.log("Entry displayed successfully");
    });
  });
});


//Update
app.post('/update', function(req,res){
  db.serialize(()=>{
    db.run('UPDATE emp SET name = ? WHERE id = ?', [req.body.name,req.body.id], function(err){
      if(err){
        res.send("Error encountered while updating");
        return console.error(err.message);
      }
      res.send("Entry updated successfully");
      console.log("Entry updated successfully");
    });
  });
});

// Delete
app.post('/delete', function(req,res){
  db.serialize(()=>{
    db.run('DELETE FROM emp WHERE id = ?', req.body.id, function(err) {
      if (err) {
        res.send("Error encountered while deleting");
        return console.error(err.message);
      }
      res.send("Entry deleted");
      console.log("Entry deleted");
    });
  });

});

// Closing the database connection.
app.get('/close', function(req,res){
  db.close((err) => {
    if (err) {
      res.send('There is some error in closing the database');
      return console.error(err.message);
    }
    console.log('Closing the database connection.');
    res.send('Database connection successfully closed');
  });

});

server.listen(3000, function(){
  console.log("server is listening on port: 3000");
});

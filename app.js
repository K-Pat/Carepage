var sqlite3 = require('sqlite3').verbose();
var express = require('express');
var http = require('http');
var path = require("path");
var bodyParser = require('body-parser');
var helmet = require('helmet');
var rateLimit = require("express-rate-limit");



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

db.run('CREATE TABLE IF NOT EXISTS carepage(name TEXT, address TEXT, city TEXT, state TEXT, zip TEXT, mobile TEXT, email TEXT, nation TEXT, fnation TEXT, mnation TEXT)');

app.get('/', function(req,res){
  res.sendFile(path.join(__dirname,'./public/form.html'));
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

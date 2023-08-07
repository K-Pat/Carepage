const { Client, Pool } = require('pg');
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

//table for username and passwords
client.query('CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY, username TEXT, email TEXT UNIQUE, password TEXT)', (err, res) => {
    if(err) throw err;
});

//table for session
client.query(`
    CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
    ) WITH (OIDS=FALSE);
`, (err, res) => {
    if (err) throw err;
    console.log("Session table is set up!");
});
/*
client.query('ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid")', (err, res) => {
  if(err) throw err;
  console.log("Session table altered successfully");
});
*/
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

app.use(session({
    store: new pgSession({
        conString: connectionString,
        tableName: 'session'
    }),
    secret: 'aVerySecretKey',  // Change this to a strong secret in production
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }  // 30 days
}));

//table for user details on homepage
client.query('CREATE TABLE IF NOT EXISTS userDetails(userId INTEGER REFERENCES users(id), name TEXT, birthday DATE, address TEXT, phone TEXT)', (err, res) => {
  if(err) throw err;
});

//client.query('ALTER TABLE userDetails ADD CONSTRAINT unique_userid UNIQUE (userid);');

/*
const setupDatabase = async () => {
  const client = new Pool({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });
  await client.connect();

  // Add a unique constraint on userid
  await client.query('ALTER TABLE userDetails ADD CONSTRAINT unique_userid UNIQUE (userid);');

  await client.end();
}

setupDatabase().then(() => {
  console.log("Database setup complete");
}).catch((err) => {
  console.error("Error setting up the database:", err);
});
*/
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
        // Inside the successful login section:
        req.session.userId = result.rows[0].id;  // Store user ID in session
        res.redirect(`/homepage.html?username=${usrname}`);

      } else {
        res.send("<div align ='center'><h2>Invalid email or password</h2></div><br><br><div align ='center'><a href='./login.html'>login again</a></div>");
      }
    });
  } catch {
    res.send("Internal server error");
  }
});


function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
}
  return res.status(401).send('Unauthorized');
}
/*
app.post('/updateDetails', ensureAuthenticated, async (req, res) => {
  const { name, birthday, address, phone } = req.body;
  const userId = req.session.userId;  // Retrieve user ID from session
  
  if (!userId) {
    return res.send("User not logged in");
  }
  
  client.query('INSERT INTO userDetails(userId, name, birthday, address, phone) VALUES ($1, $2, $3, $4, $5) ON CONFLICT(userId) DO UPDATE SET name = $2, birthday = $3, address = $4, phone = $5', [userId, name, birthday, address, phone], (err, result) => {
    if (err) {
      console.log(err);
      return res.send("Internal server error");
    }
    return res.send("Details updated successfully!");
  });

const values = [req.session.userId, req.body.name, req.body.birthday, req.body.address, req.body.phone];

try {
  res.redirect('/homepage.html');
} catch (err) {
  console.error('Error updating details:', err);
  res.status(500).send('Internal Server Error');
}

});
*/

app.post('/updateDetails', ensureAuthenticated, async (req, res) => {
  const { name, birthday, address, phone } = req.body;
  const userId = req.session.userId;  // Retrieve user ID from session
  
  if (!userId) {
    return res.send("User not logged in");
  }
  
  client.query('INSERT INTO userDetails(userId, name, birthday, address, phone) VALUES ($1, $2, $3, $4, $5) ON CONFLICT(userId) DO UPDATE SET name = $2, birthday = $3, address = $4, phone = $5', [userId, name, birthday, address, phone], (err, result) => {
    if (err) {
      console.log(err);
      return res.json({ success: false });
  }
  
  res.json({ success: true });
  });
});

app.get('/viewDetails', ensureAuthenticated, async (req, res) => {
  const userId = req.session.userId;
  
  if (!userId) {
      return res.send('User not logged in');
  }

  try {
      const result = await client.query('SELECT name, birthday, address, phone FROM userDetails WHERE userId = $1', [userId]);
      if (result.rows.length === 0) {
          return res.send('No details available for this user.');
      }
      
      const userDetail = result.rows[0];
      // Here, you can render a template or send the data as JSON to be rendered on the client side.
      // For simplicity, I'll send the data as plain text.
      return res.send(`
          Name: ${userDetail.name} <br>
          Birthday: ${userDetail.birthday} <br>
          Address: ${userDetail.address} <br>
          Phone: ${userDetail.phone}
      `);
  } catch (err) {
      console.error('Error fetching details:', err);
      return res.status(500).send('Internal Server Error');
  }
});


var port = process.env.PORT || 3000;

server.listen(port, function(){
  console.log("server is listening on port: " + port);
});
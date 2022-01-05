// https://obscure-wave-43713.herokuapp.com/
function log() {
  console.log(...arguments);
}
// Load environment variables into process.env.
require('dotenv').config();

const express = require('express'),
  app = express(),
  // enable CORS (https://en.wikipedia.org/wiki/Cross-origin_resource_sharing)
  // so that your API is remotely testable by FCC
  cors = require('cors'),
  mongodb = require('mongodb'),
  mongoose = require('mongoose'),
  bodyParser = require('body-parser'),
  urlencodedParser = bodyParser.urlencoded({ extended: false }),
  port = process.env.PORT || 3000;

// 📄 mongoose.connect(uri, { useNewUrlParser: true }) is the MINIMUM required to connect, but to work with future versions of mongoose (where Server Discovery and Monitoring engine are deprecated), we also pass the useUnifiedTopology key with a true value.
mongoose
  .connect(process.env.MONGO_URI, {
    // ⚠️ ADD YOUR URI TO A ROOT .ENV FILE
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => log('🍃 first-cluster db connected!'))
  .catch(err => log('❌ first-cluster db connection error: ' + err));

// 📄 Express evaluates functions in the order they appear in the code. This is true for middleware too. If you want it to work for all the routes, it should be mounted before them.

app.use(cors({ optionsSuccessStatus: 200 })); // some legacy browsers choke on 204

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// A root-level action logging middleware. Calling next() prevents server from pausing on requests.
app.use((req, res, next) => {
  const { method, path, ip } = req;
  log(`${method} ${path} - ${ip}`);
  next();
});

// File responses.
// http://expressjs.com/en/starter/basic-routing.html
app.get('/', (req, res) => res.sendFile(__dirname + '/views/index.html'));
app.get('/timestamp', (req, res) =>
  res.sendFile(__dirname + '/views/timestamp.html')
);
app.get('/header-parser', (req, res) =>
  res.sendFile(__dirname + '/views/header-parser.html')
);
app.get('/url-shortener', (req, res) =>
  res.sendFile(__dirname + '/views/url-shortener.html')
);
app.get('/exercise-tracker', (req, res) =>
  res.sendFile(__dirname + '/views/exercise-tracker.html')
);
app.get('/file-metadata', (req, res) =>
  res.sendFile(__dirname + '/views/file-metadata.html')
);

// 1. Timestamp.
app.get('/api', (req, res) => {
  const date = new Date();
  res.json({
    unix: date.valueOf(),
    utc: date.toUTCString(),
  });
});

// 2. Request Header Parser.
app.get('/api/whoami', (req, res) => {
  // Still need to find ipaddress key.
  res.json({
    ipaddress: req.socket.remoteAddress,
    language: req.headers['accept-language'],
    software: req.headers['user-agent'],
  });
});

// 1. Timestamp.
app.get('/api/:date', (req, res) => {
  const routeParam = req.params.date,
    date = new Date(isNaN(+routeParam) ? routeParam : +routeParam);
  res.json(
    date.toUTCString() === 'Invalid Date'
      ? { error: 'Invalid Date' }
      : { unix: date.valueOf(), utc: date.toUTCString() }
  );
});

// 3. URL Shortener.
app.get('/api/shorturl/:url', (req, res) => {
  const url = req.params.url;
  res.json({
    url: url,
  });
});

// 3. URL Shortener.
// It is recommended to add parsers specifically to the routes that need them, rather than on root level with app.use().
app.post('/api/shorturl', urlencodedParser, (req, res) => {
  const { url: original_url } = req.body;
  res.json({
    original_url: original_url,
    short_url: 'TBD',
  });
});

const listener = app.listen(port, () =>
  log('Your app is listening on port ' + port)
);

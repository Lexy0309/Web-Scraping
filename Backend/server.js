const express = require('express');
const bodyParser = require('body-parser');
const app = express();
var server = require('http').createServer(app);

var io = require('socket.io')(server);
io.on('connection', function(client) {
    console.log('Client connected...');
    // client.on('join', function(data) {
    //     console.log(data);
    //     client.emit('messages', 'Hello from server');
    // });
});

const ScrappingModule = require('./scrapping');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.post('/retrieve-matches-with-daterange', (req, res, next) => {
    const { startDate, endDate } = req.body;
    let unit = Math.max(1, parseInt(req.body.unit));
    ScrappingModule.getMatchesFromDateRange(startDate, endDate, unit, io.sockets);
    res.json({ state: 'socket-will-response' });
})

app.post('/retrieve-boxscore-with-ids', (req, res, next) => {
    const { arrIDs } = req.body;
    ScrappingModule.getBoxscoreFromIDs(arrIDs, io.sockets);
    res.json({ state: 'socket-will-response' });
})

server.listen(3030, function() {
    console.log("Scrapping Backend Server is listening at port %s", 3030)
});

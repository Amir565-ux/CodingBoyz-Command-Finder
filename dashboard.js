require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const METHODS_FILE = path.join(__dirname, 'methods.json');

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

// Simple Session Handling
app.use((req, res, next) => {
    req.session = req.session || {};
    next();
});

app.get('/', (req, res) => {
    if (req.session.loggedIn) return res.redirect('/panel');
    res.render('dashboard', { error: null, loggedIn: false, methods: {} });
});

app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.DASHBOARD_SECRET) {
        req.session.loggedIn = true;
        return res.redirect('/panel');
    }
    res.render('dashboard', { error: 'Invalid Password', loggedIn: false, methods: {} });
});

app.get('/panel', (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/');
    const methods = JSON.parse(fs.readFileSync(METHODS_FILE, 'utf8') || '{}');
    res.render('dashboard', { error: null, loggedIn: true, methods });
});

app.post('/add-method', (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/');
    const { name, summary } = req.body;
    const methods = JSON.parse(fs.readFileSync(METHODS_FILE, 'utf8') || '{}');
    methods[name.toLowerCase()] = summary;
    fs.writeFileSync(METHODS_FILE, JSON.stringify(methods, null, 2));
    res.redirect('/panel');
});

app.post('/delete-method', (req, res) => {
    if (!req.session.loggedIn) return res.redirect('/');
    const { name } = req.body;
    const methods = JSON.parse(fs.readFileSync(METHODS_FILE, 'utf8') || '{}');
    delete methods[name.toLowerCase()];
    fs.writeFileSync(METHODS_FILE, JSON.stringify(methods, null, 2));
    res.redirect('/panel');
});

app.get('/logout', (req, res) => {
    req.session.loggedIn = false;
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`Dashboard running on http://localhost:${PORT}`);
});

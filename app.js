const express = require("express");
const upload = require("./upload.js");
const fs = require("fs");
const morgan = require("morgan");
const OpenAI= require("openai");
const mongoose = require("mongoose");
const Transcription = require("./models/transcription.js");
const User = require("./models/users.js");
const bcrypt = require("bcrypt");
const session = require("express-session");
const store = new session.MemoryStore;

// express app

const app = express();

// express session

app.use(session({
    secret: 'something-secret',
    cookie: {maxAge: 1000 * 60 * 60 * 24 * 365 * 10},
    saveUninitialized: false,
    store: store
}))

// create openai client

const openai = new OpenAI();

// register view engine

app.set('view engine', 'ejs');

// get filename

let filename;
let transcription = 'No transcription yet';
let errorMessage;

function checkUser(req, res) {
    if (!req.session.authenticated) {
        res.redirect('signin');
    }
}

function getFileName(req, res, next) {

    if (req.session.authenticated) {
        fs.readdir('./data', (err, files) => {
            if (err) {
                console.error(err);
            }
            filename = './data/' + files[0];
            req.session.currentUser.sessionFile=files[0];
            console.log(req.session.currentUser.sessionFile)
            next();
        });
    }else{
        next();
    }
}

function deleteFile(req, res, next) {
    fs.unlink(filename, (err) => {
        if (err) {
            console.error(err);
        }
        console.log(filename.split('/')[2] + ' was deleted');
      }); 

      next();
}

const transcribe = async (filename) => {
    const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filename),
        model: "whisper-1"
    })

    return transcription.text;
};

// connect to mongodb

const dbURI='mongodb+srv://viniciusrabello:F2b60dYiPDRjZYfP@sst-website.oagvayr.mongodb.net/sst-website-db';
const port = 3000;

mongoose.connect(dbURI)
    .then((result) => app.listen(port))
    .catch((err) => console.log(err));

app.use(morgan('dev'));
app.use(express.urlencoded({extended: true}));
app.use(getFileName);

app.post('/transcribe', async (req, res, next) => {
    try {
        transcription = await transcribe(filename);
    } catch (error) {
        transcription=error
        next(error);
    }

    const transc = new Transcription({
        filename: filename.split('/')[2].split('.')[0],
        transcription: transcription,
        username: user
    });

    req.session.currentUser.sessionTranscription = transcription;

    transc.save()
        .then((result) => {
            res.send(result);
        })
        .catch((err) => {
            console.log(err);
        })

    res.redirect('/');
});

app.get('/history', (req, res) => {

    checkUser(req,res);
    let username = req.session.currentUser.name;

    Transcription.find({username:username})
        .then((history) => res.render('history',{ history, user:username }))
        .catch((err) => console.log(err));
});

app.get('/', (req, res) => {
    checkUser(req,res);
    res.render('index', {filename:filename, transcription:req.session.currentUser.sessionTranscription, user:user});
});

app.post('/upload', deleteFile);

app.post('/upload', upload.single('file'), (req, res) => {
    console.log(req.body);
    console.log('file uploaded succesfully!');
    res.redirect('/');
});

app.get('/download', (req, res) => {
    checkUser(req,res);
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=${filename.split('/')[2].split('.')[0]}.txt`);
    res.send(transcription);
});

app.get('/download/:id', (req,res) => {
    checkUser(req,res);
    const id = req.params.id;
    Transcription.findById(id)
        .then((result) => {
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', `attachment; filename=${result.filename}.txt`);
            res.send(result.transcription);
        })
        .catch((err) => {
            console.log(err);
        });
});

app.get('/download', (req, res, next) => {
    checkUser(req,res);
    textFileName=filename.split('/')[2].split('.')[0]+'.txt';
    res.download('./transcriptions/'+ textFileName);
});

app.get('/signin', (req, res) => {
    errorMessage=undefined;
    res.render('signin',{ loginFailed: loginFailed });
})

let loginFailed;

app.post('/signin', (req,res) => {
    console.log(req.body);

    const email = req.body.email;
    const password = req.body.password;

    User.find({email: email})
        .then((data) => {
            if (data) {
                const hashedPassword = data[0].password;
                bcrypt.compare(password, hashedPassword)
                    .then((result) => {
                        if (result) {
                            console.log('sign in succesful')
                            user=data[0].username;
                            loginFailed=undefined;

                            req.session.authenticated=true;
                            req.session.currentUser={
                                name:user,
                                sessionTranscription: 'No transcription yet.'
                            }

                            res.redirect('/');
                        }else{
                            loginFailed='Incorrect e-mail or password.';
                            res.redirect('signin');
                        }
                    })
                    .catch((err) => {
                        console.log(err);
                    })}
            })
        .catch((err) => {
            loginFailed='Incorrect e-mail or password.';
            console.log(err);
            res.redirect('signin')
        })
})

app.get('/signup', (req, res) => {
    res.render('signup', {errorMessage: errorMessage});
})

app.post('/signup', (req,res) => {
    console.log(req.body);

    const username = req.body.username;
    const email = req.body.email;
    const password = req.body.password;
    const confirm_password = req.body.confirm_password;

    if (!/^[a-zA-Z ]*$/.test(username)) {
        res.redirect('/signup');
        errorMessage='Please just use letters for the username.'
        console.log(errorMessage);
    }else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
        res.redirect('/signup');
        errorMessage='Please enter a valid e-mail.'
        console.log(errorMessage);
    }else if (password.length < 8){
        res.redirect('/signup');
        errorMessage='Password must be at least 8 characters long.'
        console.log(errorMessage);
    }else if (password != confirm_password){
        res.redirect('/signup');
        errorMessage='Passwords do not match.'
        console.log(errorMessage);
    }else{
        User.find({email: email})
            .then((result) => {
                if (result.length) {
                    res.redirect('/signup');
                    errorMessage='User already exists.'
                    console.log(errorMessage);
                }else{
                // try to create user

                // password handling
                const saltRounds = 10;
                bcrypt.hash(password, saltRounds)
                    .then((hashedPassword) => {
                        const user = new User({
                            username: username,
                            email: email,
                            password: hashedPassword
                        });

                        user.save()
                            .then((result) => {
                                res.send(result);
                            })
                            .catch((err) => {
                                console.log(err);
                            })

                        errorMessage=undefined;
                    })
                    .catch((err) => {
                        console.log(err);
                    })
                }
            })
            .catch((err) => {
                console.log(err);
                res.json({
                    status: 'FAILED',
                    message: 'An error ocurred when checking for existing user.'
                });
            })
    }
})

app.get('/signout',(req,res) => {
    user = undefined;
    res.redirect('signin')
})

app.use((req, res) => {
    res.render('404');
});
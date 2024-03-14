const multer = require("multer");

// set up storage for uploaded files

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null,'data/');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

// create the multer instance

const upload = multer({ storage:storage });

module.exports = upload;
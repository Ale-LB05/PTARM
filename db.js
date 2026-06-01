const mysql = require('mysql2');
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'partesdetransito_local'
});
connection.connect(err => {
    if (err) console.error('Error MySQL:', err);
    else console.log('Conectado a MySQL');
});
module.exports = connection;
module.exports.conn = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'secret',
  database: 'sys',
  charset: 'UTF8_UNICODE_CI',
  supportBigNumbers: true,
  decimalNumbers: true,
  connectionLimit: 40
};

module.exports.createTable = async function (db, name) {
  await db.query('DROP TABLE IF EXISTS ' + name);
  await db.query(`
    CREATE TABLE \`` + name + `\` (
      \`id\` int(10) unsigned NOT NULL AUTO_INCREMENT,
      \`name\` varchar(16) NOT NULL,
      \`code\` smallint(4) unsigned NOT NULL,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci
  `);
}

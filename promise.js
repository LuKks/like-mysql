let globalInsertId = 0;

let db = {
	insertId: 0
};

function executeBase () {
	return new Promise(resolve => {
		setTimeout(() => {
			globalInsertId++;

			setImmediate(() => {
				console.log('immediate', globalInsertId, db.insertId);
			});

			process.nextTick(() => {
				console.log('nextTick', globalInsertId, db.insertId);
				db.insertId = 99;
			});

			resolve({ insertId: globalInsertId });
		}, 10);
	});
}

function executeWrap () {
	return executeBase().then(res => {
		db.insertId = res.insertId;
		return res;
	});
}

db.insert = function () {
	return executeWrap().then(res => {
		return res;
	});
}

async function main () {
	console.log('========================================');
	console.log('bef', db.insertId);

	for (let i = 0; i < 50; i += 2) {
		(async function () {
			// let record = await db.insert();
			// console.log((i + 1) + ' == ' + (i + 1), record, db.insertId);

			db.insert().then((record) => console.log((i + 1) + ' == ' + (i + 1), record, db.insertId));
			db.insert().then((record) => console.log((i + 2) + ' == ' + (i + 2), record, db.insertId));
		})();
	}
}

main();

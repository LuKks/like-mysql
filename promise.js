let db = {
	ai: 0
};

db.insert = function () {
	return new Promise(resolve => {
		setTimeout(() => {
			this.ai++;

			let res = {
				ai: this.ai
			};

			resolve(res);
		}, 200);
	});
}

async function main () {
	console.log('bef', db.ai);
	db.insert().then(res => console.log('1st (should be 1)', res, db.ai));
	db.insert().then(res => console.log('2nd (should be 2)', res, db.ai));
}

main();

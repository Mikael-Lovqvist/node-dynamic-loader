import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createHash } from 'crypto';
import net from 'net';


function sha256_hex(input) {
	return createHash('sha256').update(input).digest('hex');
}


let server_socket;
const code_queue = [];
const code_seen = new Set();

const server = net.createServer((socket) => {
	socket.on('data', (chunk) => {
		const url = JSON.parse(chunk.toString());
		const pending_code = code_queue.shift();
		socket.write(JSON.stringify(pending_code) + '\n');
		server_socket = socket;
	});
});


async function dynamic_import(code) {
	const checksum = sha256_hex(code);
	if (!code_seen.has(checksum)) {	// Only push to queue if it is a new checksum
		code_queue.push(code);
	}

	return await import(`data://top.mjs?hash=${checksum}`);
}


server.listen(0, '127.0.0.1', async () => {
	const port = server.address().port;
	process.env.CODE_SOURCE_PORT = port;

	register('./hosted-loader.mjs', import.meta.url);


	const s1 = await dynamic_import(`
		import { hello } from './t1-b.mjs';
		console.log('First we will greet:', hello);
	`);

	const s2 = await dynamic_import(`
		import { hello } from './t1-b.mjs';
		console.log("Before second greet, let's check out top level await - sleep 1 sec");

		await new Promise(resolve => setTimeout(resolve, 1000));
		console.log('Secondly we will greet:', hello);

	`);

	server_socket.write('shutdown\n');
	server.close();

});

/* OUTPUT

Loaded module t1-b.mjs
First we will greet: world
Before second greet, let's check out top level await - sleep 1 sec
Secondly we will greet: world
Shutdown loader

*/
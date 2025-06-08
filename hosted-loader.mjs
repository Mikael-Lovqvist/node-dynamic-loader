import net from 'net';

import { pathToFileURL } from 'url';
import { resolve as path_resolve } from 'path';



const PREFIX = 'data://top.mjs';

export async function resolve(specifier, context, nextResolve) {
	//console.log("RESOLVE", specifier, context);

	if (context.parentURL.startsWith(PREFIX)) {
		return {
			url: pathToFileURL(path_resolve(specifier)).href,
			format: 'module',
			shortCircuit: true
		};
	}

	if (specifier.startsWith(PREFIX)) {
		return {
			url: specifier,
			format: 'module',
			shortCircuit: true
		};
	}
	return nextResolve(specifier, context, nextResolve);
}


let client;
let inflight = null;

function ensureConnection() {
	if (!client) {
		client = net.connect(process.env.CODE_SOURCE_PORT, '127.0.0.1');
		let buffer = '';

		client.on('data', (chunk) => {
			buffer += chunk.toString();
			let newlineIndex;
			while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
				const line = buffer.slice(0, newlineIndex);
				buffer = buffer.slice(newlineIndex + 1);
				try {
					if (line === 'shutdown') {
						console.log("Shutdown loader");
						client.end();
						return;
					}
					const msg = JSON.parse(line);
					if (inflight) {
						inflight.resolve(msg);
						inflight = null;
					}
				} catch (err) {
					if (inflight) {
						inflight.reject(err);
						inflight = null;
					}
				}
			}
		});

		client.on('error', (err) => {
			if (inflight) {
				inflight.reject(err);
				inflight = null;
			}
		});
	}
}

export async function load(url, context, nextLoad) {

	if (!url.startsWith(PREFIX)) {
		return nextLoad(url, context, nextLoad);
	}

	ensureConnection();

	const source = await new Promise((resolve, reject) => {
		inflight = { resolve, reject };
		client.write(JSON.stringify(url) + '\n');
	});

	return {
		format: 'module',
		source,
		shortCircuit: true,
	};
}

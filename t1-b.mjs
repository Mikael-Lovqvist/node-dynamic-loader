export const hello = 'world';
console.log("Loaded module t1-b.mjs - now sleeping 1 sec");
await new Promise(resolve => setTimeout(resolve, 1000));

